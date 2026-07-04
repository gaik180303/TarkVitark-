import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    // Tests share one in-memory DB, so run files sequentially to avoid races.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000, // first run downloads the mongodb-memory-server binary
  },
});
