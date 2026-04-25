import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
  },
  define: {
    // Exposed as import.meta.env.APP_VERSION in the app bundle so
    // the pre-update nag can detect version changes.
    'import.meta.env.APP_VERSION': JSON.stringify(pkg.version),
  },
  build: {
    // Phase 5.5 — manual chunks for the heaviest third-party libs.
    // Splits the main bundle from ~1.5 MB to a set of cacheable chunks:
    //
    //   recharts        — every chart component (Dashboard, Charts,
    //                      TransactionLog spark bar, etc.)
    //   pdf             — jspdf + html2canvas, only loaded when the
    //                      user opens the PDF/share modal
    //   dnd             — @dnd-kit/* for HoldingsTable reorder
    //   react           — react + react-dom split out so unrelated
    //                      app code changes don't bust react's cache
    //
    // Side effect: the file-size warning at 500 kB goes away. We also
    // raise the limit modestly so a future small overshoot doesn't
    // trip CI without warning.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // We don't carve out a 'react' chunk: rollup co-locates it with
        // its only consumer (the main app bundle) and emits a 0-byte file
        // when forced. The other splits below have non-trivial bytes and
        // are loaded via dedicated component paths so the cache benefit
        // is real.
        manualChunks: {
          recharts: ['recharts'],
          pdf: ['jspdf', 'html2canvas'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
})
