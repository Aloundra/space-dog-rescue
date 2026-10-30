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
  baseShot, laserStats, missileStats, salvoDamage, sideShots, speedMultiplier, violetBurst,
} from './weaponStats';

/** Shorthand for the entity scale. */
const S = GAME_SCALE;

export type Phase = 'intro' | 'waves' | 'warning' | 'boss' | 'bossDying' | 'clear' | 'rescue' | 'dying';
export type WorldEvent = 'gameover' | 'victory';

export interface DebugOptions {
  startLevel?: number;
  god?: boolean;
  weapons?: WeaponType[];
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
  dead: boolean;
  moving: number;
  firing: boolean;
}

/** One red beam. Red level n = n beams. */
export interface Beam {
  /** Locked target; kept until it dies or fire is released. null = beam goes straight up. */
  target: Target | null;
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
    missileSide: 1, dead: false, moving: 0, firing: false,
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
    const speed = PLAYER_BASE_SPEED * speedMultiplier(lv('pink'));
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
    // Releasing fire (or losing the red weapon) breaks every lock. One beam per red level.
    if (!this.laser.active) this.laser.beams = [];
    else {
      const n = lv('red');
      while (this.laser.beams.length < n) this.laser.beams.push({ target: null, sx: p.x, sy: p.y, tx: p.x, ty: 0 });
      this.laser.beams.length = n;
    }
    if (!firing) {
      p.fireT = Math.max(0, p.fireT - dt);
      return;
    }

    p.fireT -= dt;
    if (p.fireT <= 0) {
      const b = baseShot(lv('green'));
      p.fireT += b.interval;
      if (p.fireT < 0) p.fireT = 0;
      for (let i = 0; i < b.count; i++) {
        const a = -Math.PI / 2 + (i - (b.count - 1) / 2) * b.spread;
        const off = (i - (b.count - 1) / 2) * 7 * S;
        this.firePlayer('shot', p.x + off, p.y - 26 * S, a, b.speed, b.damage, b.radius, b.scale);
      }
      // Yellow side shots follow the vertical arrows: up = -45 deg, none = horizontal, down = +45 deg.
      const vertical = (input.isDown(KEYS.down) ? 1 : 0) - (input.isDown(KEYS.up) ? 1 : 0);
      const side = sideShots(lv('yellow'), vertical);
      if (side) {
        for (const a of side.angles) this.firePlayer('side', p.x, p.y - 6 * S, a, side.speed, side.damage, side.radius, side.scale);
      }
    }

