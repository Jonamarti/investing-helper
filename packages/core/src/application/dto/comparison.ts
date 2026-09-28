/**
 * DTOs de la comparacion de estrategias.
 *
 * `ui/**` puede importar de aqui (regla 4 de `docs/arquitectura.md`), pero no
 * de `domain/engine|analytics`: por eso estas formas se declaran aparte, aunque
 * hoy coincidan campo a campo con `ValuePoint`/`StrategyMetrics`/etc. Quien las
 * rellena es `application/usecases/compareStrategies.ts`.
 */
export interface ValuePointDto {
  readonly monthIndex: number
  readonly date: string
  readonly contribution: number
  readonly cumulativeContribution: number
  readonly value: number
  readonly cash: number
  readonly position: number
  readonly grossReturn: number
  readonly tax: number
  readonly netReturn: number
}

/** Un punto de la serie real (deflactada a poder de compra del mes 0). */
export interface RealPointDto {
  readonly monthIndex: number
  readonly date: string
  readonly value: number
}

export interface StrategyMetricsDto {
  readonly finalNominal: number
  readonly finalReal: number
  readonly totalContributed: number
  readonly netGain: number
  readonly netGainReal: number
  readonly irrAnnual: number | null
  readonly totalTax: number
  readonly breakevenMonth: number | null
}

export interface RecommendationItemDto {
  readonly key: string
  readonly params?: Readonly<Record<string, number | string>>
}

export interface RecommendationDto {
  readonly headlineKey: string
  readonly reasons: readonly RecommendationItemDto[]
  readonly caveats: readonly RecommendationItemDto[]
}

export interface CrossoverDto {
  readonly leaderBefore: string
  readonly leaderAfter: string
  readonly monthIndex: number
}

export interface StrategyComparisonDto {
  readonly strategyId: string
  readonly type: string
  readonly labelKey: string
  readonly points: readonly ValuePointDto[]
  /** La misma serie, en poder de compra del mes 0 (para el grafico). */
  readonly realPoints: readonly RealPointDto[]
  readonly metrics: StrategyMetricsDto
}

export interface ComparisonResultDto {
  readonly horizonMonths: number
  readonly strategies: readonly StrategyComparisonDto[]
  /** Ids en el orden del ranking: primero el que mas patrimonio real deja. */
  readonly ranking: readonly string[]
  readonly crossovers: readonly CrossoverDto[]
  readonly recommendation: RecommendationDto
}
