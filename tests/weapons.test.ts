// Headless behaviour tests of the level 1-5 weapon abilities (and the level 6+ rules) inside the real World.
import { describe, expect, it } from 'vitest';
import { PLAY_H, PLAY_W, STEP } from '../src/config';
import type { InputState } from '../src/core/input';
import type { WeaponType } from '../src/data/weapons';
import { World } from '../src/game/world';
import type { Bullet, BulletStyle, Enemy } from '../src/game/types';

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

const copies = (type: WeaponType, n: number): WeaponType[] => Array.from({ length: n }, () => type);

/** A World in the waves phase with no enemies, holding `level` copies of `type`. */
function setup(type: WeaponType, level: number, slots = 0): World {
  const w = new World(5, { god: true, weapons: copies(type, level), slots });
  w.phase = 'waves';
  w.enemies = [];
  return w;
}

type Fire = (style: BulletStyle, x: number, y: number, a: number, speed: number, dmg: number, r: number, scale: number) => Bullet | null;
const fire = (w: World): Fire => (w as unknown as { firePlayer: Fire }).firePlayer.bind(w);

/** A sturdy enemy that stays where it is put (re-pinned every step by `step`). */
function dummy(w: World, x: number, y: number, hp = 5000): { e: Enemy; pin: () => void } {
  const e = w.spawnEnemy('armoredRect', x, y, 0);
  e.hp = e.maxHp = hp;
  return { e, pin: () => { e.x = x; e.y = y; e.vx = e.vy = 0; } };
}

function run(w: World, input: FakeInput, steps: number, each?: () => void): void {
  for (let i = 0; i < steps; i++) {
    each?.();
    w.update(STEP, input);
  }
}

const fireInput = (): FakeInput => {
  const i = new FakeInput();
  i.down.add('Space');
  return i;
};

describe('green (base gun)', () => {
  it('level 3 shots pierce one enemy, level 2 shots stop at the first', () => {
    const results = [2, 3].map((lv) => {
      const w = setup('green', lv);
      const a = dummy(w, w.player.x, w.player.y - 200);
      const b = dummy(w, w.player.x, w.player.y - 330);
      run(w, fireInput(), 60, () => { a.pin(); b.pin(); });
      return [a.e.hp < 5000, b.e.hp < 5000];
    });
    expect(results).toEqual([[true, false], [true, true]]);
  });

  it('level 4 shots ricochet once off the side walls (never the top edge); level 3 shots do not', () => {
    const run4 = (lv: number): { bounced: boolean; topBounce: boolean } => {
      const w = setup('green', lv);
      w.player.x = 40; // next to the left wall, so the left-leaning shots reach it
      const input = fireInput();
      const wentLeft = new Set<Bullet>();
      let bounced = false;
      let topBounce = false;
      run(w, input, 100, () => {
        for (const b of w.pShots.items) {
          if (!b.active || b.style !== 'shot') continue;
          if (b.vx < 0) wentLeft.add(b);
          else if (wentLeft.has(b)) bounced = true;
          if (b.vy > 0) topBounce = true;
        }
      });
      return { bounced, topBounce };
    };
    expect(run4(3)).toEqual({ bounced: false, topBounce: false });
    expect(run4(4)).toEqual({ bounced: true, topBounce: false });
  });

  it('level 5 adds a heavy exploding shot whose blast hurts neighbours', () => {
    const neighbourHp = (lv: number): number => {
      const w = setup('green', lv);
      const a = dummy(w, w.player.x, w.player.y - 300);
      const b = dummy(w, w.player.x + 100, w.player.y - 300);
      // Short run: ricocheted shots only come back down after ~0.9 s and could hit the neighbour directly.
      run(w, fireInput(), 45, () => { a.pin(); b.pin(); });
      return b.e.hp;
    };
    expect(neighbourHp(4)).toBe(5000);
    expect(neighbourHp(5)).toBeLessThan(5000);
  });

  it('level 6+ fires more shots', () => {
    const w = setup('green', 6, 1);
    run(w, fireInput(), 1);
    expect(w.pShots.items.filter((b) => b.active && b.style === 'shot')).toHaveLength(4);
  });
});

