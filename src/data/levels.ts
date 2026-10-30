// Level and boss definitions. Waves are pure data interpreted by game/spawner.ts.
import { Rng } from '../core/math';
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

const HAND_MADE_LEVELS: LevelDef[] = [
  {
    name: 'Violet Nebula',
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
      name: 'Greedy Cruiser',
      hp: 320, points: 10_000, seed: 11, halfW: 14, h: 20, holdsDog: false,
      colors: { main: '#e8e4f4', light: '#ffffff', dark: '#7b6f99', accent: '#ffb02e' },
      patterns: [p('spread', 1.4, 5, 170), p('aimed', 0.9, 1, 230)],
      rage: [p('ring', 2.6, 14, 140)],
    },
  },
  {
    name: 'Indigo Belt',
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
      name: 'Indigo Fortress',
      hp: 520, points: 15_000, seed: 23, halfW: 15, h: 22, holdsDog: false,
      colors: { main: '#9fb4e8', light: '#e6efff', dark: '#3c4f8c', accent: '#5be36a' },
      patterns: [p('spiral', 0.12, 2, 150), p('missiles', 2.4, 2, 160)],
      rage: [p('spread', 1.1, 7, 190), p('minions', 4, 3, 0, 'secondary')],
    },
  },
  {
    name: 'Magenta Abyss',
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
      name: 'Iron Jellyfish',
      hp: 750, points: 25_000, seed: 47, halfW: 16, h: 24, holdsDog: false,
      colors: { main: '#ff9e8a', light: '#ffe0d6', dark: '#a8473f', accent: '#ffd93b' },
      patterns: [p('curtain', 1.8, 9, 120), p('aimed', 0.6, 3, 250), p('missiles', 3, 3, 170)],
      rage: [p('ring', 1.6, 20, 130), p('spiral', 0.1, 3, 170)],
    },
  },
];

// ---------------------------------------------------------------- generated levels (4..10)

/** Total number of levels. The last one is the Kidnapper's Lair, where the dog is held. */
export const LEVEL_COUNT = 10;

type Tier = 'swarm' | 'mid' | 'heavy';

interface KindProfile {
  tier: Tier;
  /** Base spawn weight and its change per level above 4. */
  weight: number;
  growth: number;
  /** Enemies per wave at level 4, and extra enemies gained per level (rounded down). */
  count: [number, number];
  extra: number;
  max: number;
  formations: Formation[];
  /** Seconds between spawns inside a wave. */
  interval: number;
}

const SIDES: Formation[] = ['fromLeft'];
const PROFILES: Record<EnemyKind, KindProfile> = {
  basic: { tier: 'swarm', weight: 4, growth: -0.3, count: [8, 12], extra: 0.8, max: 18, formations: ['line', 'column', 'random', ...SIDES], interval: 0.18 },
  secondary: { tier: 'swarm', weight: 4, growth: -0.2, count: [6, 12], extra: 0.8, max: 18, formations: ['line', 'column', 'random', ...SIDES], interval: 0.2 },
  green: { tier: 'swarm', weight: 4, growth: 0, count: [6, 10], extra: 0.7, max: 16, formations: ['line', 'column', 'random', ...SIDES], interval: 0.22 },
  vBall: { tier: 'swarm', weight: 3, growth: 0.2, count: [9, 13], extra: 0.6, max: 17, formations: ['v'], interval: 0 },
  marbleBomb: { tier: 'mid', weight: 3, growth: 0.1, count: [3, 6], extra: 0.5, max: 10, formations: ['random', 'line'], interval: 0.6 },
  robotRabbit: { tier: 'mid', weight: 3, growth: 0.1, count: [4, 6], extra: 0.5, max: 10, formations: ['random'], interval: 0.4 },
  turret: { tier: 'mid', weight: 3, growth: 0, count: [2, 4], extra: 0.4, max: 7, formations: ['line'], interval: 0 },
  magnet: { tier: 'mid', weight: 2, growth: 0.2, count: [1, 2], extra: 0.3, max: 5, formations: ['line', 'single'], interval: 0 },
  missileLauncher: { tier: 'mid', weight: 2, growth: 0.3, count: [2, 4], extra: 0.4, max: 8, formations: ['line', 'random'], interval: 0.9 },
  armoredRect: { tier: 'heavy', weight: 2, growth: 0.3, count: [3, 5], extra: 0.4, max: 8, formations: ['line', 'column'], interval: 0.8 },
  turretPlus: { tier: 'heavy', weight: 2, growth: 0.3, count: [2, 4], extra: 0.4, max: 7, formations: ['line'], interval: 0 },
  tank: { tier: 'heavy', weight: 2, growth: 0.4, count: [1, 3], extra: 0.4, max: 6, formations: ['line', 'single'], interval: 0 },
  tankGreen: { tier: 'heavy', weight: 1.5, growth: 0.5, count: [1, 2], extra: 0.4, max: 5, formations: ['line', 'single'], interval: 0 },
  missileRect: { tier: 'heavy', weight: 1.5, growth: 0.5, count: [1, 2], extra: 0.4, max: 5, formations: ['line', 'single'], interval: 0 },
  grinder: { tier: 'heavy', weight: 1.5, growth: 0.5, count: [1, 2], extra: 0.4, max: 5, formations: ['line', 'single'], interval: 0 },
  tankRed: { tier: 'heavy', weight: 1.5, growth: 0.6, count: [1, 2], extra: 0.3, max: 4, formations: ['line', 'single'], interval: 0 },
};

