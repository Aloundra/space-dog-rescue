// Pure weapon tuning functions: level -> firing parameters and unlocked abilities.
//
// Level rules (shared by every weapon):
//  - Levels 1..5 ("tiers"): each level adds a visible change and one ability (see each function). Damage and
//    projectile size both grow by +15% per level, and stop growing in size at level 5.
//  - Levels 6+: no new ability and no more size. Damage grows +10% per level (relative to the level-5 value) and
//    some weapons gain an extra projectile every few levels, up to a cap.
import { GAME_SCALE } from '../config';
import { WEAPONS, type WeaponType } from '../data/weapons';

/** Last level that unlocks something new. */
export const TIER_LEVELS = 5;
/** Per-level growth of damage and projectile size, levels 1..5. */
export const LEVEL_GROWTH = 0.15;
/** Per-level damage growth above level 5, relative to the level-5 damage. */
export const BONUS_GROWTH = 0.1;

/** Level clamped to the tier range (0 = weapon not owned). */
export function tierOf(level: number): number {
  return Math.max(0, Math.min(level, TIER_LEVELS));
}

/** Damage multiplier of a weapon at `level`: x1 at level 1, +15% per level up to 5 (x2), then +10% per level. */
export function levelMultiplier(level: number): number {
  if (level <= 0) return 1;
  const tiered = 1 + LEVEL_GROWTH * (tierOf(level) - 1);
  return level <= TIER_LEVELS ? tiered : tiered * (1 + BONUS_GROWTH * (level - TIER_LEVELS));
}

/** Projectile size multiplier: grows +15% per level up to level 5, then stays put. */
export function sizeMultiplier(level: number): number {
  return level <= 0 ? 1 : 1 + LEVEL_GROWTH * (tierOf(level) - 1);
}

/** Extra projectiles earned above level 5: the first one at level 6, then one more every `every` levels. */
export function bonusCount(level: number, every: number): number {
  return level > TIER_LEVELS ? Math.ceil((level - TIER_LEVELS) / every) : 0;
}

// ------------------------------------------------------------------ green: the base gun

export interface ChargeShot {
  /** Seconds between heavy shots. */
  interval: number;
  damage: number;
  radius: number;
  scale: number;
  /** Explosion radius on impact (logical px). */
  blast: number;
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
  /** Visual tier 0..5. */
  tier: number;
  /** Enemies a shot passes through before it stops (level 3+). */
  pierce: number;
  /** Companion particle fired with each shot (level 4+): its damage as a fraction of the shot's, 0 = none. */
  particle: number;
  /** Heavy exploding shot in the middle of the volley (level 5+). */
  charge: ChargeShot | null;
}

/** Green gun multiplier: level 0 = bare gun (x1), +15% per level to 5, then +10% per level. */
function gunMultiplier(green: number): number {
  const tiered = 1 + LEVEL_GROWTH * tierOf(green);
  return green <= TIER_LEVELS ? tiered : tiered * (1 + BONUS_GROWTH * (green - TIER_LEVELS));
}

/**
 * Base gun, upgraded by the green weapon. Level 0 = bare gun.
 * 1: two shots. 2: three shots. 3: shots pierce one enemy. 4: each shot is joined by a particle doing 50% less damage.
 * 5: a heavy exploding shot joins the volley. 6+: +10% damage, +1 shot every 3 levels (max 8).
 */
export function baseShot(green: number): BaseShot {
  const m = gunMultiplier(green);
  const size = 1 + LEVEL_GROWTH * tierOf(green);
  const shots = green <= 0 ? 1 : green === 1 ? 2 : 3;
  return {
    // Fire rate gains flatten out once the tiers are over.
    interval: Math.max(0.07, 0.15 - 0.015 * tierOf(green)),
    count: Math.min(8, shots + bonusCount(green, 3)),
    spread: 0.075,
    damage: 1.5 * m,
    speed: 780,
    radius: 4 * GAME_SCALE * size,
    scale: GAME_SCALE * size,
    tier: tierOf(green),
    pierce: green >= 3 ? 1 : 0,
    particle: green >= 4 ? 0.5 : 0,
    charge: green >= 5
      ? { interval: 0.9, damage: 6 * m, radius: 7 * GAME_SCALE, scale: GAME_SCALE * 1.8, blast: 55 * GAME_SCALE }
      : null,
  };
}

// ------------------------------------------------------------------ pink: speed and mobility

/** Speed multiplier from the pink weapon: +20% per level up to x2 at level 5, never more. */
export function speedMultiplier(pink: number): number {
  return 1 + 0.2 * tierOf(pink);
}

