import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The site is served from the root of a custom domain (phrase.rakeshvadnala.in),
// so the base path is "/". If you host under https://<user>.github.io/phrase/
// instead, build with:  VITE_BASE=/phrase/ npm run build
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), tailwindcss()],
  // harper.js locates its WebAssembly binary with `new URL(..., import.meta.url)`,
  // which must not be rewritten by the dev-server dependency optimizer.
  optimizeDeps: { exclude: ['harper.js'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
