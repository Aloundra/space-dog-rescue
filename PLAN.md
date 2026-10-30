# PLAN — Space Dog Rescue (formerly Iron Chouquette)

## Milestones
1. Scaffold Vite/TS, fixed-step loop, input, scaling — commit `m1`
2. Player ship, base shot, scrolling nebula background
3. Basic enemies, collisions, score, 3-HP health bar
4. Weapon system (FIFO inventory, levels, 6 types) + sacrifice salvo
5. Full enemy catalogue (16 kinds) + gamepad-shaped weapon carriers
6. Levels (data-driven waves), bosses
7. Menus, pause, game over, localStorage high scores, victory screen
8. Polish: particles, effects, balancing, performance

## Decisions (not specified by the brief)
- **Logical resolution** 800×1000: icy cyan frame (20 px), play area 760×860 at (20,20), HUD bar 80 px at the bottom.
  Canvas is CSS-scaled with `image-rendering: pixelated`, keeping the ratio (downscaling allowed).
- **Pixel size**: 1 art pixel = 4×4 logical px. Sprites are string matrices (mostly mirrored halves) or
  procedurally generated (bosses via a seeded symmetric generator, discs/rings via math), cached on offscreen canvases.
- **Health**: 3 HP, no lives, no continue. Hit = −1 HP + 1.5 s invulnerability. 0 HP = game over.
  Weapons are kept for the whole run.
- **Healing**: each boss drops one repair heart (+1 HP, capped at 3). Needed so that 4 levels on 3 HP stay fair.
- **Weapon slots**: 5 at start; each boss drops a `+1 slot` capsule (max 8 slots).
- **Sacrifice**: Ctrl/Shift = one press, one sacrifice, the *most recent* weapon. With no weapon: nothing happens.
  Automatic sacrifice (inventory overflow) removes the *oldest* weapon and **also triggers its salvo**
  (a sacrifice is always a salvo in this game).
- **Salvo**: clears every enemy bullet, damages every on-screen enemy (bosses take 1/3), short invulnerability.
  Damage depends on the sacrificed weapon type and its level before removal.
- **Weapon levels**: level = number of copies of a type, no cap (up to the 8 slots). Past level 4, fire-rate gains are clamped (green interval >= 0.07 s, blue >= 0.35 s); damage/size keep growing. Each level = +25% damage and +25%
  projectile size (linear: level n = x(1 + 0.25(n-1)); green: x(1 + 0.25n) over the bare gun). Losing a level removes 25%.
- **Violet**: balls fired from the nose, random direction inside a 90 deg cone ahead; they live until they leave the screen. **Yellow**: one shot per side per level (narrow fan);
  no arrow = horizontal, Up held = shots tilted down 60 deg from horizontal, Down held = shots tilted up 60 deg. **Blue**: missiles lock the nearest enemy at launch,
  retarget the nearest one when it dies. **Red**: one beam per level; each locks the nearest enemy not locked by another beam (shares one if none are left) until it dies or
  fire is released; with nothing to lock, it goes straight up.
- **Entity scale** (`GAME_SCALE` = 1.5): ship, enemies, bosses, bullets, pickups, particles, score popups and hitboxes
  are 1.5x (sprites at 6 px per art pixel). HUD, menus and overlays are unchanged.
- **Carrier ("gamepad")**: points not given by the brief → 200 points. Neutral steel-grey for every weapon: the dropped weapon cannot be guessed.
- **Bosses**: one per level (4). Points: 10,000 / 15,000 / 25,000 / 50,000. The last one holds the dog.
- **Level end bonus**: 5,000 × level + 2,500 × remaining HP.
- **Score**: 7 digits with leading zeros (caps at 9,999,999).
- Ground units (turrets, tanks) sit on small floating platforms that scroll with the background;
  they cannot collide with the player.
- **Boss HP** (after balancing with headless simulation): 320 / 520 / 750 / 950. Boss minions are cheap
  enemies (secondary / green) so they cannot be farmed for points.
- A full run with decent weapons scores ~350,000 points, in line with the 350k world-record video.
- Marble bombs that self-destruct (fuse timer) give no points; only shot-down enemies score.
- Dev port is **5280** (5173 was already used by another local project).

## Status
All 8 milestones implemented. Commits were made per area at the end rather than strictly one per milestone.

## Open questions
None blocking.
