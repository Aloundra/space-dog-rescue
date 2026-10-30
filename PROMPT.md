# Prompt — Project "Iron Chouquette"

## Role
You are a senior TypeScript developer specialized in 2D web games. You work autonomously, in steps, verifying each step before moving on to the next.

## Goal
Recreate **Iron Chouquette**, a shoot'em up from the former Flash site kadokado.com: the player pilots a ship that tries to rescue its dog, kidnapped by enemy ships. A faithful tribute in spirit, not a copy of the original files (no original assets; everything is recreated).

## Stack and constraints
- TypeScript (strict) + Canvas 2D + Vite. No game library (no Phaser, etc.). Dev dependencies only: vite, typescript, vitest.
- Graphics: **procedurally generated pixel art** (sprites defined in code as matrices/palettes, rendered to offscreen canvases, cached, `imageSmoothingEnabled = false`). No external image files.
- **No sound** (the original game had none).
- Fixed logical resolution 800×1000 (play area + frame + bottom bar), scaled to the window while keeping the ratio, centered (scale < 1 allowed if the window is smaller). Pixel art sprites are drawn on a grid of "big" pixels (e.g. 1 art pixel = 4×4 logical px) to keep the pixelated look at this resolution.
- Fixed-timestep game loop (60 Hz), decoupled from rendering (requestAnimationFrame).
- Persistence: best scores (top 10) in `localStorage`.
- Readable code, comments in English, modular architecture (see below). Game texts in French.

## Controls
- Arrows: movement
- Space: fire
- Ctrl or Shift: sacrifice the most recent weapon to launch a **devastating energy salvo** (clears enemy projectiles, deals heavy damage across the screen; the power depends on the sacrificed weapon). One press triggers a single sacrifice; holding the key does not consume the whole inventory.
- Enter: confirm in menus; Esc/P: pause

## Mechanics
### Weapons
- Weapons are obtained by destroying a carrier ship shaped like a **PlayStation controller**; the carrier's color indicates the weapon.
- Inventory: **3 weapons maximum** (extensible through certain bonuses/options). If the limit is exceeded, **the oldest weapon is automatically sacrificed** (FIFO queue).
- Owning several copies of the same type makes the weapon more powerful (level = number of copies, reasonably capped).
- Types:
  - **Violet**: small violet balls in all directions; more levels = more balls, wider area.
  - **Pink**: increases ship speed (cumulative, capped).
  - **Green**: improves the base weapon (fire rate, damage, width).
  - **Yellow**: fires on both sides at once (lateral/rear depending on level).
  - **Blue**: fires missiles (lightly homing at higher levels).
  - **Red**: electric beam laser (zigzag/lightning rendering).
- Each weapon has a visual icon representation in the HUD (color + level).

### Enemies and points (exact values)
| Enemy | Points |
|---|---|
| Basic enemy | 65 |
| Secondary enemy | 80 |
| Green enemy | 120 |
| Ball bomb | 300 |
| Robot rabbit | 350 |
| Basic turret | 450 |
| Magnet | 500 |
| V-formation balls | 600 |
| Missile launcher | 800 |
| Armored rectangle | 1000 |
| Improved turret | 1500 |
| Basic tank | 2000 |
| Green tank | 3500 |
| Missile rectangle | 4800 |
| Circular saw | 5000 |
| Red tank | 8000 |

Each enemy has a distinct behavior (trajectory, shooting, HP) designed to be coherent with its name: e.g. Magnet = attracts the ship/pickups; Ball bomb = explodes into projectiles; Robot rabbit = hopping movement; V-balls = flying in a V formation; Turrets/tanks = on the ground (scrolling), aimed shots; Circular saw = rotating projectile/blade; etc. The points table is centralized data (a single config file).

### Progression
- Vertical scrolling, several levels (min. 4) with different backgrounds (procedural parallax), scripted waves defined via data (not hard-coded in the logic), increasing difficulty.
- A boss at the end of each level (the last abductor holds the dog; an end screen with the reunion).
- **Health bar with 3 HP, no lives system**: each hit removes 1 HP (the bar is split into 3 segments), brief invincibility after damage, game over at 0 HP. Owned weapons are kept until the end of the run. No mandatory healing pickup (to be decided and documented in PLAN.md if balancing requires it).
- Score displayed continuously, end-of-level bonus.

### Screens
Title menu (play, how to play, best scores), game with HUD (score, 3-HP health bar, weapons + levels, current level), pause, game over with name entry if in the top 10, victory.

## Visual/gameplay references
Study these videos for pacing, enemy patterns, and the look of weapons and backgrounds (ignore the sound):
- https://www.youtube.com/watch?v=Sl3ayGmvMKM
- https://www.youtube.com/watch?v=-efcI7Qn20o
- https://www.youtube.com/watch?v=jpe5Y01jzkE
The original game can be replayed via the Eternaltwin community project: https://kadokadeo.eternaltwin.org/games/3 (useful as a reference for feel if accessible; copy nothing from its files).
If you cannot consult these references, say so explicitly and base yourself on the description below without inventing details presented as faithful.

