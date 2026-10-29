import { VIEW_H, VIEW_W } from '../config';

/** Fit the fixed-resolution canvas in the window, keeping aspect ratio. */
export function fitCanvas(canvas: HTMLCanvasElement): void {
  const apply = (): void => {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
    canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
  };
  window.addEventListener('resize', apply);
  apply();
}
