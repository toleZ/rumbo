import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Explicit 127.0.0.1 (not just 'localhost') so the dev server is reachable at
    // that literal address — required for the Spotify OAuth flow, since Spotify
    // rejects "localhost" as a redirect URI and the OAuth CSRF cookie must be
    // scoped to the same hostname used throughout (see server/.env.example).
    host: '127.0.0.1',
    proxy: {
      '/trpc': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/api': {
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
          if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype') || id.includes('unified') || id.includes('micromark') || id.includes('mdast') || id.includes('hast') || id.includes('vfile')) return 'vendor-markdown'
        },
      },
    },
  },
})
