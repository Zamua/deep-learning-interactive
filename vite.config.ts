import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  // fsModuleCache keeps transformed modules in one stable cache; without it every run leaves a copy dir in the OS temp
  test: { include: ['src/**/*.test.ts'], fsModuleCache: true },
});
