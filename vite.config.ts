import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart({
      spa: {
        enabled: true,
        // Cloudflare の not_found_handling が返すのは index.html なので、
        // シェルの出力先を既定の /_shell からそこへ移す
        prerender: {
          outputPath: '/index',
        },
      },
    }),
    // react の plugin は start の plugin より後に置く必要がある
    viteReact(),
  ],
})
