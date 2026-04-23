import path from 'node:path'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@/*': 'src/*',
      '@components/*': 'src/components/*',
      '@features/*': 'src/features/*',
      '@hooks/*': 'src/hooks/*',
      '@routes/*': 'src/routes/*',
      '@shared': path.resolve(__dirname, '../server/types'),
    },
  },
  plugins: [
    tailwindcss(),
    devtools(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})

export default config
