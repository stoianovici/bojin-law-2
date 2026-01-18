import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Check if SSL certs exist (only needed for local dev)
const certPath = path.resolve(__dirname, 'certs/localhost+2.pem');
const keyPath = path.resolve(__dirname, 'certs/localhost+2-key.pem');
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/word-addin/' : '/',
  server: {
    port: 3005,
    // Only use HTTPS in dev mode with certs (not needed for production build)
    https: hasCerts
      ? {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      : undefined,
    // Allow connections from Office (localhost and 127.0.0.1)
    host: true,
  },
  // Serve public directory for icons and assets
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        taskpane: 'taskpane.html',
        commands: 'commands.html',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
