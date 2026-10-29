// Builds pixel-art sprites onto cached offscreen canvases.
import { PX } from '../config';
import { LEVELS } from '../data/levels';
import { WEAPONS, WEAPON_TYPES, type WeaponType } from '../data/weapons';
import { bossHalfRows, sphere, sawBlade, spiralDisc, tankRows, turretRows } from './procedural';
import { BASE_PALETTE, SPRITES, expandRows } from './spriteData';

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Size in logical pixels. */
  w: number;
  h: number;
}

export function buildSprite(rows: string[], palette: Record<string, string>, px = PX): Sprite {
  const h = rows.length;
  const w = rows[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w * px;
  canvas.height = h * px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === undefined) continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * px, y * px, px, px);
    }
  }
  return { canvas, w: w * px, h: h * px };
}

function whiten(palette: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(palette)) out[k] = '#ffffff';
  return out;
}


/** All game sprites, generated once at startup. */
export class SpriteBank {
  private sprites = new Map<string, Sprite>();
  private flashes = new Map<string, Sprite>();
  private sources = new Map<string, { rows: string[]; palette: Record<string, string> }>();

  constructor() {
    for (const [name, d] of Object.entries(SPRITES)) this.add(name, expandRows(d), d.palette);

    for (const t of WEAPON_TYPES) {
      const info = WEAPONS[t];
      this.add(`carrier_${t}`, expandRows(SPRITES.carrier), { ...SPRITES.carrier.palette, X: info.color });
      this.add(`pickup_${t}`, expandRows(SPRITES.pickup), {
        ...SPRITES.pickup.palette, X: info.color, L: info.light, D: info.dark,
      });
    }

    for (let i = 0; i < 4; i++) this.add(`vBall_${i}`, spiralDisc(4, i / 4), BASE_PALETTE);
    for (let i = 0; i < 3; i++) this.add(`grinder_${i}`, sawBlade(8, 10, i / 3), BASE_PALETTE);
    for (let i = 0; i < 2; i++) this.add(`disc_${i}`, sawBlade(3, 6, i / 2), BASE_PALETTE);
    this.add('marbleBomb', sphere(5), BASE_PALETTE);
    this.add('turret', turretRows(6, 's', 'S'), BASE_PALETTE);
    this.add('turretPlus', turretRows(7, 'o', 'O'), BASE_PALETTE);
    this.add('tank', tankRows(7, 14, 'b', 'B'), BASE_PALETTE);
    this.add('tankGreen', tankRows(8, 15, 'g', 'G'), BASE_PALETTE);
    this.add('tankRed', tankRows(9, 17, 'r', 'R'), BASE_PALETTE);

    LEVELS.forEach((lvl, i) => {
      const b = lvl.boss;
      const half = bossHalfRows(b.seed, b.halfW, b.h);
      const rows = half.map((r) => r + [...r.slice(0, -1)].reverse().join(''));
      this.add(`boss_${i}`, rows, {
        k: BASE_PALETTE.k, m: b.colors.main, l: b.colors.light, d: b.colors.dark, a: b.colors.accent,
      });
    });
  }

  private add(name: string, rows: string[], palette: Record<string, string>): void {
    this.sources.set(name, { rows, palette });
    this.sprites.set(name, buildSprite(rows, palette));
  }

  get(name: string): Sprite {
    const s = this.sprites.get(name);
    if (!s) throw new Error(`Unknown sprite ${name}`);
    return s;
  }

  /** White silhouette used for hit flashes (built lazily). */
  flash(name: string): Sprite {
    let s = this.flashes.get(name);
    if (!s) {
      const src = this.sources.get(name);
      if (!src) throw new Error(`Unknown sprite ${name}`);
      s = buildSprite(src.rows, whiten(src.palette));
      this.flashes.set(name, s);
    }
    return s;
  }
}

export function carrierSprite(t: WeaponType): string {
  return `carrier_${t}`;
}

/** Draws a sprite centred on (x, y), with optional rotation and scale. */
export function drawSprite(
  ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, rot = 0, sx = 1, sy = 1,
): void {
  if (rot === 0 && sx === 1 && sy === 1) {
    ctx.drawImage(s.canvas, Math.round(x - s.w / 2), Math.round(y - s.h / 2));
    return;
  }
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (rot !== 0) ctx.rotate(rot);
  ctx.scale(sx, sy);
  ctx.drawImage(s.canvas, -s.w / 2, -s.h / 2);
  ctx.restore();
}