describe('violet (balls)', () => {
  it('level 2 balls rebound off an enemy instead of stopping', () => {
    const w = setup('violet', 2);
    const { e } = dummy(w, 300, 300);
    const b = fire(w)('violet', 300, 380, -Math.PI / 2, 400, 1, 8, 1)!;
    b.rebound = 1;
    w.update(STEP, new FakeInput());
    for (let i = 0; i < 20 && b.vy < 0; i++) w.update(STEP, new FakeInput());
    expect(e.hp).toBeLessThan(5000);
    expect(b.active).toBe(true);
    expect(b.vy).toBeGreaterThan(0);
    expect(b.rebound).toBe(0);
  });

  it('level 4 balls split into two smaller balls on impact', () => {
    const w = setup('violet', 4);
    dummy(w, 300, 300);
    const b = fire(w)('violet', 300, 340, -Math.PI / 2, 400, 1, 8, 2)!;
    b.splitOnHit = true;
    for (let i = 0; i < 20 && b.active; i++) w.update(STEP, new FakeInput());
    expect(b.active).toBe(false);
    const kids = w.pShots.items.filter((k) => k.active && k.style === 'violet' && k !== b);
    expect(kids).toHaveLength(2);
    for (const k of kids) expect(k.scale).toBeLessThan(2);
  });

  it('level 5 has four orbiting orbs that absorb small enemy bullets, then recharge', () => {
    const w = setup('violet', 5);
    w.update(STEP, new FakeInput());
    const orbs = w.orbitals();
    expect(orbs).toHaveLength(4);
    const shot = w.eShots.acquire()!;
    Object.assign(shot, { x: orbs[0].x, y: orbs[0].y, vx: 0, vy: 0, r: 5, life: 5, t: 0, style: 'ePellet', homing: 0, bounce: false });
    w.update(STEP, new FakeInput());
    expect(shot.active).toBe(false);
    expect(w.orbitCd[0]).toBeGreaterThan(1);
    expect(w.orbitals()[0].ready).toBe(false);
    // Below level 5 there are no orbs.
    expect(setup('violet', 4).orbitals()).toHaveLength(0);
  });

  it('orbs hurt enemies they touch', () => {
    const w = setup('violet', 5);
    w.update(STEP, new FakeInput());
    const o = w.orbitals()[0];
    const { e, pin } = dummy(w, o.x, o.y - 40);
    run(w, new FakeInput(), 10, pin);
    expect(e.hp).toBeLessThan(5000);
  });
});

describe('pink (mobility)', () => {
  it('level 2 leaves a trail that hurts enemies on the ship path', () => {
    const hpAfterDash = (lv: number): number => {
      const w = setup('pink', lv);
      const ex = w.player.x - 90;
      const ey = w.player.y;
      const e = w.spawnEnemy('turret', ex, ey, 0); // ground unit: no contact damage
      e.hp = e.maxHp = 5000;
      const input = new FakeInput();
      input.down.add('ArrowLeft');
      run(w, input, 20, () => { e.x = ex; e.y = ey; e.vx = e.vy = 0; });
      return e.hp;
    };
    expect(hpAfterDash(1)).toBe(5000);
    expect(hpAfterDash(2)).toBeLessThan(5000);
  });

  it('level 3 pulls nearby pickups toward the ship', () => {
    const dist = (lv: number): number => {
      const w = setup('pink', lv);
      w.pickups.push({ kind: 'heart', weapon: null, x: w.player.x + 200, y: w.player.y - 150, t: 0 });
      const start = Math.hypot(200, 150);
      run(w, new FakeInput(), 20);
      const pk = w.pickups[0];
      return pk ? Math.hypot(pk.x - w.player.x, pk.y - w.player.y) - start : -start;
    };
    expect(dist(2)).toBeGreaterThan(-20);
    expect(dist(3)).toBeLessThan(dist(2) - 40);
  });

  it('level 4 grants brief invulnerability on a near miss, then recharges', () => {
    const w = setup('pink', 4);
    const p = w.player;
    const shot = w.eShots.acquire()!;
    Object.assign(shot, { x: p.x + 38, y: p.y, vx: 0, vy: 0, r: 7, life: 5, t: 0, style: 'ePellet', homing: 0, bounce: false });
    w.update(STEP, new FakeInput());
    expect(p.invuln).toBeGreaterThan(0.4);
    expect(p.grazeCd).toBeGreaterThan(7);
    // Below level 4: nothing happens.
    const w3 = setup('pink', 3);
    const s3 = w3.eShots.acquire()!;
    Object.assign(s3, { x: w3.player.x + 38, y: w3.player.y, vx: 0, vy: 0, r: 7, life: 5, t: 0, style: 'ePellet', homing: 0, bounce: false });
    w3.update(STEP, new FakeInput());
    expect(w3.player.invuln).toBe(0);
  });

  it('level 5 slows enemy bullets near the ship', () => {
    const moved = (lv: number): number => {
      const w = setup('pink', lv);
      const shot = w.eShots.acquire()!;
      Object.assign(shot, { x: w.player.x + 100, y: w.player.y - 400, vx: 0, vy: 300, r: 7, life: 5, t: 0, style: 'ePellet', homing: 0, bounce: false });
      const y0 = shot.y;
      shot.y = w.player.y - 120;
      const before = shot.y;
      w.update(STEP, new FakeInput());
      void y0;
      return shot.y - before;
    };
    expect(moved(4)).toBeCloseTo(300 * STEP);
    expect(moved(5)).toBeCloseTo(150 * STEP);
  });
});

