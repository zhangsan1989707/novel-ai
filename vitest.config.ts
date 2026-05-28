import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 15000,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '*.config.*',
        'src/types/',
        'prisma/',
        '.next/',
        'src/__tests__/**',
        'src/app/layout.tsx',
        'src/lib/version.json',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
