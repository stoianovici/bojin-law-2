/**
 * AI Service Entry Point
 * Story 3.1: AI Service Infrastructure
 */

// Load environment variables first
import 'dotenv/config';

import express, { Application, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { aiRoutes } from './routes/ai.routes';
import trainingPipelineRoutes from './routes/training-pipeline.routes';
import taskParserRoutes from './routes/task-parser.routes';
import timeEstimationRoutes from './routes/time-estimation.routes';
import handoffGenerationRoutes from './routes/handoff-generation.routes';
import emailDraftingRoutes from './routes/email-drafting.routes';
import { initializePrisma } from './services/token-tracker.service';
import { initializeCachePrisma } from './services/cache.service';
import { initializePatternLearningPrisma } from './services/task-pattern-learning.service';
import { setupCronScheduler } from './lib/cron-scheduler';

const app: Application = express();

// Initialize Prisma client
const prisma = new PrismaClient();
initializePrisma(prisma);
initializeCachePrisma(prisma);
initializePatternLearningPrisma(prisma);

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
app.use('/api/ai', taskParserRoutes); // Story 4.1: Task parser routes
app.use('/api/ai', timeEstimationRoutes); // Story 4.3: Time estimation routes
app.use('/api/ai', handoffGenerationRoutes); // Story 4.5: Handoff generation routes
app.use('/api/email-drafting', emailDraftingRoutes); // Story 5.3: Email drafting routes

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
