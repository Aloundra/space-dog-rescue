// Icy frame around the play area + bottom HUD bar (level, HP bar, score).
import { HUD_H, HUD_Y, PLAY_H, PLAY_W, PLAY_X, PLAY_Y, PLAYER_MAX_HP, PX, VIEW_H, VIEW_W } from '../config';
import { MAX_SLOTS, WEAPONS, type WeaponType } from '../data/weapons';
import type { WeaponInventory } from '../game/inventory';
import { formatScore } from '../game/score';
import { drawDigits, drawText } from './text';

const ICE = '#bfeeff';
const ICE_LIGHT = '#f1fcff';
const ICE_DARK = '#6fb7d6';
const ICE_DEEP = '#3f7fa3';

function bevelRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = ICE;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = ICE_LIGHT;
  ctx.fillRect(x, y, w, PX);
  ctx.fillRect(x, y, PX, h);
  ctx.fillStyle = ICE_DARK;
  ctx.fillRect(x, y + h - PX, w, PX);
  ctx.fillRect(x + w - PX, y, PX, h);
}

/** Draws the frame (everything outside the play area). */
export function drawFrame(ctx: CanvasRenderingContext2D, t: number): void {
  ctx.fillStyle = ICE;
  ctx.fillRect(0, 0, VIEW_W, PLAY_Y);
  ctx.fillRect(0, PLAY_Y + PLAY_H, VIEW_W, VIEW_H - PLAY_Y - PLAY_H);
  ctx.fillRect(0, 0, PLAY_X, VIEW_H);
  ctx.fillRect(PLAY_X + PLAY_W, 0, VIEW_W - PLAY_X - PLAY_W, VIEW_H);
  // Frost sparkles on the frame.
  ctx.fillStyle = ICE_LIGHT;
  for (let i = 0; i < 28; i++) {
    const k = (i * 97 + Math.floor(t * 2) * 13) % 1000;
    const onSide = i % 2 === 0;
    const x = onSide ? (i % 4 === 0 ? 8 : VIEW_W - 12) : (k / 1000) * VIEW_W;
    const y = onSide ? (k / 1000) * VIEW_H : 8;
    ctx.fillRect(Math.floor(x / PX) * PX, Math.floor(y / PX) * PX, PX, PX);
  }
  // Inner bevel around play area.
  ctx.fillStyle = ICE_DEEP;
  ctx.fillRect(PLAY_X - PX, PLAY_Y - PX, PLAY_W + PX * 2, PX);
  ctx.fillRect(PLAY_X - PX, PLAY_Y - PX, PX, PLAY_H + PX * 2);
  ctx.fillStyle = ICE_LIGHT;
  ctx.fillRect(PLAY_X - PX, PLAY_Y + PLAY_H, PLAY_W + PX * 2, PX);
  ctx.fillRect(PLAY_X + PLAY_W, PLAY_Y - PX, PX, PLAY_H + PX * 2);
  bevelRect(ctx, PLAY_X, HUD_Y, PLAY_W, HUD_H);
}

export interface HudState {
  score: number;
  hp: number;
  levelNumber: number;
  t: number;
}

export function drawHud(ctx: CanvasRenderingContext2D, s: HudState): void {
  const cy = HUD_Y + HUD_H / 2;
  // Level badge.
  ctx.fillStyle = ICE_DEEP;
  ctx.fillRect(PLAY_X + 16, cy - 28, 56, 56);
  ctx.fillStyle = '#1b2a55';
  ctx.fillRect(PLAY_X + 20, cy - 24, 48, 48);
  drawDigits(ctx, String(s.levelNumber), PLAY_X + 44, cy - 15, 6, '#ffe25a', null, 'center');

  // Health bar: 3 segments.
  const bx = PLAY_X + 92;
  const segW = 74;
  const segH = 26;
  ctx.fillStyle = ICE_DEEP;
  ctx.fillRect(bx - PX, cy - segH / 2 - PX, segW * PLAYER_MAX_HP + PX * (PLAYER_MAX_HP + 1), segH + PX * 2);
  for (let i = 0; i < PLAYER_MAX_HP; i++) {
    const x = bx + i * (segW + PX);
    const full = i < s.hp;
    const lowBlink = s.hp === 1 && Math.sin(s.t * 10) > 0;
    ctx.fillStyle = full ? (lowBlink ? '#ffd0dc' : '#ff4f7b') : '#3a2240';
    ctx.fillRect(x, cy - segH / 2, segW, segH);
    if (full) {
      ctx.fillStyle = '#ffb3c6';
      ctx.fillRect(x, cy - segH / 2, segW, PX);
      ctx.fillStyle = '#b0204a';
      ctx.fillRect(x, cy + segH / 2 - PX, segW, PX);
    }
  }

  // Score, 7 digits, on a dark panel for contrast.
  const right = PLAY_X + PLAY_W - 32;
  const sw = 7 * 4 * 8 - 8;
  const sx = right - sw;
  ctx.fillStyle = ICE_DEEP;
  ctx.fillRect(sx - 14, cy - 32, sw + 28, 64);
  ctx.fillStyle = '#1b2a55';
  ctx.fillRect(sx - 10, cy - 28, sw + 20, 56);
  drawDigits(ctx, formatScore(s.score), right, cy - 20, 8, '#ffffff', '#4f9fd1', 'right');
}