const PROFILE_KINDS = Object.keys(PROFILES) as EnemyKind[];

/** Number of waves of a generated level: grows by 4 per level (34 at level 4, 58 at level 10). */
export function waveTarget(level: number): number {
  return 34 + 4 * (level - 4);
}

function pickKind(rng: Rng, level: number, progress: number): EnemyKind {
  const weights = PROFILE_KINDS.map((k) => {
    const pr = PROFILES[k];
    const base = Math.max(0.5, pr.weight + pr.growth * (level - 4));
    // Heavy units arrive later in the level so each level ramps up before the boss.
    return pr.tier === 'heavy' ? base * (0.15 + progress * 1.1) : pr.tier === 'mid' ? base * (0.6 + progress * 0.6) : base * (1.2 - progress * 0.5);
  });
  let r = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return PROFILE_KINDS[i];
  }
  return PROFILE_KINDS[0];
}

function buildWaves(level: number, rng: Rng): Wave[] {
  const waves: Wave[] = [];
  const target = waveTarget(level);
  const pace = 1 - 0.045 * (level - 4);
  let at = 1;
  let n = 0;
  while (n < target) {
    const progress = n / target;
    if (n > 0 && n % 6 === 3) {
      waves.push(w(at, 'carrier', 1, 'single', rng.range(0.2, 0.8)));
      n++;
      at += rng.range(0.8, 1.4) * pace;
      continue;
    }
    const kind = pickKind(rng, level, progress);
    const pr = PROFILES[kind];
    const count = Math.min(pr.max, rng.int(pr.count[0], pr.count[1]) + Math.floor(pr.extra * (level - 4)));
    const formation = rng.pick(pr.formations);
    if (formation === 'fromLeft') {
      const y = rng.range(0.1, 0.4);
      waves.push(w(at, kind, count, 'fromLeft', y, { interval: pr.interval }));
      waves.push(w(at + 1, kind, count, 'fromRight', y + rng.range(0, 0.1), { interval: pr.interval }));
      n += 2;
    } else if (formation === 'v') {
      waves.push(w(at, kind, count % 2 === 0 ? count + 1 : count, 'v', rng.range(0.3, 0.7)));
      n++;
    } else if (formation === 'line') {
      waves.push(w(at, kind, count, 'line', 0.5, { spread: Math.min(0.9, 0.2 + 0.1 * count) }));
      n++;
    } else if (formation === 'column') {
      waves.push(w(at, kind, count, 'column', rng.range(0.2, 0.8), { interval: pr.interval }));
      n++;
    } else if (formation === 'single') {
      waves.push(w(at, kind, count, 'column', rng.range(0.2, 0.8), { interval: Math.max(pr.interval, 1.2) }));
      n++;
    } else {
      waves.push(w(at, kind, count, 'random', 0.5, { interval: pr.interval }));
      n++;
    }
    at += rng.range(1.5, 2.8) * pace;
  }
  return waves;
}

interface GeneratedTheme {
  name: string;
  nebula: [string, string, string, string];
  boss: Omit<BossDef, 'holdsDog'>;
}

