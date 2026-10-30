// Game session: one run across all levels (score, HP and weapons persist between levels).
import {
  GAME_SCALE, PLAY_H, PLAY_W, PLAYER_BASE_SPEED, PLAYER_HITBOX, PLAYER_INVULN, PLAYER_MAX_HP,
} from '../config';
import { KEYS, type InputState } from '../core/input';
import { Rng, clamp, dist2 } from '../core/math';
import { CARRIER_HP, ENEMY_STATS, type EnemyKind } from '../data/enemies';
import { LEVELS, type LevelDef } from '../data/levels';
import { WEAPONS, WEAPON_TYPES, type WeaponType } from '../data/weapons';
import { bossHit, createBoss, updateBoss, type BossContext } from './boss';
import { isOffscreen, updateEnemy, type FireOpts } from './enemyAI';
import { WeaponInventory, type Sacrifice } from './inventory';
import { addScore, levelBonus, pointsFor } from './score';
import { expandWaves, type SpawnEvent } from './spawner';
import {
  Pool, makeBullet, makeParticle, type Boss, type Bullet, type BulletStyle, type Enemy, type EnemyId,
  type FloatText, type Particle, type ParticleKind, type Pickup, type Salvo, type Target,
} from './types';
import {
  baseShot, laserStats, missileStats, orbitalStats, pinkStats, salvoDamage, sideShots, violetBurst,
} from './weaponStats';

/** Shorthand for the entity scale. */
const S = GAME_SCALE;

export type Phase = 'intro' | 'waves' | 'warning' | 'boss' | 'bossDying' | 'clear' | 'rescue' | 'dying';
export type WorldEvent = 'gameover' | 'victory';

export interface DebugOptions {
  startLevel?: number;
  god?: boolean;
  weapons?: WeaponType[];
  /** Extra weapon slots granted at start (dev aid, capped by MAX_SLOTS). */
  slots?: number;
  /** Skip the waves and go straight to the boss warning. */
  boss?: boolean;
}

export interface Player {
  x: number;
  y: number;
  hp: number;
  invuln: number;
  fireT: number;
  violetT: number;
  missileT: number;
  missileSide: number;
  /** Green level 5 charge shot timer, blue level 5 heavy missile timer, pink graze cooldown. */
  chargeT: number;
  heavyT: number;
  grazeCd: number;
  dead: boolean;
  moving: number;
  firing: boolean;
}

/** One red beam. Red level n = n beams. */
export interface Beam {
  /** Locked target; kept until it dies or fire is released. null = beam goes straight up. */
  target: Target | null;
  /** Width and damage per second of this beam; the main beam (red level 5+) is wider and stronger. */
  w: number;
  dps: number;
  main: boolean;
  /** Chain lightning (red level 3+): second enemy hit by this beam, when `chain` is true. */
  chain: boolean;
  cx: number;
  cy: number;
  /** Beam origin (ship nose + horizontal offset) and end point, updated every step. */
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

export interface Laser {
  active: boolean;
  /** Width of each beam. */
  width: number;
  beams: Beam[];
}

export class World {
  readonly rng: Rng;
  readonly inventory = new WeaponInventory();
  readonly player: Player = {
    x: PLAY_W / 2, y: PLAY_H - 90 * S, hp: PLAYER_MAX_HP, invuln: 0, fireT: 0, violetT: 0, missileT: 0,
    missileSide: 1, chargeT: 0, heavyT: 0, grazeCd: 0, dead: false, moving: 0, firing: false,
  };
  readonly pShots = new Pool<Bullet>(1500, makeBullet);
  readonly eShots = new Pool<Bullet>(900, makeBullet);
  readonly particles = new Pool<Particle>(1200, makeParticle);
  enemies: Enemy[] = [];
  pickups: Pickup[] = [];
  texts: FloatText[] = [];
  salvos: Salvo[] = [];
  boss: Boss | null = null;
  laser: Laser = { active: false, width: 0, beams: [] };
  /** Pink level 2+: recent ship positions that hurt enemies they touch. */
  trail: { x: number; y: number; t: number }[] = [];
  private trailT = 0;
  /** Violet level 5+: orbiting shield. */
  orbitAngle = 0;
  orbitCd: number[] = [];
  events: WorldEvent[] = [];

  levelIndex = 0;
  level: LevelDef = LEVELS[0];
  phase: Phase = 'intro';
  phaseT = 0;
  levelTime = 0;
  score = 0;
  lastBonus = 0;
  shake = 0;
  time = 0;
  /** Dog position during the rescue sequence. */
  dog = { x: 0, y: 0 };

  private spawnQueue: SpawnEvent[] = [];
  private lastSpawnTime = 0;
  private readonly god: boolean;
  private readonly ctx: BossContext;

  constructor(seed = Date.now(), debug: DebugOptions = {}) {
    this.rng = new Rng(seed);
    this.god = debug.god ?? false;
    for (let i = 0; i < (debug.slots ?? 0); i++) this.inventory.addSlot();
    for (const w of debug.weapons ?? []) this.inventory.add(w);
    this.ctx = {
      px: 0, py: 0, difficulty: 1, rng: this.rng,
      fire: (style, x, y, a, s, o) => this.fireEnemy(style, x, y, a, s, o),
      attract: (x, y, strength) => this.attract(x, y, strength),
      boom: (x, y, big) => this.explode(x, y, (big ? 40 : 20) * S, false),
      spawnMinion: (kind, x, y) => this.spawnEnemy(kind, x, y, 0),
    };
    this.startLevel(clamp(debug.startLevel ?? 0, 0, LEVELS.length - 1));
    if (debug.boss) {
      this.spawnQueue = [];
      this.setPhase('warning');
    }
  }