/**
 * 5x5 symbol per weapon type, so the slots stay readable without relying on colour alone.
 * '#' = lit cell. Shapes: violet = scattered balls, pink = speed chevron, green = plus (upgrade),
 * yellow = fan to both sides, blue = missile, red = lightning beam.
 */
const WEAPON_GLYPHS: Record<WeaponType, readonly string[]> = {
  violet: ['#.#.#', '.....', '..#..', '.....', '#.#.#'],
  pink: ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
  green: ['..#..', '..#..', '#####', '..#..', '..#..'],
  yellow: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  blue: ['..#..', '.###.', '.###.', '.#.#.', '#...#'],
  red: ['..##.', '.#...', '#####', '...#.', '.##..'],
};

/** Column of weapon slots at the bottom-left of the play area. */
export function drawWeaponSlots(ctx: CanvasRenderingContext2D, inv: WeaponInventory): void {
  const size = 36;
  const gap = 6;
  const x = 10;
  const bottom = PLAY_H - 12;
  for (let i = 0; i < MAX_SLOTS; i++) {
    const y = bottom - (i + 1) * (size + gap) + gap;
    if (i >= inv.slots) continue;
    const t = inv.list[i];
    ctx.fillStyle = 'rgba(18,12,42,0.75)';
    ctx.fillRect(x - PX, y - PX, size + PX * 2, size + PX * 2);
    if (t) {
      const w = WEAPONS[t];
      ctx.fillStyle = w.color;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = w.light;
      ctx.fillRect(x, y, size, PX);
      ctx.fillRect(x, y, PX, size);
      ctx.fillStyle = w.dark;
      ctx.fillRect(x, y + size - PX, size, PX);
      ctx.fillRect(x + size - PX, y, PX, size);
      // Level digit at the top, symbol below it.
      drawDigits(ctx, String(inv.level(t)), x + size / 2, y + 4, 2, '#ffffff', '#120c2a', 'center');
      const cell = 3;
      const gx = x + (size - 5 * cell) / 2;
      const gy = y + size - 4 - 5 * cell;
      ctx.fillStyle = '#ffffff';
      WEAPON_GLYPHS[t].forEach((row, r) => {
        for (let c = 0; c < 5; c++) {
          if (row[c] === '#') ctx.fillRect(gx + c * cell, gy + r * cell, cell, cell);
        }
      });
    } else {
      ctx.strokeStyle = '#6fb7d6';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    }
  }
}

export function drawBossBar(ctx: CanvasRenderingContext2D, name: string, ratio: number): void {
  const w = PLAY_W - 160;
  const x = 80;
  const y = 18;
  ctx.fillStyle = 'rgba(18,12,42,0.8)';
  ctx.fillRect(x - PX, y - PX, w + PX * 2, 16 + PX * 2);
  ctx.fillStyle = '#3a2240';
  ctx.fillRect(x, y, w, 16);
  ctx.fillStyle = '#ff9a2e';
  ctx.fillRect(x, y, Math.max(0, Math.floor((w * ratio) / PX) * PX), 16);
  ctx.fillStyle = '#ffd28a';
  ctx.fillRect(x, y, Math.max(0, Math.floor((w * ratio) / PX) * PX), PX);
  drawText(ctx, name, PLAY_W / 2, y + 34, 18, '#ffe7a8');
}
