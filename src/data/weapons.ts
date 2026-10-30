// Weapon catalogue. Single source of truth for colours, names and salvo power.
export type WeaponType = 'violet' | 'pink' | 'green' | 'yellow' | 'blue' | 'red';

export const WEAPON_TYPES: readonly WeaponType[] = ['violet', 'pink', 'green', 'yellow', 'blue', 'red'];

export interface WeaponInfo {
  name: string;
  description: string;
  color: string;
  light: string;
  dark: string;
  /** Damage dealt to every on-screen enemy when this weapon is sacrificed (level 1). */
  salvoDamage: number;
}

export const WEAPONS: Record<WeaponType, WeaponInfo> = {
  violet: {
    name: 'Violet',
    description: 'Small violet balls sprayed ahead of the ship',
    color: '#b066ff', light: '#e2c2ff', dark: '#5d2a9e', salvoDamage: 30,
  },
  pink: {
    name: 'Pink',
    description: 'Speeds up the ship',
    color: '#ff6fb5', light: '#ffc6e2', dark: '#a12c6a', salvoDamage: 22,
  },
  green: {
    name: 'Green',
    description: 'Upgrades the base gun',
    color: '#5be36a', light: '#c4ffc9', dark: '#23813a', salvoDamage: 28,
  },
  yellow: {
    name: 'Yellow',
    description: 'Fires to both sides at once',
    color: '#ffd93b', light: '#fff4b8', dark: '#a67c0b', salvoDamage: 28,
  },
  blue: {
    name: 'Blue',
    description: 'Launches homing missiles',
    color: '#3f8cff', light: '#bcd8ff', dark: '#1c3f99', salvoDamage: 34,
  },
  red: {
    name: 'Red',
    description: 'Electric laser beam',
    color: '#ff3b4e', light: '#ffc0c6', dark: '#9e1426', salvoDamage: 40,
  },
};

export const BASE_SLOTS = 5;
export const MAX_SLOTS = 8;
/** No evolution cap: the level can reach the slot count (8). */
export const MAX_WEAPON_LEVEL = MAX_SLOTS;
