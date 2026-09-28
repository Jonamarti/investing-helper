import { ComparisonTab } from '../ui/features/comparison/ComparisonTab'
import { DEFAULT_LOCALE, LocaleContext, useTranslation } from '../ui/i18n'
import { DEFAULT_TAB, useHashTab } from './hashRouter'

const TABS = [
  'comparison',
  'assumptions',
  'debts',
  'contributions',
  'montecarlo',
  'scenarios',
] as const
type TabId = (typeof TABS)[number]

function ComingSoon() {
  const { t } = useTranslation()
  return <p className="text-slate-500">{t('tab.comingSoon')}</p>
}

function TabContent({ tab }: { readonly tab: string }) {
  if ((tab as TabId) === 'comparison') {
    return <ComparisonTab />
  }
  return <ComingSoon />
}

function AppShell() {
  const { t } = useTranslation()
  const [tab, setTab] = useHashTab()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">{t('app.title')}</h1>
        <p className="text-sm text-slate-500">{t('app.tagline')}</p>
      </header>
      <nav className="flex gap-1 border-b border-slate-200 bg-white px-6">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              (id === tab || (id === DEFAULT_TAB && !TABS.includes(tab as TabId))
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800') +
              ' border-b-2 px-3 py-2 text-sm font-medium'
            }
          >
            {t(`nav.${id}`)}
          </button>
        ))}
      </nav>
      <main className="p-6">
        <TabContent tab={tab} />
      </main>
    </div>
  )
}

export function App() {
  return (
    <LocaleContext value={DEFAULT_LOCALE}>
      <AppShell />
    </LocaleContext>
  )
}
