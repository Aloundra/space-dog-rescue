import { describe, expect, it } from 'vitest';
import { WeaponInventory } from '../src/game/inventory';
import { BASE_SLOTS, MAX_SLOTS, MAX_WEAPON_LEVEL } from '../src/data/weapons';

describe('WeaponInventory', () => {
  it('starts empty with 5 slots, extensible to 8', () => {
    const inv = new WeaponInventory();
    expect(inv.slots).toBe(BASE_SLOTS);
    expect(inv.slots).toBe(5);
    expect(MAX_SLOTS).toBe(8);
    expect(inv.size).toBe(0);
  });

  it('keeps up to the slot count without sacrifice', () => {
    const inv = new WeaponInventory(3);
    expect(inv.add('violet')).toBeNull();
    expect(inv.add('blue')).toBeNull();
    expect(inv.add('red')).toBeNull();
    expect(inv.list).toEqual(['violet', 'blue', 'red']);
  });

  it('auto-sacrifices the OLDEST weapon when the limit is exceeded (FIFO)', () => {
    const inv = new WeaponInventory(3);
    inv.add('violet');
    inv.add('blue');
    inv.add('red');
    const s = inv.add('green');
    expect(s).toEqual({ type: 'violet', level: 1 });
    expect(inv.list).toEqual(['blue', 'red', 'green']);
    expect(inv.add('yellow')).toEqual({ type: 'blue', level: 1 });
    expect(inv.list).toEqual(['red', 'green', 'yellow']);
  });

  it('reports the level of the sacrificed weapon before removal', () => {
    const inv = new WeaponInventory(3);
    inv.add('violet');
    inv.add('violet');
    inv.add('red');
    expect(inv.add('blue')).toEqual({ type: 'violet', level: 2 });
    expect(inv.level('violet')).toBe(1);
  });

  it('manual sacrifice removes the MOST RECENT weapon, one per call', () => {
    const inv = new WeaponInventory();
    inv.add('violet');
    inv.add('blue');
    inv.add('red');
    expect(inv.sacrificeLatest()).toEqual({ type: 'red', level: 1 });
    expect(inv.list).toEqual(['violet', 'blue']);
    expect(inv.sacrificeLatest()).toEqual({ type: 'blue', level: 1 });
    expect(inv.size).toBe(1);
  });

  it('manual sacrifice with an empty inventory does nothing', () => {
    const inv = new WeaponInventory();
    expect(inv.sacrificeLatest()).toBeNull();
    expect(inv.size).toBe(0);
  });

  it('level = number of copies, no cap below the slot count (5 copies = 5, 8 copies = 8)', () => {
    const inv = new WeaponInventory(MAX_SLOTS);
    expect(inv.level('green')).toBe(0);
    inv.add('green');
    inv.add('green');
    expect(inv.level('green')).toBe(2);
    for (let i = 0; i < 3; i++) inv.add('green');
    expect(inv.level('green')).toBe(5);
    for (let i = 0; i < 3; i++) inv.add('green');
    expect(inv.size).toBe(8);
    expect(inv.level('green')).toBe(8);
    expect(MAX_WEAPON_LEVEL).toBe(8);
  });

  it('extra slots raise the limit up to MAX_SLOTS', () => {
    const inv = new WeaponInventory();
    expect(inv.addSlot()).toBe(true);
    expect(inv.slots).toBe(6);
    for (const t of ['violet', 'pink', 'green', 'yellow', 'blue', 'red'] as const) expect(inv.add(t)).toBeNull();
    expect(inv.add('green')).toEqual({ type: 'violet', level: 1 });
    expect(inv.addSlot()).toBe(true);
    expect(inv.addSlot()).toBe(true);
    expect(inv.addSlot()).toBe(false);
    expect(inv.slots).toBe(MAX_SLOTS);
  });
});
