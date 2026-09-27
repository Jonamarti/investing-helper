import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const CORE = 'packages/core/src'
const WEB = 'apps/web/src'

/** Paths que ui/** tiene prohibido tocar. Reforza la regla 4 de docs/arquitectura.md. */
const FORBIDDEN_IN_UI = [
  `${CORE}/domain/engine`,
  `${CORE}/domain/strategies`,
  `${CORE}/domain/analytics`,
  `${CORE}/domain/montecarlo`,
  `${CORE}/domain/amortization`,
  `${CORE}/domain/taxes`,
  `${CORE}/domain/params`,
  `${CORE}/domain/model`,
]

/** Paths que infrastructure/** tiene prohibido tocar. Reforza la regla 3. */
const FORBIDDEN_IN_INFRA = [
  `${WEB}/ui`,
  `${CORE}/domain/engine`,
  `${CORE}/domain/strategies`,
  `${CORE}/domain/analytics`,
  `${CORE}/domain/montecarlo`,
  `${CORE}/domain/amortization`,
  `${CORE}/domain/taxes`,
  `${CORE}/domain/params`,
  `${CORE}/domain/model`,
  `${CORE}/application/usecases`,
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
    files: [`${WEB}/src/infrastructure/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: FORBIDDEN_IN_INFRA.map((g) => ({
            group: [g],
            message: `Prohibido importar ${g} desde infrastructure (ver docs/arquitectura.md regla 3).`,
          })),
        },
      ],
    },
  },
  {
    files: [`${WEB}/src/ui/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: FORBIDDEN_IN_UI.map((g) => ({
            group: [g],
            message: `Prohibido importar ${g} desde ui (ver docs/arquitectura.md regla 4): la UI consume DTOs.`,
          })),
        },
      ],
    },
  },
  reactHooks.configs.flat['recommended-latest'],
  reactRefresh.configs.vite,

  // Las 5 reglas de docs/arquitectura.md las verifica .dependency-cruiser.mjs
  // (fuente unica). Los bloques `no-restricted-imports` de arriba dan feedback
  // inmediato en el editor para los imports que mas se repiten; ver
  // `deuda-tecnica.md` (DEUDA-002).

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
