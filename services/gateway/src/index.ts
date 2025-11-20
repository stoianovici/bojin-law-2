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
import { sessionConfig } from './config/session.config';
import { authRouter } from './routes/auth.routes';
import { adminRouter } from './routes/admin.routes';
import { userManagementRouter } from './routes/user-management.routes';

// Create Express app
const app: Express = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true, // Allow cookies
}));

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

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler
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
    message: process.env.NODE_ENV === 'production'
      ? 'An error occurred'
      : err.message,
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Gateway service listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Export app for testing
export { app };
