/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      // Force relative asset paths so builds work on GitHub Pages regardless of
      // the deploy path. Overrides the CI preview job's --base=/pr-N/ flag,
      // which would otherwise produce asset URLs missing the repo prefix.
      name: 'force-relative-base',
      config: () => ({ base: './' }),
    },
  ],
  base: '/caravan-route-weather/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
