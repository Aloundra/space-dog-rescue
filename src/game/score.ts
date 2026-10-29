import { SCORE_DIGITS, SCORE_MAX } from '../config';
import { CARRIER_POINTS, ENEMY_POINTS, type EnemyKind } from '../data/enemies';

export function pointsFor(kind: EnemyKind | 'carrier'): number {
  return kind === 'carrier' ? CARRIER_POINTS : ENEMY_POINTS[kind];
}

export function addScore(score: number, points: number): number {
  return Math.min(SCORE_MAX, score + Math.max(0, Math.floor(points)));
}

export function formatScore(score: number): string {
  return String(Math.min(SCORE_MAX, Math.max(0, Math.floor(score)))).padStart(SCORE_DIGITS, '0');
}

export function levelBonus(levelNumber: number, hp: number): number {
  return 5000 * levelNumber + 2500 * hp;
}