  get isLastLevel(): boolean {
    return this.levelIndex === LEVELS.length - 1;
  }

  startLevel(i: number): void {
    this.levelIndex = i;
    this.level = LEVELS[i];
    this.spawnQueue = expandWaves(this.level.waves, this.rng);
    this.lastSpawnTime = this.spawnQueue.length ? this.spawnQueue[this.spawnQueue.length - 1].time : 0;
    this.levelTime = 0;
    this.enemies = [];
    this.pickups = [];
    this.boss = null;
    this.eShots.clear();
    this.setPhase('intro');
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  // ---------------------------------------------------------------- update

  update(dt: number, input: InputState): void {
    this.time += dt;
    this.phaseT += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    this.ctx.px = this.player.x;
    this.ctx.py = this.player.y;
    this.ctx.difficulty = this.level.difficulty;

    this.updatePhase(dt);
    if (!this.player.dead) this.updatePlayer(dt, input);
    else {
      this.laser.active = false;
      this.laser.beams = [];
    }
    this.updateEnemies(dt);
    if (this.boss) this.updateBossState(dt);
    this.updateBullets(dt);
    this.collide(dt);
    this.updatePickups(dt);
    this.updateEffects(dt);
    this.player.x = clamp(this.player.x, 24 * S, PLAY_W - 24 * S);
    this.player.y = clamp(this.player.y, 40 * S, PLAY_H - 30 * S);
  }

  private updatePhase(dt: number): void {
    switch (this.phase) {
      case 'intro':
        if (this.phaseT > 2.5) this.setPhase('waves');
        break;
      case 'waves': {
        this.levelTime += dt;
        while (this.spawnQueue.length && this.spawnQueue[0].time <= this.levelTime) {
          const s = this.spawnQueue.shift();
          if (s) this.spawnEnemy(s.kind, s.x, s.y, s.side, s.weapon);
        }
        const airLeft = this.enemies.some((e) => !e.ground);
        if (!this.spawnQueue.length && (!airLeft || this.levelTime > this.lastSpawnTime + 9)) this.setPhase('warning');
        break;
      }
      case 'warning':
        if (this.phaseT > 2.6) {
          this.boss = createBoss(this.level.boss, this.levelIndex);
          this.setPhase('boss');
        }
        break;
      case 'boss':
        break;
      case 'bossDying':
        if (this.boss && this.phaseT < 2.4 && this.rng.chance(0.35)) {
          const b = this.boss;
          this.explode(b.x + this.rng.range(-b.halfW, b.halfW), b.y + this.rng.range(-b.halfH, b.halfH), 34 * S, true);
          this.shake = 0.3;
        }
        if (this.phaseT > 2.6) this.finishBoss();
        break;
      case 'clear':
        if (this.phaseT > 4.5) this.startLevel(this.levelIndex + 1);
        break;
      case 'rescue':
        this.dog.x += (this.player.x - this.dog.x) * Math.min(1, dt * 1.5);
        this.dog.y += (this.player.y - 50 - this.dog.y) * Math.min(1, dt * 1.5);
        if (this.phaseT > 4) this.emit('victory');
        break;
      case 'dying':
        if (this.phaseT > 2.6) this.emit('gameover');
        break;
    }
  }

  private emit(e: WorldEvent): void {
    if (!this.events.includes(e)) this.events.push(e);
  }

  private finishBoss(): void {
    const b = this.boss;
    if (!b) return;
    this.score = addScore(this.score, b.def.points);
    this.addText(String(b.def.points), b.x, b.y, '#ffffff', true, 3 * S);
    this.explode(b.x, b.y, 90 * S, true);
    this.boss = null;
    this.eShots.clear();
    this.lastBonus = levelBonus(this.levelIndex + 1, this.player.hp);
    this.score = addScore(this.score, this.lastBonus);
    if (b.def.holdsDog) {
      this.dog = { x: b.x, y: b.y + b.halfH };
      this.setPhase('rescue');
      return;
    }
    this.pickups.push({ kind: 'heart', weapon: null, x: b.x - 30 * S, y: b.y, t: 0 });
    this.pickups.push({ kind: 'slot', weapon: null, x: b.x + 30 * S, y: b.y, t: 0 });
    this.setPhase('clear');
  }

  // ---------------------------------------------------------------- player

  private updatePlayer(dt: number, input: InputState): void {
    const p = this.player;
    if (p.invuln > 0) p.invuln -= dt;
    const lv = (t: WeaponType): number => this.inventory.level(t);
    const pink = pinkStats(lv('pink'));
    const speed = PLAYER_BASE_SPEED * (pink?.speed ?? 1);
    if (p.grazeCd > 0) p.grazeCd -= dt;
    let dx = 0;
    let dy = 0;
    if (input.isDown(KEYS.left)) dx -= 1;
    if (input.isDown(KEYS.right)) dx += 1;
    if (input.isDown(KEYS.up)) dy -= 1;
    if (input.isDown(KEYS.down)) dy += 1;
    if (dx !== 0 && dy !== 0) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    p.x += dx * speed * dt;
    p.y += dy * speed * dt;
    p.moving = dx;
    this.updateTrail(dt, dx !== 0 || dy !== 0, pink !== null && pink.trailDps > 0);
    this.updateOrbitals(dt);

    const canAct = this.phase !== 'rescue';
    if (canAct && input.wasPressed(...KEYS.sacrifice)) {
      const s = this.inventory.sacrificeLatest();
      if (s) this.triggerSalvo(s);
    }

    const firing = canAct && input.isDown(KEYS.fire);
    p.firing = firing;
    const laser = laserStats(lv('red'));
    this.laser.active = firing && laser !== null;
    this.laser.width = laser?.width ?? 0;
    // Releasing fire (or losing the red weapon) breaks every lock. Beam count comes from the red level.
    if (!this.laser.active || !laser) this.laser.beams = [];
    else {
      const n = laser.beams;
      while (this.laser.beams.length < n) {
        this.laser.beams.push({
          target: null, w: laser.width, dps: laser.dps, main: false, chain: false, cx: 0, cy: 0, sx: p.x, sy: p.y, tx: p.x, ty: 0,
        });
      }
      this.laser.beams.length = n;
    }
    if (!firing) {
      p.fireT = Math.max(0, p.fireT - dt);
      return;
    }

    const gun = baseShot(lv('green'));
    p.fireT -= dt;
    if (gun.charge) {
      // Green level 5: a heavy exploding shot every so often, straight ahead.
      p.chargeT -= dt;
      if (p.chargeT <= 0) {
        p.chargeT += gun.charge.interval;
        const c = gun.charge;
        const bl = this.firePlayer('charge', p.x, p.y - 30 * S, -Math.PI / 2, 560, c.damage, c.radius, c.scale);
        if (bl) { bl.tier = 5; bl.blast = c.blast; bl.blastDmg = c.damage * 0.6; }
      }
    }
    if (p.fireT <= 0) {
      p.fireT += gun.interval;
      if (p.fireT < 0) p.fireT = 0;
      for (let i = 0; i < gun.count; i++) {
        const a = -Math.PI / 2 + (i - (gun.count - 1) / 2) * gun.spread;
        const off = (i - (gun.count - 1) / 2) * 7 * S;
        const bl = this.firePlayer('shot', p.x + off, p.y - 26 * S, a, gun.speed, gun.damage, gun.radius, gun.scale);
        if (bl) { bl.tier = gun.tier; bl.pierce = gun.pierce; }
          if (gun.particle > 0) {
            // Green level 4: a small particle rides along each shot for a fraction of its damage.
            const pt = this.firePlayer('shot', p.x + off + 6 * S, p.y - 20 * S, a, gun.speed, gun.damage * gun.particle, gun.radius * 0.6, gun.scale * 0.55);
            if (pt) pt.pierce = gun.pierce;
          }
      }
      // Yellow side shots follow the vertical arrows: up = -45 deg, none = horizontal, down = +45 deg.
      const vertical = (input.isDown(KEYS.down) ? 1 : 0) - (input.isDown(KEYS.up) ? 1 : 0);
      const side = sideShots(lv('yellow'), vertical);
      if (side) {
        const fireSide = (a: number, speed: number, y: number): void => {
          const bl = this.firePlayer('side', p.x, y, a, speed, side.damage, side.radius, side.scale);
          if (!bl) return;
          bl.tier = side.tier;
          bl.pierce = side.pierce;
          if (side.boomerang > 0) { bl.turnAt = side.boomerang; bl.life = 3.5; }
        };
        for (const a of side.angles) fireSide(a, side.speed, p.y - 6 * S);
        if (side.rear) fireSide(Math.PI / 2, side.speed * 0.85, p.y + 8 * S);
      }
    }

    const v = violetBurst(lv('violet'));
    if (v) {
      p.violetT -= dt;
      if (p.violetT <= 0) {
        p.violetT += v.interval;
        for (let i = 0; i < v.count; i++) {
          // Random direction within a 90 deg cone in front of the ship, fired from the nose.
          const a = -Math.PI / 2 + this.rng.range(-v.cone / 2, v.cone / 2);
          const bl = this.firePlayer('violet', p.x, p.y - 26 * S, a, v.speed * this.rng.range(0.7, 1.1), v.damage, v.radius, v.scale);
          if (bl) {
            bl.life = v.life;
            bl.tier = v.tier;
            bl.rebound = v.rebound;
            bl.trail = v.trail;
            bl.splitOnHit = v.split;
            bl.waveAmp = v.wave.amp;
            bl.waveFreq = v.wave.freq;
            bl.wavePhase = this.rng.range(0, Math.PI * 2);
          }
        }
      }
    }

    const m = missileStats(lv('blue'));
    if (m) {
      p.missileT -= dt;
      if (p.missileT <= 0) {
        p.missileT += m.interval;
        const target = this.nearestTarget(p.x, p.y);
        for (let i = 0; i < m.count; i++) {
          p.missileSide = -p.missileSide;
          const bl = this.firePlayer('missile', p.x + p.missileSide * 18 * S, p.y, -Math.PI / 2 + p.missileSide * 0.35, 300, m.damage, m.radius, m.scale);
          if (bl) {
            bl.homing = m.homing;
            bl.target = target;
            bl.life = 4;
            bl.tier = m.tier;
            bl.blast = m.blast;
            bl.blastDmg = m.damage * 0.6;
            bl.splitAt = m.split ? 0.45 : 0;
          }
        }
      }
      if (m.heavy) {
        // Blue level 5: a heavy missile that flies straight through everything on its path.
        p.heavyT -= dt;
        if (p.heavyT <= 0) {
          p.heavyT += m.heavy.interval;
          const bl = this.firePlayer('heavyMissile', p.x, p.y - 20 * S, -Math.PI / 2, 700, m.heavy.damage, m.heavy.radius, m.heavy.scale);
          if (bl) { bl.pierce = 99; bl.life = 3; bl.tier = 5; }
        }
      }
    }
  }

  /** Pink level 2+: remember where the ship has been recently; the trail hurts enemies (see collide). */
  private updateTrail(dt: number, moving: boolean, active: boolean): void {
    for (const pt of this.trail) pt.t += dt;
    this.trail = this.trail.filter((pt) => pt.t < 0.45);
    if (!active) { this.trail = []; return; }
    this.trailT -= dt;
    if (moving && this.trailT <= 0) {
      this.trailT = 0.03;
      this.trail.push({ x: this.player.x, y: this.player.y, t: 0 });
    }
  }

  /** Violet level 5+: spin the orbs and recover their cooldowns. */
  private updateOrbitals(dt: number): void {
    const orb = orbitalStats(this.inventory.level('violet'));
    if (!orb) { this.orbitCd = []; return; }
    this.orbitAngle += orb.speed * dt;
    while (this.orbitCd.length < orb.count) this.orbitCd.push(0);
    this.orbitCd = this.orbitCd.map((c) => Math.max(0, c - dt));
  }

  /** Current orb positions around the ship (empty without violet level 5+). `ready` = able to absorb a bullet. */
  orbitals(): { x: number; y: number; ready: boolean }[] {
    const orb = orbitalStats(this.inventory.level('violet'));
    if (!orb || this.player.dead) return [];
    return Array.from({ length: orb.count }, (_, i) => {
      const a = this.orbitAngle + (i / orb.count) * Math.PI * 2;
      return {
        x: this.player.x + Math.cos(a) * orb.orbit,
        y: this.player.y + Math.sin(a) * orb.orbit,
        ready: (this.orbitCd[i] ?? 0) <= 0,
      };
    });
  }

  private firePlayer(
    style: BulletStyle, x: number, y: number, a: number, speed: number, dmg: number, r: number, scale: number,
  ): Bullet | null {
    const b = this.pShots.acquire();
    if (!b) return null;
    b.x = x; b.y = y; b.vx = Math.cos(a) * speed; b.vy = Math.sin(a) * speed;
    b.r = r; b.dmg = dmg; b.style = style; b.t = 0; b.life = 2; b.homing = 0; b.bounce = false;
    b.scale = scale; b.target = null;
    b.tier = 0; b.pierce = 0; b.edgeBounce = 0; b.rebound = 0; b.blast = 0; b.blastDmg = 0;
    b.splitOnHit = false; b.splitAt = 0; b.turnAt = 0; b.returning = false; b.waveAmp = 0; b.trail = false; b.hit.length = 0;
    return b;
  }

  private fireEnemy(style: BulletStyle, x: number, y: number, a: number, speed: number, o: FireOpts = {}): void {
    if (this.player.dead || this.phase === 'bossDying' || this.phase === 'rescue') return;
    const b = this.eShots.acquire();
    if (!b) return;
    b.x = x; b.y = y; b.vx = Math.cos(a) * speed; b.vy = Math.sin(a) * speed;
    b.r = (o.r ?? (style === 'eMissile' ? 6 : style === 'eOrb' ? 7 : 5)) * S;
    b.dmg = 1; b.style = style; b.t = 0; b.life = o.life ?? 8; b.homing = o.homing ?? 0; b.bounce = o.bounce ?? false;
    b.scale = S; b.target = null;
  }

  private attract(x: number, y: number, strength: number): void {
    const p = this.player;
    if (p.dead) return;
    const d = Math.sqrt(dist2(x, y, p.x, p.y));
    if (d < 30 * S || d > 650) return;
    const f = (strength * (1 - d / 650)) / d;
    p.x += (x - p.x) * f * (1 / 60);
    p.y += (y - p.y) * f * (1 / 60);
    for (const pk of this.pickups) {
      pk.x += (x - pk.x) * f * 0.6 * (1 / 60);
      pk.y += (y - pk.y) * f * 0.6 * (1 / 60);
    }
  }

  /** Sacrifice → devastating salvo. */
  triggerSalvo(s: Sacrifice): void {
    const info = WEAPONS[s.type];
    const dmg = salvoDamage(s.type, s.level);
    for (const b of this.eShots.items) {
      if (!b.active) continue;
      b.active = false;
      this.spawnParticle('spark', b.x, b.y, 0, 0, 0.3, 4 * S, info.light);
    }
    for (const e of this.enemies) if (e.y > -20 && !e.dead) this.damageEnemy(e, dmg);
    if (this.boss && !this.boss.entering && this.phase === 'boss') this.damageBoss(dmg / 3);
    this.salvos.push({ x: this.player.x, y: this.player.y, t: 0, life: 0.7, color: info.color, light: info.light });
    this.player.invuln = Math.max(this.player.invuln, 0.6);
    this.shake = 0.35;
    this.addText(`${info.name} salvo!`, this.player.x, this.player.y - 50 * S, info.light, false, 20 * S);
  }

  private hurtPlayer(): void {
    const p = this.player;
    if (p.invuln > 0 || p.dead || this.god || this.phase === 'rescue' || this.phase === 'clear') return;
    p.hp--;
    p.invuln = PLAYER_INVULN;
    this.shake = 0.4;
    this.explode(p.x, p.y, 16 * S, false);
    // Mercy: clear bullets right around the ship.
    for (const b of this.eShots.items) if (b.active && dist2(b.x, b.y, p.x, p.y) < 110 * S * (110 * S)) b.active = false;
    if (p.hp <= 0) {
      p.dead = true;
      this.explode(p.x, p.y, 60 * S, true);
      this.setPhase('dying');
    }
  }

  // ---------------------------------------------------------------- enemies

  spawnEnemy(kind: EnemyId, x: number, y: number, side: number, weapon?: WeaponType): Enemy {
    const stats = kind === 'carrier' ? null : ENEMY_STATS[kind];
    const hpScale = 1 + (this.level.difficulty - 1) * 0.5;
    const hp = stats ? Math.ceil(stats.hp * hpScale) : CARRIER_HP;
    const e: Enemy = {
      kind, x, y, vx: 0, vy: 0, hp, maxHp: hp, r: (stats?.radius ?? 26) * S, t: 0,
      fireT: this.rng.range(0.6, 1.8), flash: 0, ground: stats?.ground ?? false,
      weapon: kind === 'carrier' ? weapon ?? this.rng.pick(WEAPON_TYPES) : null,
      dead: false, side, a: this.rng.range(0, Math.PI * 2), b: 0, c: 0,
    };
    this.enemies.push(e);
    return e;
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (!e.dead) updateEnemy(e, dt, this.ctx);
    }
    this.enemies = this.enemies.filter((e) => !e.dead && !isOffscreen(e));
    // Ground units are drawn first.
    this.enemies.sort((a, b) => Number(b.ground) - Number(a.ground));
  }

