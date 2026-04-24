import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { runMigrations } from './data/migrations'
import { hydrateStore } from './data/store/hydration'

/**
 * App bootstrap sequence. Each step must complete before the next.
 *
 *   1. runMigrations — advance the stored schema if needed. Never throws;
 *      failures land in app-meta.history and are surfaced by
 *      ErrorBoundary if the app then crashes.
 *   2. hydrateStore — pre-read every managed big-store key from the
 *      active adapter (localStorage today; IndexedDB in a future
 *      commit) into an in-memory cache. Must complete before React
 *      mounts so useLocalStorage can read synchronously.
 *   3. createRoot().render — mount the app.
 *
 * If hydration itself fails, we still mount the app — useLocalStorage
 * will fall back to fallback values. The ErrorBoundary catches any
 * downstream crash and offers a data-export recovery UI.
 */
async function boot() {
  try {
    await runMigrations()
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Migration runner threw:', err)
  }

  try {
    await hydrateStore()
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Store hydration failed — falling back to fallback values:', err)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}

boot()
