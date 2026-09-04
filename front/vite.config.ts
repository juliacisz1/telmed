import {defineConfig, loadEnv} from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({command, mode}) => {
  const env = loadEnv(mode, process.cwd(), '');

  if (command === 'build' && !env.VITE_API_BASEURL) {
    throw new Error(
        'Brak zmiennej VITE_API_BASEURL. Ustaw adres backendu w pliku .env albo w środowisku CI przed uruchomieniem `npm run build`.'
    );
  }

  return {
    plugins: [react()],
    optimizeDeps: {
      include: ['react-use-websocket'],
    },
    server: {
      proxy: {
        '/api': {
          target: env.BACKEND_URL || 'http://127.0.0.1:8000',
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
})