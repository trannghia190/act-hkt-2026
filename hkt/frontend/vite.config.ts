import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const CORE_URL = process.env.VITE_CORE_URL || 'http://localhost:8080';
const AI_FACE_URL = process.env.VITE_AI_FACE_URL || 'http://localhost:8000';

// Vite 5.4.12+ chặn Host lạ. Cho phép các domain của tunnel để mở app qua
// internet; thêm domain riêng bằng VITE_ALLOWED_HOSTS=a.com,b.com
const EXTRA_ALLOWED_HOSTS = (process.env.VITE_ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    allowedHosts: [
      '.trycloudflare.com',
      '.ngrok-free.app',
      '.ngrok-free.dev',
      '.ngrok.app',
      '.ngrok.io',
      '.loca.lt',
      '.ts.net',
      ...EXTRA_ALLOWED_HOSTS,
    ],
    proxy: {
      // AI Face Service (FastAPI): /ai-face/api/v1/face/... -> /api/v1/face/...
      '/ai-face': {
        target: AI_FACE_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai-face/, ''),
      },
      // Core Service (Spring Boot): /api/v1/... -> Core :8080/api/v1/...
      '/api': {
        target: CORE_URL,
        changeOrigin: true,
        // Bỏ Origin/Referer khi proxy để backend không áp CORS theo domain tunnel
        // (ngrok/cloudflare). Auth vẫn do JWT trong X-Auth-Token đảm bảo.
        configure: (proxy: any) => {
          proxy.on('proxyReq', (proxyReq: any) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        },
      },
    },
  },
});
