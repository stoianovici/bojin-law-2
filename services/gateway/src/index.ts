/**
 * Gateway Service Entry Point
 * Story 2.4: Authentication with Azure AD
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
  }
}

// Start the server
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

// Export app and server for testing
export { app, httpServer };
