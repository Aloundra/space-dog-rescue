// Text helpers: pixel digit font (score, points) and outlined canvas text (menus).
import { DIGITS } from './spriteData';

export type Align = 'left' | 'center' | 'right';

/** Draws digits with the 3x5 pixel font. `cell` = size of one font pixel. */
export function drawDigits(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, cell: number,
  color: string, outline: string | null = null, align: Align = 'left',
): void {
  const glyphW = 4 * cell;
  const total = text.length * glyphW - cell;
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
  cx = Math.round(cx);
  const cy = Math.round(y);
  const paint = (ox: number, oy: number, c: string): void => {
    ctx.fillStyle = c;
    let gx = cx;
    for (const ch of text) {
      const g = DIGITS[ch];
      if (g) {
        for (let r = 0; r < 5; r++) {
          for (let k = 0; k < 3; k++) {
            if (g[r][k] === '#') ctx.fillRect(gx + k * cell + ox, cy + r * cell + oy, cell, cell);
          }
        }
      }
      gx += glyphW;
    }
  };
  if (outline) {
    const o = Math.max(1, Math.floor(cell / 4));
    for (const [ox, oy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]]) paint(ox, oy, outline);
  }
  paint(0, 0, color);
}

export const FONT = "'Trebuchet MS', 'Verdana', sans-serif";

export function drawText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string,
  align: Align = 'center', outline: string | null = '#120c2a', weight = 'bold',
): void {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size / 6);
    ctx.strokeStyle = outline;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
