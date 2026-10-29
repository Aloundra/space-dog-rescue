// Per-kind enemy behaviours. Each function moves the enemy and may fire through the context.
import { GAME_SCALE as S, PLAY_H, PLAY_W, SCROLL_SPEED } from '../config';
import { angleTo, type Rng } from '../core/math';
import type { BulletStyle, Enemy, EnemyId } from './types';

export interface FireOpts {
  homing?: number;
  life?: number;
  bounce?: boolean;
  r?: number;
}

export interface AIContext {
  px: number;
  py: number;
  difficulty: number;
  rng: Rng;
  fire(style: BulletStyle, x: number, y: number, angle: number, speed: number, opts?: FireOpts): void;
  /** Pulls the player toward (x, y) with the given strength (px/s). */
  attract(x: number, y: number, strength: number): void;
  /** Visual explosion (no damage). */
  boom(x: number, y: number, big: boolean): void;
}

type Behaviour = (e: Enemy, dt: number, c: AIContext) => void;

const H = PLAY_H;
const W = PLAY_W;

/** Returns true (and resets the timer) when the enemy should fire. */
function cooldown(e: Enemy, dt: number, interval: number, c: AIContext): boolean {
  e.fireT -= dt;
  if (e.fireT > 0) return false;
  e.fireT = (interval / c.difficulty) * c.rng.range(0.85, 1.15);
  return e.y > 10 && e.y < H * 0.85 && e.x > 0 && e.x < W;
}

const spd = (c: AIContext, s: number): number => s * Math.sqrt(c.difficulty);

function aim(e: Enemy, c: AIContext): number {
  return angleTo(e.x, e.y, c.px, c.py);
}

function fan(e: Enemy, c: AIContext, style: BulletStyle, n: number, arc: number, speed: number, base = aim(e, c)): void {
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? base : base - arc / 2 + (arc * i) / (n - 1);
    c.fire(style, e.x, e.y, a, spd(c, speed));
  }
}

function ring(e: Enemy, c: AIContext, style: BulletStyle, n: number, speed: number, phase = 0): void {
  for (let i = 0; i < n; i++) c.fire(style, e.x, e.y, phase + (i / n) * Math.PI * 2, spd(c, speed));
}

/** Generic side entry: enemies coming from a side cross the screen in an arc. */
function sideEntry(e: Enemy, dt: number, speed: number): boolean {
  if (e.side === 0) return false;
  e.x += -e.side * speed * dt;
  e.y += (40 + e.t * 50) * dt;
  return true;
}

function ground(e: Enemy, dt: number): void {
  e.y += SCROLL_SPEED * dt;
}

