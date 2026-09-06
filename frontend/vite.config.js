import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.BACKEND_URL || env.VITE_BACKEND_URL || process.env.BACKEND_URL || process.env.VITE_BACKEND_URL || '';

  return {
    plugins: [react()],
    server: {
      host: true,
    },
    define: {
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(backendUrl),
      'import.meta.env.BACKEND_URL': JSON.stringify(backendUrl),
    },
  };
});
