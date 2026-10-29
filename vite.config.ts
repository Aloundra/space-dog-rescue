import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { host: true, port: 5280 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