const behaviours: Record<EnemyId, Behaviour> = {
  basic(e, dt, c) {
    if (!sideEntry(e, dt, 200)) {
      e.y += 120 * dt;
      e.x += Math.sin(e.t * 3 + e.a) * 50 * dt;
    }
    if (cooldown(e, dt, 2.6, c) && c.rng.chance(0.45)) fan(e, c, 'ePellet', 1, 0, 170);
  },
  secondary(e, dt, c) {
    if (sideEntry(e, dt, 230)) {
      if (cooldown(e, dt, 2.2, c) && c.rng.chance(0.5)) fan(e, c, 'ePellet', 1, 0, 190);
      return;
    }
    if (e.a === 0) {
      e.y += 160 * dt;
      if (e.y > H * 0.28) {
        e.a = 1;
        e.vx = Math.sign(c.px - e.x) * 170;
        fan(e, c, 'ePellet', 2, 0.25, 200);
      }
    } else {
      e.x += e.vx * dt;
      e.y += 230 * dt;
    }
  },
  green(e, dt, c) {
    if (!sideEntry(e, dt, 180)) {
      e.x += Math.cos(e.t * 2.5 + e.a) * 160 * dt;
      e.y += 90 * dt;
    }
    if (cooldown(e, dt, 1.7, c)) fan(e, c, 'eBead', 1, 0, 200);
  },
  marbleBomb(e, dt, c) {
    e.y += 65 * dt;
    e.x += Math.sin(e.t * 1.5) * 20 * dt;
    if (e.t > 4.2 || e.y > H * 0.62) {
      ring(e, c, 'eBead', 12, 150, e.t);
      ring(e, c, 'ePellet', 6, 100, e.t + 0.3);
      e.dead = true; // self-destruct: no points
      c.boom(e.x, e.y, false);
    }
  },
  robotRabbit(e, dt, c) {
    // Hops: velocity bursts that decay; b = hop timer.
    e.b -= dt;
    if (e.b <= 0) {
      e.b = 0.85;
      const a = Math.PI / 2 + c.rng.range(-0.9, 0.9) + (c.px > e.x ? -0.25 : 0.25);
      e.vx = Math.cos(a) * 330;
      e.vy = Math.sin(a) * 260 + 40;
      if (c.rng.chance(0.35 * c.difficulty)) fan(e, c, 'ePellet', 3, 0.5, 180);
    }
    e.vx *= Math.exp(-4 * dt);
    e.vy *= Math.exp(-4 * dt);
    e.x = Math.max(20, Math.min(W - 20, e.x + e.vx * dt));
    e.y += (e.vy + 25) * dt;
  },
  turret(e, dt, c) {
    ground(e, dt);
    e.a = aim(e, c);
    if (cooldown(e, dt, 1.9, c)) fan(e, c, 'ePellet', 1, 0, 210, e.a);
  },
  magnet(e, dt, c) {
    if (e.y < H * 0.22 && e.t < 10) e.y += 90 * dt;
    else if (e.t >= 10) e.y += 70 * dt;
    e.x += Math.sin(e.t * 0.8) * 60 * dt;
    if (e.y > 0) c.attract(e.x, e.y, 150);
    if (cooldown(e, dt, 3.2, c)) ring(e, c, 'eOrb', 8, 110, e.t);
  },
  vBall(e, dt) {
    e.y += 165 * dt;
    e.x += Math.sin(e.t * 2 + e.a) * 25 * dt;
  },
  missileLauncher(e, dt, c) {
    if (e.y < H * 0.2 && e.t < 9) e.y += 110 * dt;
    else if (e.t >= 9) e.y += 90 * dt;
    e.x += Math.sin(e.t * 1.2 + e.a) * 70 * dt;
    if (cooldown(e, dt, 2.6, c)) {
      c.fire('eMissile', e.x - 16 * S, e.y + 10 * S, Math.PI / 2, spd(c, 150), { homing: 1.6, life: 4 });
      c.fire('eMissile', e.x + 16 * S, e.y + 10 * S, Math.PI / 2, spd(c, 150), { homing: 1.6, life: 4 });
    }
  },
  armoredRect(e, dt, c) {
    e.y += 52 * dt;
    if (cooldown(e, dt, 2.1, c)) fan(e, c, 'eSquare', 3, 0.5, 160, Math.PI / 2);
  },
  turretPlus(e, dt, c) {
    ground(e, dt);
    e.a = aim(e, c);
    // b = burst counter, c = burst timer
    if (e.b > 0) {
      e.c -= dt;
      if (e.c <= 0) {
        e.c = 0.14;
        e.b--;
        fan(e, c, 'ePellet', 5, 0.55, 220, e.a);
      }
    } else if (cooldown(e, dt, 2.3, c)) {
      e.b = 3;
      e.c = 0;
    }
  },
  tank(e, dt, c) {
    ground(e, dt);
    e.x += Math.sin(e.t * 0.9 + e.a) * 50 * dt;
    e.b = aim(e, c);
    if (cooldown(e, dt, 1.5, c)) {
      c.fire('eSquare', e.x, e.y, e.b - 0.08, spd(c, 220));
      c.fire('eSquare', e.x, e.y, e.b + 0.08, spd(c, 220));
    }
  },
  tankGreen(e, dt, c) {
    ground(e, dt);
    e.x += Math.sin(e.t * 0.7 + e.a) * 40 * dt;
    e.b = aim(e, c);
    if (cooldown(e, dt, 2, c)) fan(e, c, 'eBead', 7, 1.0, 170, e.b);
  },
  missileRect(e, dt, c) {
    e.y += 45 * dt;
    if (cooldown(e, dt, 2.8, c)) {
      for (const dx of [-26 * S, 26 * S]) {
        c.fire('eMissile', e.x + dx, e.y - 16 * S, Math.PI / 2 + dx / (120 * S), spd(c, 140), { homing: 1.4, life: 4.5 });
        c.fire('eMissile', e.x + dx, e.y + 16 * S, Math.PI / 2 + dx / (80 * S), spd(c, 160), { homing: 1.4, life: 4.5 });
      }
      fan(e, c, 'eSquare', 4, 0.7, 170);
    }
  },
  grinder(e, dt, c) {
    if (e.y < H * 0.24 && e.t < 12) e.y += 100 * dt;
    else if (e.t >= 12) e.y += 80 * dt;
    e.x = W / 2 + Math.sin(e.t * 0.7 + e.a) * (W * 0.36);
    if (cooldown(e, dt, 2.2, c)) {
      c.fire('eDisc', e.x, e.y, aim(e, c), spd(c, 200), { bounce: true, life: 5.5, r: 11 });
    }
  },
  tankRed(e, dt, c) {
    ground(e, dt);
    e.y -= 15 * dt; // slower than the scroll: lingers on screen
    e.x += Math.sin(e.t * 0.6 + e.a) * 35 * dt;
    e.b = aim(e, c);
    if (cooldown(e, dt, 2.4, c)) {
      ring(e, c, 'ePellet', 16, 140, e.t);
      fan(e, c, 'eSquare', 3, 0.3, 240, e.b);
    }
  },
  carrier(e, dt) {
    e.y += 85 * dt;
    e.x += Math.sin(e.t * 2) * 70 * dt;
  },
};

export function updateEnemy(e: Enemy, dt: number, c: AIContext): void {
  e.t += dt;
  if (e.flash > 0) e.flash -= dt;
  behaviours[e.kind](e, dt, c);
}

export function isOffscreen(e: Enemy): boolean {
  if (e.y > H + 90 * S) return true;
  if (e.t > 1.5 && (e.x < -140 * S || e.x > W + 140 * S)) return true;
  return e.y < -400;
}
