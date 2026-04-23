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
})
