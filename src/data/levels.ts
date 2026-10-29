// Level and boss definitions. Waves are pure data interpreted by game/spawner.ts.
import type { EnemyKind } from './enemies';
import type { WeaponType } from './weapons';

export type Formation = 'single' | 'line' | 'column' | 'v' | 'random' | 'fromLeft' | 'fromRight';

export interface Wave {
  /** Seconds since level start. */
  at: number;
  kind: EnemyKind | 'carrier';
  count: number;
  formation: Formation;
  /** 0..1 horizontal anchor (for fromLeft/fromRight: vertical anchor). */
  x: number;
  /** Seconds between spawns (column, random, side formations). */
  interval: number;
  /** 0..1 width fraction used by line formations. */
  spread: number;
  /** Forced weapon colour for carriers (random otherwise). */
  weapon?: WeaponType;
}

export type BossPatternType = 'aimed' | 'spread' | 'ring' | 'spiral' | 'missiles' | 'minions' | 'curtain';

export interface BossPattern {
  type: BossPatternType;
  interval: number;
  count: number;
  speed: number;
  minion?: EnemyKind;
}

export interface BossDef {
  name: string;
  hp: number;
  points: number;
  /** Seed for the procedural sprite generator. */
  seed: number;
  colors: { main: string; light: string; dark: string; accent: string };
  /** Half width / height of the generated sprite, in art pixels. */
  halfW: number;
  h: number;
  patterns: BossPattern[];
  /** Extra patterns activated below 50% HP. */
  rage: BossPattern[];
  holdsDog: boolean;
}

export interface LevelDef {
  name: string;
  /** Nebula palette from darkest to brightest. */
  nebula: [string, string, string, string];
  /** Multiplier on enemy bullet speed and fire rate. */
  difficulty: number;
  waves: Wave[];
  boss: BossDef;
}

type WaveOpts = Partial<Pick<Wave, 'interval' | 'spread' | 'weapon'>>;

function w(at: number, kind: Wave['kind'], count = 1, formation: Formation = 'single', x = 0.5, o: WaveOpts = {}): Wave {
  return { at, kind, count, formation, x, interval: o.interval ?? 0.4, spread: o.spread ?? 0.6, weapon: o.weapon };
}

const p = (type: BossPatternType, interval: number, count: number, speed: number, minion?: EnemyKind): BossPattern =>
  ({ type, interval, count, speed, minion });

