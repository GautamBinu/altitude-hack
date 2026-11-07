import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.PORT || '3000'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
    },
    server: {
      // host: true lets a phone on the same Wi-Fi open the dev server by the laptop's IP address.
      host: true,
      port: 5173,
      proxy: {
        // The API, the realtime stream and the session cookies all stay same-origin in dev.
        '/api': { target: `http://localhost:${apiPort}` },
        // Pictures uploaded from the dashboard.
        '/uploads': { target: `http://localhost:${apiPort}` },
      },
    },
    build: { outDir: 'dist' },
    test: {
      include: ['server/**/*.test.ts', 'shared/**/*.test.ts'],
      environment: 'node',
    },
  }
})
