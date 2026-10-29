import { STEP } from '../config';

/**
 * Fixed timestep loop: simulation runs at 60 Hz regardless of display refresh,
 * rendering happens once per animation frame.
 */
export function startLoop(update: (dt: number) => void, render: () => void): void {
  let acc = 0;
  let last = performance.now();
  const frame = (now: number): void => {
    let delta = (now - last) / 1000;
    last = now;
    if (delta > 0.25) delta = 0.25; // avoid spiral of death after tab switch
    acc += delta;
    let steps = 0;
    while (acc >= STEP && steps < 8) {
      update(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 8) acc = 0;
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
