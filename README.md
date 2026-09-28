# investing-helper

Calculadora web para comparar, sobre los mismos datos, si conviene amortizar
deuda, invertir en bonos, invertir en renta variable o dejar el dinero en
cuenta corriente, ajustando por inflación, crecimiento del sueldo y dinero
libre mensual.

**URL pública**: <https://jonamarti.github.io/investing-helper/>. La app está
completa: Comparador (recomendación, ranking, gráfico de patrimonio nominal y
poder de compra, cruces entre estrategias), Escenarios
(guardar/cargar/duplicar/exportar), Deudas (alta y edición de préstamos),
Supuestos (inflación, horizonte, Monte Carlo y qué estrategias comparar, con
todos sus parámetros), Aportaciones (nómina y plan de aportaciones) y Monte
Carlo (ejecutarlo sobre la estrategia de renta variable elegida y ver
percentiles y probabilidades). El detalle de qué queda por pulir está en
[Estado actual](#estado-actual).

## Estado actual

El motor de simulación (`packages/core`) está completo y probado: modelo de
dominio, amortización, simulador, las cinco estrategias, motor fiscal,
analítica (TIR, ranking, recomendación), Monte Carlo (GBM, percentiles) y la
capa `application` (casos de uso `compareStrategies`/`runMonteCarlo`/
`validateScenario`, DTOs, puertos). La app web (`apps/web`) tiene la
infraestructura (`localStorage`, RNG con semilla), un shell real (hash router,
i18n ES/EN, store de zustand) y un `FieldRenderer` genérico que recorre el
catálogo declarativo de `ParamSpec` del dominio para generar formularios sin
conocer las estrategias. Con eso, las seis pestañas del plan original
(**Comparador**, **Escenarios**, **Deudas**, **Supuestos**, **Aportaciones** y
**Monte Carlo**) están completas y funcionando sobre el escenario activo.
Queda pendiente el `workerRunner` (paso 16 del plan: mover el cálculo a un Web
Worker), una optimización de rendimiento que hoy no hace falta —1000
trayectorias de Monte Carlo tardan bien por debajo de un segundo en el hilo
principal—, y la interfaz todavía no muestra los errores de
`validateScenario`/`validateStrategyParams` (existen y están probados en
`packages/core`, pero ninguna pestaña los pinta todavía). El detalle completo
está en [docs/plan.md, §5](docs/plan.md#5-orden-de-implementación).

## Stack

- TypeScript, en un monorepo de npm workspaces (`packages/core` + `apps/web`)
- `packages/core`: motor puro, sin dependencias en tiempo de ejecución
- `apps/web`: React 19 + Vite 8 + Tailwind 4 + Recharts
- Tests: Vitest + fast-check (property-based) en el motor, Vitest (jsdom) en la
  infraestructura y la UI, Playwright para E2E
- CI: GitHub Actions (`quality` ‖ `e2e` → `deploy`) → GitHub Pages

## Requisitos

- Node 24, fijado en [`.nvmrc`](.nvmrc)
- npm 11, vía `corepack enable` (la versión está fijada en el `packageManager`
  del `package.json` raíz)

## Scripts

Desde la raíz del repo:

| Script                  | Qué hace                                                      |
| ----------------------- | ------------------------------------------------------------- |
| `npm run dev`           | Arranca la app web en modo desarrollo                         |
| `npm run build`         | Compila la app web a `apps/web/dist`                          |
| `npm test`              | Ejecuta los tests unitarios y de propiedades del motor        |
| `npm run test:coverage` | Igual, con el informe de cobertura (umbral 90/90/85/90)       |
| `npm run test:web`      | Tests unitarios de `apps/web` (infraestructura, jsdom)        |
| `npm run lint`          | ESLint + Prettier (`--check`) + `dependency-cruiser`          |
| `npm run typecheck`     | `tsc --noEmit` en cada workspace                              |
| `npm run verify`        | `lint` + `typecheck` + `test:coverage` + `test:web` + `build` |

`npm run verify` es lo que corre en CI (job `quality`); conviene lanzarlo antes
de cada commit con cambios de código.

## Estructura del monorepo

```
packages/core/   # motor de simulación, sin dependencias
apps/web/        # presentación (React)
docs/
  plan.md          # plan del proyecto: decisiones, arquitectura, roadmap
  arquitectura.md  # capas hexagonales y reglas que aplica dependency-cruiser
```

Ver [docs/plan.md](docs/plan.md) para el porqué de cada decisión y el estado
del roadmap, y [docs/arquitectura.md](docs/arquitectura.md) para las reglas de
dependencia entre capas y cómo añadir una estrategia nueva.

## Despliegue

La CI (`.github/workflows/ci.yml`) tiene tres jobs: `quality` (lint, tipos,
tests, build) y `e2e` (Playwright) en cada push y pull request, y `deploy` —
que solo corre en `main` y solo si los otros dos pasaron — que publica
`apps/web/dist` en GitHub Pages. El `base` de Vite sale de `VITE_BASE_PATH`,
que pone `configure-pages` a partir del nombre real del repositorio: renombrar
el repo no rompe el build.

El repositorio ya es público y Settings → Pages → Source está en **GitHub
Actions**: el job `deploy` corre en cada push a `main` sin pasos manuales
adicionales.

## Limitaciones del modelo

Para que las cifras no se interpreten como más precisas de lo que son:

- El motor de bonos es **renta fija + convergencia de precio**, no un pricer de
  riesgo de tipos. Los reintegros asumen cupón constante.
- Los impuestos son **parámetros configurables**, no un simulador fiscal. Los
  valores por defecto son 0 salvo la retención estándar, que es editable.
- Las conversiones entre divisas son **nominales con tipos manuales**: no hay
  PPC ni series históricas.
- La TIR es money-weighted con flujos mensuales: no modela la secuencia dentro
  del mes ni la reinversión intra-mensual.
- El Monte Carlo usa GBM lognormal iid, y solo afecta a la renta variable:
  correlaciones entre activos, colas gruesas y volatilidad estocástica quedan
  fuera del modelo.
