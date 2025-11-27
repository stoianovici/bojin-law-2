/**
 * AI Service Entry Point
 * Story 3.1: AI Service Infrastructure
 */

import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { aiRoutes } from './routes/ai.routes';
import trainingPipelineRoutes from './routes/training-pipeline.routes';
import { initializePrisma } from './services/token-tracker.service';
import { initializeCachePrisma } from './services/cache.service';
import { setupCronScheduler } from './lib/cron-scheduler';

const app = express();

// Initialize Prisma client
const prisma = new PrismaClient();
initializePrisma(prisma);
initializeCachePrisma(prisma);

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
app.use('/api/ai/training-pipeline', trainingPipelineRoutes);

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

app.listen(PORT, HOST, () => {
  console.log(`AI Service running on http://${HOST}:${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');

  // Setup cron scheduler for training pipeline
  setupCronScheduler();
});

export { app, prisma };
