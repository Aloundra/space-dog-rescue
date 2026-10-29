// Global layout constants (logical pixels).
export const VIEW_W = 800;
export const VIEW_H = 1000;

/** Size of one pixel-art pixel in logical pixels. */
export const PX = 4;

/** Size multiplier for in-game entities (ship, enemies, bullets, pickups, effects, score popups). HUD/menus excluded. */
export const GAME_SCALE = 1.5;
/** Pixel-art pixel size for in-game entity sprites. */
export const ENTITY_PX = PX * GAME_SCALE; // 6

export const FRAME = 20;
export const PLAY_X = FRAME;
export const PLAY_Y = FRAME;
export const PLAY_W = VIEW_W - FRAME * 2; // 760
export const PLAY_H = 860;
export const HUD_Y = PLAY_Y + PLAY_H + 12; // 892
export const HUD_H = VIEW_H - HUD_Y - 12; // 96

export const STEP = 1 / 60;

/** Background / ground scroll speed in px/s. */
export const SCROLL_SPEED = 55;

export const PLAYER_MAX_HP = 3;
export const PLAYER_INVULN = 1.5;
export const PLAYER_BASE_SPEED = 290;
export const PLAYER_HITBOX = 7 * GAME_SCALE;

export const SCORE_MAX = 9_999_999;
export const SCORE_DIGITS = 7;
