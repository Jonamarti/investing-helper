import { describe, expect, it } from 'vitest'

import {
  annualFreeMoney,
  annualEmployerCost,
  assertSalaryIsSane,
  baselineFreeMonthly,
  freeMonthlyInMonth,
  grossFromNet,
  hasExtraPay,
  netSalaryInMonth,
  paymentsPerYear,
  salaryGrowthFactor,
  validateExtraPayMonths,
  type Salary,
} from '../../../../src/domain/model'

const base: Salary = {
  netMonthly: 2000,
  fixedCostsMonthly: 1200,
  extraPayMonths: [7, 12],
  growthAnnual: 0.02,
  employeeContributionRate: 0,
}

describe('salaryGrowthFactor', () => {
  it('es 1 durante el primer año', () => {
    expect(salaryGrowthFactor(base, 0)).toBe(1)
    expect(salaryGrowthFactor(base, 11)).toBe(1)
  })

  it('aplica el crecimiento en el dia del año', () => {
    expect(salaryGrowthFactor(base, 12)).toBeCloseTo(1.02, 10)
    expect(salaryGrowthFactor(base, 24)).toBeCloseTo(1.02 ** 2, 10)
  })

  it('tolera un crecimiento negativo', () => {
    const shrinking = { ...base, growthAnnual: -0.01 }
    expect(salaryGrowthFactor(shrinking, 24)).toBeCloseTo(0.99 ** 2, 10)
  })
})

describe('hasExtraPay', () => {
  it('detecta los meses de paga extra', () => {
    // El escenario arranca en enero, asi que el mes 6 es julio y el 11 diciembre.
    expect(hasExtraPay(base, 6)).toBe(true)
    expect(hasExtraPay(base, 11)).toBe(true)
    expect(hasExtraPay(base, 0)).toBe(false)
  })

  it('se repite cada año', () => {
    expect(hasExtraPay(base, 18)).toBe(true)
    expect(hasExtraPay(base, 17)).toBe(false)
  })
})

describe('netSalaryInMonth', () => {
  it('es el neto base sin pagas extra', () => {
    expect(netSalaryInMonth(base, 0)).toBe(2000)
  })

  it('dobra en los meses de paga extra', () => {
    expect(netSalaryInMonth(base, 6)).toBe(4000)
  })

  it('acumula el crecimiento anual', () => {
    expect(netSalaryInMonth(base, 12)).toBeCloseTo(2040, 10)
  })
})

describe('freeMonthlyInMonth', () => {
  it('resta los gastos fijos', () => {
    expect(freeMonthlyInMonth(base, 0)).toBe(800)
  })

  it('duplica el dinero libre en las pagas extra', () => {
    expect(freeMonthlyInMonth(base, 6)).toBe(2800)
  })

  it('puede ser negativo si los fijos superan el neto', () => {
    const broke = { ...base, fixedCostsMonthly: 2500 }
    expect(freeMonthlyInMonth(broke, 0)).toBe(-500)
  })

  it('la linea base no paga dobles', () => {
    expect(baselineFreeMonthly(base, 6)).toBe(800)
  })
})

describe('nomina anual', () => {
  it('cuenta las pagas del año', () => {
    expect(paymentsPerYear(base)).toBe(14)
    expect(paymentsPerYear({ ...base, extraPayMonths: [] })).toBe(12)
  })

  it('el sueldo libre anual descuenta doce meses de fijos', () => {
    // 2000 x 14 pagas - 1200 x 12.
    expect(annualFreeMoney(base, 0)).toBe(28_000 - 14_400)
  })

  it('aplica el crecimiento del año', () => {
    expect(annualFreeMoney(base, 1)).toBeCloseTo(28_000 * 1.02 - 14_400, 8)
  })
})

describe('grossFromNet', () => {
  it('con cotizacion cero el bruto es el neto', () => {
    expect(grossFromNet(base)).toBe(2000)
  })

  it('descuenta la parte del trabajador', () => {
    expect(grossFromNet({ ...base, employeeContributionRate: 0.2 })).toBe(2500)
  })

  it('rechaza una cotizacion del 100 %', () => {
    expect(() => grossFromNet({ ...base, employeeContributionRate: 1 })).toThrow(RangeError)
  })

  it('calcula el coste anual para la empresa', () => {
    expect(annualEmployerCost({ ...base, employeeContributionRate: 0.2 })).toBe(35_000)
  })
})

describe('validateExtraPayMonths', () => {
  it('acepta una lista valida', () => {
    expect(validateExtraPayMonths([1, 6, 12])).toEqual([])
  })

  it('rechaza meses fuera de rango', () => {
    expect(validateExtraPayMonths([0, 13])).toHaveLength(2)
  })

  it('rechaza meses repetidos', () => {
    expect(validateExtraPayMonths([3, 3])).toEqual([
      'salary.extraPayMonths: el mes 3 esta repetido',
    ])
  })
})

describe('assertSalaryIsSane', () => {
  it('acepta un sueldo normal', () => {
    expect(() => assertSalaryIsSane(base)).not.toThrow()
  })

  it('rechaza importes negativos', () => {
    expect(() => assertSalaryIsSane({ ...base, netMonthly: -1 })).toThrow()
    expect(() => assertSalaryIsSane({ ...base, fixedCostsMonthly: -1 })).toThrow()
  })
})
