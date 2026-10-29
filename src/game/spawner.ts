// Expands data-driven waves into individual timed spawn events.
import { PLAY_H, PLAY_W } from '../config';
import { Rng } from '../core/math';
import type { Wave } from '../data/levels';
import type { WeaponType } from '../data/weapons';
import type { EnemyId } from './types';

export interface SpawnEvent {
  time: number;
  kind: EnemyId;
  x: number;
  y: number;
  side: number;
  weapon?: WeaponType;
}

export function expandWaves(waves: readonly Wave[], rng: Rng): SpawnEvent[] {
  const out: SpawnEvent[] = [];
  for (const wv of waves) {
    const base = { kind: wv.kind, weapon: wv.weapon, side: 0 };
    switch (wv.formation) {
      case 'single':
        for (let i = 0; i < wv.count; i++) out.push({ ...base, time: wv.at + i * wv.interval, x: wv.x * PLAY_W, y: -40 });
        break;
      case 'line': {
        for (let i = 0; i < wv.count; i++) {
          const f = wv.count === 1 ? 0.5 : i / (wv.count - 1);
          const x = (wv.x + (f - 0.5) * wv.spread) * PLAY_W;
          out.push({ ...base, time: wv.at, x, y: -40 });
        }
        break;
      }
      case 'column':
        for (let i = 0; i < wv.count; i++) out.push({ ...base, time: wv.at + i * wv.interval, x: wv.x * PLAY_W, y: -40 });
        break;
      case 'v': {
        const mid = (wv.count - 1) / 2;
        for (let i = 0; i < wv.count; i++) {
          const off = i - mid;
          out.push({ ...base, time: wv.at, x: wv.x * PLAY_W + off * 44, y: -40 - Math.abs(off) * 36 });
        }
        break;
      }
      case 'random':
        for (let i = 0; i < wv.count; i++) {
          out.push({ ...base, time: wv.at + i * wv.interval, x: rng.range(0.1, 0.9) * PLAY_W, y: -40 });
        }
        break;
      case 'fromLeft':
      case 'fromRight': {
        const side = wv.formation === 'fromLeft' ? -1 : 1;
        for (let i = 0; i < wv.count; i++) {
          out.push({
            ...base, side, time: wv.at + i * wv.interval,
            x: side < 0 ? -40 : PLAY_W + 40, y: wv.x * PLAY_H,
          });
        }
        break;
      }
    }
  }
  return out.sort((a, b) => a.time - b.time);
}
