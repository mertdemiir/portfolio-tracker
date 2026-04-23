import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Isolate each test so localStorage mocks don't leak between files
    isolate: true,
  },
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify('test'),
  },
});
