import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { runMigrations } from './data/migrations'

// Run migrations before the app mounts. If something fails here, the
// ErrorBoundary below cannot catch it (it's synchronous infra), so the
// runMigrations function is designed to never throw — it records failure
// in app-meta.history and returns, letting the app continue. Consumers
// check meta.history and surface errors through normal UI.
runMigrations().catch((err) => {
  // Truly unexpected — runMigrations itself shouldn't throw, but guard anyway.
  // eslint-disable-next-line no-console
  console.error('Migration runner threw:', err)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