describe('yellow (side shots)', () => {
  const sideHits = (lv: number): boolean[] => {
    const w = setup('yellow', lv);
    const a = dummy(w, w.player.x + 150, w.player.y - 9);
    const b = dummy(w, w.player.x + 330, w.player.y - 9);
    run(w, fireInput(), 40, () => { a.pin(); b.pin(); });
    return [a.e.hp < 5000, b.e.hp < 5000];
  };

  it('level 3 side shots pierce one enemy, level 2 shots stop at the first', () => {
    expect(sideHits(2)).toEqual([true, false]);
    expect(sideHits(3)).toEqual([true, true]);
  });

  it('level 4 adds a shot fired straight backward', () => {
    const rear = (lv: number): number => {
      const w = setup('yellow', lv);
      run(w, fireInput(), 1);
      return w.pShots.items.filter((b) => b.active && b.style === 'side' && Math.abs(b.vx) < 1e-6 && b.vy > 0).length;
    };
    expect(rear(3)).toBe(0);
    expect(rear(4)).toBe(1);
  });

  it('level 5 side shots turn back toward the ship (boomerang) and vanish near it', () => {
    const w = setup('yellow', 5);
    const input = fireInput();
    w.update(STEP, input);
    input.down.delete('Space');
    const shots = w.pShots.items.filter((b) => b.active && b.style === 'side');
    expect(shots.length).toBeGreaterThan(0);
    let returned = false;
    for (let i = 0; i < 180 && shots.some((b) => b.active); i++) {
      w.update(STEP, input);
      if (shots.some((b) => b.active && b.returning)) returned = true;
    }
    expect(returned).toBe(true);
    expect(shots.every((b) => !b.active)).toBe(true);
  });

  it('level 6 fires three shots per side', () => {
    const w = setup('yellow', 6, 1);
    run(w, fireInput(), 1);
    const side = w.pShots.items.filter((b) => b.active && b.style === 'side' && Math.abs(b.vx) > 1);
    expect(side).toHaveLength(6);
  });
});

