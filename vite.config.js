import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    host: true,
    port: 3000,

    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },

    fs: {
      allow: ['..']
    },

    watch: {
      ignored: [
        '**/env/**',
        '**/venv/**',
        '**/__pycache__/**',
        '**/site-packages/**'
      ]
    }
  },

  assetsInclude: ['**/*.onnx', '**/*.wasm'],

  publicDir: 'public',

  optimizeDeps: {
    exclude: [
      'onnxruntime-web',
      'virtual:cc-init'
    ]
  },

  build: {
    rollupOptions: {
      external: []
    }
  },

  define: {
    global: 'globalThis',
  },

  worker: {
    format: 'es'
  }
})