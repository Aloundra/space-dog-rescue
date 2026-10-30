// Draws a World into the play area.
import { ENTITY_PX, GAME_SCALE as S, PLAY_H, PLAY_W, PLAY_X, PLAY_Y } from '../config';
import { LEVELS } from '../data/levels';
import { formatScore } from '../game/score';
import { laserStats, orbitalStats, pinkStats, TIER_LEVELS } from '../game/weaponStats';
import type { Bullet, Enemy } from '../game/types';
import type { World } from '../game/world';
import { Background } from './background';
import { drawBossBar, drawWeaponSlots } from './hud';
import { drawSprite, type SpriteBank } from './sprites';
import { drawDigits, drawText } from './text';

const BARRELS: Partial<Record<Enemy['kind'], { len: number; w: number; useB: boolean }>> = {
  turret: { len: 26, w: 8, useB: false },
  turretPlus: { len: 30, w: 12, useB: false },
  tank: { len: 34, w: 10, useB: true },
  tankGreen: { len: 38, w: 12, useB: true },
  tankRed: { len: 42, w: 14, useB: true },
};

export class WorldRenderer {
  private backgrounds = new Map<number, Background>();

  constructor(private bank: SpriteBank) {}

  background(levelIndex: number): Background {
    let bg = this.backgrounds.get(levelIndex);
    if (!bg) {
      bg = new Background(LEVELS[levelIndex].nebula, 1000 + levelIndex * 17);
      this.backgrounds.set(levelIndex, bg);
    }
    return bg;
  }

