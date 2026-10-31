import { defineConfig } from 'vitest/config';
import { devRooms } from './tools/dev-rooms.mjs';
import { serviceWorker } from './tools/service-worker.mjs';
import { timingDuration } from './tools/timing-duration.mjs';

export default defineConfig({
  base: './',
  plugins: [devRooms(), timingDuration(), serviceWorker()],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  // Vitest 5 caches module transforms across runs by default, and a cached import.meta.glob misses newly added files.
  test: { include: ['src/**/*.test.ts', 'push/src/**/*.test.ts'], fsModuleCache: false },
});
