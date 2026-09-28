# Plan: `investing-helper` — comparador de estrategias de inversión

Calculadora webapp para comparar, sobre los mismos datos, si conviene amortizar
deuda, invertir en bonos, invertir en renta variable, o dejar el dinero en cuenta
corriente, ajustando por inflación, crecimiento del sueldo y dinero libre mensual.

---

## 0. Decisiones cerradas

| Tema | Elección |
|---|---|
| Stack UI | React 19 + Vite 8 + TypeScript + Tailwind 4 |
| Estructura | npm workspaces: `packages/core` + `apps/web` |
| Motor | TypeScript puro, sin dependencias, sin React |
| Deudas | Genéricas (sistema francés / constante) + revolving |
| Rentabilidad | Determinista + Monte Carlo opcional (con semilla) |
| Aportaciones | Automáticas (capital inicial + % del sueldo libre + crecimiento) **y** overrides manuales por periodo |
| Impuestos | Configurables por estrategia, 0 % por defecto |
| Persistencia | localStorage + import/export JSON, sin URL compartible |
| Moneda | Multi-moneda con tipos manuales + i18n ES/EN |
| Gráficos | Recharts 3.10+ |
| Tests | Unitarios + property-based (fast-check) + golden files + E2E Playwright |
| CI | Actions: `quality` ‖ `e2e` → `deploy` a GitHub Pages |

### 0.1 Persistencia

Sin URL compartible: el router de hash solo guarda la pestaña activa
(`#/<tab>`, sin estado del escenario en la URL). Todo el estado vive en
`localStorage`, bajo estas claves:

| Clave | Contenido |
|---|---|
| `investing-helper:v1:index` | Lista de escenarios guardados: `{ id, nameKey o nombre, updatedAt }[]` |
| `investing-helper:v1:scenario:<id>` | El `Scenario` completo de ese id, tal cual lo consume el motor |
| `investing-helper:v1:settings` | Preferencias de la app: idioma, tema, última pestaña |

La **biblioteca de escenarios** (pestaña Escenarios) opera sobre el índice:
listar, cargar (lee `scenario:<id>` y lo pasa al motor), renombrar (solo toca el
índice), duplicar (nuevo `id`, mismo contenido, entrada nueva en el índice) y
borrar (quita la entrada del índice y su clave `scenario:<id>`).

**Import/export** es JSON plano de un `Scenario`, con `scenarioVersion`
(`SCENARIO_VERSION` en `model/scenario.ts`) como parte del payload. Al importar,
si la versión es menor que la que entiende el código, se encadenan las
migraciones conocidas antes de aceptarlo; si es mayor, se rechaza en vez de
adivinar el formato.

---

## 1. Arquitectura hexagonal

La frontera es **física**, no una convención: `packages/core` no puede importar
nada externo porque no declara dependencias en su `package.json`. `apps/web` es el
único paquete que puede tocar el motor.

```
┌─ apps/web ────────────────────────────────────────────────┐
│  ui/            React, componentes, gráficos, formularios, i18n │  ← conoce DTOs
│      ↓ usa                                                       │
│  infrastructure/  localStorage, RNG, worker, codec, tipos FX     │  ← implementa puertos
│      ↓ implementan                                               │
├─ packages/core ────────────────────────────────────────────┤
│  application/    casos de uso + puertos (IRandomSource, ...)     │  ← orquesta
│      ↓                                                           │
│  domain/         model, engine, strategies, taxes,               │  ← CERO deps
│                 analytics, montecarlo, amortization               │
└─────────────────────────────────────────────────────────────┘
```

**Reglas de dependencia**, verificadas por `dependency-cruiser` y
`eslint-plugin-boundaries`:

| Desde | Puede importar |
|---|---|
| `domain/**` | solo `domain/**` |
| `application/**` | `domain/**` |
| `infrastructure/**` | `application/ports`, `domain/shared` |
| `ui/**` | `application/dto`, `domain/shared` (Money/Rate) — **nunca** `domain/engine\|strategies\|analytics` |
| cualquiera | **nunca** `ui` (solo `main.tsx` hace el cableado) |

`Money`, `Rate` y `Percent` se permiten en la UI porque son value objects; todo lo
demás tiene que pasar por los DTOs de `application/dto`.

---

## 2. Árbol de ficheros

