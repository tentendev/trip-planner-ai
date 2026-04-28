import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load from .env files for local dev
    const env = loadEnv(mode, '.', '');

    // Use process.env for Vercel builds (injected at build time), fallback to loadEnv for local
    const apiKey = process.env.NVIDIA_API_KEY || env.NVIDIA_API_KEY || '';
    const model = process.env.NVIDIA_MODEL || env.NVIDIA_MODEL || 'minimaxai/minimax-m2.7';

    // Debug: Log env vars during build (will show in Vercel build logs)
    console.log('[Vite Build] NVIDIA_MODEL:', model);
    console.log('[Vite Build] NVIDIA_API_KEY set:', !!apiKey);

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.NVIDIA_API_KEY': JSON.stringify(apiKey),
        'process.env.NVIDIA_MODEL': JSON.stringify(model)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
