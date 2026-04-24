import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { runMigrations } from './data/migrations'
import { hydrateStore, setAdapter } from './data/store/hydration'
import { IndexedDbAdapter } from './data/store/indexedDbAdapter'
import { LocalStorageAdapter } from './data/store/localStorageAdapter'
import { readAppMeta, updateAppMeta } from './data/schema'

/**
 * App bootstrap sequence. Each step must complete before the next.
 *
 *   1. runMigrations — advance the stored schema if needed. Never throws;
 *      failures land in app-meta.history and are surfaced by the
 *      ErrorBoundary if the app then crashes.
 *   2. selectAdapter — pick localStorage or IndexedDB based on the
 *      user's saved preference in app-meta.dataBackend. If IDB is
 *      unavailable for any reason (private mode, disabled, init error),
 *      we transparently fall back to localStorage and correct the flag
 *      so the app stays functional.
 *   3. hydrateStore — pre-read every managed big-store key from the
 *      active adapter into an in-memory cache. Must complete before
 *      React mounts so useLocalStorage can read synchronously.
 *   4. createRoot().render — mount the app.
 *
 * If hydration itself fails, we still mount the app — useLocalStorage
 * will fall back to default values. The ErrorBoundary catches any
 * downstream crash and offers a data-export recovery UI.
 */
async function selectAdapter(): Promise<void> {
  const meta = readAppMeta()
  if (meta.dataBackend !== 'indexedDB') {
    setAdapter(new LocalStorageAdapter())
    return
  }
  try {
    const idb = new IndexedDbAdapter()
    await idb.init()
    setAdapter(idb)
  } catch (err) {
    // IDB unavailable — fall back to LS and correct the flag so next
    // boot doesn't retry. User's data is still safe in localStorage.
    // eslint-disable-next-line no-console
    console.warn('IndexedDB unavailable, falling back to localStorage:', err)
    updateAppMeta({ dataBackend: 'localStorage' })
    setAdapter(new LocalStorageAdapter())
  }
}

async function boot() {
  try {
    await runMigrations()
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Migration runner threw:', err)
  }

  try {
    await selectAdapter()
    await hydrateStore()
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Store hydration failed — falling back to default values:', err)
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
