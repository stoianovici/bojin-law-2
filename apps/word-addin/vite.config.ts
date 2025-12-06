import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
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
