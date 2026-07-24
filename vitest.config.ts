import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Tests unitaires + intégration (Node). Les tests end-to-end Playwright vivent
// dans e2e/ et sont exécutés séparément (npm run test:e2e).
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    globals: true,
    // Ciblé sur la feature « Feux France » (le reste du SaaS utilise node:test).
    include: ['lib/firms/**/*.test.ts', 'app/api/**/*.test.ts', 'components/feux/**/*.test.ts'],
    exclude: ['node_modules/**', 'e2e/**', '.next/**'],
  },
})