```
investing-helper/
├── package.json                  # workspaces, scripts raíz
├── .nvmrc                        # 24
├── .dependency-cruiser.mjs       # reglas hexagonales (ver docs/arquitectura.md)
├── eslint.config.js              # flat config + boundaries
├── .prettierrc.json
├── .gitignore
├── README.md
│
├── .github/
│   ├── workflows/
│   │   └── ci.yml                # quality → deploy (e2e pendiente, ver §4)
│   └── dependabot.yml            # npm + github-actions, semanal
│
├── packages/core/                # ── MOTOR, sin dependencias ──
│   ├── package.json              # "exports": "./src/index.ts", sin deps
│   ├── tsconfig.json             # strict + noUncheckedIndexedAccess
│   ├── vitest.config.ts
│   └── src/
│       ├── index.ts              # única puerta pública
│       └── domain/                # CERO deps, todo lo de abajo es solo domain/**
│           ├── shared/
│           │   ├── money.ts          # aritmética con redondeo al exponente de la divisa
│           │   ├── rate.ts           # anual↔mensual, nominal↔efectivo, real
│           │   ├── period.ts         # índice de mes ↔ {año, mes}, addMonths
│           │   ├── currency.ts       # exponent/locale por ISO-4217
│           │   ├── result.ts         # Result<T, E> sin excepciones
│           │   └── assert.ts
│           ├── model/
│           │   ├── scenario.ts       # agregado raíz, SCENARIO_VERSION
│           │   ├── assumptions.ts    # inflación, horizonte, Monte Carlo
│           │   ├── salary.ts         # sueldo neto, costes fijos, 12/14 pagas
│           │   ├── contributionPlan.ts
│           │   ├── loan.ts           # Loan + LoanKind + AmortizationSystem
│           │   ├── strategy.ts       # union de StrategyParams + StrategyType
│           │   └── exchangeRates.ts
│           ├── params/
│           │   ├── spec.ts           # ParamSpec, FieldKind, ValidationRule
│           │   ├── catalog.ts        # registry: estrategia → paramSpec
│           │   └── validate.ts
│           ├── amortization/
│           │   ├── french.ts         # A = P·i / (1 − (1+i)^−n)
│           │   ├── constant.ts
│           │   ├── schedule.ts       # tabla de amortización
│           │   └── earlyExit.ts      # penalización por cancelación anticipada
│           ├── engine/
│           │   ├── contracts.ts      # StrategyEngine, EngineContext, EngineState
│           │   ├── registry.ts       # Map<StrategyType, StrategyEngine>
│           │   └── simulator.ts      # bucle mensual: contribución→cierre→año→rebalanceo
│           ├── strategies/
│           │   ├── cash.ts
│           │   ├── bonds.ts
│           │   ├── equity.ts
│           │   ├── mixed.ts          # compone sub-activos + rebalanceo
│           │   └── debtPaydown.ts    # avalanche/snowball, plazo vs cuota
│           ├── taxes/
│           │   ├── taxEngine.ts      # retenciones, relief de interés de hipoteca
│           │   └── presets.ts
│           ├── analytics/            # ver §3.7, paso 10 del plan
│           │   ├── real.ts           # deflatación y poder de compra
│           │   ├── irr.ts            # Newton + bisección, mensual → anual
│           │   ├── metrics.ts        # netGain, TIR, breakeven
│           │   ├── ranking.ts
│           │   ├── crossovers.ts     # primer mes donde A supera a B
│           │   └── recommendation.ts # motor de reglas → claves i18n
│           └── montecarlo/           # sampler GBM + agregados p5..p95 (paso 11)
│       └── application/              # siguiente tanda (paso 12 en adelante)
│           ├── ports/                 # IRandomSource, IDateSource
│           ├── dto/                   # lo único que ve la UI
│           └── usecases/              # compareStrategies, runMonteCarlo, ...
│   └── test/
│       ├── unit/                 # espejo de src/domain
│       └── property/             # fast-check
│
└── apps/web/                     # ── PRESENTACIÓN ──
    ├── package.json
    ├── vite.config.ts            # base = VITE_BASE_PATH (GitHub Pages)
    ├── playwright.config.ts      # pendiente, ver §4
    ├── e2e/
    │   ├── smoke.spec.ts         # carga, mover un slider, la tabla se actualiza
    │   └── scenario-library.spec.ts  # guardar/cargar/duplicar/borrar en localStorage
    └── src/
        ├── main.tsx              # único punto que conoce ui + infra
        ├── container.ts          # DI manual: registry + repos + runner
        ├── app/
        │   ├── App.tsx
        │   ├── hashRouter.ts     # #/<tab>, sin estado en la URL (sin 404 en Pages)
        │   ├── compositionRoot.tsx
        │   └── providers.tsx     # i18n, query client, tema
        ├── infrastructure/
        │   ├── rng/mulberry32.ts
        │   ├── persistence/{localStorageRepo,jsonFileRepo,migrations}.ts
        │   ├── rates/manualFxProvider.ts       # pendiente: nada lo necesita todavia
        │   ├── clock/systemDateSource.ts       # pendiente: nada lo necesita todavia
        │   └── runner/{SimulationRunner.ts,workerRunner.ts,inlineRunner.ts,simulate.worker.ts}
        └── ui/
            ├── components/
            │   ├── fields/       # FieldRenderer genérico desde ParamSpec
            │   │   ├── MoneyInput, PercentSlider, NumberInput,
            │   │   ├── SelectField, DateField, InfoTip
            │   ├── charts/       # wrappers sobre Recharts
            │   └── layout/       # Card, Tabs, StatTile, Table, Badge
            ├── features/
            │   ├── comparison/   # ← PESTAÑA PRINCIPAL
            │   │   ├── ComparisonTab.tsx
            │   │   ├── StrategyCards.tsx
            │   │   ├── RankingTable.tsx      # patrimonio, TIR, real, impuestos
            │   │   ├── NetWorthChart.tsx     # curvas nominal + poder de compra
            │   │   ├── CrossoverList.tsx     # "supera a X en el mes 87"
            │   │   └── RecommendationPanel.tsx
            │   ├── debts/        # DebtTab, LoanForm, AmortizationTable
            │   ├── contributions/# ContributionsTab, OverrideEditor
            │   ├── assumptions/  # AssumptionsTab (incluye la semilla de Monte Carlo)
            │   ├── montecarlo/   # MonteCarloTab, PercentileFanChart
            │   └── scenarios/    # ScenariosTab: biblioteca + ImportExport
            ├── hooks/            # useScenario, useComparison, useDebounced
            ├── store/            # zustand: scenarioStore, uiStore, settingsStore
            ├── format/           # formateo con Intl (moneda, %, fecha)
            └── i18n/{es.ts,en.ts}
```

