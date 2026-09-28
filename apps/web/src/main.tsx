import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Registra los motores antes de que nada intente simular: `App` (via el
// store) llama a `compareStrategies` en cuanto se importa, no solo al montar.
import './container'
import { App } from './app/App'
import './styles.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Falta el contenedor #root en index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
