// Procedural pixel-art generators. Pure functions returning full rows (no mirroring needed).
import { Rng } from '../core/math';

type CellFn = (dx: number, dy: number, d: number, a: number) => string;

/** Draws a disc-shaped sprite of the given art radius using a per-cell function. */
export function discRows(radius: number, fn: CellFn): string[] {
  const size = radius * 2 + 1;
  const rows: string[] = [];
  for (let y = 0; y < size; y++) {
    let row = '';
    for (let x = 0; x < size; x++) {
      const dx = x - radius;
      const dy = y - radius;
      const d = Math.sqrt(dx * dx + dy * dy);
      row += d <= radius + 0.35 ? fn(dx, dy, d, Math.atan2(dy, dx)) : '.';
    }
    rows.push(row);
  }
  return rows;
}

/** Orange "snail" disc with a concentric spiral (V-formation balls). */
export function spiralDisc(radius: number, phase = 0): string[] {
  return discRows(radius, (_dx, _dy, d, a) => {
    if (d > radius - 0.7) return 'k';
    const s = (a / (Math.PI * 2) + d / 2.2 + phase) % 1;
    return (s + 1) % 1 < 0.5 ? 'o' : d < 1.2 ? 'y' : 'O';
  });
}

/** Shaded sphere (marble bomb) with a red core light. */
export function sphere(radius: number): string[] {
  return discRows(radius, (dx, dy, d) => {
    if (d > radius - 0.7) return 'k';
    if (d < 1.3) return 'r';
    const light = -(dx + dy) / (radius * 1.5);
    if (light > 0.55) return 'w';
    if (light > 0.1) return 's';
    return 'S';
  });
}

/** Spinning saw blade (grinder enemy and its projectiles). */
export function sawBlade(radius: number, teeth: number, phase = 0): string[] {
  return discRows(radius, (_dx, _dy, d, a) => {
    const t = ((a / (Math.PI * 2)) * teeth + phase) % 1;
    const tooth = (t + 1) % 1 < 0.5;
    if (d > radius - 1.2) return tooth ? 'w' : '.';
    if (d > radius - 2.2) return 'k';
    if (d > radius * 0.45) return 's';
    if (d > radius * 0.3) return 'k';
    return 'm';
  });
}

/** Ground turret: hex-ish platform with a dome. */
export function turretRows(radius: number, dome: string, domeDark: string): string[] {
  return discRows(radius, (dx, dy, d) => {
    if (d > radius - 0.7) return 'k';
    if (d > radius * 0.62) return (Math.abs(dx) + Math.abs(dy)) % 3 === 0 ? 'Q' : 'q';
    if (d > radius * 0.55) return 'k';
    return dx + dy < 0 ? dome : domeDark;
  });
}

