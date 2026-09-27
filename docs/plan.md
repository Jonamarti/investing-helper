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
| Persistencia | localStorage + import/export JSON + URL compartible (deflate + base64url) |
| Moneda | Multi-moneda con tipos manuales + i18n ES/EN |
| Gráficos | Recharts 3.10+ |
| Tests | Unitarios + property-based (fast-check) + golden files + E2E Playwright |
| CI | Actions: `quality` ‖ `e2e` → `deploy` a GitHub Pages |

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
├── .dependency-cruiser.js        # reglas hexagonales
├── eslint.config.js              # flat config + boundaries
├── .prettierrc.json
├── .gitignore
├── README.md
│
├── .github/
│   ├── workflows/
│   │   └── ci.yml                # quality ‖ e2e → deploy
│   └── dependabot.yml            # npm + github-actions, semanal
│
├── packages/core/                # ── MOTOR, sin dependencias ──
│   ├── package.json              # "exports": "./src/index.ts", sin deps
│   ├── tsconfig.json             # strict + noUncheckedIndexedAccess
│   ├── vitest.config.ts
│   └── src/
│       ├── index.ts              # única puerta pública
│       ├── shared/
│       │   ├── money.ts          # aritmética con redondeo al exponente de la divisa
│       │   ├── rate.ts           # anual↔mensual, nominal↔efectivo, real
│       │   ├── period.ts         # índice de mes ↔ {año, mes}, addMonths
│       │   ├── currency.ts       # exponent/locale por ISO-4217
│       │   ├── result.ts         # Result<T, E> sin excepciones
│       │   └── assert.ts
│       ├── model/
│       │   ├── scenario.ts       # agregado raíz
│       │   ├── assumptions.ts    # inflación, crecimiento nómina, MC, impuestos
│       │   ├── salary.ts         # sueldo neto, costes fijos, 12/14 pagas
│       │   ├── contributionPlan.ts
│       │   ├── loan.ts           # Loan + LoanType + AmortizationSystem
│       │   ├── strategy.ts       # union de StrategyParams + StrategyType
│       │   └── exchangeRates.ts
│       ├── params/
│       │   ├── spec.ts           # ParamSpec, FieldKind, ValidationRule
│       │   ├── catalog.ts        # registry: estrategia → paramSpec
│       │   └── specs/{cash,bonds,equity,mixed,debt}.spec.ts
│       ├── engine/
│       │   ├── contracts.ts      # StrategyEngine, StepContext, AssetState
│       │   ├── registry.ts       # Map<StrategyType, StrategyEngine>
│       │   ├── simulator.ts      # bucle mensual de fases
│       │   ├── phases/{contribute,debt,growth,tax,valuation}.ts
│       │   └── state.ts          # MonthState
│       ├── strategies/
│       │   ├── cash.ts
│       │   ├── bonds.ts
│       │   ├── equity.ts
│       │   ├── mixed.ts          # compone sub-activos + rebalanceo
│       │   └── debtPaydown.ts    # avalanche/snowball, plazo vs cuota
│       ├── amortization/
│       │   ├── french.ts         # A = P·i / (1 − (1+i)^−n)
│       │   ├── constant.ts
│       │   ├── schedule.ts       # tabla + Flynn/Sherwood
│       │   └── earlyExit.ts      # penalización por cancelación anticipada
│       ├── taxes/
│       │   ├── taxEngine.ts      # retenciones, relief de interés de hipoteca
│       │   └── presets.ts
│       ├── analytics/
│       │   ├── real.ts           # deflatación y poder de compra
│       │   ├── irr.ts            # Newton + bisección, mensual → anual
│       │   ├── metrics.ts        # netGain, CAGR, breakeven
│       │   ├── ranking.ts
│       │   ├── crossovers.ts     # primer mes donde A supera a B
│       │   └── recommendation.ts # motor de reglas → claves i18n
│       ├── montecarlo/
│       │   ├── sampler.ts        # GBM lognormal, Z
│       │   └── aggregate.ts      # p5/p25/p50/p75/p95, P(gana), P(>inflación)
│       ├── ports/
│       │   ├── random.ts         # IRandomSource
│       │   └── clock.ts          # IDateSource
│       └── usecases/             # superficie pública
│           ├── compareStrategies.ts
│           ├── simulateStrategy.ts
│           ├── buildAmortizationSchedule.ts
│           ├── rankStrategies.ts
│           ├── runMonteCarlo.ts
│           └── validateScenario.ts
│   └── test/
│       ├── unit/
│       ├── property/             # fast-check
│       └── fixtures/golden/      # cuadros de amortización validados a mano
│
└── apps/web/                     # ── PRESENTACIÓN ──
    ├── package.json
    ├── vite.config.ts            # base = base_path de GitHub Pages
    ├── playwright.config.ts
    ├── e2e/
    │   ├── smoke.spec.ts         # carga, mover un slider, la tabla se actualiza
    │   ├── share-url.spec.ts     # round-trip del enlace compartible
    │   └── persistence.spec.ts   # recálculo guardado en localStorage
    └── src/
        ├── main.tsx              # único punto que conoce ui + infra
        ├── container.ts          # DI manual: registry + repos + runner
        ├── app/
        │   ├── App.tsx
        │   ├── hashRouter.ts     # #/tab/comparison?s=<estado>  (sin 404 en Pages)
        │   ├── compositionRoot.tsx
        │   └── providers.tsx     # i18n, query client, tema
        ├── infrastructure/
        │   ├── rng/mulberry32.ts
        │   ├── persistence/{localStorageRepo,jsonFileRepo,migrations}.ts
        │   ├── codec/shareUrlCodec.ts        # deflate-raw + base64url
        │   ├── rates/manualFxProvider.ts
        │   ├── clock/systemDateSource.ts
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
            │   ├── assumptions/  # AssumptionsTab
            │   ├── montecarlo/   # MonteCarloTab, PercentileFanChart
            │   └── scenarios/    # ScenariosTab, ShareBar, ImportExport
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

