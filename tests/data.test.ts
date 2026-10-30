import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { ENEMY_KINDS } from '../src/data/enemies';
import { LEVELS } from '../src/data/levels';
import { WEAPON_TYPES } from '../src/data/weapons';
import { expandWaves } from '../src/game/spawner';
import {
  baseShot, bonusCount, laserStats, levelMultiplier, missileStats, orbitalStats, pinkStats, salvoDamage, sideShots,
  sizeMultiplier, speedMultiplier, violetBurst,
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
    expect(sideShots(2, 0)!.angles.length).toBeGreaterThan(sideShots(1, 0)!.angles.length);
    expect(missileStats(2)!.count).toBeGreaterThan(missileStats(1)!.count);
    expect(laserStats(2)!.beams).toBeGreaterThan(laserStats(1)!.beams);
    expect(laserStats(2)!.dps).toBeGreaterThan(laserStats(1)!.dps);
    for (const t of WEAPON_TYPES) expect(salvoDamage(t, 2)).toBeGreaterThan(salvoDamage(t, 1));
  });
});

describe('weapon level rules: abilities over levels 1-5, damage and count after', () => {
  it('damage grows +15% per level up to 5, then +10% per level (of the level-5 value)', () => {
    expect(levelMultiplier(1)).toBe(1);
    expect(levelMultiplier(2)).toBeCloseTo(1.15);
    expect(levelMultiplier(3)).toBeCloseTo(1.3);
    expect(levelMultiplier(5)).toBeCloseTo(1.6);
    expect(levelMultiplier(6)).toBeCloseTo(1.76);
    expect(levelMultiplier(10)).toBeCloseTo(2.4);
    expect(levelMultiplier(20)).toBeCloseTo(4);
  });

  it('size stops growing at level 5', () => {
    expect(sizeMultiplier(1)).toBe(1);
    expect(sizeMultiplier(5)).toBeCloseTo(1.6);
    expect(sizeMultiplier(6)).toBeCloseTo(1.6);
    expect(sizeMultiplier(20)).toBeCloseTo(1.6);
    for (const l of [5, 12, 20]) {
      expect(violetBurst(l)!.radius).toBeCloseTo(violetBurst(5)!.radius);
      expect(missileStats(l)!.radius).toBeCloseTo(missileStats(5)!.radius);
      expect(sideShots(l, 0)!.radius).toBeCloseTo(sideShots(5, 0)!.radius);
      expect(laserStats(l)!.width).toBeCloseTo(laserStats(5)!.width);
    }
  });

  it('extra projectiles start at level 6 and are capped', () => {
    expect(bonusCount(5, 2)).toBe(0);
    expect(bonusCount(6, 2)).toBe(1);
    expect(bonusCount(7, 2)).toBe(1);
    expect(bonusCount(8, 2)).toBe(2);
    for (const l of [1, 3, 5]) {
      expect(baseShot(l).count).toBeLessThanOrEqual(3);
      expect(sideShots(l, 0)!.angles.length).toBeLessThanOrEqual(4);
      expect(missileStats(l)!.count).toBeLessThanOrEqual(2);
      expect(laserStats(l)!.beams).toBeLessThanOrEqual(3);
    }
    expect(baseShot(6).count).toBe(4);
    expect(baseShot(20).count).toBe(8);
    expect(sideShots(6, 0)!.angles.length / 2).toBe(3);
    expect(sideShots(20, 0)!.angles.length / 2).toBe(8);
    expect(missileStats(6)!.count).toBe(3);
    expect(missileStats(20)!.count).toBe(10);
    expect(laserStats(6)!.beams).toBe(4);
    expect(laserStats(20)!.beams).toBe(8);
    expect(violetBurst(6)!.count).toBe(violetBurst(5)!.count + 2);
  });

  it('levels 1-5 unlock one ability each, in order', () => {
    // Green: 1 two shots, 2 three, 3 pierce, 4 particle per shot, 5 charged exploding shot.
    expect([1, 2, 3, 4, 5].map((l) => baseShot(l).count)).toEqual([2, 3, 3, 3, 3]);
    expect([2, 3, 4].map((l) => [baseShot(l).pierce, baseShot(l).particle])).toEqual([[0, 0], [1, 0], [1, 0.5]]);
    expect(baseShot(4).charge).toBeNull();
    expect(baseShot(5).charge!.blast).toBeGreaterThan(0);
    // Violet: 2 rebound, 3 trail, 4 split, 5 orbitals.
    expect([1, 2, 3, 4].map((l) => [violetBurst(l)!.rebound, violetBurst(l)!.trail, violetBurst(l)!.split])).toEqual([
      [0, false, false], [1, false, false], [1, true, false], [1, true, true],
    ]);
    expect(orbitalStats(4)).toBeNull();
    expect(orbitalStats(5)!.count).toBe(4);
    // Pink: 2 trail, 3 magnet, 4 graze, 5 bullet time; speed capped at x2.
    const pk = [1, 2, 3, 4, 5].map((l) => pinkStats(l)!);
    expect(pk.map((x) => x.trailDps > 0)).toEqual([false, true, true, true, true]);
    expect(pk.map((x) => x.magnet > 0)).toEqual([false, false, true, true, true]);
    expect(pk.map((x) => x.graze !== null)).toEqual([false, false, false, true, true]);
    expect(pk.map((x) => x.slow !== null)).toEqual([false, false, false, false, true]);
    expect(speedMultiplier(5)).toBe(2);
    expect(speedMultiplier(20)).toBe(2);
    // Yellow: 2 wider fan (two per side), 3 pierce, 4 rear shot, 5 boomerang.
    expect([1, 2, 3, 4, 5].map((l) => sideShots(l, 0)!.angles.length / 2)).toEqual([1, 2, 2, 2, 2]);
    expect([3, 4, 5].map((l) => [sideShots(l, 0)!.pierce, sideShots(l, 0)!.rear, sideShots(l, 0)!.boomerang > 0])).toEqual([
      [1, false, false], [1, true, false], [1, true, true],
    ]);
    // Blue: 2 two missiles, 3 blast, 4 split, 5 heavy missile.
    expect([1, 2].map((l) => missileStats(l)!.count)).toEqual([1, 2]);
    expect([2, 3, 4, 5].map((l) => [missileStats(l)!.blast > 0, missileStats(l)!.split, missileStats(l)!.heavy !== null])).toEqual([
      [false, false, false], [true, false, false], [true, true, false], [true, true, true],
    ]);
    // Red: 2 two beams, 3 chain, 4 third beam, 5 main beam.
    expect([1, 2, 3, 4, 5].map((l) => laserStats(l)!.beams)).toEqual([1, 2, 2, 3, 3]);
    expect([2, 3, 4, 5].map((l) => [laserStats(l)!.chain !== null, laserStats(l)!.beams === 3, laserStats(l)!.main !== null])).toEqual([
      [false, false, false], [true, false, false], [true, true, false], [true, true, true],
    ]);
  });

  it('salvo power: +50% per level to 5, then +15%', () => {
    const base = salvoDamage('red', 1);
    expect(salvoDamage('red', 5)).toBeCloseTo(base * 3);
    expect(salvoDamage('red', 6)).toBeCloseTo(base * 3 * 1.15);
    expect(salvoDamage('red', 20)).toBeLessThan(base * 10);
  });

  it('level 20 keeps projectile counts bounded (pool-safe)', () => {
    const perSecond =
      (baseShot(20).count / baseShot(20).interval) * 2 +
      (sideShots(20, 0)!.angles.length / baseShot(20).interval) * 3.5 +
      (violetBurst(20)!.count / violetBurst(20)!.interval) * 3 +
      (missileStats(20)!.count / missileStats(20)!.interval) * 4;
    expect(perSecond).toBeLessThan(2500);
  });
});

describe('weapon level growth (+15% damage and size per level, -25% when a level is lost)', () => {
  it('applies to damage and projectile size of every projectile weapon', () => {
    const pairs = [
      [violetBurst(1)!, violetBurst(2)!],
      [sideShots(1, 0)!, sideShots(2, 0)!],
      [missileStats(1)!, missileStats(2)!],
    ];
    for (const [a, b] of pairs) {
      expect(b.damage / a.damage).toBeCloseTo(1.15);
      expect(b.radius / a.radius).toBeCloseTo(1.15);
      expect(b.scale / a.scale).toBeCloseTo(1.15);
    }
    // Losing a level: back from level 3 to 2 removes 15% of base.
    expect(missileStats(3)!.damage - missileStats(2)!.damage).toBeCloseTo(missileStats(1)!.damage * 0.15);
    expect(baseShot(1).damage / baseShot(0).damage).toBeCloseTo(1.15);
    expect(baseShot(2).radius / baseShot(0).radius).toBeCloseTo(1.3);
    expect(laserStats(2)!.dps / laserStats(1)!.dps).toBeCloseTo(1.15);
    expect(laserStats(5)!.width).toBe(laserStats(1)!.width);
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
