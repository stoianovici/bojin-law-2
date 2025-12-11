import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3005, // Changed from 3001 to avoid conflict with legacy-import (3001) and AI service (3002)
    https: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        taskpane: 'taskpane.html',
        commands: 'commands.html',
      },
    },
  },
});
