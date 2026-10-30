import { describe, expect, it } from 'vitest';
import {
  HIGHSCORE_KEY, insertScore, loadScores, qualifies, sanitizeName, saveScores, type HighScore, type KeyValueStorage,
} from '../src/ui/highscores';

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}

const hs = (score: number, i = 0): HighScore => ({ name: `P${i}`, score, level: 1, date: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z` });

describe('high scores', () => {
  it('keeps the top 10 sorted descending', () => {
    let list: HighScore[] = [];
    for (let i = 0; i < 12; i++) list = insertScore(list, hs(i * 100, i));
    expect(list).toHaveLength(10);
    expect(list[0].score).toBe(1100);
    expect(list[9].score).toBe(200);
  });

  it('qualifies only above the 10th score', () => {
    const list = Array.from({ length: 10 }, (_, i) => hs((i + 1) * 100, i));
    expect(qualifies(list, 100)).toBe(false);
    expect(qualifies(list, 101)).toBe(true);
    expect(qualifies([], 1)).toBe(true);
    expect(qualifies([], 0)).toBe(false);
  });

  it('sanitizes names', () => {
    expect(sanitizeName('  Zoé<script>  ')).toBe('Zoéscript');
    expect(sanitizeName('')).toBe('ANONYMOUS');
    expect(sanitizeName('ABCDEFGHIJKLMNOP')).toHaveLength(10);
  });

  it('round-trips through storage', () => {
    const st = new MemoryStorage();
    const list = insertScore([], hs(5000, 1));
    saveScores(st, list);
    expect(loadScores(st)).toEqual(list);
  });

  it('survives corrupted or missing storage', () => {
    const st = new MemoryStorage();
    st.setItem(HIGHSCORE_KEY, '{not json');
    expect(loadScores(st)).toEqual([]);
    st.setItem(HIGHSCORE_KEY, JSON.stringify([{ name: 1 }, hs(10, 2)]));
    expect(loadScores(st)).toHaveLength(1);
    expect(loadScores(null)).toEqual([]);
  });
});