export interface PinkStats {
  speed: number;
  /** Damaging trail behind the ship (level 2+): damage per second to enemies touching it. */
  trailDps: number;
  /** Radius within which pickups are pulled toward the ship (level 3+). */
  magnet: number;
  /** Graze shield (level 4+): a near miss grants brief invulnerability, then needs `cooldown` seconds. */
  graze: { radius: number; invuln: number; cooldown: number } | null;
  /** Bullet time (level 5+): enemy bullets inside `radius` move at `factor` of their speed. */
  slow: { radius: number; factor: number } | null;
}

/** Pink: 1 speed, 2 damaging trail, 3 pickup magnet, 4 graze shield, 5 bullet time. 6+: +10% trail damage, shorter graze cooldown. */
export function pinkStats(pink: number): PinkStats | null {
  if (pink <= 0) return null;
  return {
    speed: speedMultiplier(pink),
    trailDps: pink >= 2 ? 14 * levelMultiplier(pink) : 0,
    magnet: pink >= 3 ? 200 * GAME_SCALE : 0,
    graze: pink >= 4
      ? { radius: 20 * GAME_SCALE, invuln: 0.6, cooldown: Math.max(3, 8 - Math.max(0, pink - TIER_LEVELS)) }
      : null,
    slow: pink >= 5 ? { radius: 110 * GAME_SCALE, factor: 0.5 } : null,
  };
}

// ------------------------------------------------------------------ violet: scattered balls

export interface VioletBurst {
  interval: number;
  count: number;
  speed: number;
  /** Long enough to cross the whole screen; bullets are culled when they leave it. */
  life: number;
  damage: number;
  radius: number;
  scale: number;
  /** Full aperture (radians) of the cone in front of the ship. */
  cone: number;
  tier: number;
  /** Rebounds off the first enemy hit (level 2+). */
  rebound: number;
  /** Luminous trail (level 3+, visual). */
  trail: boolean;
  /** Splits into two small balls on impact (level 4+). */
  split: boolean;
  /** Sine-wave motion: lateral amplitude (logical px) and angular speed (rad/s). */
  wave: { amp: number; freq: number };
}

/**
 * Violet: balls fired at random inside a 90 deg cone in front of the ship, crossing the whole screen.
 * 1: balls. 2: rebound once off an enemy. 3: luminous trail. 4: split in two on impact. 5: orbiting shield (see orbitalStats).
 * 6+: +10% damage, +2 balls per burst.
 */
export function violetBurst(violet: number): VioletBurst | null {
  if (violet <= 0) return null;
  const size = sizeMultiplier(violet);
  return {
    interval: 0.42,
    count: violet <= TIER_LEVELS ? 2 + 6 * violet : 2 + 6 * TIER_LEVELS + 2 * (violet - TIER_LEVELS),
    speed: 380, life: 10, damage: 0.9 * levelMultiplier(violet),
    radius: 5 * GAME_SCALE * size, scale: GAME_SCALE * size, cone: Math.PI / 2,
    tier: tierOf(violet),
    rebound: violet >= 2 ? 1 : 0,
    trail: violet >= 3,
    split: violet >= 4,
    wave: { amp: 22 * GAME_SCALE, freq: 7 },
  };
}

export interface OrbitalStats {
  count: number;
  /** Orbit radius around the ship (logical px). */
  orbit: number;
  /** Radius of each orb. */
  radius: number;
  /** Angular speed (rad/s). */
  speed: number;
  /** Damage per second to enemies an orb touches. */
  dps: number;
  /** Seconds an orb needs to recover after absorbing a bullet. */
  cooldown: number;
}

/** Violet level 5+: orbs circle the ship, absorb small enemy bullets and hurt what they touch. */
export function orbitalStats(violet: number): OrbitalStats | null {
  if (violet < TIER_LEVELS) return null;
  return {
    count: 4, orbit: 64 * GAME_SCALE, radius: 12 * GAME_SCALE, speed: 2.4,
    dps: 20 * levelMultiplier(violet), cooldown: 1.5,
  };
}

// ------------------------------------------------------------------ yellow: side shots

export interface SideShots {
  angles: number[];
  damage: number;
  speed: number;
  radius: number;
  scale: number;
  tier: number;
  /** Enemies a shot passes through (level 3+). */
  pierce: number;
  /** Extra shot fired straight backward (level 4+). */
  rear: boolean;
  /** Seconds after which side shots turn back toward the ship (level 5+), 0 = never. */
  boomerang: number;
}

/**
 * Yellow: shots on both sides, aimed with the vertical arrows.
 * `vertical`: -1 = up held (shots 60 deg below horizontal), 0 = none (horizontal), 1 = down held (shots 60 deg above horizontal).
 * Angles in radians, 0 = right, PI/2 = down.
 * 1: one shot per side. 2: two per side, wider fan. 3: pierce. 4: rear shot. 5: boomerang return.
 * 6+: +10% damage, +1 shot per side every 2 levels (max 8 per side).
 */
