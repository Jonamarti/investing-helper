import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/** Ruta de fichero real: usada en `files:` (eslint SI resuelve globs de fichero). */
const CORE = 'packages/core/src'
const WEB = 'apps/web/src'

/**
 * `no-restricted-imports` compara contra el especificador tal cual se
 * escribe (`@investing-helper/core/...`), no contra la ruta de fichero
 * resuelta: una lista con rutas de `packages/core/src/...` (como
 * `.dependency-cruiser.mjs`) nunca haria matching con nada, y el aviso en el
 * editor se quedaria mudo sin que nadie lo notara. Estas listas usan los
 * mismos alias que `apps/web/vite.config.ts`/`vitest.config.ts`.
 *
 * El barrel entero (`@investing-helper/core` a secas) tira de todo el motor
 * por dentro, asi que tambien esta prohibido donde haga falta una puerta
 * estrecha: forzar el alias especifico (`.../domain/shared`,
 * `.../application/ports`, ...) es lo que hace el resto de la lista inutil.
 */
const CORE_PKG = '@investing-helper/core'

/** Especificadores que ui/** tiene prohibido importar. Refuerza la regla 4 de docs/arquitectura.md. */
const FORBIDDEN_IN_UI = [
  CORE_PKG,
  `${CORE_PKG}/domain/engine`,
  `${CORE_PKG}/domain/strategies`,
  `${CORE_PKG}/domain/analytics`,
  `${CORE_PKG}/domain/montecarlo`,
  `${CORE_PKG}/domain/amortization`,
  `${CORE_PKG}/domain/taxes`,
  `${CORE_PKG}/domain/params`,
]

/** Especificadores que infrastructure/** tiene prohibido importar. Refuerza la regla 3. */
const FORBIDDEN_IN_INFRA = [
  CORE_PKG,
  `${CORE_PKG}/application`,
  `${CORE_PKG}/application/usecases`,
  `${CORE_PKG}/domain/engine`,
  `${CORE_PKG}/domain/strategies`,
  `${CORE_PKG}/domain/analytics`,
  `${CORE_PKG}/domain/montecarlo`,
  `${CORE_PKG}/domain/amortization`,
  `${CORE_PKG}/domain/taxes`,
  `${CORE_PKG}/domain/params`,
]

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/.tsbuild/**',
    '**/playwright-report/**',
    '**/test-results/**',
  ]),

  js.configs.recommended,
  tseslint.configs.recommended,
  ...tseslint.configs.stylistic,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-implicit-coercion': 'error',
      'prefer-const': 'error',
      'object-shorthand': ['error', 'properties'],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSAnyKeyword',
          message: 'Usa `unknown` en lugar de `any` explicito.',
        },
      ],
    },
  },

  // ── TypeScript con informacion de tipos ────────────────────────────────────
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/only-throw-error': 'error',
    },
  },

  // ── core: motor puro, sin DOM ─────────────────────────────────────────────
  {
    files: [`${CORE}/**/*.ts`],
    languageOptions: {
      globals: {},
    },
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'domain/application no pueden tocar el DOM.' },
        { name: 'document', message: 'domain/application no pueden tocar el DOM.' },
        { name: 'localStorage', message: 'Persistencia es responsabilidad de infrastructure.' },
        { name: 'fetch', message: 'I/O es responsabilidad de infrastructure.' },
      ],
    },
  },

  // ── web ───────────────────────────────────────────────────────────────────
  {
    files: [`${WEB}/**/*.{ts,tsx}`],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: [`${WEB}/infrastructure/**/*.{ts,tsx}`],
    rules: {
      // `paths` compara el especificador por igualdad exacta, a diferencia de
      // `patterns`/`group` (glob): un `group: ['@investing-helper/core']`
      // tambien hace matching de `@investing-helper/core/domain/model`, que es
      // justo lo que aqui SI esta permitido. Con `paths` cada entrada solo
      // bloquea su propio especificador exacto.
      'no-restricted-imports': [
        'error',
        {
          paths: FORBIDDEN_IN_INFRA.map((name) => ({
            name,
            message: `Prohibido importar ${name} desde infrastructure (ver docs/arquitectura.md regla 3).`,
          })),
        },
      ],
    },
  },
  {
    files: [`${WEB}/ui/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: FORBIDDEN_IN_UI.map((name) => ({
            name,
            message: `Prohibido importar ${name} desde ui (ver docs/arquitectura.md regla 4): la UI consume DTOs.`,
          })),
        },
      ],
    },
  },
  reactHooks.configs.flat['recommended-latest'],
  reactRefresh.configs.vite,

  // Las 5 reglas de docs/arquitectura.md las verifica .dependency-cruiser.mjs
  // (fuente unica, resuelve el grafo real de imports). Los bloques
  // `no-restricted-imports` de arriba dan el mismo aviso en el editor al
  // teclear, sin esperar a `npm run lint:deps`; solo cubren los
  // especificadores de `@investing-helper/core` (ver el comentario de
  // `CORE_PKG`), no imports relativos dentro del propio monorepo.

  // ── Tests ─────────────────────────────────────────────────────────────────
  {
    files: ['**/test/**/*.{ts,tsx}', '**/e2e/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-syntax': 'off',
    },
  },

  // ── Ficheros de configuracion ─────────────────────────────────────────────
  {
    files: ['**/*.config.{ts,js,mjs}', '.dependency-cruiser.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-imports': 'off' },
  },
])
