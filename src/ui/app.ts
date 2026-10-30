// Application state machine: title, how-to, high scores, game, pause, game over, name entry, victory.
import { ENTITY_PX, PLAY_H, PLAY_W, PLAY_X, PLAY_Y, VIEW_H, VIEW_W } from '../config';
import { KEYS, type Input } from '../core/input';
import { ENEMY_KINDS, ENEMY_POINTS, ENEMY_STATS } from '../data/enemies';
import { LEVELS } from '../data/levels';
import { WEAPONS, WEAPON_TYPES } from '../data/weapons';
import { formatScore } from '../game/score';
import { World, type DebugOptions } from '../game/world';
import { drawFrame, drawHud } from '../render/hud';
import { SpriteBank, drawSprite } from '../render/sprites';
import { drawDigits, drawText } from '../render/text';
import { WorldRenderer } from '../render/worldRenderer';
import {
  NAME_MAX, browserStorage, insertScore, loadScores, qualifies, saveScores, type HighScore,
} from './highscores';

type Screen = 'title' | 'howto' | 'scores' | 'game' | 'pause' | 'gameover' | 'victory' | 'nameEntry';

const MENU = ['Play', 'How to play', 'High scores'] as const;

export class App {
  private screen: Screen = 'title';
  private screenT = 0;
  private menuIndex = 0;
  private world: World | null = null;
  private renderer: WorldRenderer;
  private scores: HighScore[];
  private storage = browserStorage();
  private nameBuffer = '';
  private confirmQuit = false;
  private highlight = -1;
  private time = 0;
  private lastFrame = performance.now();

  constructor(private ctx: CanvasRenderingContext2D, private input: Input, private bank: SpriteBank, private debug: DebugOptions) {
    // In-game entities use a 1.5x sprite bank; menus keep `bank` unchanged.
    this.renderer = new WorldRenderer(new SpriteBank(ENTITY_PX));
    this.scores = loadScores(this.storage);
    if (debug.startLevel !== undefined || debug.weapons || debug.boss) this.startGame();
  }

  private go(s: Screen): void {
    this.screen = s;
    this.screenT = 0;
    this.confirmQuit = false;
  }

  private startGame(): void {
    this.world = new World(Date.now(), this.debug);
    this.go('game');
  }

  // ---------------------------------------------------------------- update

  update(dt: number): void {
    this.time += dt;
    this.screenT += dt;
    const inp = this.input;
    const confirm = inp.wasPressed(...KEYS.confirm);
    const back = inp.wasPressed('Escape');
    switch (this.screen) {
      case 'title':
        if (inp.wasPressed('ArrowUp')) this.menuIndex = (this.menuIndex + MENU.length - 1) % MENU.length;
        if (inp.wasPressed('ArrowDown')) this.menuIndex = (this.menuIndex + 1) % MENU.length;
        if (confirm || inp.wasPressed('Space')) {
          if (this.menuIndex === 0) this.startGame();
          else if (this.menuIndex === 1) this.go('howto');
          else { this.highlight = -1; this.go('scores'); }
        }
        break;
      case 'howto':
      case 'scores':
        if ((confirm || back || inp.wasPressed('Space')) && this.screenT > 0.2) this.go('title');
        break;
      case 'game': {
        const w = this.world;
        if (!w) break;
        if (inp.wasPressed(...KEYS.pause)) { this.go('pause'); break; }
        w.update(dt, inp);
        const ev = w.events.shift();
        if (ev === 'gameover') this.go('gameover');
        if (ev === 'victory') this.go('victory');
        break;
      }
      case 'pause':
        if (this.confirmQuit) {
          // Quit needs a second, explicit confirmation: Enter = quit, Esc/P = stay.
          if (confirm) { this.confirmQuit = false; this.world = null; this.go('title'); }
          else if (inp.wasPressed(...KEYS.pause)) this.confirmQuit = false;
        } else if (inp.wasPressed(...KEYS.pause) || confirm) {
          this.go('game');
        } else if (inp.wasPressed('KeyQ')) {
          this.confirmQuit = true;
        }
        break;
      case 'gameover':
      case 'victory':
        if ((confirm || inp.wasPressed('Space')) && this.screenT > 1) this.afterRun();
        break;
      case 'nameEntry':
        this.updateNameEntry();
        break;
    }
    this.input.endStep();
  }

