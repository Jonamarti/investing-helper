/** English dictionary, same keys as `es.ts`. See that file for scope notes. */
export const en: Readonly<Record<string, string>> = {
  'app.title': 'investing-helper',
  'app.tagline':
    'Compare, on the same data, whether it pays off to pay down debt, bonds, equities or cash.',

  'nav.comparison': 'Comparison',
  'nav.assumptions': 'Assumptions',
  'nav.debts': 'Debts',
  'nav.contributions': 'Contributions',
  'nav.montecarlo': 'Monte Carlo',
  'nav.scenarios': 'Scenarios',

  'tab.comingSoon': 'This tab is not built yet. See docs/plan.md, §5.',

  'scenario.default.name': 'Default scenario',

  'strategy.cash.label': 'Cash account',
  'strategy.bonds.label': 'Bonds',
  'strategy.equity.label': 'Equities',
  'strategy.mixed.label': 'Mixed portfolio',
  'strategy.debtPaydown.label': 'Pay down debt',

  'comparison.ranking.title': 'Ranking',
  'comparison.ranking.strategy': 'Strategy',
  'comparison.ranking.finalNominal': 'Nominal wealth',
  'comparison.ranking.finalReal': 'Purchasing power',
  'comparison.ranking.irrAnnual': 'Annual IRR',
  'comparison.ranking.totalTax': 'Tax paid',
  'comparison.ranking.noIrr': '—',

  'comparison.chart.title': 'Wealth over time',
  'comparison.chart.nominal': '{label} (nominal)',
  'comparison.chart.real': '{label} (purchasing power)',

  'comparison.crossovers.title': 'Crossovers between strategies',
  'comparison.crossovers.empty': 'No strategy overtakes another over this horizon.',
  'comparison.crossovers.item': '{after} overtakes {before} in month {month}',

  'comparison.recommendation.title': 'Recommendation',

  'recommendation.headline.winner': '{strategyId} is the best option',
  'recommendation.headline.tie': 'Technical tie between {a} and {b}',
  'recommendation.headline.empty': 'Add at least one strategy to compare',

  'recommendation.reason.winner': 'It leaves the most real wealth at the end of the horizon',
  'recommendation.reason.tie': 'The difference between {a} and {b} is under 1%',
  'recommendation.reason.debtBeatsMarket':
    "The loan's rate ({loanRate}) beats the best available investment ({marketRate})",

  'recommendation.caveat.negativeReal':
    'Real return is negative ({netGainReal}): purchasing power is being lost',
  'recommendation.caveat.highTax': 'Taxes take a large share of the gain ({taxShare})',

  'scenarios.current.title': 'Active scenario',
  'scenarios.current.nameLabel': 'Name',
  'scenarios.current.namePlaceholder': 'Scenario name',
  'scenarios.save': 'Save to library',
  'scenarios.new': 'Blank new scenario',
  'scenarios.export': 'Export to JSON',
  'scenarios.import': 'Import JSON',
  'scenarios.importError': 'Could not import: {reason}',

  'scenarios.library.title': 'Library',
  'scenarios.library.empty': "You haven't saved any scenario yet.",
  'scenarios.library.updatedAt': 'Saved: {date}',
  'scenarios.library.load': 'Load',
  'scenarios.library.duplicate': 'Duplicate',
  'scenarios.library.delete': 'Delete',
  'scenarios.library.renameLabel': 'Name',

  'debts.title': 'Loans',
  'debts.add': 'Add loan',
  'debts.empty': 'There are no loans in this scenario.',
  'debts.delete': 'Delete',
  'debts.field.name': 'Name',
  'debts.field.kind': 'Kind',
  'debts.field.currency': 'Currency',
  'debts.field.principal': 'Principal',
  'debts.field.annualRate': 'Annual rate (%)',
  'debts.field.termMonths': 'Term (months)',
  'debts.field.system': 'Amortization',
  'debts.field.startMonth': 'Starts in month',
  'debts.field.earlyExitPenaltyRate': 'Early exit penalty (%)',
  'debts.field.interestDeductible': 'Interest deductible',
  'debts.kind.installment': 'Installment loan',
  'debts.kind.mortgage': 'Mortgage',
  'debts.kind.revolving': 'Revolving',
  'debts.system.french': 'French (constant payment)',
  'debts.system.constant': 'Constant amortization',
}
