import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  // No fsModuleCache: it reuses a module's transform across runs, so an import.meta.glob would miss newly added files.
  test: { include: ['src/**/*.test.ts'] },
});
