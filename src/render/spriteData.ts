// Hand-made pixel-art matrices. One char = one art pixel; '.' = transparent.
// Mirrored sprites store the LEFT half including the centre column (full width = 2*w - 1).

export interface SpriteDef {
  rows: string[];
  mirror: boolean;
  palette: Record<string, string>;
}

export const BASE_PALETTE: Record<string, string> = {
  k: '#120c2a', // outline
  w: '#f4f6ff', // white
  l: '#bfe3ff', // light blue
  h: '#6ff0ff', // cyan
  b: '#4a8cff', // blue
  B: '#1f3f9a', // dark blue
  s: '#a7aec4', // grey
  S: '#5b6275', // dark grey
  c: '#fff0c8', // cream
  u: '#e0b040', // gold
  y: '#ffe25a', // yellow
  o: '#ff9a2e', // orange
  O: '#c45a12', // dark orange
  r: '#e8344e', // red
  R: '#8e1528', // dark red
  p: '#ff7ab8', // pink
  g: '#5be36a', // green
  G: '#23813a', // dark green
  v: '#b066ff', // violet
  m: '#ff9e8a', // salmon
  M: '#b2524a', // dark salmon
  n: '#9a6232', // brown
  N: '#5e3a1c', // dark brown
  q: '#4a4170', // platform
  Q: '#2c2648', // dark platform
};

const def = (rows: string[], mirror = true, palette: Record<string, string> = {}): SpriteDef => ({
  rows,
  mirror,
  palette: { ...BASE_PALETTE, ...palette },
});

export const SPRITES = {
  player: def([
    '......k',
    '.....kh',
    '.....kl',
    '....kwl',
    '....kwb',
    '...kwlb',
    '..kwwlb',
    '.kwlwwb',
    'kwllwww',
    'kwwlkww',
    'kSSk.kS',
    '.kk..kk',
  ]),
  basic: def([
    'kk....',
    'kuk...',
    'kuuk.k',
    '.kcckc',
    '..kccw',
    '..kcwl',
    '..kccw',
    '.kucck',
    'kuk.kk',
    'kk....',
  ]),
  secondary: def([
    '.....k',
    '....kb',
    '...kbl',
    'k..kbw',
    'kk.kbl',
    'kbkkbb',
    'kbbbbk',
    '.kbbkB',
    '..kk.B',
  ]),
  green: def([
    '..k...',
    '.kgk..',
    '..kgkk',
    '..kggg',
    '.kgGgy',
    'kgGggy',
    'kgkGgg',
    'kk.kGG',
    '....kk',
  ]),
  robotRabbit: def([
    '.k....',
    'kwk...',
    'kpk...',
    'kpk...',
    'kwkkkk',
    'kwwwww',
    'kwrwww',
    'kwwwwk',
    'kwwwww',
    '.kwwww',
    '.kSkkk',
    '..k...',
  ]),
  magnet: def([
    '..kkkk',
    '.krrrr',
    'krrrrr',
    'krrkkk',
    'krrk..',
    'krrk..',
    'krrk..',
    'kwwk..',
    'kkkk..',
  ]),
  missileLauncher: def([
    '.kk....',
    'krrk...',
    'kssk.kk',
    'kssk.ks',
    'ksskkss',
    'kssSsSw',
    'kssSssl',
    'kSSSssw',
    '.kkkSSs',
    '...kkkk',
  ]),
  armoredRect: def([
    'kkkkkkk',
    'kwwwwww',
    'kwsssss',
    'kwskkkk',
    'kwskggg',
    'kwskgGg',
    'kwskggg',
    'kwskkkk',
    'kwsssss',
    'kwsSsSs',
    'kwsssss',
    'kSSSSSS',
    'kkkkkkk',
  ]),
  missileRect: def([
    '.k...kkk',
    'krk.kwww',
    'krk.kwss',
    'ksk.kwsk',
    'ksk.kwsk',
    'kskkkwsk',
    'kssSkwsk',
    'kskkkwss',
    'ksk.kwSs',
    'ksk.kwss',
    'krk.kwss',
    'kkk.kSSS',
    '....kkkk',
  ]),
  carrier: def([
    '..kkkkkkk',
    '.kXXXXXXX',
    'kXXwXXXXX',
    'kXwwwXXkk',
    'kXXwXXkdd',
    'kXXXXXkdd',
    'kXXXXk...',
    '.kXXk....',
    '..kk.....',
  ], true, { X: '#ffffff', d: '#2a2350' }),
  pickup: def([
    '..kkk',
    '.kXXX',
    'kXLXX',
    'kXLXX',
    'kXXXX',
    'kXXXD',
    '.kDDD',
    '..kkk',
  ], true, { X: '#ffffff', L: '#ffffff', D: '#888888' }),
  heart: def([
    '.kk..',
    'krrk.',
    'krwrk',
    'krrrr',
    'krrrr',
    '.krrr',
    '..krr',
    '...kr',
    '....k',
  ]),
  slot: def([
    '..kkk',
    '.kwww',
    'kwwwk',
    'kwwwh',
    'kwkhh',
    'kwwwh',
    'kwwwk',
    '.kwww',
    '..kkk',
  ]),
  dog: def([
    'nn....',
    'nnn.cc',
    'nNcccc',
    'nNckcc',
    '.ncccc',
    '..cccc',
    '..ccck',
    '...ccp',
    '..cccc',
    '.cccwc',
    '.cc.cc',
    '.kk.kk',
  ]),
} satisfies Record<string, SpriteDef>;

export type SpriteName = keyof typeof SPRITES;

/** 3x5 pixel digits used for the score and floating points. */
export const DIGITS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  'x': ['...', '#.#', '.#.', '#.#', '...'],
};

/** Expands a sprite definition into full rows (applies mirroring). */
export function expandRows(d: SpriteDef): string[] {
  if (!d.mirror) return d.rows;
  return d.rows.map((r) => r + [...r.slice(0, -1)].reverse().join(''));
}
