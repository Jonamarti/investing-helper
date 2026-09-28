import { useScenarioStore } from '../../store/scenarioStore'
import { CrossoverList } from './CrossoverList'
import { NetWorthChart } from './NetWorthChart'
import { RankingTable } from './RankingTable'
import { RecommendationPanel } from './RecommendationPanel'

export function ComparisonTab() {
  const scenario = useScenarioStore((state) => state.scenario)
  const comparison = useScenarioStore((state) => state.comparison)
  const currency = scenario.baseCurrency

  return (
    <div className="flex flex-col gap-6">
      <RecommendationPanel comparison={comparison} currency={currency} />
      <RankingTable comparison={comparison} currency={currency} />
      <NetWorthChart comparison={comparison} currency={currency} />
      <CrossoverList comparison={comparison} />
    </div>
  )
}
