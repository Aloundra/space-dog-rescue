// Loads artist-made PNG sprites and turns them into the same Sprite objects the renderer uses.
// Not wired into the game yet: SpriteBank still builds sprites procedurally.
import type { Sprite } from './sprites';

/** Loads one image; resolves once it is decoded. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite ${url}`));
    img.src = url;
  });
}

/** Loads every named sprite from `baseUrl` (`<baseUrl><name>.png`) in parallel. */
export async function loadSpriteImages(
  names: readonly string[], baseUrl = '/sprites/',
): Promise<Map<string, HTMLImageElement>> {
  const imgs = await Promise.all(names.map((n) => loadImage(`${baseUrl}${n}.png`)));
  return new Map(names.map((n, i) => [n, imgs[i]]));
}

/**
 * Scales an art image by `px` with nearest-neighbour sampling, as the procedural builder does.
 * One art pixel = one image pixel, so the result is `naturalWidth * px` by `naturalHeight * px`.
 */
export function imageToSprite(img: HTMLImageElement, px: number): Sprite {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w * px;
  canvas.height = h * px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w * px, h * px);
  return { canvas, w: w * px, h: h * px };
}

/** Returns a copy of `img` (as a canvas) with exact colours replaced, e.g. `{ '#ff00ff': '#ffd93b' }`. */
export function recolorImage(img: HTMLImageElement, map: Record<string, string>): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const table = new Map<number, [number, number, number]>();
  for (const [from, to] of Object.entries(map)) {
    table.set(hexKey(from), rgb(to));
  }
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
    const to = table.get(key);
    if (to) {
      px[i] = to[0];
      px[i + 1] = to[1];
      px[i + 2] = to[2];
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/** White silhouette of an image (alpha kept), used for hit flashes. */
export function silhouetteImage(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i] = 255;
    data.data[i + 1] = 255;
    data.data[i + 2] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

function rgb(hex: string): [number, number, number] {
  const k = hexKey(hex);
  return [(k >> 16) & 255, (k >> 8) & 255, k & 255];
}

function hexKey(hex: string): number {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) throw new Error(`Invalid colour ${hex}`);
  return parseInt(m[1], 16);
}