---

## 3. Modelo de dominio

### 3.1 Dinero

`number` en unidades mayores, con todo el aritmético pasado por funciones puras
que redondean al exponente de la divisa (`roundToExponent(x, currency.exponent)`).
Se descartó la opción de céntimos enteros por el rozamiento con multi-moneda
(JPY tiene exponente 0, y hay que hacer conversiones entre divisas).

### 3.2 Granularidad

**Mensual** como tick base (`t = 0..horizonMonths`), agregado a años solo para las
tablas. Deuda, intereses y nómina se mensualizan.

### 3.3 Motor: fases por mes

Para cada mes `t`, y para cada estrategia:

1. **CONTRIBUTION** — aporta lo que toca del plan (respeta overrides, pagas
   extra, sueldo libre).
2. **DEBT** — interés sobre el saldo, cuota, extra = `min(disponible, objetivo)`,
   penalización si se cancela antes de tiempo.
3. **GROWTH** — cada engine devenga: `cash × (1 + r/12)`, cupón + precio, o GBM
   en modo Monte Carlo.
4. **TAX** — los engines reportan hechos imponibles, el `TaxEngine` calcula y
   descuenta.
5. **VALUATION** — saldo nominal e índice de inflación acumulado.
6. **SNAPSHOT** — un punto de la serie temporal.

`StrategyEngine` es la pieza clave de la extensibilidad:

```ts
interface StrategyEngine<P, S> {
  readonly type: StrategyType
  readonly paramSpec: ParamSpec[]
  create(params: P, ctx: InitContext): S
  accrue(state: S, ctx: MonthContext): S
  contribute?(state: S, amount: Money, ctx: MonthContext): S
  value(state: S, ctx: MonthContext): Money
  taxes(state: S, ctx: MonthContext): TaxCharge
  snapshot(state: S, ctx: MonthContext): StrategySnapshot
}
```

