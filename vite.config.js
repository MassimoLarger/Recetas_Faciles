import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: './cliente',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
})