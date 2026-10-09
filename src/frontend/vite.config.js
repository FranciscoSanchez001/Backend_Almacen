import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pruebas con Vitest: entorno de navegador simulado (jsdom) y una URL de API fija,
  // para que las pruebas no dependan del .env de cada máquina.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    env: { VITE_API_URL: 'http://api.pruebas' },
    css: false,
    // Los formularios largos se rellenan tecla por tecla con userEvent; con todos los
    // archivos en paralelo, el límite de 5 s por defecto se queda corto.
    testTimeout: 20000,
  },
})
