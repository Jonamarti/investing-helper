# Arquitectura

Este documento describe la frontera hexagonal del proyecto y las reglas que
`.dependency-cruiser.mjs` comprueba automáticamente en `npm run lint:deps`. Si
una regla de aquí y una regla de ese fichero no coinciden, el fichero manda:
este documento es la versión legible de esas cinco reglas, no al revés.

## Capas

```
packages/core/src/domain          ← motor, cero dependencias
packages/core/src/application     ← casos de uso + puertos (pendiente, paso 12 de docs/plan.md)
apps/web/src/infrastructure       ← adaptadores: localStorage, RNG, tipos de cambio
apps/web/src/ui                   ← React
```

| Regla | Desde                                                           | Puede importar                                                                                                                                                               |
| ----- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `domain/**`                                                     | solo `domain/**`                                                                                                                                                             |
| 2     | `application/**`                                                | `domain/**`, nada más                                                                                                                                                        |
| 3     | `infrastructure/**`                                             | `application/ports` y `domain/shared`, nunca la UI ni el motor (`engine`, `strategies`, `analytics`, `montecarlo`, `amortization`, `taxes`)                                  |
| 4     | `ui/**`                                                         | `application/dto` y `domain/shared` (`Money`/`Rate`/`Percent`, que son value objects); nunca `domain/engine\|strategies\|analytics\|montecarlo\|amortization\|taxes\|params` |
| 5     | cualquiera salvo `ui/**`, `app/**`, `main.tsx` y `container.ts` | nunca `ui/**`                                                                                                                                                                |

La consecuencia práctica de la regla 1 es que `packages/core/package.json` no
declara ninguna dependencia: si `domain/` necesitara una librería externa, la
regla ya se habría roto antes de que `depcruise` lo detecte.

## Qué va en cada carpeta

- **`domain/shared`**: tipos y aritmética de base (`Money`, `Rate`,
  `CurrencyCode`, `Result<T, E>`) que usa el resto del dominio. No sabe nada de
  escenarios ni de estrategias.
- **`domain/model`**: las entidades que describen un escenario — `Scenario`,
  `Assumptions`, `Salary`, `ContributionPlan`, `Loan`, `StrategyParams` — y
  funciones puras sobre ellas. Son datos planos y serializables: se escriben
  tal cual en `localStorage`, en un `.json` exportado o en un test.
- **`domain/params`**: el catálogo declarativo (`ParamSpec[]`) que describe los
  campos de cada estrategia — clave, tipo de control, límites, claves de i18n.
  La UI recorre esto para generar formularios sin conocer los nombres de las
  estrategias.
- **`domain/amortization`**: fórmulas de amortización (francés, constante) y
  tablas, independientes de que un préstamo se use dentro de una estrategia de
  deuda o solo para mostrar un cuadro.
- **`domain/engine`**: los contratos (`StrategyEngine`, `EngineContext`,
  `EngineState`) y el simulador (`simulator.ts`) que ejecuta el bucle mensual
  llamando a los mismos ganchos, en el mismo orden, para cualquier estrategia.
  El simulador no sabe qué es un bono ni una hipoteca.
- **`domain/strategies`**: un `StrategyEngine` por cada tipo de estrategia
  (`cash`, `bonds`, `equity`, `mixed`, `debtPaydown`). Es la única carpeta que
  conoce el significado financiero de cada producto.
- **`domain/taxes`**: el motor fiscal (`computeTax`) y los presets de
  retenciones/impuestos que las estrategias declaran como hechos imponibles.
- **`domain/analytics`**: métricas derivadas de un `StrategyResult` ya
  simulado — deflactación, TIR, ranking, cruces entre curvas, motor de
  recomendación. No vuelve a simular nada, solo lee `points`/`finalValue`.
- **`domain/montecarlo`**: muestreo GBM (`sampler.ts`, puro: recibe el
  generador uniforme, no lo crea) y agregados por percentil y probabilidad
  sobre varias trayectorias (`aggregate.ts`). `EngineContext.month.
randomMonthlyReturn` es el punto de enganche con el motor: si una
  simulación lo trae, la renta variable lo usa en vez de `expectedReturn` ese
  mes; el resto de estrategias lo ignora.
- **`application`** (pendiente): puertos (`IRandomSource`, `IDateSource`), DTOs
  hacia la UI y los casos de uso (`compareStrategies`, `runMonteCarlo`,
  `validateScenario`) que orquestan el dominio sin añadirle reglas nuevas.
- **`apps/web/src/infrastructure`**: implementaciones concretas de los puertos
  — repositorios de `localStorage`, generador de números aleatorios,
  proveedor de tipos de cambio manuales.
- **`apps/web/src/ui`**: componentes React, formularios generados desde
  `ParamSpec`, gráficos y las pestañas de la app. Solo habla con el dominio a
  través de DTOs.

## Cómo añadir una estrategia nueva

Añadir un producto nuevo (por ejemplo, un plan de pensiones) no toca el
simulador ni la UI genérica. Son tres piezas:

1. **Motor** en `domain/strategies/<nombre>.ts`: un objeto que implementa
   `StrategyEngine` (`domain/engine/contracts.ts`) — `init`, `onMonthStart`,
   `onContribution`, `onMonthEnd`, `onYearEnd`, `onRebalance`, `value`, y los
   ganchos opcionales que necesite (`sell`, `liquidate`, `report`).
2. **Spec** en `domain/params/catalog.ts` (`PARAM_SPECS`): los campos que va a
   pedir el formulario, con sus límites y claves de i18n, más el caso
   correspondiente en `defaultParamsFor`.
3. **Registro** en `domain/strategies/index.ts`: añadir el motor a la lista
   `ENGINES`. `registerAllEngines()` lo da de alta en el `registry.ts` del
   motor, y a partir de ahí el simulador y el comparador lo ofrecen igual que
   a los demás, sin ningún cambio adicional.

## Por qué el dominio no tiene dependencias

`packages/core` no declara dependencias en tiempo de ejecución a propósito:
es la garantía física de que el motor de simulación se puede probar,
razonar y reutilizar (en un Web Worker, en un CLI, en un test) sin arrastrar
React, el DOM o cualquier detalle de la app que lo consuma hoy. La regla 1 de
`dependency-cruiser` hace cumplir esa frontera en cada `npm run lint:deps`, en
vez de dejarla como una convención que se olvida con el primer `import`
cómodo.