Añadir "plan de pensiones" o "cripto" es **un fichero** en `domain/strategies/`
más su `spec.ts`. Ni el simulador ni la UI se tocan.

### 3.4 UI autogenerada desde el dominio

Cada estrategia declara sus parámetros como **datos** (`ParamSpec[]`), no como JSX:

```ts
{ key: 'expectedReturn', kind: 'percent', default: 0.07,
  min: -0.5, max: 0.5, step: 0.001,
  labelKey: 'params.equity.expectedReturn.label',
  helpKey: 'params.equity.expectedReturn.help' }
```

`FieldRenderer` recorre el spec y elige `MoneyInput` / `PercentSlider` /
`NumberInput` / `SelectField` / `DateField`. Resultado: los formularios de cada
pestaña se generan solos, y traducir es solo añadir claves a `es.ts` / `en.ts`.

### 3.5 Estrategias

| Espacio | Modelo |
|---|---|
| **Cash** | saldo × tasa/12, retención sobre el interés |
| **Bonos** | cupón `couponRate` sobre el nominal, más un precio que converge a `maturityPrice` en `maturityMonths`; venta a mercado en cualquier mes; retención sobre el cupón |
| **Renta variable** | determinista `(1 + r/12)`, o GBM `exp((μ−σ²/2)/12 + σ/√12·Z)` en Monte Carlo; retención sobre dividendos y sobre plusvalías (`annual` \| `onExit`) |
| **Mixto** | composición con pesos y rebalanceo anual a pesos objetivo |
| **Amortizar deuda** | apunta a un préstamo concreto; orden `avalanche` (mayor interés) o `snowball` (menor saldo); `shortenTerm` o `reducePayment`; instante y coste de la salida anticipada |
| **Revolving** | saldo revolving, pago mínimo = `max(minPayment, saldo × tasa)`, y el excedente amortiza deuda (suele ser gratis, porque el revolving es lo más caro) |

### 3.6 Aportaciones

`initialLumpSum` + `monthly = freeMonthly × savingsRate`, con
`salaryGrowthRate` aplicado cada 12 meses y `extraPayMonths: number[]` (por
ejemplo `[7, 12]` para 14 pagas). Los **overrides** son un
`Map<"YYYY-MM", { lumpSum?, monthlyAmount? }>` que se mezcla sobre el automático.

### 3.7 Analítica

- `finalReal = finalNominal / (1 + inflación)^(t/12)`
- **TIR** money-weighted: NPV de los flujos mensuales = 0, Newton-Raphson con
  fallback a bisección, anualizada como `(1 + r_m)^12 − 1`.
- **Crossovers**: comparación por pares, primer cambio de signo de `A(t) − B(t)`.
- **Ranking** por `finalReal` (poder de compra), secundario TIR.
- **Recommendation**: motor de reglas puro que devuelve
  `{ headlineKey, reasons: [{ key, params }], caveats }`. Ejemplo de regla:
  *"amortar gana porque la TIR fija del préstamo (4,1 %) supera tu escenario base
  de bolsa (4,0 %) y no tributas"*.

### 3.8 Monte Carlo

`domain/montecarlo` ya existe: `sampleGbmPath` genera una trayectoria de
rentabilidades mensuales GBM a partir de un generador uniforme inyectado (puro,
sin `Math.random`), y `EngineContext.month.randomMonthlyReturn` es el enganche
con el simulador — hoy solo lo lee la renta variable, que lo usa en vez de
`expectedReturn` ese mes. `percentilesOf`/`probabilityAbove`/
`probabilityPairwiseAbove` agregan el resultado de varias trayectorias.

Falta el caso de uso `runMonteCarlo(scenario, strategy, { paths: 1000, seed })`
(paso 12, `application/usecases/`) que genere las `paths` semillas con
`IRandomSource`, llame a `simulate(...)` una vez por trayectoria con
`randomMonthlyReturnFor`, y devuelva
`{ p5, p25, p50, p75, p95, probBeatsBest, probBeatsInflation, finalValues[] }`.
**La semilla sera visible y editable** en la pestaña de Supuestos
(`MonteCarloSettings.seed`) y se guardara con el escenario, no en la URL: con
la misma semilla y los mismos parametros, el resultado es identico. Se
ejecutara en un Web Worker, con fallback sincrono (pasos 13 y 16).

---

## 4. CI / CD (`.github/workflows/ci.yml`)

