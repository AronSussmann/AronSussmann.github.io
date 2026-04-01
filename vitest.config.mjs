import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['ui-tests/unit/**/*.test.mjs'],
    environment: 'node'
  }
});
