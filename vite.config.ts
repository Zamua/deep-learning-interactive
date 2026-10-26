import { defineConfig } from 'vitest/config';
import { devRooms } from './tools/dev-rooms.mjs';

export default defineConfig({
  base: './',
  plugins: [devRooms()],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  // Vitest 5 caches module transforms across runs by default, and a cached import.meta.glob misses newly added files.
  test: { include: ['src/**/*.test.ts', 'push/src/**/*.test.ts'], fsModuleCache: false },
});