  private afterRun(): void {
    const w = this.world;
    if (w && qualifies(this.scores, w.score)) {
      this.nameBuffer = '';
      this.go('nameEntry');
    } else {
      this.highlight = -1;
      this.go('scores');
    }
  }

  private updateNameEntry(): void {
    const w = this.world;
    if (!w) { this.go('title'); return; }
    for (const ch of this.input.typed()) {
      if (/^[\p{L}\p{N} _-]$/u.test(ch) && this.nameBuffer.length < NAME_MAX) this.nameBuffer += ch.toUpperCase();
    }
    if (this.input.wasPressed('Backspace')) this.nameBuffer = this.nameBuffer.slice(0, -1);
    if (this.input.wasPressed(...KEYS.confirm)) {
      const entry: HighScore = {
        name: this.nameBuffer,
        score: w.score,
        level: this.screenWasVictory ? LEVELS.length + 1 : w.levelIndex + 1,
        date: new Date().toISOString(),
      };
      this.scores = insertScore(this.scores, entry);
      saveScores(this.storage, this.scores);
      this.highlight = this.scores.findIndex((s) => s.date === entry.date && s.score === entry.score);
      this.world = null;
      this.go('scores');
    }
  }

  private get screenWasVictory(): boolean {
    return this.world?.phase === 'rescue';
  }

  // ---------------------------------------------------------------- render

  render(): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b0820';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const w = this.world;
    const inGame = w && (this.screen === 'game' || this.screen === 'pause' || this.screen === 'gameover'
      || this.screen === 'victory' || this.screen === 'nameEntry');
    if (w && inGame) {
      this.renderer.draw(ctx, w, this.screen === 'game' ? dt : 0, this.screen === 'game' || this.screen === 'pause');
    } else {
      this.drawMenuBackground(dt);
    }
    drawFrame(ctx, this.time);
    drawHud(ctx, {
      score: w?.score ?? this.scores[0]?.score ?? 0,
      hp: w?.player.hp ?? 3,
      levelNumber: w ? w.levelIndex + 1 : 1,
      t: this.time,
    });

