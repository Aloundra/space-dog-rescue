// Keyboard state. "pressed" edges are consumed per simulation step.
const BLOCKED = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'Enter', 'Escape', 'Backspace',
]);

export interface InputState {
  isDown(code: string): boolean;
  wasPressed(...codes: string[]): boolean;
  typed(): readonly string[];
}

export class Input implements InputState {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private typedChars: string[] = [];

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (BLOCKED.has(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) this.typedChars.push(e.key);
    });
    target.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    target.addEventListener('blur', () => {
      this.down.clear();
    });
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(...codes: string[]): boolean {
    return codes.some((c) => this.pressed.has(c));
  }

  typed(): readonly string[] {
    return this.typedChars;
  }

  /** Call after each simulation step. */
  endStep(): void {
    this.pressed.clear();
    this.typedChars = [];
  }
}

export const KEYS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  fire: 'Space',
  sacrifice: ['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight'],
  confirm: ['Enter', 'NumpadEnter'],
  pause: ['Escape', 'KeyP'],
} as const;
