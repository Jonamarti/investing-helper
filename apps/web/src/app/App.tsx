import { DEFAULT_CURRENCY, roundMoney, type Money } from '@investing-helper/core'

/**
 * Marcador de fase 0: comprueba que React monta, que Tailwind se inyecta y que el
 * barrel de `@investing-helper/core` se resuelve dentro del bundle del navegador.
 *
 *Ese ultimo punto es el que de verdad importa aqui: `packages/core` no declara
 * dependencias y no toca el DOM, asi que deberia empaquetarse sin tocar nada.
 * Si este import llegara a fallar en el navegador, el motor no es portable y hay
 * que arrancarlo por otra via.
 *
 * Se reemplaza por la aplicacion real en la fase de shell.
 */
function smoke(): Money {
  return roundMoney(1234.5678, 2)
}

export function App() {
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <h1 className="text-2xl font-semibold">investing-helper</h1>
      <p className="mt-2 text-slate-600">
        App estatica, sin backend. Divisa por defecto: {DEFAULT_CURRENCY}. Motor enlazado: {smoke()}
      </p>
    </main>
  )
}