const GENERATED_THEMES: GeneratedTheme[] = [
  {
    name: 'Ember Drift',
    nebula: ['#2a0a08', '#531410', '#852216', '#b83a22'],
    boss: {
      name: 'Ember Sentinel', hp: 1000, points: 35_000, seed: 131, halfW: 17, h: 24,
      colors: { main: '#ffb27a', light: '#ffe6d0', dark: '#a24a1e', accent: '#ffe25a' },
      patterns: [p('aimed', 0.5, 3, 260), p('curtain', 1.7, 10, 130)],
      rage: [p('spiral', 0.1, 3, 170), p('missiles', 2.6, 3, 170)],
    },
  },
  {
    name: 'Emerald Veil',
    nebula: ['#06201a', '#0c3d30', '#13644a', '#21966a'],
    boss: {
      name: 'Emerald Hydra', hp: 1250, points: 45_000, seed: 151, halfW: 18, h: 24,
      colors: { main: '#8fe8a8', light: '#d8ffe2', dark: '#2d7a48', accent: '#ff6fb5' },
      patterns: [p('spread', 1.2, 7, 190), p('missiles', 2.6, 3, 170)],
      rage: [p('ring', 1.7, 18, 140), p('minions', 5, 3, 0, 'secondary')],
    },
  },
  {
    name: 'Frozen Reach',
    nebula: ['#06182a', '#0d3556', '#16588a', '#2a86b8'],
    boss: {
      name: 'Frost Leviathan', hp: 1500, points: 60_000, seed: 173, halfW: 19, h: 25,
      colors: { main: '#a8e4ff', light: '#eefaff', dark: '#2c6a96', accent: '#3f8cff' },
      patterns: [p('curtain', 1.6, 11, 130), p('aimed', 0.55, 3, 255)],
      rage: [p('spiral', 0.09, 3, 175), p('spread', 1, 9, 200)],
    },
  },
  {
    name: 'Golden Wastes',
    nebula: ['#241a05', '#4a3510', '#7a5a18', '#b08a2a'],
    boss: {
      name: 'Golden Colossus', hp: 1800, points: 75_000, seed: 197, halfW: 19, h: 26,
      colors: { main: '#ffe08a', light: '#fff7d6', dark: '#9a6e12', accent: '#ff3b4e' },
      patterns: [p('spread', 1.2, 9, 190), p('spiral', 0.1, 2, 160), p('missiles', 2.6, 4, 170)],
      rage: [p('ring', 1.6, 20, 140), p('minions', 5, 3, 0, 'green')],
    },
  },
  {
    name: 'Crimson Rift',
    nebula: ['#22060f', '#4a0e22', '#7a1738', '#ac2850'],
    boss: {
      name: 'Crimson Reaper', hp: 2150, points: 90_000, seed: 211, halfW: 20, h: 26,
      colors: { main: '#ff7a96', light: '#ffd0da', dark: '#8e1d3a', accent: '#ffd93b' },
      patterns: [p('aimed', 0.45, 4, 270), p('curtain', 1.5, 11, 135), p('missiles', 2.4, 4, 175)],
      rage: [p('spiral', 0.08, 3, 180), p('ring', 1.5, 22, 140), p('minions', 5, 4, 0, 'secondary')],
    },
  },
  {
    name: 'Void Gate',
    nebula: ['#050510', '#0e0e2a', '#1a1a4a', '#2e2e78'],
    boss: {
      name: 'Void Warden', hp: 2500, points: 110_000, seed: 233, halfW: 21, h: 27,
      colors: { main: '#9a9aff', light: '#dcdcff', dark: '#2a2a78', accent: '#5be36a' },
      patterns: [p('spread', 1, 11, 200), p('spiral', 0.1, 3, 165), p('missiles', 2.2, 5, 180)],
      rage: [p('ring', 1.4, 24, 145), p('curtain', 2.2, 11, 125), p('minions', 4.5, 4, 0, 'green')],
    },
  },
  {
    name: "Kidnapper's Lair",
    nebula: ['#08061a', '#1b1040', '#33186a', '#552a8e'],
    boss: {
      name: 'The Kidnapper', hp: 3200, points: 150_000, seed: 97, halfW: 20, h: 28,
      colors: { main: '#c9c3dd', light: '#ffffff', dark: '#4d4466', accent: '#ff3b4e' },
      patterns: [p('spread', 1.2, 11, 190), p('spiral', 0.1, 3, 165), p('missiles', 2.4, 5, 180), p('aimed', 0.6, 3, 250)],
      rage: [p('ring', 1.5, 22, 140), p('curtain', 2.2, 11, 125), p('minions', 5, 4, 0, 'green'), p('spiral', 0.08, 3, 175)],
    },
  },
];

/** Builds level `level` (4..LEVEL_COUNT): more waves, denser groups, heavier units and a tougher boss each time. */
function generateLevel(level: number): LevelDef {
  const theme = GENERATED_THEMES[level - 4];
  return {
    name: theme.name,
    nebula: theme.nebula,
    difficulty: Math.round((1.4 + 0.1 * (level - 3)) * 100) / 100,
    waves: buildWaves(level, new Rng(0x5eed + level * 7919)),
    boss: { ...theme.boss, holdsDog: level === LEVEL_COUNT },
  };
}

export const LEVELS: LevelDef[] = [
  ...HAND_MADE_LEVELS,
  ...Array.from({ length: LEVEL_COUNT - HAND_MADE_LEVELS.length }, (_, i) => generateLevel(HAND_MADE_LEVELS.length + 1 + i)),
];