  draw(ctx: CanvasRenderingContext2D, w: World, dt: number, overlays = true): void {
    const bg = this.background(w.levelIndex);
    bg.update(dt, w.phase === 'clear' ? 3 : 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(PLAY_X, PLAY_Y, PLAY_W, PLAY_H);
    ctx.clip();
    const sh = w.shake > 0 ? Math.round((Math.random() - 0.5) * 16 * w.shake) : 0;
    const sv = w.shake > 0 ? Math.round((Math.random() - 0.5) * 16 * w.shake) : 0;
    ctx.translate(PLAY_X + sh, PLAY_Y + sv);
    bg.draw(ctx);

    for (const e of w.enemies) if (e.ground) this.drawEnemy(ctx, e, w);
    for (const pk of w.pickups) this.drawPickup(ctx, pk.kind, pk.weapon, pk.x, pk.y, pk.t);
    for (const e of w.enemies) if (!e.ground) this.drawEnemy(ctx, e, w);
    this.drawBoss(ctx, w);
    for (const b of w.pShots.items) if (b.active) this.drawPlayerBullet(ctx, b);
    if (w.laser.active && !w.player.dead) this.drawLaser(ctx, w);
    this.drawPinkEffects(ctx, w);
    this.drawPlayer(ctx, w);
    this.drawOrbitals(ctx, w);
    if (w.phase === 'rescue') this.drawDog(ctx, w.dog.x, w.dog.y, w.time, false);
    for (const b of w.eShots.items) if (b.active) this.drawEnemyBullet(ctx, b, w.time);
    this.drawParticles(ctx, w);
    this.drawSalvos(ctx, w);
    for (const t of w.texts) {
      const alpha = Math.min(1, (t.life - t.t) * 3);
      ctx.globalAlpha = alpha;
      if (t.digits) drawDigits(ctx, t.text, t.x, t.y, Math.round(t.size), t.color, '#120c2a', 'center');
      else drawText(ctx, t.text, t.x, t.y, t.size, t.color);
      ctx.globalAlpha = 1;
    }
    drawWeaponSlots(ctx, w.inventory);
    if (w.boss && (w.phase === 'boss' || w.phase === 'bossDying')) drawBossBar(ctx, w.boss.def.name, w.boss.hp / w.boss.maxHp);
    if (overlays) this.drawPhaseOverlay(ctx, w);
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, w: World): void {
    let name: string;
    let rot = 0;
    let sy = 1;
    switch (e.kind) {
      case 'vBall': name = `vBall_${Math.floor(w.time * 10 + e.a * 3) % 4}`; break;
      case 'grinder': name = `grinder_${Math.floor(w.time * 18) % 3}`; break;
      case 'carrier': name = 'carrier'; break;
      case 'robotRabbit': name = 'robotRabbit'; sy = e.b > 0.6 ? 0.85 : 1; break;
      case 'marbleBomb': name = 'marbleBomb'; rot = Math.round(e.t * 4) * (Math.PI / 8); break;
      default: name = e.kind;
    }
    if (e.ground) {
      ctx.fillStyle = 'rgba(8,4,20,0.45)';
      ctx.fillRect(Math.round(e.x - e.r + 6 * S), Math.round(e.y - e.r + 10 * S), e.r * 2, e.r * 2);
    }
    const sprite = e.flash > 0 ? this.bank.flash(name) : this.bank.get(name);
    drawSprite(ctx, sprite, e.x, e.y, rot, 1, sy);
    const barrel = BARRELS[e.kind];
    if (barrel) {
      const a = barrel.useB ? e.b : e.a;
      ctx.save();
      ctx.translate(Math.round(e.x), Math.round(e.y));
      ctx.rotate(a);
      ctx.scale(S, S);
      ctx.fillStyle = '#120c2a';
      ctx.fillRect(0, -barrel.w / 2 - 2, barrel.len + 2, barrel.w + 4);
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#7d86a0';
      ctx.fillRect(0, -barrel.w / 2, barrel.len, barrel.w);
      ctx.fillStyle = '#c9cfe0';
      ctx.fillRect(0, -barrel.w / 2, barrel.len, 2);
      ctx.restore();
    }
    if (e.kind === 'magnet' && e.y > 0) {
      ctx.strokeStyle = `rgba(111,240,255,${0.25 + 0.15 * Math.sin(w.time * 8)})`;
      ctx.lineWidth = 4 * S;
      for (let i = 0; i < 3; i++) {
        const r = (40 + ((w.time * 60 + i * 30) % 90)) * S;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      }
    }
  }

  private drawPickup(ctx: CanvasRenderingContext2D, kind: string, weapon: string | null, x: number, y: number, t: number): void {
    const bob = Math.round(Math.sin(t * 5) * 3 * S);
    const name = kind === 'weapon' ? `pickup_${weapon}` : kind;
    const g = 22 * S;
    ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.1 * Math.sin(t * 8)})`;
    ctx.fillRect(Math.round(x - g), Math.round(y - g + bob), g * 2, g * 2);
    drawSprite(ctx, this.bank.get(name), x, y + bob);
  }

  private drawBoss(ctx: CanvasRenderingContext2D, w: World): void {
    const b = w.boss;
    if (!b) return;
    const name = `boss_${b.index}`;
    if (b.def.holdsDog) {
      // Caged dog hanging under the final boss.
      const cy = b.y + b.halfH + 26 * S;
      ctx.fillStyle = '#5b6275';
      ctx.fillRect(Math.round(b.x - 2 * S), Math.round(b.y + b.halfH - 6 * S), 4 * S, 14 * S);
      this.drawDog(ctx, b.x, cy, w.time, true);
      ctx.fillStyle = '#9aa3b8';
      for (let i = -2; i <= 2; i++) ctx.fillRect(Math.round(b.x + (i * 12 - 2) * S), Math.round(cy - 30 * S), 4 * S, 60 * S);
      ctx.fillRect(Math.round(b.x - 30 * S), Math.round(cy - 32 * S), 60 * S, 4 * S);
      ctx.fillRect(Math.round(b.x - 30 * S), Math.round(cy + 28 * S), 60 * S, 4 * S);
    }
    const flash = b.flash > 0 && Math.floor(w.time * 30) % 2 === 0;
    drawSprite(ctx, flash ? this.bank.flash(name) : this.bank.get(name), b.x, b.y);
    // Pulsing core light.
    ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(w.time * 6)})`;
    ctx.fillRect(Math.round(b.x - ENTITY_PX), Math.round(b.y + b.halfH * 0.1), ENTITY_PX * 2, ENTITY_PX * 2);
  }

  private drawDog(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, sad: boolean): void {
    const hop = sad ? 0 : Math.abs(Math.sin(t * 6)) * -10 * S;
    drawSprite(ctx, this.bank.get('dog'), x, y + hop);
    if (!sad && Math.floor(t * 3) % 2 === 0) drawSprite(ctx, this.bank.get('heart'), x + 30 * S, y - 34 * S + hop);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, w: World): void {
    const p = w.player;
    if (p.dead) return;
    if (p.invuln > 0 && Math.floor(w.time * 20) % 2 === 0) return;
    const flick = Math.floor(w.time * 30) % 2;
    // Ship effects are authored at 1x around the ship centre, then scaled with the entities.
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    ctx.scale(S, S);
    for (const dx of [-16, 16]) {
      ctx.fillStyle = '#ff9a2e';
      ctx.fillRect(dx - 4, 24, 8, 8 + flick * 4);
      ctx.fillStyle = '#ffe25a';
      ctx.fillRect(dx - 2, 24, 4, 4 + flick * 4);
    }
    const inv = w.inventory;
    if (p.firing && (inv.level('green') > 0 || inv.level('yellow') > 0)) {
      // Yellow muzzle glow in front of the ship.
      const g = 6 + flick * 2;
      ctx.fillStyle = 'rgba(255,226,90,0.45)';
      ctx.fillRect(-g * 2, -30 - g, g * 4, g * 2);
      ctx.fillRect(-g, -30 - g * 2, g * 2, g * 4);
      ctx.fillStyle = '#fff4b8';
      ctx.fillRect(-4, -34, 8, 8);
    }
    if (inv.level('pink') > 0) {
      ctx.fillStyle = 'rgba(255,111,181,0.35)';
      for (let i = 1; i <= Math.min(TIER_LEVELS, inv.level('pink')); i++) ctx.fillRect(-12, 30 + i * 8, 24, 4);
    }
    ctx.restore();
    drawSprite(ctx, this.bank.get('player'), p.x, p.y);
  }

  /** Pink abilities: damaging trail (2+), graze-ready ring (4+), bullet-time field (5+). */
  private drawPinkEffects(ctx: CanvasRenderingContext2D, w: World): void {
    const p = w.player;
    if (p.dead) return;
    const pink = pinkStats(w.inventory.level('pink'));
    if (!pink) return;
    for (const pt of w.trail) {
      const k = 1 - pt.t / 0.45;
      const size = Math.round(18 * S * (0.4 + 0.6 * k));
      ctx.fillStyle = `rgba(255,111,181,${0.75 * k})`;
      ctx.fillRect(Math.round(pt.x - size / 2), Math.round(pt.y - size / 2), size, size);
      ctx.fillStyle = `rgba(255,214,236,${0.8 * k})`;
      ctx.fillRect(Math.round(pt.x - size / 4), Math.round(pt.y - size / 4), Math.round(size / 2), Math.round(size / 2));
    }
    if (pink.slow) {
      ctx.strokeStyle = `rgba(255,111,181,${0.4 + 0.12 * Math.sin(w.time * 4)})`;
      ctx.lineWidth = 3 * S;
      ctx.setLineDash([10 * S, 8 * S]);
      ctx.lineDashOffset = -w.time * 20;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pink.slow.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (pink.graze && p.grazeCd <= 0) {
      ctx.strokeStyle = `rgba(255,198,226,${0.35 + 0.2 * Math.sin(w.time * 10)})`;
      ctx.lineWidth = 2 * S;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26 * S, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Violet level 5+: orbiting orbs (dark while recharging). */
  private drawOrbitals(ctx: CanvasRenderingContext2D, w: World): void {
    const orb = orbitalStats(w.inventory.level('violet'));
    if (!orb) return;
    for (const o of w.orbitals()) {
      const r = orb.radius;
      ctx.globalAlpha = o.ready ? 1 : 0.4;
      ctx.fillStyle = 'rgba(226,194,255,0.45)';
      ctx.fillRect(Math.round(o.x - r * 1.4), Math.round(o.y - r * 1.4), Math.round(r * 2.8), Math.round(r * 2.8));
      ctx.fillStyle = '#5d2a9e';
      ctx.fillRect(Math.round(o.x - r), Math.round(o.y - r), Math.round(r * 2), Math.round(r * 2));
      ctx.fillStyle = '#b066ff';
      ctx.fillRect(Math.round(o.x - r + 3), Math.round(o.y - r + 3), Math.round(r * 2 - 6), Math.round(r * 2 - 6));
      ctx.fillStyle = '#e2c2ff';
      ctx.fillRect(Math.round(o.x - r / 2), Math.round(o.y - r / 2), Math.round(r), Math.round(r));
      ctx.globalAlpha = 1;
    }
  }

  private drawPlayerBullet(ctx: CanvasRenderingContext2D, b: Bullet): void {
    // Shapes are authored at 1x around (0, 0); b.scale applies entity scale and weapon level growth.
    ctx.save();
    ctx.translate(Math.round(b.x), Math.round(b.y));
    ctx.scale(b.scale, b.scale);
    this.drawPlayerBulletShape(ctx, b);
    ctx.restore();
  }

  private drawPlayerBulletShape(ctx: CanvasRenderingContext2D, b: Bullet): void {
    const x = 0;
    const y = 0;
    switch (b.style) {
      case 'shot': {
        // Green: plain lime bolt (tier 0-1), green glow (2), long trail (3 = pierce), flares (4 = companion particle), halo (5).
        const t = b.tier;
        if (t >= 5) {
          ctx.fillStyle = 'rgba(196,255,201,0.28)';
          ctx.fillRect(x - 8, y - 12, 16, 26);
        }
        if (t >= 3) {
          ctx.fillStyle = 'rgba(91,227,106,0.4)';
          ctx.fillRect(x - 2, y + 8, 4, 12);
          ctx.fillRect(x - 1, y + 20, 2, 8);
        }
        if (t >= 2) {
          ctx.fillStyle = '#23813a';
          ctx.fillRect(x - 5, y - 8, 10, 18);
        }
        ctx.fillStyle = t >= 2 ? '#5be36a' : '#c8ff4a';
        ctx.fillRect(x - 3, y - 6, 6, 14);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 2, y - 8, 4, 6);
        if (t >= 4) {
          ctx.fillStyle = '#c4ffc9';
          ctx.fillRect(x - 8, y - 2, 4, 4);
          ctx.fillRect(x + 4, y - 2, 4, 4);
        }
        break;
      }
      case 'charge': {
        // Heavy exploding shot (green level 5): pulsing orb with a spiky core.
        const pulse = Math.floor(b.t * 20) % 2;
        ctx.fillStyle = 'rgba(196,255,201,0.3)';
        ctx.fillRect(x - 12 - pulse, y - 12 - pulse, 24 + pulse * 2, 24 + pulse * 2);
        ctx.fillStyle = '#23813a';
        ctx.fillRect(x - 8, y - 10, 16, 20);
        ctx.fillRect(x - 10, y - 8, 20, 16);
        ctx.fillStyle = '#5be36a';
        ctx.fillRect(x - 6, y - 8, 12, 16);
        ctx.fillRect(x - 8, y - 6, 16, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 3, y - 4, 6, 8);
        break;
      }
      case 'side': {
        // Yellow: block (tier 0-1), white rim (2), arrowhead along the flight direction (3 = pierce),
        // sparkle (4 = rear shot), spinning blade (5 = boomerang).
        const t = b.tier;
        ctx.save();
        if (t >= 5) ctx.rotate(b.t * 18);
        else if (t >= 3) ctx.rotate(Math.atan2(b.vy, b.vx));
        if (t >= 5) {
          ctx.fillStyle = '#a67c0b';
          ctx.fillRect(x - 9, y - 3, 18, 6);
          ctx.fillRect(x - 3, y - 9, 6, 18);
          ctx.fillStyle = '#ffd93b';
          ctx.fillRect(x - 8, y - 2, 16, 4);
          ctx.fillRect(x - 2, y - 8, 4, 16);
          ctx.fillStyle = '#fff4b8';
          ctx.fillRect(x - 3, y - 3, 6, 6);
        } else if (t >= 3) {
          ctx.fillStyle = '#a67c0b';
          ctx.fillRect(x - 9, y - 4, 16, 8);
          ctx.fillRect(x + 6, y - 6, 4, 12);
          ctx.fillStyle = '#ffd93b';
          ctx.fillRect(x - 8, y - 3, 14, 6);
          ctx.fillRect(x + 6, y - 4, 3, 8);
          ctx.fillStyle = '#fff4b8';
          ctx.fillRect(x - 2, y - 2, 8, 4);
          if (t >= 4) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x - 12, y - 1, 3, 2);
            ctx.fillRect(x - 14, y - 3, 2, 6);
          }
        } else {
          ctx.fillStyle = t >= 2 ? '#fff4b8' : '#a67c0b';
          ctx.fillRect(x - 5, y - 5, 10, 10);
          ctx.fillStyle = '#ffd93b';
          ctx.fillRect(x - 4, y - 4, 8, 8);
          ctx.fillStyle = '#fff4b8';
          ctx.fillRect(x - 2, y - 2, 4, 4);
        }
        ctx.restore();
        break;
      }
      case 'violet': {
        // Violet: ball (tier 0-1), light rim (2 = rebound), trail (3), pink core (4 = split), halo (5).
        const t = b.tier;
        if (t >= 3) {
          const sp = Math.hypot(b.vx, b.vy) || 1;
          const ux = b.vx / sp;
          const uy = b.vy / sp;
          for (let k = 1; k <= 3; k++) {
            ctx.fillStyle = `rgba(176,102,255,${0.5 - k * 0.12})`;
            const sz = 8 - k * 1.5;
            ctx.fillRect(x - ux * k * 7 - sz / 2, y - uy * k * 7 - sz / 2, sz, sz);
          }
        }
        if (t >= 5) {
          ctx.fillStyle = 'rgba(226,194,255,0.25)';
          ctx.fillRect(x - 9, y - 9, 18, 18);
        }
        ctx.fillStyle = t >= 2 ? '#e2c2ff' : '#5d2a9e';
        ctx.fillRect(x - 5, y - 5, 10, 10);
        ctx.fillStyle = '#b066ff';
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.fillStyle = t >= 4 ? '#ff9ad5' : '#e2c2ff';
        ctx.fillRect(x - 3, y - 3, 4, 4);
        break;
      }
      case 'missile': {
        // Blue: slim missile (tier 0-1), orange warhead (3 = blast), side pods (4 = split).
        const t = b.tier;
        ctx.save();
        ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
        if (t >= 4) {
          ctx.fillStyle = '#1c3f99';
          ctx.fillRect(-8, -2, 4, 10);
          ctx.fillRect(4, -2, 4, 10);
          ctx.fillStyle = '#bcd8ff';
          ctx.fillRect(-8, -2, 4, 3);
          ctx.fillRect(4, -2, 4, 3);
        }
        ctx.fillStyle = '#120c2a';
        ctx.fillRect(-4, -10, 8, 20);
        ctx.fillStyle = '#3f8cff';
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillStyle = t >= 3 ? '#ff9a2e' : '#bcd8ff';
        ctx.fillRect(-3, -10, 6, 4);
        ctx.fillStyle = '#ff9a2e';
        ctx.fillRect(-2, 8, 4, 4);
        ctx.restore();
        break;
      }
      case 'heavyMissile': {
        // Blue level 5: big steel missile with a red band and a long flame.
        ctx.fillStyle = 'rgba(255,154,46,0.5)';
        ctx.fillRect(x - 4, y + 14, 8, 16 + (Math.floor(b.t * 30) % 2) * 6);
        ctx.fillStyle = '#ffe25a';
        ctx.fillRect(x - 2, y + 14, 4, 10);
        ctx.fillStyle = '#120c2a';
        ctx.fillRect(x - 7, y - 16, 14, 32);
        ctx.fillStyle = '#c9cfe0';
        ctx.fillRect(x - 5, y - 14, 10, 28);
        ctx.fillStyle = '#3f8cff';
        ctx.fillRect(x - 5, y - 6, 10, 6);
        ctx.fillStyle = '#ff3b4e';
        ctx.fillRect(x - 5, y + 2, 10, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 3, y - 18, 6, 6);
        ctx.fillStyle = '#1c3f99';
        ctx.fillRect(x - 11, y + 6, 4, 10);
        ctx.fillRect(x + 7, y + 6, 4, 10);
        break;
      }
      default:
        break;
    }
  }

  private drawEnemyBullet(ctx: CanvasRenderingContext2D, b: Bullet, t: number): void {
    if (b.style === 'eDisc') {
      // Sprite from the entity bank, already at entity scale.
      drawSprite(ctx, this.bank.get(`disc_${Math.floor(t * 16) % 2}`), b.x, b.y);
      return;
    }
    ctx.save();
    ctx.translate(Math.round(b.x), Math.round(b.y));
    ctx.scale(b.scale, b.scale);
    this.drawEnemyBulletShape(ctx, b, t);
    ctx.restore();
  }

  private drawEnemyBulletShape(ctx: CanvasRenderingContext2D, b: Bullet, t: number): void {
    const x = 0;
    const y = 0;
    const block = (s: number, outline: string, fill: string, core: string): void => {
      ctx.fillStyle = outline;
      ctx.fillRect(x - s / 2 - 2, y - s / 2 + 2, s + 4, s - 4);
      ctx.fillRect(x - s / 2 + 2, y - s / 2 - 2, s - 4, s + 4);
      ctx.fillStyle = fill;
      ctx.fillRect(x - s / 2, y - s / 2 + 2, s, s - 4);
      ctx.fillRect(x - s / 2 + 2, y - s / 2, s - 4, s);
      ctx.fillStyle = core;
      ctx.fillRect(x - s / 2 + 2, y - s / 2 + 2, 4, 4);
    };
    switch (b.style) {
      case 'ePellet': block(12, '#5a0a24', '#ff3b6b', '#ffd0dc'); break;
      case 'eBead': block(12, '#0f4a1e', '#5be36a', '#d8ffd8'); break;
      case 'eSquare':
        ctx.fillStyle = '#7a6420';
        ctx.fillRect(x - 7, y - 7, 14, 14);
        ctx.fillStyle = '#fff2a8';
        ctx.fillRect(x - 5, y - 5, 10, 10);
        break;
      case 'eOrb': block(16, '#b066ff', '#2a0f52', '#7b3fd0'); break;
      case 'eMissile': {
        ctx.save();
        ctx.rotate(Math.atan2(b.vy, b.vx) - Math.PI / 2);
        ctx.fillStyle = '#120c2a';
        ctx.fillRect(-5, -10, 10, 20);
        ctx.fillStyle = '#c9cfe0';
        ctx.fillRect(-3, -8, 6, 14);
        ctx.fillStyle = '#e8344e';
        ctx.fillRect(-3, 4, 6, 6);
        ctx.fillStyle = Math.floor(t * 20) % 2 ? '#ffe25a' : '#ff9a2e';
        ctx.fillRect(-2, -14, 4, 4);
        ctx.restore();
        break;
      }
      default:
        break;
    }
  }

  private drawLaser(ctx: CanvasRenderingContext2D, w: World): void {
    const tier = laserStats(w.inventory.level('red'))?.tier ?? 1;
    for (const bm of w.laser.beams) {
      this.drawBeam(ctx, bm.w / 2, bm.sx, bm.sy, bm.tx, bm.ty, bm.target !== null, bm.main, tier);
      if (bm.chain) {
        // Chain lightning: a thinner arc from the first target to the second.
        this.drawBeam(ctx, bm.w / 4, bm.tx, bm.ty, bm.cx, bm.cy, true, false, tier);
      }
    }
  }

  /** One electric beam from (sx, sy) to (ex, ey). */
  private drawBeam(
    ctx: CanvasRenderingContext2D, hw: number, sx: number, sy: number, ex: number, ey: number, locked: boolean,
    main = false, tier = 1,
  ): void {
    const len = Math.hypot(ex - sx, ey - sy);
    if (len < 1) return;
    const ux = (ex - sx) / len;
    const uy = (ey - sy) / len;
    // Perpendicular, used for the electric zigzag.
    const nx = -uy;
    const ny = ux;
    const step = 22 * S;
    const pts: [number, number][] = [[sx, sy]];
    for (let d = step; d < len; d += step) {
      const j = (Math.random() - 0.5) * hw * 1.6;
      pts.push([sx + ux * d + nx * j, sy + uy * d + ny * j]);
    }
    pts.push([ex, ey]);
    const stroke = (width: number, color: string): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'miter';
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    };
    // Soft straight glow along the beam axis; brighter with the red level, white-hot for the main beam.
    ctx.strokeStyle = main ? 'rgba(255,200,205,0.3)' : `rgba(255,59,78,${0.12 + 0.03 * tier})`;
    ctx.lineWidth = hw * 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    stroke(hw, 'rgba(255,59,78,0.55)');
    stroke(main ? 10 * S : 6 * S, main ? '#ff7a86' : '#ff3b4e');
    stroke(main ? 4 * S : 2 * S, '#ffffff');
    // Small electric branches.
    ctx.strokeStyle = '#ffc0c6';
    ctx.lineWidth = 2 * S;
    for (let i = 2; i < pts.length - 1; i += 3) {
      const [x, y] = pts[i];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * hw * 3, y + (Math.random() - 0.5) * 20 * S);
      ctx.stroke();
    }
    if (locked) {
      // Impact flare on the locked target.
      const r = hw * (0.8 + Math.random() * 0.4);
      ctx.fillStyle = 'rgba(255,192,198,0.6)';
      ctx.fillRect(Math.round(ex - r), Math.round(ey - r), Math.round(r * 2), Math.round(r * 2));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(ex - 3 * S), Math.round(ey - 3 * S), 6 * S, 6 * S);
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, w: World): void {
    for (const pt of w.particles.items) {
      if (!pt.active) continue;
      const k = pt.t / pt.life;
      const x = Math.round(pt.x / 2) * 2;
      const y = Math.round(pt.y / 2) * 2;
      switch (pt.kind) {
        case 'fire':
          ctx.fillStyle = k > 0.7 ? '#8e2a18' : pt.color;
          ctx.fillRect(x - pt.size / 2, y - pt.size / 2, pt.size, pt.size);
          break;
        case 'spark':
          ctx.fillStyle = pt.color;
          ctx.fillRect(x - pt.size / 2, y - pt.size / 2, pt.size, pt.size);
          break;
        case 'smoke':
          ctx.globalAlpha = 0.65 * (1 - k);
          ctx.fillStyle = pt.color;
          ctx.fillRect(x - pt.size / 2, y - pt.size / 2, pt.size, pt.size);
          ctx.globalAlpha = 1;
          break;
        case 'ring':
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = pt.color;
          ctx.lineWidth = 4 * S;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size * (0.3 + k), 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
      }
    }
  }

  private drawSalvos(ctx: CanvasRenderingContext2D, w: World): void {
    for (const s of w.salvos) {
      const k = s.t / s.life;
      ctx.globalAlpha = 0.3 * (1 - k);
      ctx.fillStyle = s.light;
      ctx.fillRect(0, 0, PLAY_W, PLAY_H);
      ctx.globalAlpha = 1 - k;
      for (let i = 0; i < 3; i++) {
        const r = Math.max(1, (k * 1.1 - i * 0.08) * 1000);
        ctx.strokeStyle = i === 1 ? s.light : s.color;
        ctx.lineWidth = (28 * (1 - k) + 4) * S;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawPhaseOverlay(ctx: CanvasRenderingContext2D, w: World): void {
    const cx = PLAY_W / 2;
    const cy = PLAY_H / 2 - 60;
    switch (w.phase) {
      case 'intro': {
        const a = Math.min(1, w.phaseT * 3, (2.5 - w.phaseT) * 3);
        ctx.globalAlpha = Math.max(0, a);
        drawText(ctx, `LEVEL ${w.levelIndex + 1}`, cx, cy, 52, '#ffe25a');
        drawText(ctx, w.level.name, cx, cy + 56, 30, '#e2f6ff');
        ctx.globalAlpha = 1;
        break;
      }
      case 'warning':
        if (Math.floor(w.phaseT * 4) % 2 === 0) {
          ctx.fillStyle = 'rgba(232,52,78,0.22)';
          ctx.fillRect(0, cy - 50, PLAY_W, 100);
          drawText(ctx, 'WARNING!', cx, cy - 12, 52, '#ff4f7b');
          drawText(ctx, w.level.boss.name, cx, cy + 32, 26, '#ffe7a8');
        }
        break;
      case 'clear': {
        drawText(ctx, 'LEVEL CLEARED!', cx, cy, 46, '#ffe25a');
        drawText(ctx, `Level bonus: ${w.lastBonus}`, cx, cy + 56, 26, '#e2f6ff');
        drawText(ctx, `Score: ${formatScore(w.score)}`, cx, cy + 96, 26, '#e2f6ff');
        break;
      }
      case 'rescue':
        drawText(ctx, 'Your dog is free!', cx, cy, 40, '#ffe25a');
        drawText(ctx, `Final bonus: ${w.lastBonus}`, cx, cy + 50, 26, '#e2f6ff');
        break;
      default:
        break;
    }
  }
}
