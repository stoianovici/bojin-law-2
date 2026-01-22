/**
 * Gateway Service Entry Point
 * Story 2.4: Authentication with Azure AD
 * Story 4.4: Task Dependencies and Automation (task reminder worker registration)
 * Task 5.1: WebSocket Server for GraphQL Subscriptions
 *
 * Main Express application with session management and authentication routes.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
// @ts-expect-error - graphql-ws v6 exports are not resolved by moduleResolution: node
import { useServer } from 'graphql-ws/use/ws';
import { sessionConfig } from './config/session.config';
import { authRouter } from './routes/auth.routes';
import { adminRouter } from './routes/admin.routes';
import { userManagementRouter } from './routes/user-management.routes';
import { graphRouter } from './routes/graph.routes';
import webhookRouter from './routes/webhook.routes';
import { wordAIRouter } from './routes/word-ai.routes';
import { wordAddinAuthRouter } from './routes/word-addin-auth.routes';
import { createApolloServer, createGraphQLMiddleware, resolvers } from './graphql/server';
import { buildExecutableSchema, loadSchema } from './graphql/schema';
import { startTaskReminderWorker, stopTaskReminderWorker } from './workers/task-reminder.worker';
import {
  startOOOReassignmentWorker,
  stopOOOReassignmentWorker,
} from './workers/ooo-reassignment.worker';
import { startDailyDigestWorker, stopDailyDigestWorker } from './workers/daily-digest.worker';
import { startCaseSummaryWorker, stopCaseSummaryWorker } from './workers/case-summary.worker';
import {
  startEmailCategorizationWorker,
  stopEmailCategorizationWorker,
} from './workers/email-categorization.worker';
import { startChatCleanupWorker, stopChatCleanupWorker } from './workers/chat-cleanup.worker';
import { startCaseChaptersWorker, stopCaseChaptersWorker } from './workers/case-chapters.worker';
import { startCaseSyncWorker, stopCaseSyncWorker } from './workers/case-sync.worker';
import {
  startHistoricalSyncWorker,
  stopHistoricalSyncWorker,
} from './workers/historical-email-sync.worker';
import {
  startEmailSubscriptionRenewalWorker,
  stopEmailSubscriptionRenewalWorker,
} from './workers/email-subscription-renewal.worker';
import {
  startAttachmentUploadWorker,
  stopAttachmentUploadWorker,
} from './workers/attachment-upload.worker';
import {
  startClientAttachmentSyncWorker,
  stopClientAttachmentSyncWorker,
} from './workers/client-attachment-sync.worker';
import { startThumbnailWorker, stopThumbnailWorker } from './workers/thumbnail-generation.worker';
import { redis } from '@legal-platform/database';

// Create Express app
const app: Express = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Security middleware - configure helmet for GraphQL and Office add-in compatibility
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", 'https://appsforoffice.microsoft.com'],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              fontSrc: ["'self'", 'https:', 'data:'],
              connectSrc: [
                "'self'",
                'https://graph.microsoft.com',
                'https://login.microsoftonline.com',
              ],
              frameSrc: ["'self'", 'https://login.microsoftonline.com'],
              frameAncestors: [
                "'self'",
                'https://*.officeapps.live.com',
                'https://*.office.com',
                'https://*.sharepoint.com',
              ],
            },
          }
        : false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:3000', 'http://localhost:3001', 'https://localhost:3005'],
    credentials: true, // Allow cookies
  })
);

// Word Add-in static files (served at /word-addin/*)
// In development, proxy to Vite dev server; in production, serve static files
const wordAddinPath = path.join(__dirname, 'word-addin');
const isDev = process.env.NODE_ENV !== 'production';

// Add headers for Word Online compatibility (must allow iframe embedding and popups)
app.use('/word-addin', (_req, res, next) => {
  // CORS for assets
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Allow iframe embedding in Office (override helmet's X-Frame-Options)
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://*.officeapps.live.com https://*.office.com https://*.sharepoint.com"
  );
  // Allow popups to communicate with opener (needed for MSAL auth popup)
  // Override helmet's default same-origin policy
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

if (isDev) {
  // In dev mode, proxy to Vite dev server
  // Vite uses base: '/word-addin/' so we need to add the prefix back after Express strips it

  const { createProxyMiddleware } = require('http-proxy-middleware');
  app.use(
    '/word-addin',
    createProxyMiddleware({
      target: 'https://localhost:3005',
      changeOrigin: true,
      secure: false, // Accept self-signed certs
      pathRewrite: (path: string) => '/word-addin' + path,
      ws: true, // Proxy websockets for HMR
    })
  );
} else {
  // In production, serve static files
  app.use(
    '/word-addin',
    express.static(wordAddinPath, {
      maxAge: '1d',
      etag: true,
    })
  );
}

// Body parsing middleware with error handling (increased limit for ONRC template sync)
app.use(
  express.json({
    limit: '10mb',
    verify: (req: any, res, buf, encoding) => {
      // Store raw body for debugging
      req.rawBody = buf.toString();
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Debug middleware for GraphQL requests - logs AFTER body parsing
app.use('/graphql', (req: any, res, next) => {
  if (req.body?.query?.includes('createMapa') || req.body?.operationName === 'CreateMapa') {
    console.log(
      '[DEBUG] createMapa request body:',
      JSON.stringify(req.body, null, 2).substring(0, 1000)
    );
  }
  next();
});

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

// Word AI routes (Word add-in AI features)
// Add permissive CORS for Word Online - add-in runs in Microsoft's iframe sandbox
// with origins like *.officeapps.live.com, *.office.com, etc.
app.use('/api/ai/word', (req, res, next) => {
  // Allow any origin for Word add-in API (auth is via Bearer token, not cookies)
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Fallback for requests without origin (same-origin or non-browser)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Dev-Bypass');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});
app.use('/api/ai/word', wordAIRouter);

// Word Add-in Auth routes (server-side token exchange)
// Uses same permissive CORS as Word AI routes
app.use('/api/word-addin/auth', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});
app.use('/api/word-addin/auth', wordAddinAuthRouter);

// Legacy webhook route alias - existing subscriptions in production use /api/webhooks/outlook
// The webhookRouter has a /graph endpoint, so we need a direct mapping
// TODO: Remove after all subscriptions have been renewed with the new URL
app.post('/api/webhooks/outlook', (req, res, next) => {
  // Forward to the /webhooks/graph handler by rewriting the URL
  req.url = '/graph';
  webhookRouter(req, res, next);
});

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

// Apply all pending schema migrations manually
// This is needed because the Dockerfile migration step may fail silently
app.post('/admin/run-pending-migrations', async (req: Request, res: Response) => {
  const { prisma } = await import('@legal-platform/database');
  const results: { migration: string; success: boolean; error?: string }[] = [];

  // Migration: 20260107100000_add_ai_model_configs
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ai_model_configs" (
        "id" TEXT NOT NULL,
        "firm_id" TEXT NOT NULL,
        "operation_type" VARCHAR(100) NOT NULL,
        "model" VARCHAR(50) NOT NULL,
        "updated_by_id" TEXT NOT NULL,
        "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ai_model_configs_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ai_model_configs_firm_id_idx" ON "ai_model_configs"("firm_id")`
    );
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ai_model_configs_operation_type_firm_id_key"
      ON "ai_model_configs"("operation_type", "firm_id")
    `);
    // Foreign keys - ignore errors if they already exist
    await prisma
      .$executeRawUnsafe(
        `
      ALTER TABLE "ai_model_configs"
      ADD CONSTRAINT IF NOT EXISTS "ai_model_configs_firm_id_fkey"
      FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `
      )
      .catch(() => {});
    await prisma
      .$executeRawUnsafe(
        `
      ALTER TABLE "ai_model_configs"
      ADD CONSTRAINT IF NOT EXISTS "ai_model_configs_updated_by_id_fkey"
      FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `
      )
      .catch(() => {});
    results.push({ migration: '20260107100000_add_ai_model_configs', success: true });
  } catch (error: any) {
    results.push({
      migration: '20260107100000_add_ai_model_configs',
      success: false,
      error: error.message,
    });
  }

  // Migration: 20260107100001_add_task_scheduling_fields
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "scheduled_date" DATE`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "scheduled_start_time" VARCHAR(5)`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1`
    );
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "tasks_firm_id_scheduled_date_status_idx"
      ON "tasks"("firm_id", "scheduled_date", "status")
    `);
    results.push({ migration: '20260107100001_add_task_scheduling_fields', success: true });
  } catch (error: any) {
    results.push({
      migration: '20260107100001_add_task_scheduling_fields',
      success: false,
      error: error.message,
    });
  }

  const allSuccess = results.every((r) => r.success);
  res.status(allSuccess ? 200 : 500).json({
    success: allSuccess,
    message: allSuccess ? 'All migrations applied successfully' : 'Some migrations failed',
    results,
  });
});

// Initialize Apollo Server and GraphQL endpoint
async function startServer() {
  // Ensure Redis is connected before starting (fixes lazyConnect + enableOfflineQueue=false issue)
  try {
    await redis.connect();
    console.log('✅ Redis connected');
  } catch (err: any) {
    // Redis may already be connected or connecting
    if (!err.message?.includes('already')) {
      console.warn('⚠️ Redis connection warning:', err.message);
    }
  }

  // Task 5.1: Build schema for both Apollo Server and WebSocket server
  const typeDefs = loadSchema();
  const schema = buildExecutableSchema(typeDefs, resolvers);

  // Task 5.1: Create WebSocket server for GraphQL subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  // Task 5.1: Setup graphql-ws server with schema and context extraction
  // eslint-disable-next-line react-hooks/rules-of-hooks -- useServer is from graphql-ws, not React
  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        // Extract user from connection params
        const connectionParams = ctx.connectionParams || {};
        // The client should pass user info in connectionParams
        return {
          user: connectionParams.user || undefined,
        };
      },
    },
    wsServer
  );

  // Create Apollo Server with WebSocket cleanup integration
  const apolloServer = await createApolloServer(httpServer, {
    close: async () => {
      await serverCleanup.dispose();
    },
  });
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
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
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
        console.log(`WebSocket endpoint: ws://localhost:${PORT}/graphql`);
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

    // OPS-048: Start case summary worker
    startCaseSummaryWorker();

    // Story 5.1: Start email categorization worker
    startEmailCategorizationWorker();

    // Task 5.1: Start chat cleanup worker
    startChatCleanupWorker();

    // Case History: Start case chapters worker (weekly AI chapter generation)
    startCaseChaptersWorker();

    // Case Sync: Start case sync worker (email sync on case creation)
    startCaseSyncWorker();

    // Historical Sync: Start historical email sync worker (processes sync jobs)
    startHistoricalSyncWorker();

    // Email Subscription Renewal: Renew expiring Graph API email subscriptions
    startEmailSubscriptionRenewalWorker();

    // Attachment Upload: Upload email attachments to SharePoint when user logs in
    startAttachmentUploadWorker();

    // Client Attachment Sync: Sync attachments for emails reclassified to ClientInbox
    startClientAttachmentSyncWorker();

    // OPS-114: Thumbnail Generation: Generate document thumbnails for grid views
    startThumbnailWorker();
  }
}

// Graceful shutdown handler
function setupGracefulShutdown() {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`Received ${signal}, shutting down gracefully...`);

      // Stop workers
      stopTaskReminderWorker();
      stopOOOReassignmentWorker();
      stopDailyDigestWorker();
      stopCaseSummaryWorker();
      stopEmailCategorizationWorker();
      stopChatCleanupWorker();
      stopCaseChaptersWorker();
      stopCaseSyncWorker();
      stopHistoricalSyncWorker();
      stopEmailSubscriptionRenewalWorker();
      await stopAttachmentUploadWorker();
      await stopClientAttachmentSyncWorker();
      await stopThumbnailWorker();

      // Close Redis connection
      try {
        console.log('Closing Redis connection...');
        await redis.quit();
        console.log('Redis connection closed');
      } catch (error) {
        console.error('Error closing Redis:', error);
      }

      // Close HTTP server
      httpServer.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 3s if graceful shutdown fails (tsx watch waits 5s)
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 3000);
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
