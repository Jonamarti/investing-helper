import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Mismo orden que vite.config.ts: los alias especificos van antes que el
      // barrel general. Ver el comentario alli.
      '@investing-helper/core/application/ports': fileURLToPath(
        new URL('../../packages/core/src/application/ports/index.ts', import.meta.url),
      ),
      '@investing-helper/core/application': fileURLToPath(
        new URL('../../packages/core/src/application/index.ts', import.meta.url),
      ),
      '@investing-helper/core/domain/model': fileURLToPath(
        new URL('../../packages/core/src/domain/model/index.ts', import.meta.url),
      ),
      '@investing-helper/core/domain/params': fileURLToPath(
        new URL('../../packages/core/src/domain/params/index.ts', import.meta.url),
      ),
      '@investing-helper/core/domain/shared': fileURLToPath(
        new URL('../../packages/core/src/domain/shared/index.ts', import.meta.url),
      ),
      '@investing-helper/core': fileURLToPath(
        new URL('../../packages/core/src/index.ts', import.meta.url),
      ),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
})
