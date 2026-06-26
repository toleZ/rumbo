import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/trpc': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'vendor-editor'
          if (id.includes('@dnd-kit')) return 'vendor-dnd'
          if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react'
          if (id.includes('@tanstack') || id.includes('@trpc')) return 'vendor-query'
          if (id.includes('motion') || id.includes('lucide') || id.includes('react-hot-toast')) return 'vendor-ui'
        },
      },
    },
  },
})