    const v = violetBurst(lv('violet'));
    if (v) {
      p.violetT -= dt;
      if (p.violetT <= 0) {
        p.violetT += v.interval;
        for (let i = 0; i < v.count; i++) {
          const a = this.rng.range(0, Math.PI * 2);
          const bl = this.firePlayer('violet', p.x, p.y, a, v.speed * this.rng.range(0.7, 1.1), v.damage, v.radius, v.scale);
          if (bl) bl.life = v.life;
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
          }
        }
      }
    }

  }

  private firePlayer(
    style: BulletStyle, x: number, y: number, a: number, speed: number, dmg: number, r: number, scale: number,
  ): Bullet | null {
    const b = this.pShots.acquire();
    if (!b) return null;
    b.x = x; b.y = y; b.vx = Math.cos(a) * speed; b.vy = Math.sin(a) * speed;
    b.r = r; b.dmg = dmg; b.style = style; b.t = 0; b.life = 2; b.homing = 0; b.bounce = false;
    b.scale = scale; b.target = null;
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
    this.addText(`Salve ${info.name.toLowerCase()} !`, this.player.x, this.player.y - 50 * S, info.light, false, 20 * S);
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
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.t > b.life || b.y < -30 || b.y > PLAY_H + 30 || b.x < -30 || b.x > PLAY_W + 30) b.active = false;
    }
    const p = this.player;
    for (const b of this.eShots.items) {
      if (!b.active) continue;
      b.t += dt;
      if (b.homing > 0 && b.t < 2.2 && !p.dead) this.steer(b, p.x, p.y, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.bounce) {
        if (b.x < 10 || b.x > PLAY_W - 10) b.vx = -b.vx;
        if (b.y < 10 && b.vy < 0) b.vy = -b.vy;
      }
      if (b.t > b.life || b.y < -40 || b.y > PLAY_H + 40 || b.x < -40 || b.x > PLAY_W + 40) b.active = false;
    }
  }

  private collide(dt: number): void {
    const p = this.player;
    const boss = this.boss;
    for (const b of this.pShots.items) {
      if (!b.active) continue;
      for (const e of this.enemies) {
        if (e.dead || e.y < -10) continue;
        const rr = e.r + b.r;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          this.damageEnemy(e, b.dmg);
          this.spawnParticle('spark', b.x, b.y, this.rng.range(-60, 60), this.rng.range(-80, 20), 0.15, 4 * S, '#fff6a0');
          b.active = false;
          break;
        }
      }
      if (b.active && boss && bossHit(boss, b.x, b.y, b.r)) {
        this.damageBoss(b.dmg);
        this.spawnParticle('spark', b.x, b.y, this.rng.range(-60, 60), -40, 0.15, 4 * S, '#fff6a0');
        b.active = false;
      }
    }

    if (this.laser.active) {
      const red = laserStats(this.inventory.level('red'));
      if (red) this.applyLaser(red.dps * dt);
    }

    if (p.dead) return;
    const hit = PLAYER_HITBOX;
    for (const b of this.eShots.items) {
      if (!b.active) continue;
      const rr = b.r + hit;
      if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        b.active = false;
        this.hurtPlayer();
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

  /**
   * Red beams. Each beam locks the nearest enemy not already locked by another beam (or, when every
   * visible enemy is taken, the nearest one) and keeps it until it dies or fire is released.
   * A beam with nothing to lock goes straight up and hits everything in its column.
   */
  private applyLaser(amount: number): void {
    const p = this.player;
    const boss = this.boss;
    const beams = this.laser.beams;
    const n = beams.length;
    const locked = new Set<Target>();
    for (const bm of beams) {
      if (bm.target && this.isValidTarget(bm.target)) locked.add(bm.target);
      else bm.target = null;
    }
    beams.forEach((bm, i) => {
      bm.sx = p.x + (i - (n - 1) / 2) * 10 * S;
      bm.sy = p.y - 26 * S;
      if (!bm.target) {
        bm.target = this.nearestTarget(bm.sx, bm.sy, locked) ?? this.nearestTarget(bm.sx, bm.sy);
        if (bm.target) locked.add(bm.target);
      }
      const t = bm.target;
      if (t) {
        bm.tx = t.x;
        bm.ty = t.y;
        if (t === boss) this.damageBoss(amount);
        else this.damageEnemy(t as Enemy, amount);
        if (this.rng.chance(0.3)) this.spawnParticle('spark', t.x, t.y, this.rng.range(-90, 90), this.rng.range(-90, 90), 0.2, 4 * S, '#ffc0c6');
        if (t.dead) bm.target = null;
        return;
      }
      bm.tx = bm.sx;
      bm.ty = -20;
      const hw = this.laser.width / 2;
      for (const e of this.enemies) {
        if (!e.dead && e.y < p.y && e.y > -10 && Math.abs(e.x - bm.sx) < hw + e.r) this.damageEnemy(e, amount);
      }
      if (boss && boss.y < p.y && Math.abs(boss.x - bm.sx) < hw + boss.halfW * 0.8) this.damageBoss(amount);
    });
  }

  // ---------------------------------------------------------------- pickups & effects

  private updatePickups(dt: number): void {
    const p = this.player;
    const magnetize = this.phase === 'clear';
    for (const pk of this.pickups) {
      pk.t += dt;
      if (magnetize && !p.dead) {
        pk.x += (p.x - pk.x) * Math.min(1, dt * 3);
        pk.y += (p.y - pk.y) * Math.min(1, dt * 3);
      } else {
        pk.y += 75 * dt;
        pk.x += Math.sin(pk.t * 3) * 30 * dt;
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
      this.addText('Réparation +1', p.x, p.y - 40 * S, '#ff8fa3', false, 20 * S);
      return;
    }
    if (pk.kind === 'slot') {
      const ok = this.inventory.addSlot();
      this.addText(ok ? 'Emplacement +1' : 'Emplacements max', p.x, p.y - 40 * S, '#9ff5ff', false, 20 * S);
      return;
    }
    if (!pk.weapon) return;
    const info = WEAPONS[pk.weapon];
    const auto = this.inventory.add(pk.weapon);
    this.addText(`${info.name} niv. ${this.inventory.level(pk.weapon)}`, p.x, p.y - 40 * S, info.light, false, 20 * S);
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
