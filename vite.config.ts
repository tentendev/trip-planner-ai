import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    // Load from .env files for local dev
    const env = loadEnv(mode, '.', '');

    // API keys are read server-side in api/chat.ts — never exposed to the client.
    // Only the display model name is baked into the client bundle.
    // OpenRouter is the primary provider; NVIDIA is the fallback.
    const orModel = process.env.OPENROUTER_MODEL || env.OPENROUTER_MODEL || '';
    const nvModel = process.env.NVIDIA_MODEL || env.NVIDIA_MODEL || '';
    const orKey = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || '';
    const displayModel =
      (orKey ? orModel : '') || (nvModel || '') || orModel || 'minimax/minimax-m2.7';

    console.log('[Vite Build] LLM display model:', displayModel);

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.LLM_DISPLAY_MODEL': JSON.stringify(displayModel)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
