/**
 * AI Service Entry Point
 * Story 3.1: AI Service Infrastructure
 */

// Catch any uncaught errors during startup - must be first
process.on('uncaughtException', (err) => {
  console.error('FATAL: Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('FATAL: Unhandled rejection:', reason);
  process.exit(1);
});

console.log('=== AI Service Bootstrap ===');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
console.log('REDIS_URL set:', !!process.env.REDIS_URL);
console.log('ANTHROPIC_API_KEY set:', !!process.env.ANTHROPIC_API_KEY);

// Load environment variables first
import 'dotenv/config';

import express, { Application, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { aiRoutes } from './routes/ai.routes';
import emailDraftingRoutes from './routes/email-drafting.routes';
import { initializePrisma } from './services/token-tracker.service';
import { initializeCachePrisma } from './services/cache.service';

console.log('All modules loaded');

const app: Application = express();

// Initialize Prisma client
console.log('Initializing Prisma client...');
const prisma = new PrismaClient();
initializePrisma(prisma);
initializeCachePrisma(prisma);
console.log('Prisma client initialized');

// Middleware
app.use(express.json({ limit: '10mb' }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Routes
app.use('/api/ai', aiRoutes);
app.use('/api/email-drafting', emailDraftingRoutes);

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('AI Service Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
const PORT = config.server.port;
const HOST = config.server.host;

console.log(`Starting server on ${HOST}:${PORT}...`);
app.listen(PORT, HOST, () => {
  console.log(`AI Service running on http://${HOST}:${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
});

export { app, prisma };
