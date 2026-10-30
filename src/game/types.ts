import type { EnemyKind } from '../data/enemies';
import type { BossDef } from '../data/levels';
import type { WeaponType } from '../data/weapons';

export type BulletStyle =
  | 'shot' | 'charge' | 'violet' | 'side' | 'missile' | 'heavyMissile'
  | 'ePellet' | 'eSquare' | 'eBead' | 'eOrb' | 'eMissile' | 'eDisc';

export interface Bullet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  style: BulletStyle;
  t: number;
  life: number;
  /** Turn rate in rad/s toward the target (0 = straight). */
  homing: number;
  bounce: boolean;
  /** Visual scale of the projectile sprite. */
  scale: number;
  /** Locked target for homing player missiles. */
  target: Target | null;
  /** Visual tier (weapon level 1..5), 0 = plain. */
  tier: number;
  /** Extra enemies this projectile can pass through before it stops. */
  pierce: number;
  /** Bounces left off the screen edges (green shots). */
  edgeBounce: number;
  /** Bounces left off enemies (violet balls). */
  rebound: number;
  /** Explosion radius on impact (0 = none) and its damage. */
  blast: number;
  blastDmg: number;
  /** Violet: splits into two small balls on impact. */
  splitOnHit: boolean;
  /** Blue: splits into two missiles at this age in seconds (0 = never). */
  splitAt: number;
  /** Yellow boomerang: age in seconds at which the shot turns back toward the ship (0 = never). */
  turnAt: number;
  returning: boolean;
  /** Violet sine wave: lateral amplitude (px), angular speed (rad/s) and phase; amplitude 0 = straight. */
  waveAmp: number;
  waveFreq: number;
  wavePhase: number;
  /** Violet luminous trail (visual). */
  trail: boolean;
  /** Targets already hit (so a piercing shot never hits the same one twice). */
  hit: Target[];
}

/** Anything a player weapon can lock on (enemy or boss). */
export interface Target {
  x: number;
  y: number;
  dead: boolean;
}

export const makeBullet = (): Bullet => ({
  active: false, x: 0, y: 0, vx: 0, vy: 0, r: 4, dmg: 1, style: 'shot', t: 0, life: 3, homing: 0, bounce: false,
  scale: 1, target: null, tier: 0, pierce: 0, edgeBounce: 0, rebound: 0, blast: 0, blastDmg: 0,
  splitOnHit: false, splitAt: 0, turnAt: 0, returning: false, waveAmp: 0, waveFreq: 0, wavePhase: 0, trail: false, hit: [],
});

export type EnemyId = EnemyKind | 'carrier';

export interface Enemy {
  kind: EnemyId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  r: number;
  t: number;
  fireT: number;
  flash: number;
  ground: boolean;
  weapon: WeaponType | null;
  dead: boolean;
  /** Entry side for side formations: -1 left, 1 right, 0 top. */
  side: number;
  /** Free per-behaviour state slots. */
  a: number;
  b: number;
  c: number;
}

export type PickupKind = 'weapon' | 'slot' | 'heart';

export interface Pickup {
  kind: PickupKind;
  weapon: WeaponType | null;
  x: number;
  y: number;
  t: number;
}

export interface FloatText {
  text: string;
  x: number;
  y: number;
  t: number;
  life: number;
  color: string;
  /** true = pixel digit font, false = canvas text. */
  digits: boolean;
  size: number;
}

export type ParticleKind = 'spark' | 'smoke' | 'ring' | 'fire';

export interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  size: number;
  color: string;
}

export const makeParticle = (): Particle => ({
  active: false, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, size: 4, color: '#fff',
});

export interface Salvo {
  x: number;
  y: number;
  t: number;
  life: number;
  color: string;
  light: string;
}

export interface Boss {
  def: BossDef;
  index: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  t: number;
  timers: number[];
  rageTimers: number[];
  spiral: number;
  entering: boolean;
  flash: number;
  halfW: number;
  halfH: number;
  dead: boolean;
}

export class Pool<T extends { active: boolean }> {
  readonly items: T[];
  private cursor = 0;

  constructor(size: number, make: () => T) {
    this.items = Array.from({ length: size }, make);
  }

  acquire(): T | null {
    const n = this.items.length;
    for (let i = 0; i < n; i++) {
      const idx = (this.cursor + i) % n;
      const it = this.items[idx];
      if (!it.active) {
        this.cursor = (idx + 1) % n;
        it.active = true;
        return it;
      }
    }
    return null;
  }

  clear(): void {
    for (const it of this.items) it.active = false;
  }

  countActive(): number {
    let n = 0;
    for (const it of this.items) if (it.active) n++;
    return n;
  }
}
