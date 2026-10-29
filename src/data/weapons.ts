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
    name: 'Violette',
    description: 'Petites boules violettes dans tous les sens',
    color: '#b066ff', light: '#e2c2ff', dark: '#5d2a9e', salvoDamage: 30,
  },
  pink: {
    name: 'Rose',
    description: 'Accélère le vaisseau',
    color: '#ff6fb5', light: '#ffc6e2', dark: '#a12c6a', salvoDamage: 22,
  },
  green: {
    name: 'Verte',
    description: "Améliore l'arme de base",
    color: '#5be36a', light: '#c4ffc9', dark: '#23813a', salvoDamage: 28,
  },
  yellow: {
    name: 'Jaune',
    description: 'Tire des deux côtés à la fois',
    color: '#ffd93b', light: '#fff4b8', dark: '#a67c0b', salvoDamage: 28,
  },
  blue: {
    name: 'Bleue',
    description: 'Lance des missiles',
    color: '#3f8cff', light: '#bcd8ff', dark: '#1c3f99', salvoDamage: 34,
  },
  red: {
    name: 'Rouge',
    description: 'Laser en faisceau électrique',
    color: '#ff3b4e', light: '#ffc0c6', dark: '#9e1426', salvoDamage: 40,
  },
};

export const BASE_SLOTS = 5;
export const MAX_SLOTS = 8;
export const MAX_WEAPON_LEVEL = 4;
