import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const basePath = env.VITE_BASE_PATH ?? '/'

  return {
    base: basePath.endsWith('/') ? basePath : `${basePath}/`,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        // Mas especificos primero: dan a `infrastructure/**` una puerta estrecha
        // (`application/ports`, `domain/model`, `domain/shared`) en vez del
        // barrel entero, para que `dependency-cruiser` pueda hacer cumplir la
        // regla 3 de docs/arquitectura.md.
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
    build: {
      outDir: 'dist',
      sourcemap: true,
      target: 'es2022',
    },
  }
})