    ctx.save();
    ctx.translate(PLAY_X, PLAY_Y);
    switch (this.screen) {
      case 'title': this.drawTitle(); break;
      case 'howto': this.drawHowTo(); break;
      case 'scores': this.drawScores(); break;
      case 'pause': this.drawPause(); break;
      case 'gameover': this.drawGameOver(); break;
      case 'victory': this.drawVictory(); break;
      case 'nameEntry': this.drawNameEntry(); break;
      case 'game': break;
    }
    ctx.restore();
  }

  private drawMenuBackground(dt: number): void {
    const ctx = this.ctx;
    const bg = this.renderer.background(0);
    bg.update(dt);
    ctx.save();
    ctx.translate(PLAY_X, PLAY_Y);
    bg.draw(ctx);
    ctx.restore();
  }

  private dim(alpha = 0.55): void {
    this.ctx.fillStyle = `rgba(11,8,32,${alpha})`;
    this.ctx.fillRect(0, 0, PLAY_W, PLAY_H);
  }

  private drawTitle(): void {
    const ctx = this.ctx;
    const cx = PLAY_W / 2;
    const wobble = Math.round(Math.sin(this.time * 2) * 6);
    drawText(ctx, 'SPACE DOG', cx, 150 + wobble, 88, '#e2f6ff', 'center', '#1f3f9a');
    drawText(ctx, 'RESCUE', cx, 240 + wobble, 82, '#ffe25a', 'center', '#a12c6a');
    drawText(ctx, 'Rescue your dog, kidnapped by enemy ships!', cx, 310, 20, '#e2c2ff');
    drawSprite(ctx, this.bank.get('player'), cx - 70, 400 + Math.sin(this.time * 3) * 8, 0, 1.5, 1.5);
    drawSprite(ctx, this.bank.get('dog'), cx + 70, 400 + Math.abs(Math.sin(this.time * 5)) * -10, 0, 1.5, 1.5);
    WEAPON_TYPES.forEach((t, i) => {
      drawSprite(ctx, this.bank.get(`pickup_${t}`), cx - 150 + i * 60, 490 + Math.sin(this.time * 4 + i) * 5);
    });
    MENU.forEach((item, i) => {
      const sel = i === this.menuIndex;
      const y = 580 + i * 62;
      if (sel) {
        ctx.fillStyle = 'rgba(191,238,255,0.18)';
        ctx.fillRect(cx - 190, y - 26, 380, 52);
        drawSprite(ctx, this.bank.get('player'), cx - 220, y, 0, 0.6, 0.6);
      }
      drawText(ctx, item, cx, y, sel ? 36 : 30, sel ? '#ffffff' : '#9fb4e8');
    });
    drawText(ctx, '↑ ↓ to choose, Enter to confirm', cx, 800, 18, '#bfeeff');
  }

  private drawHowTo(): void {
    const ctx = this.ctx;
    this.dim(0.7);
    const cx = PLAY_W / 2;
    drawText(ctx, 'How to play', cx, 44, 38, '#ffe25a');
    const lines = [
      'Arrows: move the ship      Space: fire',
      'Ctrl or Shift: sacrifice the latest weapon = devastating salvo',
      '5 weapons max (bonuses add extra slots).',
      'Beyond that, the oldest weapon is sacrificed automatically!',
      'Health bar: 3 HP. At 0 HP, the game is over.   Esc/P: pause',
    ];
    lines.forEach((l, i) => drawText(ctx, l, cx, 92 + i * 28, 17, '#e2f6ff', 'center', '#120c2a', 'normal'));

    drawText(ctx, 'Weapons (destroy the "gamepad" ships)', cx, 246, 21, '#ffc6e2');
    WEAPON_TYPES.forEach((t, i) => {
      const y = 282 + i * 34;
      drawSprite(ctx, this.bank.get(`pickup_${t}`), 70, y, 0, 0.8, 0.8);
      drawText(ctx, `${WEAPONS[t].name}: ${WEAPONS[t].description}`, 110, y, 18, WEAPONS[t].light, 'left');
    });
    drawText(ctx, 'Several identical weapons = a stronger weapon', cx, 494, 17, '#e2f6ff', 'center', '#120c2a', 'normal');

    drawText(ctx, 'Points per enemy', cx, 534, 22, '#ffe25a');
    ENEMY_KINDS.forEach((k, i) => {
      const col = i < 8 ? 0 : 1;
      const row = i % 8;
      const x = col === 0 ? 40 : PLAY_W / 2 + 20;
      const y = 570 + row * 30;
      drawText(ctx, ENEMY_STATS[k].name, x, y, 17, '#e2f6ff', 'left', '#120c2a', 'normal');
      drawText(ctx, `${ENEMY_POINTS[k]}`, x + PLAY_W / 2 - 70, y, 17, '#ffe25a', 'right');
    });
    drawText(ctx, 'Enter or Esc: back', cx, 828, 16, '#bfeeff');
  }

  private drawScores(): void {
    const ctx = this.ctx;
    this.dim(0.65);
    const cx = PLAY_W / 2;
    drawText(ctx, 'High scores', cx, 80, 44, '#ffe25a');
    if (this.scores.length === 0) drawText(ctx, 'No scores yet.', cx, 300, 24, '#e2f6ff');
    this.scores.forEach((s, i) => {
      const y = 170 + i * 56;
      const hl = i === this.highlight && Math.floor(this.time * 4) % 2 === 0;
      const color = hl ? '#ffe25a' : '#e2f6ff';
      drawText(ctx, `${i + 1}.`, 110, y, 26, color, 'right');
      drawText(ctx, s.name, 130, y, 26, color, 'left');
      drawText(ctx, s.level > LEVELS.length ? 'Cleared' : `Lv. ${s.level}`, 440, y, 20, '#9fb4e8', 'center');
      drawDigits(ctx, formatScore(s.score), PLAY_W - 60, y - 12, 5, color, '#120c2a', 'right');
    });
    drawText(ctx, 'Enter: back to menu', cx, 820, 18, '#bfeeff');
  }

  private drawPause(): void {
    this.dim(0.6);
    drawText(this.ctx, 'PAUSE', PLAY_W / 2, PLAY_H / 2 - 40, 64, '#ffe25a');
    if (this.confirmQuit) {
      drawText(this.ctx, 'Quit this run?', PLAY_W / 2, PLAY_H / 2 + 30, 26, '#ff4f7b');
      drawText(this.ctx, 'Enter: quit to menu    Esc / P: stay', PLAY_W / 2, PLAY_H / 2 + 66, 22, '#e2f6ff');
      return;
    }
    drawText(this.ctx, 'Esc / P / Enter: resume', PLAY_W / 2, PLAY_H / 2 + 30, 22, '#e2f6ff');
    drawText(this.ctx, 'Q: quit to menu', PLAY_W / 2, PLAY_H / 2 + 66, 22, '#e2f6ff');
  }

  private drawGameOver(): void {
    const w = this.world;
    this.dim(Math.min(0.65, this.screenT));
    drawText(this.ctx, 'GAME OVER', PLAY_W / 2, PLAY_H / 2 - 70, 72, '#ff4f7b');
    drawText(this.ctx, `Score: ${formatScore(w?.score ?? 0)}`, PLAY_W / 2, PLAY_H / 2 + 10, 32, '#ffffff');
    drawText(this.ctx, `Level reached: ${(w?.levelIndex ?? 0) + 1}`, PLAY_W / 2, PLAY_H / 2 + 52, 22, '#e2f6ff');
    if (this.screenT > 1) drawText(this.ctx, 'Press Enter to continue', PLAY_W / 2, PLAY_H / 2 + 120, 22, '#bfeeff');
  }

  private drawVictory(): void {
    const ctx = this.ctx;
    const w = this.world;
    this.dim(Math.min(0.6, this.screenT));
    const cx = PLAY_W / 2;
    drawText(ctx, 'VICTORY!', cx, 170, 72, '#ffe25a');
    drawText(ctx, 'You got your dog back.', cx, 245, 28, '#e2f6ff');
    const hop = Math.abs(Math.sin(this.time * 6)) * -16;
    drawSprite(ctx, this.bank.get('player'), cx - 60, 400, 0, 2, 2);
    drawSprite(ctx, this.bank.get('dog'), cx + 60, 410 + hop, 0, 2, 2);
    for (let i = 0; i < 5; i++) {
      const t = (this.time * 0.6 + i / 5) % 1;
      ctx.globalAlpha = 1 - t;
      drawSprite(ctx, this.bank.get('heart'), cx - 80 + i * 40, 330 - t * 120);
      ctx.globalAlpha = 1;
    }
    drawText(ctx, `Final score: ${formatScore(w?.score ?? 0)}`, cx, 540, 34, '#ffffff');
    if (this.screenT > 1) drawText(ctx, 'Press Enter to continue', cx, 620, 22, '#bfeeff');
  }

  private drawNameEntry(): void {
    const ctx = this.ctx;
    this.dim(0.75);
    const cx = PLAY_W / 2;
    drawText(ctx, 'New high score!', cx, 230, 50, '#ffe25a');
    drawText(ctx, `Score: ${formatScore(this.world?.score ?? 0)}`, cx, 300, 30, '#ffffff');
    drawText(ctx, 'Enter your name:', cx, 380, 24, '#e2f6ff');
    ctx.fillStyle = 'rgba(191,238,255,0.15)';
    ctx.fillRect(cx - 200, 410, 400, 64);
    const caret = Math.floor(this.time * 3) % 2 === 0 ? '_' : ' ';
    drawText(ctx, this.nameBuffer + caret, cx, 442, 38, '#ffffff');
    drawText(ctx, `${NAME_MAX} characters max — Enter to confirm`, cx, 510, 18, '#bfeeff');
  }
}
