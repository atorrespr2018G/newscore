import { defineConfig } from 'vitest/config'
import path from 'node:path'

/** Vitest configuration for pure frontend helper unit tests. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
