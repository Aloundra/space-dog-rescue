// Pure weapon tuning functions: level (0..4) -> firing parameters.
// Rule: every weapon level adds +25% damage and +25% projectile size (linear, so losing a level removes 25%).
import { GAME_SCALE } from '../config';
import { WEAPONS, type WeaponType } from '../data/weapons';

/** Per-level growth of damage and projectile size. */
export const LEVEL_GROWTH = 0.25;

/** Damage/size multiplier of a weapon at `level` (level 1 = x1, each extra level +25%). */
export function levelMultiplier(level: number): number {
  return level <= 0 ? 1 : 1 + LEVEL_GROWTH * (level - 1);
}

export interface BaseShot {
  interval: number;
  count: number;
  spread: number;
  damage: number;
  speed: number;
  /** Collision radius (logical px), already scaled. */
  radius: number;
  /** Visual scale of the projectile. */
  scale: number;
}

/** Base gun, upgraded by the green weapon (green level 0 = unupgraded gun, each level +25%). */
export function baseShot(green: number): BaseShot {
  const m = 1 + LEVEL_GROWTH * green;
  return {
    interval: 0.15 - 0.015 * green,
    count: 1 + green,
    spread: 0.075,
    damage: 1.5 * m,
    speed: 780,
    radius: 4 * GAME_SCALE * m,
    scale: GAME_SCALE * m,
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
  /** Long enough to cross the whole screen; bullets are culled when they leave it. */
  life: number;
  damage: number;
  radius: number;
  scale: number;
}

/** Violet: balls in every direction, travelling across the whole screen. More levels = more balls. */
export function violetBurst(violet: number): VioletBurst | null {
  if (violet <= 0) return null;
  const m = levelMultiplier(violet);
  return {
    interval: 0.42, count: 2 + 6 * violet, speed: 380, life: 10, damage: 0.9 * m,
    radius: 5 * GAME_SCALE * m, scale: GAME_SCALE * m,
  };
}

export interface SideShots {
  angles: number[];
  damage: number;
  speed: number;
  radius: number;
  scale: number;
}

/**
 * Yellow: shots on both sides, aimed with the vertical arrows.
 * `vertical`: -1 = up held (shots at -45 deg), 0 = none (horizontal), 1 = down held (shots at +45 deg).
 * Angles in radians, 0 = right, PI/2 = down. Each level adds one shot per side in a narrow fan.
 */
export function sideShots(yellow: number, vertical: number): SideShots | null {
  if (yellow <= 0) return null;
  const v = Math.sign(vertical);
  const right = (v * Math.PI) / 4;
  const left = Math.PI - right;
  const fan = 0.14;
  const angles: number[] = [];
  for (const base of [right, left]) {
    for (let i = 0; i < yellow; i++) angles.push(base + (i - (yellow - 1) / 2) * fan);
  }
  const m = levelMultiplier(yellow);
  return { angles, damage: 1 * m, speed: 620, radius: 4 * GAME_SCALE * m, scale: GAME_SCALE * m };
}

export interface MissileStats {
  interval: number;
  count: number;
  /** Turn rate toward the target (rad/s). */
  homing: number;
  damage: number;
  radius: number;
  scale: number;
}

/** Blue: missiles that home in on the nearest enemy, at every level. */
export function missileStats(blue: number): MissileStats | null {
  if (blue <= 0) return null;
  const m = levelMultiplier(blue);
  return {
    interval: 0.75 - 0.08 * blue, count: blue, homing: 9, damage: 3 * m,
    radius: 6 * GAME_SCALE * m, scale: GAME_SCALE * m,
  };
}

export interface LaserStats {
  width: number;
  dps: number;
}

/** Red: electric beam locked on the nearest enemy. */
export function laserStats(red: number): LaserStats | null {
  if (red <= 0) return null;
  const m = levelMultiplier(red);
  return { width: 14 * GAME_SCALE * m, dps: 18 * m };
}

/** Damage dealt to every on-screen enemy by sacrificing a weapon of the given level. */
export function salvoDamage(type: WeaponType, level: number): number {
  return WEAPONS[type].salvoDamage * (1 + 0.5 * (Math.max(1, level) - 1));
}
