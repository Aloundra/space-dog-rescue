// Top-10 high scores persisted in localStorage. Pure functions + a thin storage adapter.
export interface HighScore {
  name: string;
  score: number;
  /** Level reached (1-based); 5 means the game was completed. */
  level: number;
  date: string;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const HIGHSCORE_KEY = 'iron-chouquette.highscores.v1';
export const HIGHSCORE_COUNT = 10;
export const NAME_MAX = 10;

export function sortScores(list: readonly HighScore[]): HighScore[] {
  return [...list].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date)).slice(0, HIGHSCORE_COUNT);
}

export function qualifies(list: readonly HighScore[], score: number): boolean {
  if (score <= 0) return false;
  if (list.length < HIGHSCORE_COUNT) return true;
  return score > sortScores(list)[HIGHSCORE_COUNT - 1].score;
}

export function sanitizeName(raw: string): string {
  const cleaned = raw.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, NAME_MAX);
  return cleaned.length > 0 ? cleaned : 'ANONYME';
}

export function insertScore(list: readonly HighScore[], entry: HighScore): HighScore[] {
  return sortScores([...list, { ...entry, name: sanitizeName(entry.name) }]);
}

function isHighScore(v: unknown): v is HighScore {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.name === 'string' && typeof o.score === 'number' && Number.isFinite(o.score)
    && typeof o.level === 'number' && typeof o.date === 'string';
}

export function loadScores(storage: KeyValueStorage | null): HighScore[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(HIGHSCORE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? sortScores(parsed.filter(isHighScore)) : [];
  } catch {
    return [];
  }
}

export function saveScores(storage: KeyValueStorage | null, list: readonly HighScore[]): void {
  if (!storage) return;
  try {
    storage.setItem(HIGHSCORE_KEY, JSON.stringify(sortScores(list)));
  } catch {
    // Storage full or disabled: scores stay in memory for this session.
  }
}

export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
