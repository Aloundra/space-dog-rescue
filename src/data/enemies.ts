// Enemy catalogue. Points are the exact values of the original game.
export type EnemyKind =
  | 'basic'
  | 'secondary'
  | 'green'
  | 'marbleBomb'
  | 'robotRabbit'
  | 'turret'
  | 'magnet'
  | 'vBall'
  | 'missileLauncher'
  | 'armoredRect'
  | 'turretPlus'
  | 'tank'
  | 'tankGreen'
  | 'missileRect'
  | 'grinder'
  | 'tankRed';

export const ENEMY_POINTS: Record<EnemyKind, number> = {
  basic: 65,
  secondary: 80,
  green: 120,
  marbleBomb: 300,
  robotRabbit: 350,
  turret: 450,
  magnet: 500,
  vBall: 600,
  missileLauncher: 800,
  armoredRect: 1000,
  turretPlus: 1500,
  tank: 2000,
  tankGreen: 3500,
  missileRect: 4800,
  grinder: 5000,
  tankRed: 8000,
};

export interface EnemyStats {
  name: string;
  hp: number;
  /** Collision radius in logical px. */
  radius: number;
  /** Ground units scroll with the background and never touch the player. */
  ground: boolean;
}

export const ENEMY_STATS: Record<EnemyKind, EnemyStats> = {
  basic: { name: 'Basic enemy', hp: 2, radius: 18, ground: false },
  secondary: { name: 'Secondary enemy', hp: 3, radius: 18, ground: false },
  green: { name: 'Green enemy', hp: 5, radius: 20, ground: false },
  marbleBomb: { name: 'Marble bomb', hp: 7, radius: 22, ground: false },
  robotRabbit: { name: 'Robot rabbit', hp: 7, radius: 20, ground: false },
  turret: { name: 'Basic turret', hp: 12, radius: 24, ground: true },
  magnet: { name: 'Magnet', hp: 14, radius: 24, ground: false },
  vBall: { name: 'V-formation balls', hp: 4, radius: 16, ground: false },
  missileLauncher: { name: 'Missile launcher', hp: 18, radius: 26, ground: false },
  armoredRect: { name: 'Armored rectangle', hp: 34, radius: 30, ground: false },
  turretPlus: { name: 'Upgraded turret', hp: 30, radius: 28, ground: true },
  tank: { name: 'Basic tank', hp: 45, radius: 32, ground: true },
  tankGreen: { name: 'Green tank', hp: 65, radius: 34, ground: true },
  missileRect: { name: 'Missile rectangle', hp: 75, radius: 34, ground: false },
  grinder: { name: 'Grinder', hp: 70, radius: 34, ground: false },
  tankRed: { name: 'Red tank', hp: 110, radius: 38, ground: true },
};

export const ENEMY_KINDS = Object.keys(ENEMY_POINTS) as EnemyKind[];

/** Points for the gamepad-shaped weapon carrier (not in the original table). */
export const CARRIER_POINTS = 200;
export const CARRIER_HP = 6;
