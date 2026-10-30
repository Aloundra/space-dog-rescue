import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { ENEMY_KINDS } from '../src/data/enemies';
import { LEVELS } from '../src/data/levels';
import { WEAPON_TYPES } from '../src/data/weapons';
import { expandWaves } from '../src/game/spawner';
import {
  baseShot, laserStats, levelMultiplier, missileStats, salvoDamage, sideShots, speedMultiplier, violetBurst,
} from '../src/game/weaponStats';
import { bossHalfRows, sawBlade, sphere, spiralDisc, tankRows, turretRows } from '../src/render/procedural';
import { BASE_PALETTE, SPRITES, expandRows } from '../src/render/spriteData';

describe('weapon levels', () => {
  it('more copies = more power', () => {
    expect(baseShot(2).count).toBeGreaterThan(baseShot(0).count);
    expect(baseShot(4).interval).toBeLessThan(baseShot(0).interval);
    expect(speedMultiplier(2)).toBeGreaterThan(speedMultiplier(1));
    expect(violetBurst(0)).toBeNull();
    expect(violetBurst(2)!.count).toBeGreaterThan(violetBurst(1)!.count);
    expect(sideShots(0, 0)).toBeNull();
    expect(sideShots(3, 0)!.angles.length).toBeGreaterThan(sideShots(2, 0)!.angles.length);
    expect(missileStats(3)!.count).toBe(3);
    expect(violetBurst(20)!.count).toBeGreaterThan(violetBurst(8)!.count);
    expect(laserStats(20)!.dps).toBeGreaterThan(laserStats(8)!.dps);
    expect(laserStats(2)!.dps).toBeGreaterThan(laserStats(1)!.dps);
    for (const t of WEAPON_TYPES) expect(salvoDamage(t, 2)).toBeGreaterThan(salvoDamage(t, 1));
  });
});

describe('weapon level growth (+25% damage and size per level, -25% when a level is lost)', () => {
  it('multiplier is linear', () => {
    expect(levelMultiplier(1)).toBe(1);
    expect(levelMultiplier(2)).toBe(1.25);
    expect(levelMultiplier(3)).toBe(1.5);
    expect(levelMultiplier(4)).toBe(1.75);
  });

  it('applies to damage and projectile size of every projectile weapon', () => {
    const pairs = [
      [violetBurst(1)!, violetBurst(2)!],
      [sideShots(1, 0)!, sideShots(2, 0)!],
      [missileStats(1)!, missileStats(2)!],
    ];
    for (const [a, b] of pairs) {
      expect(b.damage / a.damage).toBeCloseTo(1.25);
      expect(b.radius / a.radius).toBeCloseTo(1.25);
      expect(b.scale / a.scale).toBeCloseTo(1.25);
    }
    // Losing a level: back from level 3 to 2 removes 25% of base.
    expect(missileStats(3)!.damage - missileStats(2)!.damage).toBeCloseTo(missileStats(1)!.damage * 0.25);
    expect(baseShot(1).damage / baseShot(0).damage).toBeCloseTo(1.25);
    expect(baseShot(2).radius / baseShot(0).radius).toBeCloseTo(1.5);
    expect(laserStats(2)!.dps / laserStats(1)!.dps).toBeCloseTo(1.25);
    expect(laserStats(2)!.width / laserStats(1)!.width).toBeCloseTo(1.25);
  });
});

describe('yellow side shots follow the vertical arrows', () => {
  it('level 1: horizontal, Up held = shots tilted down 60 deg, Down held = shots tilted up 60 deg', () => {
    expect(sideShots(1, 0)!.angles).toEqual([0, Math.PI]);
    const up = sideShots(1, -1)!.angles;
    expect(up[0]).toBeCloseTo(Math.PI / 3);
    expect(up[1]).toBeCloseTo((2 * Math.PI) / 3);
    const down = sideShots(1, 1)!.angles;
    expect(down[0]).toBeCloseTo(-Math.PI / 3);
    expect(down[1]).toBeCloseTo((4 * Math.PI) / 3);
  });
});

describe('violet balls cross the whole screen', () => {
  it('lifetime covers the screen diagonal at the slowest speed', () => {
    const v = violetBurst(1)!;
    expect(v.speed * 0.7 * v.life).toBeGreaterThan(Math.hypot(760, 860));
  });
});

describe('levels data', () => {
  it('has 10 levels, each with a boss; the last one (Kidnapper\'s Lair) holds the dog', () => {
    expect(LEVELS).toHaveLength(10);
    expect(LEVELS[9].name).toBe("Kidnapper's Lair");
    for (const l of LEVELS) expect(l.boss.hp).toBeGreaterThan(0);
    expect(LEVELS[LEVELS.length - 1].boss.holdsDog).toBe(true);
    expect(LEVELS.slice(0, -1).every((l) => !l.boss.holdsDog)).toBe(true);
  });

  it('gets harder level after level: difficulty, wave count and boss health only go up', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].difficulty, `difficulty ${i + 1}`).toBeGreaterThan(LEVELS[i - 1].difficulty);
      expect(LEVELS[i].boss.hp, `boss hp ${i + 1}`).toBeGreaterThan(LEVELS[i - 1].boss.hp);
      expect(LEVELS[i].boss.points, `boss points ${i + 1}`).toBeGreaterThan(LEVELS[i - 1].boss.points);
    }
    // Generated levels (4..10) add waves at every step.
    for (let i = 4; i < LEVELS.length; i++) {
      expect(LEVELS[i].waves.length, `waves ${i + 1}`).toBeGreaterThan(LEVELS[i - 1].waves.length);
    }
  });

  it('generates levels deterministically, with waves inside a playable timeline', () => {
    for (const l of LEVELS) {
      const times = l.waves.map((w) => w.at);
      expect(Math.min(...times)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...times)).toBeLessThan(150);
      for (const w of l.waves) {
        expect(w.count).toBeGreaterThan(0);
        expect(w.x).toBeGreaterThanOrEqual(0);
        expect(w.x).toBeLessThanOrEqual(1);
      }
    }
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
