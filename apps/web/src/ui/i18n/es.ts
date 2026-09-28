/**
 * Diccionario en espanol.
 *
 * Cubre solo las claves que la interfaz ya pinta: la pestana Comparador y el
 * andamiaje de navegacion. El resto de claves que emite el dominio (params.*,
 * validation.*, loan.*, ...) se anaden cuando se construya la pestana que las
 * usa, no antes.
 */
export const es: Readonly<Record<string, string>> = {
  'app.title': 'investing-helper',
  'app.tagline':
    'Compara, sobre los mismos datos, si conviene amortizar deuda, bonos, renta variable o cuenta corriente.',

  'nav.comparison': 'Comparador',
  'nav.assumptions': 'Supuestos',
  'nav.debts': 'Deudas',
  'nav.contributions': 'Aportaciones',
  'nav.montecarlo': 'Monte Carlo',
  'nav.scenarios': 'Escenarios',

  'tab.comingSoon': 'Esta pestaña todavía no está construida. Ver docs/plan.md, §5.',

  'scenario.default.name': 'Escenario por defecto',

  'strategy.cash.label': 'Cuenta corriente',
  'strategy.bonds.label': 'Bonos',
  'strategy.equity.label': 'Renta variable',
  'strategy.mixed.label': 'Cartera mixta',
  'strategy.debtPaydown.label': 'Amortizar deuda',

  'comparison.ranking.title': 'Ranking',
  'comparison.ranking.strategy': 'Estrategia',
  'comparison.ranking.finalNominal': 'Patrimonio nominal',
  'comparison.ranking.finalReal': 'Poder de compra',
  'comparison.ranking.irrAnnual': 'TIR anual',
  'comparison.ranking.totalTax': 'Impuestos pagados',
  'comparison.ranking.noIrr': '—',

  'comparison.chart.title': 'Evolución del patrimonio',
  'comparison.chart.nominal': '{label} (nominal)',
  'comparison.chart.real': '{label} (poder de compra)',

  'comparison.crossovers.title': 'Cruces entre estrategias',
  'comparison.crossovers.empty': 'Ninguna estrategia adelanta a otra en este horizonte.',
  'comparison.crossovers.item': '{after} supera a {before} en el mes {month}',

  'comparison.recommendation.title': 'Recomendación',

  'recommendation.headline.winner': '{strategyId} es la mejor opción',
  'recommendation.headline.tie': 'Empate técnico entre {a} y {b}',
  'recommendation.headline.empty': 'Añade al menos una estrategia para comparar',

  'recommendation.reason.winner': 'Es la que más patrimonio real deja al final del horizonte',
  'recommendation.reason.tie': 'La diferencia entre {a} y {b} es menor del 1 %',
  'recommendation.reason.debtBeatsMarket':
    'El tipo del préstamo ({loanRate}) supera a la mejor inversión disponible ({marketRate})',

  'recommendation.caveat.negativeReal':
    'La rentabilidad real es negativa ({netGainReal}): se pierde poder adquisitivo',
  'recommendation.caveat.highTax':
    'Los impuestos se llevan una parte importante de la ganancia ({taxShare})',

  'scenarios.current.title': 'Escenario activo',
  'scenarios.current.nameLabel': 'Nombre',
  'scenarios.current.namePlaceholder': 'Nombre del escenario',
  'scenarios.save': 'Guardar en la biblioteca',
  'scenarios.new': 'Nuevo escenario en blanco',
  'scenarios.export': 'Exportar a JSON',
  'scenarios.import': 'Importar JSON',
  'scenarios.importError': 'No se ha podido importar: {reason}',

  'scenarios.library.title': 'Biblioteca',
  'scenarios.library.empty': 'Todavía no has guardado ningún escenario.',
  'scenarios.library.updatedAt': 'Guardado: {date}',
  'scenarios.library.load': 'Cargar',
  'scenarios.library.duplicate': 'Duplicar',
  'scenarios.library.delete': 'Borrar',
  'scenarios.library.renameLabel': 'Nombre',

  'debts.title': 'Préstamos',
  'debts.add': 'Añadir préstamo',
  'debts.empty': 'No hay préstamos en este escenario.',
  'debts.delete': 'Borrar',
  'debts.field.name': 'Nombre',
  'debts.field.kind': 'Tipo',
  'debts.field.currency': 'Divisa',
  'debts.field.principal': 'Capital',
  'debts.field.annualRate': 'Interés anual (%)',
  'debts.field.termMonths': 'Plazo (meses)',
  'debts.field.system': 'Amortización',
  'debts.field.startMonth': 'Empieza en el mes',
  'debts.field.earlyExitPenaltyRate': 'Penalización cancelación (%)',
  'debts.field.interestDeductible': 'Interés deducible',
  'debts.kind.installment': 'Préstamo a plazo',
  'debts.kind.mortgage': 'Hipoteca',
  'debts.kind.revolving': 'Revolving',
  'debts.system.french': 'Francés (cuota constante)',
  'debts.system.constant': 'Amortización constante',
}
