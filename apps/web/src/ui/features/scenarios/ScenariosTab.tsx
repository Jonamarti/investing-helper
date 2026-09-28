import { useRef, useState } from 'react'
import type { ScenarioIndexEntry } from '../../../infrastructure/persistence/localStorageRepo'
import { useTranslation, type Locale } from '../../i18n'
import { useScenarioStore } from '../../store/scenarioStore'

const PRIMARY_BUTTON =
  'rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700'
const SECONDARY_BUTTON =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50'
const DANGER_BUTTON =
  'rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50'

function formatDate(iso: string, locale: Locale): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

interface LibraryRowProps {
  readonly entry: ScenarioIndexEntry
}

function LibraryRow({ entry }: LibraryRowProps) {
  const { locale, t } = useTranslation()
  const [name, setName] = useState(entry.name)
  const load = useScenarioStore((s) => s.loadFromLibrary)
  const rename = useScenarioStore((s) => s.renameInLibrary)
  const duplicate = useScenarioStore((s) => s.duplicateInLibrary)
  const remove = useScenarioStore((s) => s.deleteFromLibrary)

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-3 last:border-0">
      <label className="sr-only" htmlFor={`rename-${entry.id}`}>
        {t('scenarios.library.renameLabel')}
      </label>
      <input
        id={`rename-${entry.id}`}
        className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== entry.name) {
            rename(entry.id, name.trim())
          }
        }}
      />
      <span className="text-xs text-slate-500">
        {t('scenarios.library.updatedAt', { date: formatDate(entry.updatedAt, locale) })}
      </span>
      <div className="flex gap-2">
        <button type="button" className={SECONDARY_BUTTON} onClick={() => load(entry.id)}>
          {t('scenarios.library.load')}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON}
          onClick={() => duplicate(entry.id, `${entry.name} (2)`)}
        >
          {t('scenarios.library.duplicate')}
        </button>
        <button type="button" className={DANGER_BUTTON} onClick={() => remove(entry.id)}>
          {t('scenarios.library.delete')}
        </button>
      </div>
    </li>
  )
}

export function ScenariosTab() {
  const { t } = useTranslation()
  const scenario = useScenarioStore((s) => s.scenario)
  const library = useScenarioStore((s) => s.library)
  const saveCurrentAs = useScenarioStore((s) => s.saveCurrentAs)
  const startNewScenario = useScenarioStore((s) => s.startNewScenario)
  const exportCurrentToJson = useScenarioStore((s) => s.exportCurrentToJson)
  const importScenarioFromJsonText = useScenarioStore((s) => s.importScenarioFromJsonText)

  const [name, setName] = useState(() => t(scenario.nameKey))
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cargar, duplicar o importar cambian el escenario activo desde fuera de
  // este input: sin esto, el nombre en pantalla se quedaria con el del
  // escenario anterior. Ajustar el estado durante el render (en vez de en un
  // efecto) es el patron que recomienda React para "resetear al cambiar una
  // prop": https://react.dev/learn/you-might-not-need-an-effect
  const [scenarioIdShown, setScenarioIdShown] = useState(scenario.id)
  if (scenario.id !== scenarioIdShown) {
    setScenarioIdShown(scenario.id)
    const entry = library.find((libraryEntry) => libraryEntry.id === scenario.id)
    setName(entry?.name ?? t(scenario.nameKey))
  }

  const handleImportFile = (file: File): void => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = importScenarioFromJsonText(String(reader.result))
      setImportError(result.ok ? null : result.reason)
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-600">{t('scenarios.current.title')}</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="current-scenario-name">
              {t('scenarios.current.nameLabel')}
            </label>
            <input
              id="current-scenario-name"
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              placeholder={t('scenarios.current.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={() => name.trim() && saveCurrentAs(name.trim())}
          >
            {t('scenarios.save')}
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => startNewScenario()}>
            {t('scenarios.new')}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => downloadJson(`${name || scenario.id}.json`, exportCurrentToJson())}
          >
            {t('scenarios.export')}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('scenarios.import')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                handleImportFile(file)
              }
              e.target.value = ''
            }}
          />
        </div>
        {importError && (
          <p className="mt-2 text-sm text-red-700">
            {t('scenarios.importError', { reason: importError })}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-600">{t('scenarios.library.title')}</h3>
        {library.length === 0 ? (
          <p className="text-sm text-slate-500">{t('scenarios.library.empty')}</p>
        ) : (
          <ul>
            {library.map((entry) => (
              <LibraryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
