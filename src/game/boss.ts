// Boss creation and attack patterns.
import { PLAY_W, PX } from '../config';
import { angleTo } from '../core/math';
import type { EnemyKind } from '../data/enemies';
import type { BossDef, BossPattern } from '../data/levels';
import type { AIContext } from './enemyAI';
import type { Boss } from './types';

export interface BossContext extends AIContext {
  spawnMinion(kind: EnemyKind, x: number, y: number): void;
}

export const BOSS_REST_Y = 170;

export function createBoss(def: BossDef, index: number): Boss {
  // Generated sprite: (halfW + 1) * 2 - 1 columns, h + 5 rows (see bossHalfRows).
  const halfW = ((def.halfW * 2 + 1) * PX) / 2;
  const halfH = ((def.h + 5) * PX) / 2;
  return {
    def, index, x: PLAY_W / 2, y: -halfH, hp: def.hp, maxHp: def.hp, t: 0,
    timers: def.patterns.map((p, i) => p.interval * (0.5 + i * 0.3)),
    rageTimers: def.rage.map((p) => p.interval),
    spiral: 0, entering: true, flash: 0, halfW, halfH, dead: false,
  };
}

function runPattern(b: Boss, p: BossPattern, c: BossContext): void {
  const sp = p.speed * Math.sqrt(c.difficulty);
  const ox = b.x;
  const oy = b.y + b.halfH * 0.4;
  const toPlayer = angleTo(ox, oy, c.px, c.py);
  switch (p.type) {
    case 'aimed':
      for (let i = 0; i < p.count; i++) {
        const a = p.count === 1 ? toPlayer : toPlayer - 0.12 + (0.24 * i) / (p.count - 1);
        c.fire('ePellet', ox, oy, a, sp);
      }
      break;
    case 'spread':
      for (let i = 0; i < p.count; i++) c.fire('eSquare', ox, oy, toPlayer - 0.6 + (1.2 * i) / (p.count - 1), sp);
      break;
    case 'ring':
      for (let i = 0; i < p.count; i++) c.fire('eBead', ox, b.y, b.t + (i / p.count) * Math.PI * 2, sp);
      break;
    case 'spiral':
      for (let i = 0; i < p.count; i++) {
        c.fire('ePellet', ox, b.y, b.spiral + (i / p.count) * Math.PI * 2, sp);
      }
      b.spiral += 0.33;
      break;
    case 'missiles':
      for (let i = 0; i < p.count; i++) {
        const dx = (i - (p.count - 1) / 2) * 40;
        c.fire('eMissile', ox + dx, oy, Math.PI / 2 + dx / 200, sp, { homing: 1.5, life: 4.5 });
      }
      break;
    case 'curtain':
      for (let i = 0; i < p.count; i++) {
        const dx = (i / (p.count - 1) - 0.5) * b.halfW * 2;
        c.fire('eOrb', ox + dx, oy, Math.PI / 2 + Math.sin(b.t + i) * 0.15, sp);
      }
      break;
    case 'minions':
      if (p.minion) for (let i = 0; i < p.count; i++) c.spawnMinion(p.minion, ox + (i - (p.count - 1) / 2) * 70, b.y);
      break;
  }
}

export function updateBoss(b: Boss, dt: number, c: BossContext): void {
  b.t += dt;
  if (b.flash > 0) b.flash -= dt;
  if (b.entering) {
    b.y += 90 * dt;
    if (b.y >= BOSS_REST_Y) {
      b.y = BOSS_REST_Y;
      b.entering = false;
      b.t = 0;
    }
    return;
  }
  b.x = PLAY_W / 2 + Math.sin(b.t * 0.45) * PLAY_W * 0.28;
  b.y = BOSS_REST_Y + Math.sin(b.t * 0.9) * 28;
  const tick = (patterns: BossPattern[], timers: number[]): void => {
    patterns.forEach((p, i) => {
      timers[i] -= dt * c.difficulty;
      if (timers[i] <= 0) {
        timers[i] += p.interval;
        runPattern(b, p, c);
      }
    });
  };
  tick(b.def.patterns, b.timers);
  if (b.hp < b.maxHp / 2) tick(b.def.rage, b.rageTimers);
}

export function bossHit(b: Boss, x: number, y: number, r: number): boolean {
  return Math.abs(x - b.x) < b.halfW * 0.8 + r && Math.abs(y - b.y) < b.halfH * 0.6 + r;
}
