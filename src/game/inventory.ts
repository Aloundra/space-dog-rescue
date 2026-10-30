import { BASE_SLOTS, MAX_SLOTS, MAX_WEAPON_LEVEL, type WeaponType } from '../data/weapons';

/** Result of a sacrifice: which weapon was removed and its level just before removal. */
export interface Sacrifice {
  type: WeaponType;
  level: number;
}

/**
 * Weapon inventory, ordered by acquisition time (oldest first).
 * - Overflow automatically sacrifices the OLDEST weapon (FIFO).
 * - Manual sacrifice (Ctrl/Shift) removes the MOST RECENT weapon.
 */
export class WeaponInventory {
  private items: WeaponType[] = [];
  private slotCount: number;

  constructor(slots = BASE_SLOTS) {
    this.slotCount = Math.min(slots, MAX_SLOTS);
  }

  get slots(): number {
    return this.slotCount;
  }

  get list(): readonly WeaponType[] {
    return this.items;
  }

  get size(): number {
    return this.items.length;
  }

  /** Level of a weapon type = number of copies held (up to the slot count). 0 = not owned. */
  level(type: WeaponType): number {
    let n = 0;
    for (const t of this.items) if (t === type) n++;
    return Math.min(n, MAX_WEAPON_LEVEL);
  }

  /** Adds a weapon. Returns the auto-sacrificed oldest weapon if the limit was exceeded. */
  add(type: WeaponType): Sacrifice | null {
    this.items.push(type);
    if (this.items.length <= this.slotCount) return null;
    const oldest = this.items[0];
    const level = this.level(oldest);
    this.items.shift();
    return { type: oldest, level };
  }

  /** Manual sacrifice of the most recent weapon. Returns null when the inventory is empty. */
  sacrificeLatest(): Sacrifice | null {
    if (this.items.length === 0) return null;
    const latest = this.items[this.items.length - 1];
    const level = this.level(latest);
    this.items.pop();
    return { type: latest, level };
  }

  /** Adds one slot (up to MAX_SLOTS). Returns false when already at the cap. */
  addSlot(): boolean {
    if (this.slotCount >= MAX_SLOTS) return false;
    this.slotCount++;
    return true;
  }
}