  private damageEnemy(e: Enemy, dmg: number): void {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.06;
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    e.dead = true;
    const pts = pointsFor(e.kind);
    this.score = addScore(this.score, pts);
    this.addText(String(pts), e.x, e.y, '#ffffff', true, 2 * S);
    this.explode(e.x, e.y, e.r, e.r >= 28 * S);
    if (e.r >= 30 * S) this.shake = Math.max(this.shake, 0.2);
    if (e.kind === 'carrier' && e.weapon) {
      this.pickups.push({ kind: 'weapon', weapon: e.weapon, x: e.x, y: e.y, t: 0 });
      if (this.rng.chance(0.06)) this.pickups.push({ kind: 'slot', weapon: null, x: e.x + 30 * S, y: e.y, t: 0 });
    }
  }

  private updateBossState(dt: number): void {
    const b = this.boss;
    if (!b) return;
    if (this.phase === 'boss') updateBoss(b, dt, this.ctx);
    else if (this.phase === 'bossDying') b.y += 12 * dt;
  }

  private damageBoss(dmg: number): void {
    const b = this.boss;
    if (!b || b.entering || this.phase !== 'boss') return;
    b.hp -= dmg;
    b.flash = 0.05;
    if (b.hp <= 0) {
      b.hp = 0;
      b.dead = true;
      this.eShots.clear();
      this.enemies.forEach((e) => {
        if (!e.dead) this.killEnemy(e);
      });
      this.setPhase('bossDying');
    }
  }

