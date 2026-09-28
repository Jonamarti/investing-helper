/**
 * Reglas de dependencia de la arquitectura hexagonal.
 *
 * Ver docs/arquitectura.md. Estas reglas son la(version legible de) la
 * frontera: si una regla falla, la frontera se ha roto.
 *
 * Capas:
 *   domain/         -> packages/core/src/domain        (motor, cero deps)
 *   application/    -> packages/core/src/application   (casos de uso + puertos)
 *   infrastructure/ -> apps/web/src/infrastructure     (adaptadores)
 *   ui/             -> apps/web/src/ui                 (React)
 */
const CORE = 'packages/core/src'
const WEB_ROOT = 'apps/web'
const WEB = `${WEB_ROOT}/src`

const LAYER = {
  domain: `${CORE}/domain`,
  application: `${CORE}/application`,
  infrastructure: `${WEB}/infrastructure`,
  ui: `${WEB}/ui`,
}

export default {
  forbidden: [
    {
      name: 'domain-stays-internal',
      comment: 'Regla 1: domain/** solo puede importar domain/**',
      severity: 'error',
      from: { path: LAYER.domain },
      to: { pathNot: LAYER.domain },
    },
    {
      name: 'application-depends-on-domain-only',
      comment:
        'Regla 2: application/** puede importar domain/** y otros ficheros de ' +
        'application/** (sus propios ports/dto/usecases), nada mas.',
      severity: 'error',
      from: { path: LAYER.application },
      to: { pathNot: `^(${LAYER.domain}|${LAYER.application})` },
    },
    {
      name: 'infrastructure-no-ui-no-domain-engine',
      comment:
        'Regla 3: infrastructure/** solo usa application/ports, domain/model, ' +
        'domain/shared y otros ficheros de infrastructure/**. Nunca la UI ni el ' +
        'motor (engine, strategies, analytics, montecarlo, amortization, taxes, params).',
      severity: 'error',
      from: { path: LAYER.infrastructure },
      to: {
        pathNot: `^(${LAYER.application}/ports|${LAYER.domain}/(shared|model)|${LAYER.infrastructure})`,
      },
    },
    {
      name: 'ui-uses-dtos-not-engine',
      comment:
        'Regla 4: ui/** usa application/**, domain/shared, domain/model y ' +
        'domain/params (el catalogo declarativo de ParamSpec, hecho para que la ' +
        'UI lo recorra: ver docs/plan.md §3.4). Nunca el motor: ' +
        'domain/engine|strategies|analytics|montecarlo|amortization|taxes.',
      severity: 'error',
      from: { path: LAYER.ui },
      to: {
        path: `^${LAYER.domain}/(engine|strategies|analytics|montecarlo|amortization|taxes)`,
      },
    },
    {
      name: 'ui-only-imported-by-wiring',
      comment:
        'Regla 5: nadie importa ui/** salvo el cableado (main.tsx, container.ts, app/**) ' +
        'o los tests, que existen justo para importar lo que prueban.',
      severity: 'error',
      from: {
        pathNot: `^(${LAYER.ui}|${WEB}/app|${WEB}/main\\.tsx$|${WEB}/container\\.ts$|${WEB_ROOT}/test|${WEB_ROOT}/e2e)`,
      },
      to: { path: LAYER.ui },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Anclados con `(^|/)`, no `^`: `dist/` y `coverage/` cuelgan de
    // `apps/web/` y `packages/core/`, no de la raiz del repo.
    exclude: { path: '(^|/)(node_modules|dist|coverage|\\.tsbuild|test-results)/' },
    tsPreCompilationDeps: true,
    combinedDependencies: false,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
      // Sin esto, enhanced-resolve usa su lista por defecto (sin `.ts`/`.tsx`):
      // no resuelve `./domain` a `./domain/index.ts` ni un `import './foo'`
      // sin extension, y el grafo se queda vacio sin avisar de nada.
      extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/.*' },
    },
  },
}
