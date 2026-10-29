// Procedural pixel-art nebula (dithered periodic value noise) + parallax star layers.
import { PLAY_H, PLAY_W, PX } from '../config';
import { Rng } from '../core/math';

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

class PeriodicNoise {
  private grid: number[];
  constructor(private gw: number, private gh: number, rng: Rng) {
    this.grid = Array.from({ length: gw * gh }, () => rng.next());
  }
  private at(x: number, y: number): number {
    const gx = ((x % this.gw) + this.gw) % this.gw;
    const gy = ((y % this.gh) + this.gh) % this.gh;
    return this.grid[gy * this.gw + gx];
  }
  /** u,v in grid units; wraps in both directions. */
  sample(u: number, v: number): number {
    const x0 = Math.floor(u);
    const y0 = Math.floor(v);
    const fx = u - x0;
    const fy = v - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = this.at(x0, y0) + (this.at(x0 + 1, y0) - this.at(x0, y0)) * sx;
    const b = this.at(x0, y0 + 1) + (this.at(x0 + 1, y0 + 1) - this.at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  }
}

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  twinkle: number;
}

export class Background {
  private nebula: HTMLCanvasElement;
  private stars: Star[] = [];
  private offset = 0;

  constructor(palette: readonly string[], seed: number) {
    const rng = new Rng(seed);
    const artW = Math.ceil(PLAY_W / PX);
    const artH = Math.ceil(PLAY_H / PX);
    this.nebula = document.createElement('canvas');
    this.nebula.width = artW * PX;
    this.nebula.height = artH * PX;
    const ctx = this.nebula.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');

    const octaves = [
      new PeriodicNoise(6, 6, rng),
      new PeriodicNoise(12, 12, rng),
      new PeriodicNoise(24, 24, rng),
    ];
    for (let y = 0; y < artH; y++) {
      for (let x = 0; x < artW; x++) {
        const u = x / artW;
        const v = y / artH;
        let n = 0;
        let amp = 0.6;
        let total = 0;
        octaves.forEach((o, i) => {
          const scale = 6 * 2 ** i;
          n += o.sample(u * scale, v * scale) * amp;
          total += amp;
          amp *= 0.5;
        });
        n /= total;
        // Stretch contrast so clouds stand out from the dark void.
        const value = Math.max(0, Math.min(0.999, (n - 0.3) * 1.9));
        const threshold = (BAYER4[y % 4][x % 4] + 0.5) / 16;
        const level = Math.min(palette.length - 1, Math.floor(value * (palette.length - 1) + threshold));
        ctx.fillStyle = palette[level];
        ctx.fillRect(x * PX, y * PX, PX, PX);
      }
    }

    const layers = [
      { count: 70, size: PX / 2, speed: 25 },
      { count: 40, size: PX, speed: 60 },
      { count: 14, size: PX, speed: 120 },
    ];
    for (const l of layers) {
      for (let i = 0; i < l.count; i++) {
        this.stars.push({
          x: Math.floor(rng.range(0, PLAY_W) / PX) * PX,
          y: rng.range(0, PLAY_H),
          size: l.size,
          speed: l.speed,
          twinkle: rng.range(0, Math.PI * 2),
        });
      }
    }
  }

  update(dt: number, speedMul = 1): void {
    this.offset = (this.offset + 22 * dt * speedMul) % this.nebula.height;
    for (const s of this.stars) {
      s.y += s.speed * dt * speedMul;
      if (s.y > PLAY_H) s.y -= PLAY_H;
      s.twinkle += dt * 3;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const h = this.nebula.height;
    const y = Math.floor(this.offset / PX) * PX;
    ctx.drawImage(this.nebula, 0, y - h);
    ctx.drawImage(this.nebula, 0, y);
    for (const s of this.stars) {
      const bright = s.speed > 100;
      ctx.fillStyle = bright || Math.sin(s.twinkle) > -0.3 ? '#ffffff' : '#9c8fd0';
      const sy = Math.floor(s.y / PX) * PX;
      ctx.fillRect(s.x, sy, s.size, s.size);
      if (bright) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(s.x - PX, sy, PX, PX);
        ctx.fillRect(s.x + PX, sy, PX, PX);
        ctx.fillRect(s.x, sy - PX, PX, PX);
        ctx.fillRect(s.x, sy + PX, PX, PX);
      }
    }
  }
}