/** Tank seen from above: two treads, armoured body and a round turret base. */
export function tankRows(halfW: number, h: number, body: string, bodyDark: string): string[] {
  const w = halfW * 2 + 1;
  const rows: string[] = [];
  const cy = Math.floor(h / 2);
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const fromEdge = Math.min(x, w - 1 - x);
      const dx = x - halfW;
      const dy = y - cy;
      const dome = Math.sqrt(dx * dx + dy * dy);
      let c: string;
      if (fromEdge === 0 || y === 0 || y === h - 1) c = 'k';
      else if (fromEdge <= 2) c = y % 2 === 0 ? 'S' : 's';
      else if (fromEdge === 3) c = 'k';
      else if (dome < halfW * 0.4) c = dome > halfW * 0.4 - 1 ? 'k' : dx + dy < 0 ? 'w' : 's';
      else c = y < 2 || fromEdge === 4 ? bodyDark : body;
      row += c;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Seeded symmetric boss generator. Returns LEFT-half rows (centre column last), meant to be mirrored.
 * Silhouette = smooth random width profile + wing spikes + hanging cannons; shaded panels and windows.
 * Palette chars: m main, l light, d dark, a accent, k outline.
 */
export function bossHalfRows(seed: number, halfW: number, h: number): string[] {
  const rng = new Rng(seed);
  // 1-cell padding (left, top) and 4 extra rows at the bottom for cannons + outline.
  const W = halfW + 1;
  const H = h + 5;
  const cells: string[][] = Array.from({ length: H }, () => new Array<string>(W).fill('.'));
  const set = (x: number, y: number, c: string): void => {
    if (x >= 1 && x < W && y >= 1 && y < H - 1) cells[y][x] = c;
  };

  // Smooth width profile from random control points.
  const ctrl = Array.from({ length: 6 }, (_, i) => (i === 0 ? 0.3 : rng.range(0.45, 1)));
  const widthAt = (t: number): number => {
    const f = t * (ctrl.length - 1);
    const i = Math.min(ctrl.length - 2, Math.floor(f));
    const k = f - i;
    const s = k * k * (3 - 2 * k);
    return ctrl[i] + (ctrl[i + 1] - ctrl[i]) * s;
  };
  const widths: number[] = [];
  for (let r = 0; r < h; r++) {
    const t = r / (h - 1);
    const taper = t > 0.85 ? 1 - (t - 0.85) * 3 : 1;
    widths.push(Math.max(2, Math.round(halfW * widthAt(t) * taper)));
  }
  // Wing spikes: a few rows that extend to (almost) the full width.
  const spikeRows = rng.int(1, 2);
  for (let i = 0; i < spikeRows; i++) {
    const r = rng.int(Math.floor(h * 0.35), Math.floor(h * 0.7));
    widths[r] = halfW;
    widths[r + 1] = Math.max(widths[r + 1], halfW - 2);
  }
  const panelEvery = rng.int(3, 5);
  for (let r = 0; r < h; r++) {
    const y = r + 1;
    const wr = widths[r];
    for (let fc = 0; fc < wr; fc++) {
      const x = W - 1 - fc;
      let c = 'm';
      if (fc === wr - 1) c = 'd';
      else if (fc === wr - 2 || r === 0) c = 'l';
      else if (r % panelEvery === 0 && fc > 1) c = 'd';
      else if (fc === 0) c = 'l';
      set(x, y, c);
    }
    // Bottom shading: cells with nothing (or a narrower row) below are dark.
    const below = r + 1 < h ? widths[r + 1] : 0;
    for (let fc = below; fc < wr; fc++) set(W - 1 - fc, y, 'd');
  }
  // Symmetric windows.
  const windows = rng.int(2, 4);
  for (let i = 0; i < windows; i++) {
    const r = rng.int(2, h - 4);
    const fc = rng.int(2, Math.max(2, widths[r] - 3));
    set(W - 1 - fc, r + 1, 'a');
    set(W - 1 - fc - 1, r + 1, 'a');
  }
  // Cockpit core on the centre column.
  const core = Math.floor(h * 0.55);
  for (let y = core; y < core + 3; y++) set(W - 1, y, 'a');
  set(W - 2, core + 1, 'a');
  // Hanging cannons.
  const cannons = rng.int(1, 2);
  for (let i = 0; i < cannons; i++) {
    const fc = rng.int(2, Math.max(2, Math.min(halfW - 2, widths[h - 3] - 1)));
    for (let y = h - 2; y < h + 3; y++) set(W - 1 - fc, y, y >= h + 1 ? 'l' : 'd');
  }
  // Outline pass.
  const filled = (x: number, y: number): boolean => y >= 0 && y < H && x >= 0 && x < W && cells[y][x] !== '.' && cells[y][x] !== 'k';
  const rows: string[] = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    for (let x = 0; x < W; x++) {
      if (cells[y][x] !== '.') row += cells[y][x];
      else row += filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1) ? 'k' : '.';
    }
    rows.push(row);
  }
  return rows;
}
