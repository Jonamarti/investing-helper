import { describe, expect, it } from 'vitest'

import { translate } from '../../../../src/ui/i18n'

describe('translate', () => {
  it('devuelve el texto para una clave conocida, en cada idioma', () => {
    expect(translate('es', 'nav.comparison')).toBe('Comparador')
    expect(translate('en', 'nav.comparison')).toBe('Comparison')
  })

  it('interpola los parametros de la plantilla', () => {
    expect(translate('es', 'recommendation.headline.tie', { a: 'A', b: 'B' })).toBe(
      'Empate técnico entre A y B',
    )
  })

  it('una clave sin traduccion se devuelve tal cual', () => {
    expect(translate('es', 'no.existe.esta.clave')).toBe('no.existe.esta.clave')
  })

  it('un parametro que falta en los datos deja el placeholder sin resolver', () => {
    expect(translate('es', 'recommendation.headline.tie', { a: 'A' })).toContain('{b}')
  })

  it('sin parametros, una plantilla con placeholders no revienta', () => {
    expect(translate('es', 'recommendation.headline.tie')).toBe('Empate técnico entre {a} y {b}')
  })
})
