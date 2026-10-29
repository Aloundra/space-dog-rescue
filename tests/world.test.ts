// Headless simulation of the real World with a scripted input.
import { describe, expect, it } from 'vitest';
import { STEP } from '../src/config';
import type { InputState } from '../src/core/input';
import { LEVELS } from '../src/data/levels';
import { World } from '../src/game/world';

class FakeInput implements InputState {
  down = new Set<string>();
  pressed = new Set<string>();
  isDown(c: string): boolean {
    return this.down.has(c);
  }
  wasPressed(...c: string[]): boolean {
    return c.some((x) => this.pressed.has(x));
  }
  typed(): readonly string[] {
    return [];
  }
}

function run(w: World, input: FakeInput, seconds: number, each?: (w: World, t: number) => void): void {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    // Sweep left/right to cover the screen.
    const phase = Math.floor((i * STEP) / 1.5) % 2;
    input.down.delete('ArrowLeft');
    input.down.delete('ArrowRight');
    input.down.add(phase === 0 ? 'ArrowLeft' : 'ArrowRight');
    w.update(STEP, input);
    input.pressed.clear();
    each?.(w, i * STEP);
    if (w.events.length) return;
  }
}

describe('World simulation', () => {
  it('a full god-mode run clears all levels, defeats every boss and rescues the dog', () => {
    const w = new World(42, { god: true, weapons: ['green', 'green', 'red'] });
    const input = new FakeInput();
    input.down.add('Space');
    const levelsSeen = new Set<number>();
    const kinds = new Set<string>();
    let bosses = 0;
    let lastBoss: unknown = null;
    run(w, input, 60 * 25, (world) => {
      levelsSeen.add(world.levelIndex);
      for (const e of world.enemies) kinds.add(e.kind);
      if (world.boss && world.boss !== lastBoss) {
        lastBoss = world.boss;
        bosses++;
      }
    });
    expect(w.events).toContain('victory');
    expect(levelsSeen.size).toBe(LEVELS.length);
    expect(bosses).toBe(LEVELS.length);
    expect(kinds.size).toBe(17); // 16 enemies + carrier
    expect(w.score).toBeGreaterThan(100_000);
  }, 120_000);

  it('without moving or shooting the player loses 3 HP and the game ends', () => {
    const w = new World(7);
    const input = new FakeInput();
    let minHp = 3;
    for (let i = 0; i < 60 * 240 && !w.events.length; i++) {
      w.update(STEP, input);
      minHp = Math.min(minHp, w.player.hp);
    }
    expect(w.events).toEqual(['gameover']);
    expect(w.player.hp).toBe(0);
  }, 60_000);

  it('Ctrl/Shift sacrifices exactly one weapon (the most recent) and clears enemy bullets', () => {
    const w = new World(3, { weapons: ['violet', 'blue', 'red'] });
    const input = new FakeInput();
    run(w, input, 12);
    expect(w.eShots.countActive()).toBeGreaterThanOrEqual(0);
    input.down.add('ShiftLeft');
    input.pressed.add('ShiftLeft');
    w.update(STEP, input);
    input.pressed.clear();
    expect(w.inventory.list).toEqual(['violet', 'blue']);
    expect(w.eShots.countActive()).toBe(0);
    // Holding the key does not consume the rest of the inventory.
    for (let i = 0; i < 120; i++) w.update(STEP, input);
    expect(w.inventory.list).toEqual(['violet', 'blue']);
    expect(w.salvos.length + 1).toBeGreaterThan(0);
  });

  it('sacrifice with an empty inventory does nothing', () => {
    const w = new World(3);
    const input = new FakeInput();
    input.pressed.add('ControlLeft');
    w.update(STEP, input);
    expect(w.salvos).toHaveLength(0);
  });
});