describe('blue (missiles)', () => {
  it('level 3 missiles explode and hurt enemies next to the target', () => {
    const behindHp = (lv: number): number => {
      const w = setup('blue', lv);
      const a = dummy(w, w.player.x, w.player.y - 250);
      const b = dummy(w, w.player.x, w.player.y - 250 - 75);
      run(w, fireInput(), 150, () => { a.pin(); b.pin(); });
      return b.e.hp;
    };
    expect(behindHp(2)).toBe(5000);
    expect(behindHp(3)).toBeLessThan(5000);
  });

  it('level 4 missiles split into smaller ones in flight', () => {
    const w = setup('blue', 4);
    dummy(w, w.player.x, w.player.y - 600);
    const input = fireInput();
    w.update(STEP, input);
    input.down.delete('Space');
    const scale0 = Math.max(...w.pShots.items.filter((b) => b.active && b.style === 'missile').map((b) => b.scale));
    run(w, input, 35);
    const missiles = w.pShots.items.filter((b) => b.active && b.style === 'missile');
    expect(missiles.length).toBeGreaterThanOrEqual(4);
    expect(missiles.some((b) => b.scale < scale0 * 0.9)).toBe(true);
  });

  it('level 5 fires a heavy missile that flies through every enemy on its path', () => {
    const w = setup('blue', 5);
    run(w, fireInput(), 1);
    const heavy = w.pShots.items.find((b) => b.active && b.style === 'heavyMissile');
    expect(heavy?.pierce).toBe(99);
    const w2 = setup('blue', 1);
    const a = dummy(w2, 400, 600);
    const b = dummy(w2, 400, 400);
    const h = fire(w2)('heavyMissile', 400, 780, -Math.PI / 2, 700, 50, 15, 3)!;
    h.pierce = 99;
    run(w2, new FakeInput(), 60, () => { a.pin(); b.pin(); });
    expect(a.e.hp).toBe(4950);
    expect(b.e.hp).toBe(4950);
    expect(h.active).toBe(true);
  });
});

describe('red (laser)', () => {
  const beamsFor = (lv: number): World => {
    const w = setup('red', lv, Math.max(0, lv - 5));
    dummy(w, 250, 400);
    dummy(w, 450, 400);
    w.player.x = 350;
    w.player.y = 700;
    w.update(STEP, fireInput());
    return w;
  };

  it('level 3 beams chain to a second enemy, level 2 beams do not', () => {
    expect(beamsFor(2).laser.beams.some((b) => b.chain)).toBe(false);
    expect(beamsFor(3).laser.beams.every((b) => b.chain)).toBe(true);
  });

  it('level 4 beams destroy small enemy bullets they cross', () => {
    const survives = (lv: number): boolean => {
      const w = beamsFor(lv);
      const bm = w.laser.beams[0];
      const shot = w.eShots.acquire()!;
      Object.assign(shot, {
        x: (bm.sx + bm.tx) / 2, y: (bm.sy + bm.ty) / 2, vx: 0, vy: 0, r: 7, life: 5, t: 0, style: 'ePellet', homing: 0, bounce: false,
      });
      w.update(STEP, fireInput());
      return shot.active;
    };
    expect(survives(3)).toBe(true);
    expect(survives(4)).toBe(false);
  });

  it('level 5 beam 0 is a wider, stronger main beam on the sturdiest enemy', () => {
    const w = setup('red', 5);
    const weak = dummy(w, 250, 300, 100);
    const tough = dummy(w, 450, 500, 5000);
    w.player.x = 350;
    w.player.y = 700;
    w.update(STEP, fireInput());
    const [main, other] = w.laser.beams;
    expect(main.main).toBe(true);
    expect(other.main).toBe(false);
    expect(main.w).toBeGreaterThan(other.w);
    expect(main.dps).toBeGreaterThan(other.dps);
    expect(main.target).toBe(tough.e);
    expect(other.target).toBe(weak.e);
  });

  it('level 6+ adds beams, one more every two levels', () => {
    expect(beamsFor(6).laser.beams).toHaveLength(3);
    expect(setup('red', 8, 3).inventory.level('red')).toBe(8);
  });
});

describe('level 6+ rules inside the World', () => {
  it('bonus levels hit harder but never grow in size', () => {
    const w5 = setup('violet', 5);
    const w9 = setup('violet', 9, 4);
    run(w5, fireInput(), 1);
    run(w9, fireInput(), 1);
    const ball = (w: World): Bullet => w.pShots.items.find((b) => b.active && b.style === 'violet')!;
    expect(ball(w9).dmg).toBeGreaterThan(ball(w5).dmg);
    expect(ball(w9).r).toBeCloseTo(ball(w5).r);
  });

  it('stays inside the play area bounds (sanity)', () => {
    const w = setup('green', 5);
    run(w, fireInput(), 30);
    for (const b of w.pShots.items) if (b.active) expect(b.x).toBeGreaterThan(-31);
    expect(PLAY_W).toBeGreaterThan(0);
    expect(PLAY_H).toBeGreaterThan(0);
  });
});