Estado real: tres jobs, `quality` ‖ `e2e` → `deploy`.

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    permissions: { contents: read }
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc      # una sola fuente de verdad para la version
          cache: npm
      - run: corepack enable             # fija la version de npm (packageManager)
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:coverage       # packages/core, con umbrales
      - run: npm run test:web            # apps/web, unitarios (jsdom)
      - run: npm run build

  e2e:                            # Playwright, se solapa con quality
    permissions: { contents: read }
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: corepack enable
      - run: npm ci
      - run: npx playwright install --with-deps chromium
        working-directory: apps/web
      - run: npm run test:e2e
        env:
          VITE_BASE_PATH: /investing-helper/   # el mismo base que `deploy`
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: apps/web/playwright-report }

  deploy:                        # gate: main + push + quality y e2e en verde
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: [quality, e2e]
    permissions:
      pages: write                # ← a nivel de job, minimo privilegio
      id-token: write
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: corepack enable
      - run: npm ci
      - uses: actions/configure-pages@v5
        id: pages
      - run: npm run build
        env:
          VITE_BASE_PATH: ${{ steps.pages.outputs.base_path }}  # rename-proof
      - uses: actions/upload-pages-artifact@v3
        with: { path: apps/web/dist }
      - id: deployment
        uses: actions/deploy-pages@v4
```

Detalles que importan:

- `VITE_BASE_PATH` sale de `configure-pages`, así que renombrar el repo no rompe
  nada. No hardcodear `/investing_helper/`.
- `public/.nojekyll` para que Jekyll no toque los assets ni el enrutado por hash.
- `permissions` **a nivel de job** en `deploy`: especificar `permissions` revoca
  todo lo que no esté listado.
- Tras el merge: Settings → Pages → Source: **GitHub Actions**.
- `dependabot.yml`: npm y github-actions, semanal.
- `e2e` sí usa `VITE_BASE_PATH` literal (`/investing-helper/`), a diferencia de
  `deploy`: `configure-pages` no está disponible fuera del job de despliegue.
  `apps/web/playwright.config.ts` construye `dist/` y lo sirve con
  `vite preview` sobre ese mismo base — si el preview sirviera en `/` y el
  deploy en `/investing-helper/`, los tests pasarían en local y romperían en
  GitHub Pages. Si el repo cambia de nombre, hay que tocar los dos sitios.

---

## 5. Orden de implementación

✅ hecho · ▶ en curso · el resto, pendiente.

1. ✅ **Scaffold**: workspaces, tsconfig con project references, eslint +
   prettier, `.dependency-cruiser.mjs` con las 5 reglas, `.nvmrc`, `git init`.
2. ✅ **CI skeleton**: `ci.yml` con los jobs `quality` y `deploy`.
3. ✅ **Core/shared**: `money`, `rate`, `period`, `currency`, `result` + tests.
4. ✅ **Core/model**: `Loan`, `Scenario`, `Assumptions`, `Salary`,
   `ContributionPlan`, `StrategyParams`.
5. ✅ **Core/amortization**: francés, constante, schedule, salida anticipada.
6. ✅ **Core/params**: `ParamSpec` y el catálogo de specs de las 5 estrategias.
7. ✅ **Core/engine**: contratos, registry, simulador con sus fases.
8. ✅ **Core/strategies**: cash, bonds, equity, mixed, debtPaydown, con tests de
   conservación de capital y de rendimiento.
9. ✅ **Core/taxes**: motor y presets.
10. ✅ **Core/analytics**: real, irr, metrics, ranking, crossovers, recommendation.
11. ✅ **Core/montecarlo**: sampler (GBM), aggregate (percentiles, probabilidades)
    y `EngineContext.month.randomMonthlyReturn`, que la renta variable usa en
    vez de `expectedReturn` cuando la simulación trae una trayectoria.
12. ✅ **Core/application**: `ports` (`IRandomSource`), `dto` (comparación y
    Monte Carlo) y `usecases` (`compareStrategies`, `runMonteCarlo`,
    `validateScenario`), con tests. Faltan property-based con fast-check para
    esta capa y golden files; cobertura de `packages/core` ≥ 90 % ya cumplida.
13. ✅ **Web/infra**: `mulberry32`, repos de localStorage (biblioteca de
    escenarios + import/export + migraciones) y `container.ts`, con tests
    (jsdom, `Storage` inyectado). `manualFxProvider` se deja para cuando una
    pestaña necesite de verdad tipos de cambio manuales: `Scenario.exchangeRates`
    ya viaja con el escenario, y no había nada que este archivo fuera a hacer
    todavía. De camino, `.dependency-cruiser.mjs` tenía dos fallos que dejaban
    `lint:deps` sin comprobar casi nada (ver `docs/arquitectura.md`): se han
    corregido y ahora sí cruza los 99 módulos de `packages/core` y `apps/web`.
14. ✅ **Web/shell**: `App.tsx`, `hashRouter` (`#/<tab>`), `i18n` (ES/EN, con las
    claves que ya se pintan — no todas las que emite el dominio),
    `format/money.ts` + `format/percentInput.ts` (dinero y porcentaje),
    `store/scenarioStore.ts` (zustand, con `compareStrategies` calculado en
    cuanto cambia el escenario) y `components/fields/{FieldRenderer,
    ParamsForm}.tsx`: recorren un `ParamSpec[]` (`domain/params`) y pintan el
    input segun `kind` (money/percent/number/select/boolean/month/currency),
    tal como preveía este mismo documento en §3.4.
