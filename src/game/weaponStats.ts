// Pure weapon tuning functions: level (0..4) -> firing parameters.
import { WEAPONS, type WeaponType } from '../data/weapons';

export interface BaseShot {
  interval: number;
  count: number;
  spread: number;
  damage: number;
  speed: number;
}

/** Base gun, upgraded by the green weapon. */
export function baseShot(green: number): BaseShot {
  return {
    interval: 0.15 - 0.015 * green,
    count: 1 + green,
    spread: 0.075,
    damage: 1.5 + 0.35 * green,
    speed: 780,
  };
}

/** Speed multiplier from the pink weapon. */
export function speedMultiplier(pink: number): number {
  return 1 + 0.25 * pink;
}

export interface VioletBurst {
  interval: number;
  count: number;
  speed: number;
  life: number;
  damage: number;
}

/** Violet: balls in every direction; more levels = more balls over a wider area. */
export function violetBurst(violet: number): VioletBurst | null {
  if (violet <= 0) return null;
  return { interval: 0.42, count: 2 + 6 * violet, speed: 380, life: 0.45 + 0.17 * violet, damage: 0.9 };
}

/** Yellow: side shots angles (radians, 0 = right, -PI/2 = up). */
export function sideAngles(yellow: number): number[] {
  if (yellow <= 0) return [];
  const a = [0, Math.PI];
  if (yellow >= 2) a.push(-Math.PI / 4, (-3 * Math.PI) / 4);
  if (yellow >= 3) a.push(Math.PI / 4, (3 * Math.PI) / 4);
  if (yellow >= 4) a.push(Math.PI / 2, -Math.PI / 8, (-7 * Math.PI) / 8);
  return a;
}

export interface MissileStats {
  interval: number;
  count: number;
  homing: number;
  damage: number;
}

/** Blue: missiles, lightly homing from level 2. */
export function missileStats(blue: number): MissileStats | null {
  if (blue <= 0) return null;
  return { interval: 0.75 - 0.08 * blue, count: blue, homing: blue >= 2 ? 2 + blue : 0, damage: 3 };
}

export interface LaserStats {
  width: number;
  dps: number;
}

/** Red: electric beam. */
export function laserStats(red: number): LaserStats | null {
  if (red <= 0) return null;
  return { width: 8 + 6 * red, dps: 10 + 8 * red };
}

/** Damage dealt to every on-screen enemy by sacrificing a weapon of the given level. */
export function salvoDamage(type: WeaponType, level: number): number {
  return WEAPONS[type].salvoDamage * (1 + 0.5 * (Math.max(1, level) - 1));
}
