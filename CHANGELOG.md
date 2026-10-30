# Changelog

Updates after the 8 initial milestones (see PLAN.md for the design decisions behind them).

## Weapon rebalance
- Level growth of damage and size lowered from +25% to +15% per level (level 5 = x1.6 instead of x2; green: x(1 + 0.15n) over the bare gun).
- Red: beam width no longer grows with level; damage -20% (18 -> 14.4 dps per beam); level 4 now adds a 3rd beam instead of cutting small enemy bullets (beams: 1, 2, 2, 3, 3; level 6+ still +1 every 2 levels, max 8).
- Violet: every ball moves along a sine wave (random phase; split balls keep 60% of the amplitude). Tuning in `violetBurst().wave`.
- Green: level 4 no longer ricochets; each shot is joined by a smaller particle doing 50% less damage (inherits pierce). `BaseShot.ricochet` replaced by `particle`.

## Weapon progression by tiers
- Weapon levels 1-5 each add a visible change and one ability; damage and size grow +15% per level (see Weapon rebalance), size stops at level 5.
- Level 6+ adds no ability: damage +10% per level and, for some weapons, an extra projectile every few levels (caps: green 8 shots, yellow 8 per side, blue 10 missiles, red 8 beams, violet +2 balls per level).
- Abilities: green (2/3 shots, pierce, side-wall ricochet, heavy exploding shot), violet (rebound, trail, split, 4 orbiting orbs), pink (damaging trail, pickup magnet, graze shield, bullet time; speed capped at x2), yellow (wider fan, pierce, rear shot, boomerang), blue (2 missiles, blast, split, heavy piercing missile), red (2 beams, chain lightning, beams cut small bullets, massive main beam).
- Sacrifice salvo damage: +50% per level up to 5, then +15%.
- All rules live in `src/game/weaponStats.ts` (pure, unit-tested); behaviour in `src/game/world.ts`; looks per tier in `src/render/worldRenderer.ts`.
- Full per-weapon table in README.md; details in PLAN.md ("Weapon levels", "Abilities").

## 10 levels and 20 weapon slots
- 10 levels: 1-3 hand-authored, 4-10 generated deterministically (more waves, bigger groups, heavier enemies later in each level, difficulty 1.5 -> 2.1, one nebula and boss per level). Level 10 is Kidnapper's Lair, where the dog is held.
- Weapon slot and weapon level cap raised to 20; slot HUD wraps into two columns of 10.
- Dev URL parameter `?slots=N` grants extra slots.

## Interface
- Each weapon slot shows a distinct symbol in addition to its colour (colour-blind friendly) and a larger slot with the level digit.
- Quitting a run from the pause menu (Q) now asks for confirmation (Enter = quit, Esc / P = stay).

## Documentation
- README, PLAN and PROMPT translated to English; README level cap corrected.