export const LEVELS: LevelDef[] = [
  {
    name: 'Nébuleuse Violette',
    nebula: ['#140a2e', '#2a1452', '#46207a', '#6b35a3'],
    difficulty: 1,
    waves: [
      w(1, 'basic', 5, 'line', 0.5, { spread: 0.6 }),
      w(4, 'basic', 5, 'column', 0.25),
      w(5, 'basic', 5, 'column', 0.75),
      w(7, 'carrier', 1, 'single', 0.5, { weapon: 'green' }),
      w(10, 'secondary', 6, 'random', 0.5, { interval: 0.5 }),
      w(14, 'vBall', 7, 'v', 0.5),
      w(18, 'green', 4, 'line', 0.5, { spread: 0.7 }),
      w(21, 'basic', 8, 'fromLeft', 0.2, { interval: 0.25 }),
      w(23, 'basic', 8, 'fromRight', 0.3, { interval: 0.25 }),
      w(25, 'carrier', 1, 'single', 0.3),
      w(27, 'turret', 2, 'line', 0.5, { spread: 0.6 }),
      w(30, 'marbleBomb', 2, 'line', 0.5, { spread: 0.5 }),
      w(33, 'secondary', 8, 'random', 0.5, { interval: 0.35 }),
      w(36, 'robotRabbit', 3, 'random', 0.5, { interval: 0.8 }),
      w(40, 'vBall', 9, 'v', 0.33),
      w(42, 'vBall', 9, 'v', 0.67),
      w(44, 'carrier', 1, 'single', 0.7),
      w(46, 'green', 6, 'column', 0.5, { interval: 0.5 }),
      w(50, 'turret', 3, 'line', 0.5, { spread: 0.7 }),
      w(52, 'basic', 10, 'random', 0.5, { interval: 0.25 }),
      w(56, 'marbleBomb', 3, 'random', 0.5, { interval: 1 }),
      w(59, 'robotRabbit', 4, 'random', 0.5, { interval: 0.6 }),
      w(61, 'carrier', 1, 'single', 0.5),
      w(63, 'secondary', 6, 'fromLeft', 0.15, { interval: 0.3 }),
      w(64, 'secondary', 6, 'fromRight', 0.25, { interval: 0.3 }),
      w(68, 'vBall', 11, 'v', 0.5),
      w(71, 'green', 5, 'line', 0.5, { spread: 0.8 }),
      w(74, 'turret', 2, 'line', 0.5, { spread: 0.4 }),
    ],
    boss: {
      name: 'Croiseur Gourmand',
      hp: 320, points: 10_000, seed: 11, halfW: 14, h: 20, holdsDog: false,
      colors: { main: '#e8e4f4', light: '#ffffff', dark: '#7b6f99', accent: '#ffb02e' },
      patterns: [p('spread', 1.4, 5, 170), p('aimed', 0.9, 1, 230)],
      rage: [p('ring', 2.6, 14, 140)],
    },
  },
  {
    name: 'Ceinture Indigo',
    nebula: ['#0a0c2e', '#16205a', '#233486', '#3a52b0'],
    difficulty: 1.2,
    waves: [
      w(1, 'secondary', 6, 'line', 0.5, { spread: 0.7 }),
      w(3, 'carrier', 1, 'single', 0.5),
      w(5, 'magnet', 1, 'single', 0.5),
      w(7, 'basic', 10, 'random', 0.5, { interval: 0.2 }),
      w(11, 'turretPlus', 2, 'line', 0.5, { spread: 0.6 }),
      w(13, 'vBall', 9, 'v', 0.5),
      w(16, 'missileLauncher', 2, 'line', 0.5, { spread: 0.5 }),
      w(19, 'armoredRect', 3, 'column', 0.3, { interval: 0.9 }),
      w(20, 'armoredRect', 3, 'column', 0.7, { interval: 0.9 }),
      w(24, 'carrier', 1, 'single', 0.2),
      w(25, 'green', 8, 'fromLeft', 0.25, { interval: 0.3 }),
      w(27, 'green', 8, 'fromRight', 0.2, { interval: 0.3 }),
      w(30, 'marbleBomb', 4, 'random', 0.5, { interval: 0.8 }),
      w(33, 'turret', 4, 'line', 0.5, { spread: 0.8 }),
      w(35, 'magnet', 2, 'line', 0.5, { spread: 0.5 }),
      w(37, 'robotRabbit', 5, 'random', 0.5, { interval: 0.5 }),
      w(40, 'carrier', 1, 'single', 0.8),
      w(42, 'missileLauncher', 3, 'random', 0.5, { interval: 1.2 }),
      w(45, 'vBall', 11, 'v', 0.3),
      w(46, 'vBall', 11, 'v', 0.7),
      w(50, 'turretPlus', 3, 'line', 0.5, { spread: 0.7 }),
      w(52, 'secondary', 12, 'random', 0.5, { interval: 0.22 }),
      w(56, 'armoredRect', 4, 'line', 0.5, { spread: 0.7 }),
      w(58, 'carrier', 1, 'single', 0.4),
      w(61, 'basic', 10, 'fromLeft', 0.1, { interval: 0.2 }),
      w(62, 'basic', 10, 'fromRight', 0.2, { interval: 0.2 }),
      w(65, 'magnet', 1, 'single', 0.3),
      w(66, 'missileLauncher', 2, 'line', 0.6, { spread: 0.5 }),
      w(70, 'green', 8, 'line', 0.5, { spread: 0.9 }),
      w(74, 'turretPlus', 2, 'line', 0.5, { spread: 0.3 }),
    ],
    boss: {
      name: 'Forteresse Indigo',
      hp: 520, points: 15_000, seed: 23, halfW: 15, h: 22, holdsDog: false,
      colors: { main: '#9fb4e8', light: '#e6efff', dark: '#3c4f8c', accent: '#5be36a' },
      patterns: [p('spiral', 0.12, 2, 150), p('missiles', 2.4, 2, 160)],
      rage: [p('spread', 1.1, 7, 190), p('minions', 4, 3, 0, 'secondary')],
    },
  },
  {
    name: 'Abysses Magenta',
    nebula: ['#1e0822', '#3d0f45', '#651a6a', '#93308f'],
    difficulty: 1.4,
    waves: [
      w(1, 'green', 6, 'line', 0.5, { spread: 0.8 }),
      w(3, 'carrier', 1, 'single', 0.5),
      w(5, 'tank', 1, 'single', 0.5),
      w(8, 'vBall', 11, 'v', 0.5),
      w(11, 'missileRect', 1, 'single', 0.3),
      w(13, 'secondary', 10, 'random', 0.5, { interval: 0.25 }),
      w(16, 'tankGreen', 1, 'single', 0.7),
      w(18, 'carrier', 1, 'single', 0.2),
      w(19, 'turretPlus', 3, 'line', 0.5, { spread: 0.8 }),
      w(22, 'magnet', 2, 'line', 0.5, { spread: 0.6 }),
      w(24, 'armoredRect', 3, 'column', 0.5, { interval: 0.8 }),
      w(27, 'robotRabbit', 6, 'random', 0.5, { interval: 0.4 }),
      w(30, 'tank', 2, 'line', 0.5, { spread: 0.6 }),
      w(33, 'missileLauncher', 3, 'line', 0.5, { spread: 0.7 }),
      w(35, 'carrier', 1, 'single', 0.6),
      w(37, 'marbleBomb', 5, 'random', 0.5, { interval: 0.6 }),
      w(41, 'missileRect', 2, 'line', 0.5, { spread: 0.6 }),
      w(45, 'basic', 12, 'fromLeft', 0.15, { interval: 0.18 }),
      w(46, 'basic', 12, 'fromRight', 0.25, { interval: 0.18 }),
      w(50, 'tankGreen', 2, 'line', 0.5, { spread: 0.6 }),
      w(52, 'carrier', 1, 'single', 0.4),
      w(54, 'vBall', 13, 'v', 0.4),
      w(56, 'green', 8, 'random', 0.5, { interval: 0.3 }),
      w(60, 'armoredRect', 4, 'line', 0.5, { spread: 0.8 }),
      w(63, 'missileRect', 1, 'single', 0.7),
      w(65, 'tank', 3, 'line', 0.5, { spread: 0.8 }),
      w(69, 'carrier', 1, 'single', 0.5),
      w(71, 'magnet', 1, 'single', 0.5),
      w(72, 'secondary', 12, 'random', 0.5, { interval: 0.2 }),
      w(76, 'tankGreen', 1, 'single', 0.3),
    ],
    boss: {
      name: 'Méduse de Fer',
      hp: 750, points: 25_000, seed: 47, halfW: 16, h: 24, holdsDog: false,
      colors: { main: '#ff9e8a', light: '#ffe0d6', dark: '#a8473f', accent: '#ffd93b' },
      patterns: [p('curtain', 1.8, 9, 120), p('aimed', 0.6, 3, 250), p('missiles', 3, 3, 170)],
      rage: [p('ring', 1.6, 20, 130), p('spiral', 0.1, 3, 170)],
    },
  },
  {
    name: 'Repaire du Ravisseur',
    nebula: ['#08061a', '#1b1040', '#33186a', '#552a8e'],
    difficulty: 1.5,
    waves: [
      w(1, 'carrier', 1, 'single', 0.5),
      w(2, 'secondary', 8, 'line', 0.5, { spread: 0.8 }),
      w(5, 'grinder', 1, 'single', 0.5),
      w(9, 'vBall', 13, 'v', 0.5),
      w(12, 'tankRed', 1, 'single', 0.3),
      w(14, 'green', 10, 'random', 0.5, { interval: 0.25 }),
      w(17, 'carrier', 1, 'single', 0.8),
      w(18, 'missileRect', 2, 'line', 0.5, { spread: 0.6 }),
      w(22, 'turretPlus', 4, 'line', 0.5, { spread: 0.85 }),
      w(24, 'magnet', 2, 'line', 0.5, { spread: 0.7 }),
      w(26, 'robotRabbit', 6, 'random', 0.5, { interval: 0.35 }),
      w(29, 'tankGreen', 2, 'line', 0.5, { spread: 0.7 }),
      w(32, 'grinder', 2, 'line', 0.5, { spread: 0.6 }),
      w(34, 'carrier', 1, 'single', 0.3),
      w(36, 'marbleBomb', 6, 'random', 0.5, { interval: 0.5 }),
      w(39, 'armoredRect', 5, 'line', 0.5, { spread: 0.85 }),
      w(42, 'missileLauncher', 4, 'random', 0.5, { interval: 0.8 }),
      w(45, 'tankRed', 1, 'single', 0.7),
      w(46, 'tank', 2, 'line', 0.4, { spread: 0.5 }),
      w(49, 'carrier', 1, 'single', 0.5),
      w(51, 'vBall', 13, 'v', 0.3),
      w(52, 'vBall', 13, 'v', 0.7),
      w(55, 'basic', 14, 'fromLeft', 0.1, { interval: 0.15 }),
      w(56, 'secondary', 14, 'fromRight', 0.2, { interval: 0.15 }),
      w(60, 'missileRect', 2, 'line', 0.5, { spread: 0.7 }),
      w(62, 'grinder', 1, 'single', 0.5),
      w(64, 'carrier', 1, 'single', 0.6),
      w(66, 'tankRed', 2, 'line', 0.5, { spread: 0.6 }),
      w(70, 'green', 12, 'random', 0.5, { interval: 0.2 }),
      w(74, 'tankGreen', 2, 'line', 0.5, { spread: 0.8 }),
    ],
    boss: {
      name: 'Le Ravisseur',
      hp: 950, points: 50_000, seed: 97, halfW: 18, h: 26, holdsDog: true,
      colors: { main: '#c9c3dd', light: '#ffffff', dark: '#4d4466', accent: '#ff3b4e' },
      patterns: [p('spread', 1.4, 9, 180), p('spiral', 0.13, 2, 150), p('missiles', 3, 3, 170)],
      rage: [p('ring', 1.9, 18, 130), p('curtain', 2.8, 9, 120), p('minions', 6, 3, 0, 'green')],
    },
  },
];
