/**
 * Gateway Service Entry Point
 * Story 2.4: Authentication with Azure AD
 * Story 4.4: Task Dependencies and Automation (task reminder worker registration)
 *
 * Main Express application with session management and authentication routes.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import cors from 'cors';
import http from 'http';
import { sessionConfig } from './config/session.config';
import { authRouter } from './routes/auth.routes';
import { adminRouter } from './routes/admin.routes';
import { userManagementRouter } from './routes/user-management.routes';
import { graphRouter } from './routes/graph.routes';
import webhookRouter from './routes/webhook.routes';
import { createApolloServer, createGraphQLMiddleware } from './graphql/server';
import { startTaskReminderWorker, stopTaskReminderWorker } from './workers/task-reminder.worker';
import {
  startOOOReassignmentWorker,
  stopOOOReassignmentWorker,
} from './workers/ooo-reassignment.worker';
import { startDailyDigestWorker, stopDailyDigestWorker } from './workers/daily-digest.worker';

// Create Express app
const app: Express = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Security middleware - configure helmet to allow GraphQL
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true, // Allow cookies
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware (must be before routes that use sessions)
app.use(session(sessionConfig));

// Authentication routes
app.use('/auth', authRouter);

// Admin routes (Task 14: Session monitoring and cleanup)
app.use('/admin', adminRouter);

// User management routes (Story 2.4.1: Partner User Management)
app.use('/api/users', userManagementRouter);

// Microsoft Graph API routes (Story 2.5: Microsoft Graph API Integration Foundation)
app.use('/graph', graphRouter);

// Webhook routes (Story 2.5: Microsoft Graph API webhook notifications)
app.use('/webhooks', webhookRouter);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// One-time migration endpoint for adding isIgnored fields to emails table
// TODO: Remove after migration is applied to production
app.post('/admin/run-migration-is-ignored', async (req: Request, res: Response) => {
  const { prisma } = await import('@legal-platform/database');
  try {
    // Add is_ignored column if it doesn't exist (run each statement separately)
    await prisma.$executeRawUnsafe(
      `ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_ignored BOOLEAN DEFAULT false`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE emails ADD COLUMN IF NOT EXISTS ignored_at TIMESTAMPTZ`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS emails_is_ignored_idx ON emails(is_ignored)`
    );
    res.json({ success: true, message: 'Migration applied successfully' });
  } catch (error: any) {
    console.error('[Migration] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initialize Apollo Server and GraphQL endpoint
async function startServer() {
  // Create Apollo Server
  const apolloServer = await createApolloServer(httpServer);
  const graphqlMiddleware = createGraphQLMiddleware(apolloServer);

  // Mount GraphQL endpoint (must be before 404 handler)
  app.use('/graphql', graphqlMiddleware);

  // 404 handler (must be after all routes)
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'not_found',
      message: 'Route not found',
      path: req.path,
    });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'internal_server_error',
      message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
    });
  });

  // Start server
  if (process.env.NODE_ENV !== 'test') {
    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, () => {
        console.log(`Gateway service listening on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
        resolve();
      });
    });

    // Story 4.4: Start task reminder worker
    const reminderIntervalMs = parseInt(process.env.TASK_REMINDER_INTERVAL_MS || '3600000', 10); // Default: 1 hour
    startTaskReminderWorker(reminderIntervalMs);

    // Story 4.5: Start OOO reassignment worker
    const oooIntervalMs = parseInt(process.env.OOO_WORKER_INTERVAL_MS || '3600000', 10); // Default: 1 hour
    startOOOReassignmentWorker({ checkIntervalMs: oooIntervalMs });

    // Story 4.6: Start daily digest worker
    startDailyDigestWorker();
  }
}

// Graceful shutdown handler
function setupGracefulShutdown() {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  signals.forEach((signal) => {
    process.on(signal, () => {
      console.log(`Received ${signal}, shutting down gracefully...`);

      // Stop workers
      stopTaskReminderWorker();
      stopOOOReassignmentWorker();
      stopDailyDigestWorker();

      // Close HTTP server
      httpServer.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 30s if graceful shutdown fails
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    });
  });
}

// Start the server
if (process.env.NODE_ENV !== 'test') {
  setupGracefulShutdown();

  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

// Export app and server for testing
export { app, httpServer };
