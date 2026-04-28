import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load from .env files for local dev
    const env = loadEnv(mode, '.', '');

    // The NVIDIA API key is read server-side in api/chat.ts — never exposed to the client.
    // Only the model name is baked into the client bundle (for display + request body).
    const model = process.env.NVIDIA_MODEL || env.NVIDIA_MODEL || 'minimaxai/minimax-m2.7';

    console.log('[Vite Build] NVIDIA_MODEL:', model);

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.NVIDIA_MODEL': JSON.stringify(model)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
