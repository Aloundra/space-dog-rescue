# PLAN — Iron Chouquette

## Milestones
1. Scaffold Vite/TS, fixed-step loop, input, scaling — commit `m1`
2. Player ship, base shot, scrolling nebula background
3. Basic enemies, collisions, score, 3-HP health bar
4. Weapon system (FIFO inventory, levels, 6 types) + sacrifice salvo
5. Full enemy catalogue (16 kinds) + gamepad-shaped weapon carriers
6. Levels (data-driven waves), bosses
7. Menus, pause, game over, localStorage high scores, victory screen
8. Polish: particles, effects, balancing, performance

## Decisions (non-specified by the brief)
- **Logical resolution** 800×1000: icy cyan frame (20 px), play area 760×860 at (20,20), HUD bar 80 px at the bottom.
  Canvas is CSS-scaled with `image-rendering: pixelated`, keeping ratio (downscale allowed).
- **Pixel size**: 1 art pixel = 4×4 logical px. Sprites are string matrices (mostly mirrored halves) or
  procedurally generated (bosses via seeded symmetric generator, discs/rings via math), cached on offscreen canvases.
- **Health**: 3 HP, no lives, no continue. Hit = −1 HP + 1.5 s invulnerability. 0 HP = game over.
  Weapons are kept for the whole run.
- **Healing**: each boss drops one repair heart (+1 HP, capped at 3). Needed so that 4 levels on 3 HP stay fair.
- **Extra weapon slot** ("options"): each boss also drops a `+1 slot` capsule (max 5 slots).
- **Sacrifice**: Ctrl/Shift = one press, one sacrifice, the *most recent* weapon. With no weapon: nothing happens.
  Automatic sacrifice (inventory overflow) removes the *oldest* weapon and **also triggers its salvo**
  (a sacrifice is always a salvo in this game).
- **Salvo**: clears every enemy bullet, damages every on-screen enemy (bosses take 1/3), short invulnerability.
  Damage depends on the sacrificed weapon type and its level before removal.
- **Weapon levels**: level = number of copies of a type, capped at 4.
- **Carrier ("manette")**: points not given by the brief → 200 points. Its colour is the weapon it drops.
- **Bosses**: one per level (4). Points: 10 000 / 15 000 / 25 000 / 50 000. The last one holds the dog.
- **Level end bonus**: 5 000 × level + 2 500 × remaining HP.
- **Score**: 7 digits with leading zeros (caps at 9 999 999).
- Ground units (turrets, tanks) sit on small floating platforms that scroll with the background;
  they cannot collide with the player.
- **Boss HP** (after balancing with headless simulation): 320 / 520 / 750 / 950. Boss minions are cheap
  enemies (secondary / green) so they cannot be farmed for points.
- A full run with decent weapons scores ~350 000 points, in line with the 350k world-record video.
- Marble bombs that self-destruct (fuse timer) give no points; only shot-down enemies score.
- Dev port is **5280** (5173 was already used by another local project).

## Status
All 8 milestones implemented. Commits were made per area at the end rather than strictly one per milestone.

## Open questions
None blocking.