15. ▶ **Web/pestañas**: ✅ **Comparador**, ✅ **Escenarios** (biblioteca sobre
    `LocalStorageScenarioRepo`: guardar, cargar, renombrar, duplicar, borrar,
    exportar/importar JSON), ✅ **Deudas** (alta, edición y borrado de
    préstamos, forma fija de `Loan`) y ✅ **Supuestos** (inflación, horizonte,
    ajustes de Monte Carlo, y la lista de estrategias a comparar — añadir,
    quitar y editar cada una con `FieldRenderer`, incluida la lista de
    préstamos de una estrategia de amortizar deuda y los componentes de una
    cartera mixta, anidando `ParamsForm` una vez más). Aportaciones y Monte
    Carlo siguen siendo un aviso de "todavía no construida".
16. **Web/rendimiento**: `workerRunner` y `simulate.worker.ts` con fallback
    inline. Hoy `compareStrategies` corre siempre en el hilo principal: para
    el tamaño de escenario actual es instantáneo, así que esto es una
    optimización cuando haga falta, no un bloqueante.
17. ✅ **E2E**: `playwright.config.ts` y `e2e/smoke.spec.ts` — carga el
    comparador y ve una recomendación real, cambia a una pestaña sin construir,
    y guarda el escenario activo en la biblioteca de Escenarios — más el job
    `e2e` en la CI, que bloquea `deploy`.
18. ✅ **Deploy**: repo público, Settings → Pages → Source: GitHub Actions
    activado. El job `deploy` corre en cada push a `main`.

Los pasos 1–14, 17 y 18 ya están sobre `main`, y el paso 15 tiene cuatro
pestañas (Comparador, Escenarios, Deudas y Supuestos) funcionando de verdad.
El resto avisa honestamente que no está construido todavía, en vez de
fingirlo. Este documento se actualiza según avanza el resto.

---

## 6. Riesgos y simplificaciones

A documentar en el README, para que las cifras no se interpreten como más
precisas de lo que son:

- El motor de bonos es **renta fija + convergencia de precio**, no un pricer de
  riesgo de tipos. Los reintegros asumen cupón constante.
- Los impuestos son **parámetros configurables**, no un simulador fiscal. Los
  valores por defecto son 0 salvo la retención estándar, que es editable.
- Las conversiones entre divisas son **nominales con tipos manuales**: no hay PPC
  ni series históricas.
- La TIR es money-weighted con flujos mensuales: no modela la secuencia dentro
  del mes ni la reinversión intra-mensual.
- El Monte Carlo usa GBM lognormal iid: correlaciones, colas gruesas y
  volatilidad estocástica quedan fuera.

Nada de esto bloquea el arranque; queda anotado para respetar los límites del
modelo.

---

## 7. Pendientes de confirmar

- ~~Renombrar la carpeta `investing_helper` a `investing-helper`~~: no hace
  falta. La URL de GitHub Pages depende del **nombre del repositorio** en
  GitHub, no del directorio local, y el repo ya se llama `investing-helper`.
- En local hay Node 23.7 (odd, no-LTS). La CI usará Node 24; para desarrollo
  local conviene instalar la 24 LTS.
