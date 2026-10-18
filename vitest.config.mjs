import { configDefaults, defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    // The gateway is a separate npm package with its own dependencies and
    // lockfile; CI installs and tests it in its own step.
    exclude: [...configDefaults.exclude, 'services/pi-gateway/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
