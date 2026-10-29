import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  // Listen on all interfaces so the game is reachable on the LAN (e.g. http://192.168.0.20:5280).
  server: { host: '0.0.0.0', port: 5280, strictPort: true },
  preview: { host: '0.0.0.0', port: 5280, strictPort: true },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
