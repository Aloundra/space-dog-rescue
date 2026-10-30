import { startLoop } from './core/loop';
import { Input } from './core/input';
import { fitCanvas } from './core/scaling';
import { WEAPON_TYPES, type WeaponType } from './data/weapons';
import type { DebugOptions } from './game/world';
import { SpriteBank } from './render/sprites';
import { App } from './ui/app';

/** Dev aids via URL: ?level=3&god&boss&weapons=red,blue&slots=15 */
function readDebug(): DebugOptions {
  const q = new URLSearchParams(window.location.search);
  const opts: DebugOptions = {};
  const lvl = q.get('level');
  if (lvl !== null && Number.isFinite(Number(lvl))) opts.startLevel = Math.max(0, Number(lvl) - 1);
  if (q.has('god')) opts.god = true;
  if (q.has('boss')) opts.boss = true;
  const w = q.get('weapons');
  if (w) opts.weapons = w.split(',').filter((t): t is WeaponType => (WEAPON_TYPES as readonly string[]).includes(t));
  const sl = Number(q.get('slots'));
  if (Number.isFinite(sl) && sl > 0) opts.slots = sl;
  return opts;
}

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas #game not found');
const ctx = canvas.getContext('2d', { alpha: false });
if (!ctx) throw new Error('2D context unavailable');
ctx.imageSmoothingEnabled = false;
fitCanvas(canvas);

const input = new Input();
input.attach(window);
const app = new App(ctx, input, new SpriteBank(), readDebug());
startLoop((dt) => app.update(dt), () => app.render());
if (import.meta.env.DEV) (window as unknown as { __app: App }).__app = app;