  // ---------------------------------------------------------------- bullets & collisions

  /** True while a locked target can still be hit (alive, on screen, still in the world). */
  private isValidTarget(t: Target | null): boolean {
    if (!t || t.dead) return false;
    if (t === this.boss) return !this.boss.entering && this.phase === 'boss';
    const e = t as Enemy;
    return e.y > -10 && e.y < PLAY_H && e.x > 0 && e.x < PLAY_W && this.enemies.includes(e);
  }

  private nearestTarget(x: number, y: number, exclude?: ReadonlySet<Target>): Target | null {
    let best: Target | null = null;
    let bd = Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.y < 0 || e.y > PLAY_H || e.x < 0 || e.x > PLAY_W || exclude?.has(e)) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (this.boss && !this.boss.entering && this.phase === 'boss' && !exclude?.has(this.boss)) {
      const d = dist2(x, y, this.boss.x, this.boss.y);
      if (d < bd) best = this.boss;
    }
    return best;
  }

  private steer(b: Bullet, tx: number, ty: number, dt: number): void {
    const speed = Math.hypot(b.vx, b.vy);
    const cur = Math.atan2(b.vy, b.vx);
    let diff = Math.atan2(ty - b.y, tx - b.x) - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const na = cur + clamp(diff, -b.homing * dt, b.homing * dt);
    b.vx = Math.cos(na) * speed;
    b.vy = Math.sin(na) * speed;
  }

