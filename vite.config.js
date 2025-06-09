import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  root: __dirname, // Absolute path to frontend folder
  publicDir: path.join(__dirname, 'public'),
  server: {
    port: 3000,
    strictPort: true,
    open: '/index.html' // Force open this file
  }
});