export function sideShots(yellow: number, vertical: number): SideShots | null {
  if (yellow <= 0) return null;
  // Inverted mapping: holding Up tilts the side shots downward, holding Down tilts them upward.
  const v = -Math.sign(vertical);
  // 60 deg tilt from the horizontal axis.
  const right = (v * Math.PI) / 3;
  const left = Math.PI - right;
  const perSide = Math.min(8, (yellow === 1 ? 1 : 2) + bonusCount(yellow, 2));
  const fan = yellow >= 2 ? 0.2 : 0.14;
  const angles: number[] = [];
  for (const base of [right, left]) {
    for (let i = 0; i < perSide; i++) angles.push(base + (i - (perSide - 1) / 2) * fan);
  }
  const size = sizeMultiplier(yellow);
  return {
    angles, damage: 1 * levelMultiplier(yellow), speed: 620,
    radius: 4 * GAME_SCALE * size, scale: GAME_SCALE * size,
    tier: tierOf(yellow), pierce: yellow >= 3 ? 1 : 0, rear: yellow >= 4, boomerang: yellow >= 5 ? 0.5 : 0,
  };
}

// ------------------------------------------------------------------ blue: missiles

export interface HeavyMissile {
  interval: number;
  damage: number;
  radius: number;
  scale: number;
}

export interface MissileStats {
  interval: number;
  count: number;
  /** Turn rate toward the target (rad/s). */
  homing: number;
  damage: number;
  radius: number;
  scale: number;
  tier: number;
  /** Explosion radius on impact (level 3+), 0 = none. */
  blast: number;
  /** Splits into two missiles in flight (level 4+). */
  split: boolean;
  /** Heavy long-range missile that pierces every enemy on its path (level 5+). */
  heavy: HeavyMissile | null;
}

/**
 * Blue: missiles that home in on the nearest enemy.
 * 1: one missile. 2: two. 3: area explosion. 4: split in two in flight. 5: heavy piercing missile.
 * 6+: +10% damage, +1 missile every 2 levels (max 10).
 */
export function missileStats(blue: number): MissileStats | null {
  if (blue <= 0) return null;
  const size = sizeMultiplier(blue);
  const m = levelMultiplier(blue);
  return {
    interval: Math.max(0.35, 0.75 - 0.08 * tierOf(blue)),
    count: Math.min(10, (blue === 1 ? 1 : 2) + bonusCount(blue, 2)),
    homing: 9, damage: 3 * m,
    radius: 6 * GAME_SCALE * size, scale: GAME_SCALE * size,
    tier: tierOf(blue),
    blast: blue >= 3 ? 60 * GAME_SCALE : 0,
    split: blue >= 4,
    heavy: blue >= 5 ? { interval: 1.6, damage: 9 * m, radius: 10 * GAME_SCALE, scale: GAME_SCALE * 2 } : null,
  };
}

// ------------------------------------------------------------------ red: laser

export interface LaserStats {
  /** Number of beams. */
  beams: number;
  /** Width and damage per second of a normal beam. */
  width: number;
  dps: number;
  /** Beam 0 becomes a massive main beam at level 5+: width and dps of that beam. */
  main: { width: number; dps: number } | null;
  /** Level 3+: the damage jumps to a second enemy this close to the first one (logical px), at `factor` strength. */
  chain: { range: number; factor: number } | null;
  tier: number;
}

/**
 * Red: electric beams, each locked on an enemy. Stats are per beam.
 * 1: one beam. 2: two beams. 3: chain lightning. 4: a third beam. 5: massive main beam on the boss / biggest enemy.
 * 6+: +10% damage, +1 beam every 2 levels (max 8).
 */
export function laserStats(red: number): LaserStats | null {
  if (red <= 0) return null;
  const m = levelMultiplier(red);
  // Beam thickness never changes with the level.
  const width = 14 * GAME_SCALE;
  const dps = 14.4 * m;
  return {
    beams: Math.min(8, (red === 1 ? 1 : red >= 4 ? 3 : 2) + bonusCount(red, 2)),
    width, dps,
    main: red >= 5 ? { width: width * 1.8, dps: dps * 2.5 } : null,
    chain: red >= 3 ? { range: 170 * GAME_SCALE, factor: 0.6 } : null,
    tier: tierOf(red),
  };
}

// ------------------------------------------------------------------ sacrifice salvo

/** Damage dealt to every on-screen enemy by sacrificing a weapon: +50% per level to 5, then +15% per level. */
export function salvoDamage(type: WeaponType, level: number): number {
  const lv = Math.max(1, level);
  const tiered = 1 + 0.5 * (tierOf(lv) - 1);
  const mult = lv <= TIER_LEVELS ? tiered : tiered * (1 + 0.15 * (lv - TIER_LEVELS));
  return WEAPONS[type].salvoDamage * mult;
}