  private updateBullets(dt: number): void {
    const p = this.player;
    for (const b of this.pShots.items) {
      if (!b.active) continue;
      b.t += dt;
      if (b.style === 'missile') {
        const s = Math.hypot(b.vx, b.vy);
        const ns = Math.min(720, s + 900 * dt);
        b.vx *= ns / s;
        b.vy *= ns / s;
        if (b.homing > 0) {
          // Keep the locked target; retarget the nearest enemy when it is gone.
          if (!this.isValidTarget(b.target)) b.target = this.nearestTarget(b.x, b.y);
          if (b.target) this.steer(b, b.target.x, b.target.y, dt);
        }
        if (this.rng.chance(0.6)) this.spawnParticle('smoke', b.x, b.y + 6 * S, 0, 30, 0.35, 4 * b.scale, '#9fd0ff');
        // Blue level 4: the missile splits in two in flight.
        if (b.splitAt > 0 && b.t >= b.splitAt) this.splitMissile(b);
      } else if (b.style === 'heavyMissile') {
        if (this.rng.chance(0.8)) this.spawnParticle('smoke', b.x, b.y + 10 * S, 0, 40, 0.4, 5 * b.scale, '#bcd8ff');
      }
      // Yellow level 5: the shot turns back toward the ship, hitting enemies again on the way.
      if (b.turnAt > 0 && !b.returning && b.t >= b.turnAt) {
        b.returning = true;
        b.hit.length = 0;
        b.homing = 14;
      }
      if (b.returning) {
        if (p.dead || dist2(b.x, b.y, p.x, p.y) < (18 * S) * (18 * S)) b.active = false;
        else this.steer(b, p.x, p.y, dt);
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // Violet: sine-wave motion, as a lateral velocity perpendicular to the heading.
      if (b.waveAmp > 0) {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const lat = b.waveAmp * b.waveFreq * Math.cos(b.t * b.waveFreq + b.wavePhase);
        b.x += (-b.vy / sp) * lat * dt;
        b.y += (b.vx / sp) * lat * dt;
      }
      if (b.t > b.life || b.y < -30 || b.y > PLAY_H + 30 || b.x < -30 || b.x > PLAY_W + 30) b.active = false;
    }
    const slow = pinkStats(this.inventory.level('pink'))?.slow ?? null;
    for (const b of this.eShots.items) {
      if (!b.active) continue;
      b.t += dt;
      // Pink level 5: bullet time around the ship.
      const k = slow && !p.dead && dist2(b.x, b.y, p.x, p.y) < slow.radius * slow.radius ? slow.factor : 1;
      const bdt = dt * k;
      if (b.homing > 0 && b.t < 2.2 && !p.dead) this.steer(b, p.x, p.y, bdt);
      b.x += b.vx * bdt;
      b.y += b.vy * bdt;
      if (b.bounce) {
        if (b.x < 10 || b.x > PLAY_W - 10) b.vx = -b.vx;
        if (b.y < 10 && b.vy < 0) b.vy = -b.vy;
      }
      if (b.t > b.life || b.y < -40 || b.y > PLAY_H + 40 || b.x < -40 || b.x > PLAY_W + 40) b.active = false;
    }
  }

  /** Blue level 4: replaces a missile by two lighter homing missiles. */
  private splitMissile(b: Bullet): void {
    b.splitAt = 0;
    const base = Math.atan2(b.vy, b.vx);
    for (const da of [-0.6, 0.6]) {
      const c = this.firePlayer('missile', b.x, b.y, base + da, 380, b.dmg * 0.5, b.r * 0.75, b.scale * 0.75);
      if (!c) continue;
      c.homing = b.homing;
      c.target = this.nearestTarget(b.x, b.y);
      c.life = 2.5;
      c.tier = b.tier;
      c.blast = b.blast * 0.7;
      c.blastDmg = b.blastDmg * 0.5;
    }
    b.active = false;
  }

  /** Violet level 4: an impacting ball breaks into two small balls. */
  private splitViolet(b: Bullet): void {
    const base = Math.atan2(b.vy, b.vx);
    const speed = Math.hypot(b.vx, b.vy) * 0.9;
    for (const da of [-0.7, 0.7]) {
      const c = this.firePlayer('violet', b.x, b.y, base + da, speed, b.dmg * 0.5, b.r * 0.6, b.scale * 0.6);
      if (!c) continue;
      c.life = 1.6;
      c.tier = b.tier;
      c.waveAmp = b.waveAmp * 0.6;
      c.waveFreq = b.waveFreq;
      c.wavePhase = b.wavePhase;
      c.hit.push(...b.hit);
    }
  }

  /** Area damage around (x, y) to every enemy and the boss in range, except `skip` (already damaged). */
  private detonate(x: number, y: number, radius: number, dmg: number, skip: Target | null, light: string): void {
    for (const e of this.enemies) {
      if (e.dead || e === skip || e.y < -10) continue;
      const rr = radius + e.r;
      if (dist2(x, y, e.x, e.y) < rr * rr) this.damageEnemy(e, dmg);
    }
    const bs = this.boss;
    if (bs && bs !== skip && !bs.entering && this.phase === 'boss' && bossHit(bs, x, y, radius * 0.6)) this.damageBoss(dmg);
    this.spawnParticle('ring', x, y, 0, 0, 0.3, radius * 0.9, light);
    for (let i = 0; i < 6; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      this.spawnParticle('spark', x, y, Math.cos(a) * 180, Math.sin(a) * 180, 0.25, 4 * S, light);
    }
  }

  /** Resolves a player projectile hitting an enemy or the boss: damage, blast, rebound, split, pierce. */
  private projectileHit(b: Bullet, t: Target): void {
    if (t === this.boss) this.damageBoss(b.dmg);
    else this.damageEnemy(t as Enemy, b.dmg);
    this.spawnParticle('spark', b.x, b.y, this.rng.range(-60, 60), this.rng.range(-80, 20), 0.15, 4 * S, '#fff6a0');
    b.hit.push(t);
    if (b.blast > 0) {
      this.detonate(b.x, b.y, b.blast, b.blastDmg, t, b.style === 'charge' ? '#c4ffc9' : '#bcd8ff');
      b.blast = 0;
    }
    if (b.rebound > 0) {
      // Violet level 2: bounce off the target instead of stopping.
      b.rebound--;
      const dx = b.x - t.x;
      const dy = b.y - t.y;
      const d = Math.hypot(dx, dy) || 1;
      const dot = b.vx * (dx / d) + b.vy * (dy / d);
      if (dot < 0) {
        b.vx -= (2 * dot * dx) / d;
        b.vy -= (2 * dot * dy) / d;
      }
      return;
    }
    if (b.splitOnHit) {
      this.splitViolet(b);
      b.active = false;
      return;
    }
    if (b.pierce > 0) {
      b.pierce--;
      return;
    }
    b.active = false;
  }

  private collide(dt: number): void {
    const p = this.player;
    const boss = this.boss;
    for (const b of this.pShots.items) {
      if (!b.active) continue;
      for (const e of this.enemies) {
        if (!b.active) break;
        if (e.dead || e.y < -10 || b.hit.includes(e)) continue;
        const rr = e.r + b.r;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) this.projectileHit(b, e);
      }
      if (b.active && boss && !boss.entering && !b.hit.includes(boss) && bossHit(boss, b.x, b.y, b.r)) this.projectileHit(b, boss);
    }

    const pink = pinkStats(this.inventory.level('pink'));
    if (pink && pink.trailDps > 0 && this.trail.length > 0) this.applyTrail(pink.trailDps * dt);
    this.applyOrbitals(dt);

    if (this.laser.active) this.applyLaser(dt);

    if (p.dead) return;
    const hit = PLAYER_HITBOX;
    const graze = pink?.graze ?? null;
    for (const b of this.eShots.items) {
      if (!b.active) continue;
      const rr = b.r + hit;
      const d2 = dist2(b.x, b.y, p.x, p.y);
      if (d2 < rr * rr) {
        b.active = false;
        this.hurtPlayer();
      } else if (graze && p.grazeCd <= 0 && p.invuln <= 0 && d2 < (rr + graze.radius) * (rr + graze.radius)) {
        // Pink level 4: a near miss grants a brief invulnerability, then needs time to recharge.
        p.invuln = graze.invuln;
        p.grazeCd = graze.cooldown;
        this.addText('Graze!', p.x, p.y - 40 * S, '#ffc6e2', false, 20 * S);
        this.spawnParticle('ring', p.x, p.y, 0, 0, 0.3, 30 * S, '#ff6fb5');
      }
    }
    for (const e of this.enemies) {
      if (e.dead || e.ground) continue;
      const rr = e.r * 0.7 + hit;
      if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
        this.hurtPlayer();
        this.damageEnemy(e, 5);
      }
    }
    if (boss && this.phase === 'boss' && bossHit(boss, p.x, p.y, 0)) this.hurtPlayer();
  }

  /** Pink level 2+: enemies touching the ship's recent path take damage. */
  private applyTrail(amount: number): void {
    const reach = 14 * S;
    for (const e of this.enemies) {
      if (e.dead || e.y < -10) continue;
      const rr = e.r + reach;
      if (this.trail.some((pt) => dist2(pt.x, pt.y, e.x, e.y) < rr * rr)) this.damageEnemy(e, amount);
    }
    const bs = this.boss;
    if (bs && !bs.entering && this.phase === 'boss' && this.trail.some((pt) => bossHit(bs, pt.x, pt.y, reach))) this.damageBoss(amount);
  }

  /** Violet level 5+: orbs absorb small enemy bullets (then recharge) and hurt enemies they touch. */
  private applyOrbitals(dt: number): void {
    const orb = orbitalStats(this.inventory.level('violet'));
    if (!orb || this.player.dead) return;
    const boss = this.boss;
    this.orbitals().forEach((o, i) => {
      if (o.ready) {
        for (const b of this.eShots.items) {
          if (!b.active || b.r > 6 * S) continue;
          const rr = b.r + orb.radius;
          if (dist2(b.x, b.y, o.x, o.y) < rr * rr) {
            b.active = false;
            this.orbitCd[i] = orb.cooldown;
            this.spawnParticle('spark', o.x, o.y, 0, 0, 0.2, 8 * S, '#e2c2ff');
            break;
          }
        }
      }
      for (const e of this.enemies) {
        if (e.dead || e.y < -10) continue;
        const rr = e.r + orb.radius;
        if (dist2(o.x, o.y, e.x, e.y) < rr * rr) this.damageEnemy(e, orb.dps * dt);
      }
      if (boss && !boss.entering && this.phase === 'boss' && bossHit(boss, o.x, o.y, orb.radius)) this.damageBoss(orb.dps * dt);
    });
  }

  /** Target of the red main beam: the boss during its fight, otherwise the sturdiest enemy on screen. */
  private mainTarget(exclude: ReadonlySet<Target>): Target | null {
    const bs = this.boss;
    if (bs && !bs.entering && this.phase === 'boss' && !exclude.has(bs)) return bs;
    let best: Enemy | null = null;
    for (const e of this.enemies) {
      if (e.dead || e.y < 0 || e.y > PLAY_H || e.x < 0 || e.x > PLAY_W || exclude.has(e)) continue;
      if (!best || e.hp > best.hp) best = e;
    }
    return best;
  }

  /**
   * Red beams. Each beam locks the nearest enemy not already locked by another beam (or, when every
   * visible enemy is taken, the nearest one) and keeps it until it dies or fire is released.
   * A beam with nothing to lock goes straight up and hits everything in its column.
   * Level 3+: chain lightning to a second enemy. Level 4+: a third beam.
   * Level 5+: beam 0 is a massive main beam that prefers the boss / the sturdiest enemy.
   */
  private applyLaser(dt: number): void {
    const p = this.player;
    const boss = this.boss;
    const stats = laserStats(this.inventory.level('red'));
    if (!stats) return;
    const beams = this.laser.beams;
    const n = beams.length;
    const locked = new Set<Target>();
    for (const bm of beams) {
      if (bm.target && this.isValidTarget(bm.target)) locked.add(bm.target);
      else bm.target = null;
    }
    beams.forEach((bm, i) => {
      bm.main = i === 0 && stats.main !== null;
      bm.w = bm.main && stats.main ? stats.main.width : stats.width;
      bm.dps = bm.main && stats.main ? stats.main.dps : stats.dps;
      bm.chain = false;
      const amount = bm.dps * dt;
      bm.sx = p.x + (i - (n - 1) / 2) * 10 * S;
      bm.sy = p.y - 26 * S;
      if (!bm.target) {
        bm.target = bm.main
          ? this.mainTarget(locked) ?? this.nearestTarget(bm.sx, bm.sy)
          : this.nearestTarget(bm.sx, bm.sy, locked) ?? this.nearestTarget(bm.sx, bm.sy);
        if (bm.target) locked.add(bm.target);
      }
      const t = bm.target;
      if (t) {
        bm.tx = t.x;
        bm.ty = t.y;
        if (t === boss) this.damageBoss(amount);
        else this.damageEnemy(t as Enemy, amount);
        if (this.rng.chance(0.3)) this.spawnParticle('spark', t.x, t.y, this.rng.range(-90, 90), this.rng.range(-90, 90), 0.2, 4 * S, '#ffc0c6');
        if (stats.chain) {
          // Chain lightning: the nearest other enemy within range takes part of the damage.
          let next: Enemy | null = null;
          let bd = stats.chain.range * stats.chain.range;
          for (const e of this.enemies) {
            if (e.dead || e === t || e.y < 0 || e.y > PLAY_H) continue;
            const d = dist2(t.x, t.y, e.x, e.y);
            if (d < bd) { bd = d; next = e; }
          }
          if (next) {
            this.damageEnemy(next, amount * stats.chain.factor);
            bm.chain = true;
            bm.cx = next.x;
            bm.cy = next.y;
          }
        }
        if (t.dead) bm.target = null;
      } else {
        bm.tx = bm.sx;
        bm.ty = -20;
        const hw = bm.w / 2;
        for (const e of this.enemies) {
          if (!e.dead && e.y < p.y && e.y > -10 && Math.abs(e.x - bm.sx) < hw + e.r) this.damageEnemy(e, amount);
        }
        if (boss && boss.y < p.y && Math.abs(boss.x - bm.sx) < hw + boss.halfW * 0.8) this.damageBoss(amount);
      }
    });
  }

  // ---------------------------------------------------------------- pickups & effects

  private updatePickups(dt: number): void {
    const p = this.player;
    const magnetize = this.phase === 'clear';
    const magnet = pinkStats(this.inventory.level('pink'))?.magnet ?? 0;
    for (const pk of this.pickups) {
      pk.t += dt;
      if (magnetize && !p.dead) {
        pk.x += (p.x - pk.x) * Math.min(1, dt * 3);
        pk.y += (p.y - pk.y) * Math.min(1, dt * 3);
      } else {
        pk.y += 75 * dt;
        pk.x += Math.sin(pk.t * 3) * 30 * dt;
        if (magnet > 0 && !p.dead) {
          // Pink level 3+: pickups close to the ship are pulled in.
          const d = Math.sqrt(dist2(pk.x, pk.y, p.x, p.y));
          if (d < magnet && d > 1) {
            const pull = 320 * dt;
            pk.x += ((p.x - pk.x) / d) * pull;
            pk.y += ((p.y - pk.y) / d) * pull;
          }
        }
      }
    }
    if (!p.dead) {
      this.pickups = this.pickups.filter((pk) => {
        if (dist2(pk.x, pk.y, p.x, p.y) > 34 * S * (34 * S)) return true;
        this.collect(pk);
        return false;
      });
    }
    this.pickups = this.pickups.filter((pk) => pk.y < PLAY_H + 40 * S);
  }

  private collect(pk: Pickup): void {
    const p = this.player;
    if (pk.kind === 'heart') {
      p.hp = Math.min(PLAYER_MAX_HP, p.hp + 1);
      this.addText('Repair +1', p.x, p.y - 40 * S, '#ff8fa3', false, 20 * S);
      return;
    }
    if (pk.kind === 'slot') {
      const ok = this.inventory.addSlot();
      this.addText(ok ? 'Slot +1' : 'Slots maxed', p.x, p.y - 40 * S, '#9ff5ff', false, 20 * S);
      return;
    }
    if (!pk.weapon) return;
    const info = WEAPONS[pk.weapon];
    const auto = this.inventory.add(pk.weapon);
    this.addText(`${info.name} lv. ${this.inventory.level(pk.weapon)}`, p.x, p.y - 40 * S, info.light, false, 20 * S);
    if (auto) this.triggerSalvo(auto);
  }

  private updateEffects(dt: number): void {
    for (const pt of this.particles.items) {
      if (!pt.active) continue;
      pt.t += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.kind === 'smoke') pt.vy -= 10 * dt;
      if (pt.kind === 'fire') { pt.vx *= 0.94; pt.vy *= 0.94; }
      if (pt.t >= pt.life) pt.active = false;
    }
    for (const t of this.texts) {
      t.t += dt;
      t.y -= 30 * dt;
    }
    this.texts = this.texts.filter((t) => t.t < t.life);
    for (const s of this.salvos) s.t += dt;
    this.salvos = this.salvos.filter((s) => s.t < s.life);
  }

  spawnParticle(kind: ParticleKind, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string): void {
    const pt = this.particles.acquire();
    if (!pt) return;
    pt.kind = kind; pt.x = x; pt.y = y; pt.vx = vx; pt.vy = vy; pt.t = 0; pt.life = life; pt.size = size; pt.color = color;
  }

  explode(x: number, y: number, radius: number, big: boolean): void {
    const n = Math.min(40, 6 + Math.floor(radius / 2));
    const fireColors = ['#fff6a0', '#ffd23b', '#ff9a2e', '#ff5a1f'];
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(30, 140) * (radius / 24);
      this.spawnParticle('fire', x, y, Math.cos(a) * s, Math.sin(a) * s, this.rng.range(0.3, 0.7), this.rng.pick([4, 8, 8, 12]) * S, this.rng.pick(fireColors));
    }
    for (let i = 0; i < n / 2; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      this.spawnParticle('spark', x, y, Math.cos(a) * 260 * S, Math.sin(a) * 260 * S, 0.25, 4 * S, '#ffffff');
    }
    this.spawnParticle('ring', x, y, 0, 0, 0.4, radius * 1.6, '#ffe7a8');
    if (big) {
      for (let i = 0; i < 10; i++) {
        this.spawnParticle('smoke', x + this.rng.range(-radius, radius) * 0.6, y + this.rng.range(-radius, radius) * 0.6,
          this.rng.range(-15, 15), this.rng.range(20, 60), this.rng.range(1.2, 2.2), this.rng.pick([8, 12, 16]) * S, '#6e1a26');
      }
    }
  }

  private addText(text: string, x: number, y: number, color: string, digits: boolean, size: number): void {
    this.texts.push({ text, x, y, t: 0, life: digits ? 0.9 : 1.4, color, digits, size });
  }

  /** Enemy kinds present on screen, for debug and tests. */
  activeKinds(): Set<EnemyKind | 'carrier'> {
    return new Set(this.enemies.map((e) => e.kind));
  }
}