`runMonteCarlo(scenario, strategy, { paths: 1000, seed })` devuelve
`{ p5, p25, p50, p75, p95, probBeatsBest, probBeatsInflation, finalValues[] }`.
**La semilla va en la URL**, así que los resultados son reproducibles al
compartir. Se ejecuta en un Web Worker, con fallback síncrono.

---

## 4. CI / CD (`.github/workflows/ci.yml`)

Un solo workflow, tres jobs. El deploy **solo** si todo lo anterior pasó.

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:                       # lint + tipos + unit, rápido
    permissions: { contents: read }
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4      # node 24, cache: npm
      - run: npm ci
      - run: npm run lint               # eslint + prettier + dependency-cruiser
      - run: npm run typecheck          # tsc -b --noEmit
      - run: npm run test -- --coverage # vitest en packages/core
      - run: npm run build              # incluye apps/web

  e2e:                           # Playwright, se solapa con quality
    permissions: { contents: read }
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4      # node 24, cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm run test:e2e            # webServer: vite preview
      - uses: actions/upload-artifact@v4
        if: failure()                    # adjunta traces y screenshots
        with: { name: playwright-report, path: apps/web/playwright-report }

  deploy:                        # gate: main + push + todo verde
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: [quality, e2e]
    permissions:
      pages: write                # ← a nivel de job, mínimo privilegio
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
      - run: npm ci
      - uses: actions/configure-pages@v5
        id: pages
      - run: npm run build
        env:
          VITE_BASE_PATH: ${{ steps.pages.outputs.base_path }}  # rename-proof
      - uses: actions/upload-pages-artifact@v4
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
- Alternativa si prefieres separar el deploy: `workflow_run` disparado al
  completar `CI` con `conclusion == 'success'`.

---

## 5. Orden de implementación

1. **Scaffold**: workspaces, tsconfig con project references, eslint + prettier,
   `dependency-cruiser.js` con las 5 reglas, `.nvmrc`, `git init`.
2. **CI skeleton**: `ci.yml` con solo el job `quality` (lint y typecheck vacíos)
   para validar el plumbing.
3. **Core/shared**: `money`, `rate`, `period`, `currency`, `result` + tests.
4. **Core/model**: `Loan`, `Scenario`, `Assumptions`, `Salary`,
   `ContributionPlan`, `StrategyParams`.
5. **Core/amortization**: francés, constante, schedule, salida anticipada, más un
   golden file de una hipoteca real.
6. **Core/params**: `ParamSpec` y el catálogo de specs de las 5 estrategias.
7. **Core/engine**: contratos, registry, simulador con las 6 fases.
8. **Core/strategies**: cash, bonds, equity, mixed, debtPaydown, más tests de
   conservación de capital y de rendimiento.
9. **Core/taxes**: motor y presets.
10. **Core/analytics**: real, irr, metrics, ranking, crossovers, recommendation.
11. **Core/montecarlo**: sampler, aggregate, y test de reproducibilidad con semilla.
12. **Core/usecases** + validación + **tests**: property-based con fast-check,
    golden files, y cobertura ≥ 90 % en core.
13. **Web/infra**: `mulberry32`, repos de localStorage, `shareUrlCodec`
    (deflate-raw + base64url), `manualFxProvider`, `container.ts`.
14. **Web/shell**: App, hash router, i18n, formateo, stores, `FieldRenderer` y campos.
15. **Web/pestañas**: Supuestos → Deudas → Aportaciones → **Comparador** →
    Monte Carlo → Escenarios.
16. **Web/rendimiento**: `workerRunner` y `simulate.worker.ts` con fallback inline.
17. **E2E**: 3 specs de Playwright.
18. **Deploy**: job `deploy`, `.nojekyll`, README y primer push.

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

- La carpeta actual se llama `investing_helper` (guion bajo). Conviene renombrarla
  a `investing-helper` para que la URL de GitHub Pages quede limpia.
- En local hay Node 23.7 (odd, no-LTS). La CI usará Node 24; para desarrollo
  local conviene instalar la 24 LTS.
