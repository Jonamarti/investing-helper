import { useEffect, useState } from 'react'

/**
 * Router de hash, sin estado del escenario en la URL (ver docs/plan.md, §0.1):
 * `#/<tab>` es toda la ruta, y GitHub Pages nunca ve una URL que no sepa
 * servir porque el servidor solo ve `index.html`.
 */
export const DEFAULT_TAB = 'comparison'

function readTab(): string {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return hash || DEFAULT_TAB
}

export function useHashTab(): readonly [string, (tab: string) => void] {
  const [tab, setTabState] = useState(readTab)

  useEffect(() => {
    const onHashChange = (): void => setTabState(readTab())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const setTab = (next: string): void => {
    window.location.hash = `#/${next}`
  }

  return [tab, setTab]
}
