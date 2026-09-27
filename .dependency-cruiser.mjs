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
const WEB = 'apps/web/src'

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
      comment: 'Regla 2: application/** puede importar domain/**, nada mas',
      severity: 'error',
      from: { path: LAYER.application },
      to: { pathNot: LAYER.domain },
    },
    {
      name: 'infrastructure-no-ui-no-domain-engine',
      comment:
        'Regla 3: infrastructure/** solo usa application/ports y domain/shared. ' +
        'No toca la UI ni el motor (engine, strategies, analytics, taxes, ...).',
      severity: 'error',
      from: { path: LAYER.infrastructure },
      to: {
        pathNot: `^(${LAYER.application}/ports|${LAYER.domain}/shared)`,
      },
    },
    {
      name: 'ui-uses-dtos-not-engine',
      comment:
        'Regla 4: ui/** usa application/dto y domain/shared (Money/Rate/Percent). ' +
        'Nunca domain/engine|strategies|analytics|montecarlo|amortization|taxes.',
      severity: 'error',
      from: { path: LAYER.ui },
      to: {
        path: `^${LAYER.domain}/(engine|strategies|analytics|montecarlo|amortization|taxes|params)`,
      },
    },
    {
      name: 'ui-only-imported-by-wiring',
      comment: 'Regla 5: nadie importa ui/** salvo el cableado (main.tsx, container.ts, app/**).',
      severity: 'error',
      from: { pathNot: `^(${LAYER.ui}|${WEB}/app|${WEB}/main\\.tsx$|${WEB}/container\\.ts$)` },
      to: { path: LAYER.ui },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)node_modules/|^dist/|^coverage/|^\\.tsbuild/|^test-results/' },
    tsPreCompilationDeps: true,
    combinedDependencies: false,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/.*' },
    },
  },
}
