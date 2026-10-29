import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { ENEMY_KINDS } from '../src/data/enemies';
import { LEVELS } from '../src/data/levels';
import { WEAPON_TYPES } from '../src/data/weapons';
import { expandWaves } from '../src/game/spawner';
import { baseShot, laserStats, missileStats, salvoDamage, sideAngles, speedMultiplier, violetBurst } from '../src/game/weaponStats';
import { bossHalfRows, sawBlade, sphere, spiralDisc, tankRows, turretRows } from '../src/render/procedural';
import { BASE_PALETTE, SPRITES, expandRows } from '../src/render/spriteData';

describe('weapon levels', () => {
  it('more copies = more power', () => {
    expect(baseShot(2).count).toBeGreaterThan(baseShot(0).count);
    expect(baseShot(4).interval).toBeLessThan(baseShot(0).interval);
    expect(speedMultiplier(2)).toBeGreaterThan(speedMultiplier(1));
    expect(violetBurst(0)).toBeNull();
    expect(violetBurst(2)!.count).toBeGreaterThan(violetBurst(1)!.count);
    expect(violetBurst(2)!.life).toBeGreaterThan(violetBurst(1)!.life);
    expect(sideAngles(0)).toEqual([]);
    expect(sideAngles(1)).toEqual([0, Math.PI]);
    expect(sideAngles(3).length).toBeGreaterThan(sideAngles(2).length);
    expect(missileStats(1)!.homing).toBe(0);
    expect(missileStats(3)!.count).toBe(3);
    expect(laserStats(2)!.dps).toBeGreaterThan(laserStats(1)!.dps);
    for (const t of WEAPON_TYPES) expect(salvoDamage(t, 2)).toBeGreaterThan(salvoDamage(t, 1));
  });
});

describe('levels data', () => {
  it('has at least 4 levels, each with a boss; the last one holds the dog', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(4);
    for (const l of LEVELS) expect(l.boss.hp).toBeGreaterThan(0);
    expect(LEVELS[LEVELS.length - 1].boss.holdsDog).toBe(true);
    expect(LEVELS.slice(0, -1).every((l) => !l.boss.holdsDog)).toBe(true);
  });

  it('uses all 16 enemy kinds and weapon carriers', () => {
    const used = new Set(LEVELS.flatMap((l) => l.waves.map((w) => w.kind)));
    for (const k of ENEMY_KINDS) expect(used.has(k), k).toBe(true);
    expect(used.has('carrier')).toBe(true);
  });

  it('expands waves into sorted spawn events', () => {
    const ev = expandWaves(LEVELS[0].waves, new Rng(1));
    const expected = LEVELS[0].waves.reduce((n, w) => n + w.count, 0);
    expect(ev).toHaveLength(expected);
    for (let i = 1; i < ev.length; i++) expect(ev[i].time).toBeGreaterThanOrEqual(ev[i - 1].time);
    const v = expandWaves([{ at: 0, kind: 'vBall', count: 5, formation: 'v', x: 0.5, interval: 0, spread: 0 }], new Rng(1));
    expect(v[2].y).toBeGreaterThan(v[0].y); // leader in front
  });
});

describe('pixel art', () => {
  const rect = (rows: string[]): boolean => rows.every((r) => r.length === rows[0].length);

  it('hand-made sprites are rectangular and use known palette chars', () => {
    for (const [name, def] of Object.entries(SPRITES)) {
      expect(rect(def.rows), name).toBe(true);
      const full = expandRows(def);
      for (const ch of full.join('')) {
        if (ch !== '.') expect(def.palette[ch], `${name}:${ch}`).toBeDefined();
      }
    }
  });

  it('procedural generators are deterministic and rectangular', () => {
    const all = [spiralDisc(4), sphere(5), sawBlade(8, 10), turretRows(6, 's', 'S'), tankRows(7, 14, 'b', 'B')];
    for (const rows of all) {
      expect(rect(rows)).toBe(true);
      for (const ch of rows.join('')) if (ch !== '.') expect(BASE_PALETTE[ch], ch).toBeDefined();
    }
    for (const l of LEVELS) {
      const a = bossHalfRows(l.boss.seed, l.boss.halfW, l.boss.h);
      expect(a).toEqual(bossHalfRows(l.boss.seed, l.boss.halfW, l.boss.h));
      expect(rect(a)).toBe(true);
      expect(a).toHaveLength(l.boss.h + 5);
      expect(a.join('').replace(/[.k]/g, '').length).toBeGreaterThan(l.boss.halfW * l.boss.h * 0.4);
    }
  });
});