## Observations from the videos (to respect in spirit)
These notes come from images extracted from the 3 videos (record runs, ~7 min each, scores up to ~350,000; one video is a "WR 350k" run).
- **Format**: **portrait** play area, roughly 4:5, surrounded by a light blue-cyan "icy" frame. Plan for this interface feel (frame + bottom bar), not a full black screen.
- **Background**: dark **violet/indigo** nebula with a field of white stars, slow continuous vertical scrolling. The background stays the same over the whole viewed duration: "level" variations are to be created through tints/density (the original seems mainly a continuous difficulty progression with few visual breaks). Keep level-title screens discreet rather than a big cutscene.
- **HUD (bottom bar, light/cyan)**: on the left a small icon/counter, then a horizontal **pink/red health bar** (in our version: 3 HP segments, one segment lost per hit), and on the right the **7-digit score** (e.g. `0129595`) in large digits with a light blue outline. **Column of small square cells at the bottom left of the play area** = **weapon slots** (each cell colored by the weapon owned: yellow, green, violet…). Points gained briefly appear as **small floating white numbers** at the kill location (e.g. "350", "3500").
- **Player ship**: small, light (white/pale blue), with orange thrusters at the bottom; a **yellow glow/aura** appears in front of it when the base/yellow weapon is active.
- **Player shots**: many small **yellow-green elongated projectiles (drop/flame-shaped)** in a tight fan; density increases with weapons. A **blue missile** leaves a small swirling light-blue trail; translucent concentric rings/halos accompany some shots/explosions (a "wave" effect).
- **Enemies seen**: small white/cream devices with golden bulbs (basic enemy); **orange discs with concentric spirals ("snail"/orange waves)** arriving in numbers and formations, descending in swarms; **grey-white rectangles resembling a cartridge/box with a small green screen** (armored rectangles / "missile rectangle"), often in columns of 2-3 descending; **large grey cylindrical capsules/turrets**; small **white robot rabbits with large ears** (the "350" figure seen on screen, consistent with the table); large **pink/salmon units with claws/wings** (tanks/circular saw) with a red trail or blades; **white circles/rings** (circular-blade type).
- **Enemy shots**: small **red/pink dots**, pale **yellow squares** and **green balls**, in large slow sheets (the game becomes a light "bullet hell" late in a run); a few dark violet orbs with dark outlines. Enemy shot colors must stay clearly readable on the violet background and distinct from the player's.
- **Explosions**: stylized orange/yellow fireballs, with a persistent **dark red** smoke/trail for large destroyed enemies.
- **Pacing**: the player is constantly under a rain of waves; the screen is dense but readable; enemies come from the top and from the sides. Large enemies (tanks/rectangles) are handled by concentrated fire.
- **End of run**: the site's score screen (out of scope — to be replaced by our own game over / high scores screen).

### Adaptation notes
- The original designs (notably the grey "cartridge" shape with a green screen) must be **redrawn in an original way** (e.g. an armored grey box with a green porthole), without reproducing any branded object.
- **Imposed decision: a 3-HP health bar only, no lives system.** When the bar reaches zero, it is game over. No lives counter or continue.
- Score in 7 digits, with leading zeros.

## Suggested architecture
`src/`: `main.ts`, `core/` (loop, input, scaling, state machine), `game/` (player, weapons, enemies, bullets, bosses, levels, collisions, score), `data/` (enemies.ts, weapons.ts, levels.ts), `render/` (procedural sprites, palettes, parallax, HUD), `ui/` (menus, high scores), `tests/`.
Use an object pool for projectiles/particles, and simple AABB/circle collisions.

## Working method (mandatory)
1. **Plan**: start by writing a `PLAN.md` (milestones, open decisions, assumptions). Ask at most a few blocking questions; otherwise decide and document.
2. **Incremental milestones**, each playable and verified before the next:
   1. Vite/TS scaffold, loop, input, scaling
   2. Ship + base shot + scrolling
   3. Basic enemies + collisions + score + health bar (3 HP)
   4. Weapon system (FIFO inventory, levels, 6 types) + sacrifice salvo
   5. Full enemy catalogue (16 types) + "gamepad" carriers
   6. Levels, data-driven waves, bosses
   7. Menus, pause, game over, localStorage high scores, victory screen
   8. Polish: particles, effects, balancing, performance
3. **Verification**: unit tests (Vitest) for pure logic (FIFO weapon inventory, sacrifice of the most recent weapon, weapon levels, HP/game over, score table, high scores); `tsc --noEmit` and Vite build without errors; actually running the game in a browser with screenshots at each milestone for visual checks.
4. Never declare a step done without having executed it; honestly report what does not work.
5. Git commits per milestone, with clear messages.

## Acceptance criteria
- Controls, the 3-weapon limit with FIFO sacrifice, the Ctrl/Shift salvo, and the 6 weapons (with power growth through duplicates) work as described.
- The 16 enemies exist with the exact points from the table.
- Health bar at 3 HP, game over at 0 HP, no lives system.
- Ctrl/Shift: one press = one sacrifice (the most recent weapon); a salvo with no weapon does nothing.
- Column of colored weapon slots, floating point numbers, wave/halo effect on some shots, enemy shots readable at high density at 60 FPS.
- At least 4 levels with bosses; ending with the dog rescued.
- Stable 60 FPS on a standard PC, zero external image/audio assets.
- `npm run dev`, `npm run build`, `npm test` work; a README explains how to run and play.

## Final deliverable
Short report: what is done, what is verified (and how), known limitations, design choices not specified (enemy behaviors, balancing).
