import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load from .env files for local dev
    const env = loadEnv(mode, '.', '');

    // Use process.env for Vercel builds (injected at build time), fallback to loadEnv for local
    const apiKey = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.OPENROUTER_API_KEY': JSON.stringify(apiKey),
        'process.env.OPENROUTER_MODEL': JSON.stringify(model)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
