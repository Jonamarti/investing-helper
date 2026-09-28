/** Resultado de `runMonteCarlo` para una estrategia de renta variable. */
export interface MonteCarloResultDto {
  readonly strategyId: string
  readonly p5: number
  readonly p25: number
  readonly p50: number
  readonly p75: number
  readonly p95: number
  /** `null` si no hay otra estrategia con la que comparar. */
  readonly probBeatsBest: number | null
  readonly probBeatsInflation: number
  readonly finalValues: readonly number[]
}
