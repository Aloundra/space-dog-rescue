import { describe, expect, it } from 'vitest';
import { CARRIER_POINTS, ENEMY_KINDS, ENEMY_POINTS } from '../src/data/enemies';
import { addScore, formatScore, levelBonus, pointsFor } from '../src/game/score';

describe('score table', () => {
  it('matches the original values exactly', () => {
    expect(ENEMY_POINTS).toEqual({
      basic: 65,
      secondary: 80,
      green: 120,
      marbleBomb: 300,
      robotRabbit: 350,
      turret: 450,
      magnet: 500,
      vBall: 600,
      missileLauncher: 800,
      armoredRect: 1000,
      turretPlus: 1500,
      tank: 2000,
      tankGreen: 3500,
      missileRect: 4800,
      grinder: 5000,
      tankRed: 8000,
    });
    expect(ENEMY_KINDS).toHaveLength(16);
  });

  it('pointsFor reads the central table', () => {
    for (const k of ENEMY_KINDS) expect(pointsFor(k)).toBe(ENEMY_POINTS[k]);
    expect(pointsFor('carrier')).toBe(CARRIER_POINTS);
  });

  it('formats on 7 digits with leading zeros and caps', () => {
    expect(formatScore(0)).toBe('0000000');
    expect(formatScore(129595)).toBe('0129595');
    expect(formatScore(99_999_999)).toBe('9999999');
    expect(addScore(9_999_990, 65)).toBe(9_999_999);
    expect(addScore(100, -50)).toBe(100);
  });

  it('level bonus', () => {
    expect(levelBonus(1, 3)).toBe(12_500);
    expect(levelBonus(4, 1)).toBe(22_500);
  });
});
