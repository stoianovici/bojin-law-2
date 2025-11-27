/**
 * Database Client Wrapper
 * Story 2.2: Cloud Infrastructure and Database Setup
 *
 * Provides a singleton Prisma Client instance with optimized connection pooling
 * for production deployment on Render.com.
 *
 * Connection Pool Configuration:
 * - Max connections: 20 (Render PostgreSQL Standard tier limit)
 * - Pool size per service: 10 (allows 2 service instances)
 * - Connection timeout: 30 seconds
 * - Statement timeout: 60 seconds
 * - Idle timeout: 10 seconds
 *
 * Usage:
 *   import { prisma } from '@legal-platform/database';
 *   const users = await prisma.user.findMany();
 */

import { PrismaClient } from '@prisma/client';

// Database configuration from environment variables
const config = {
  maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20', 10),
  poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
  connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '30000', 10), // 30 seconds
  statementTimeout: parseInt(process.env.DATABASE_STATEMENT_TIMEOUT || '60000', 10), // 60 seconds
  idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '10000', 10), // 10 seconds
  sslMode: process.env.DATABASE_SSL_MODE || 'require',
};

// Check if we're in a build context (no database needed)
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

// Construct connection string with pooling parameters
const getDatabaseUrl = (): string => {
  const baseUrl = process.env.DATABASE_URL;

  if (!baseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Parse URL to add pooling parameters
  const url = new URL(baseUrl);

  // Add connection pool parameters
  url.searchParams.set('connection_limit', config.poolSize.toString());
  url.searchParams.set('pool_timeout', (config.connectionTimeout / 1000).toString()); // Convert to seconds
  url.searchParams.set('connect_timeout', (config.connectionTimeout / 1000).toString());
  url.searchParams.set('statement_timeout', config.statementTimeout.toString());

  // Ensure SSL is enabled for production
  if (!url.searchParams.has('sslmode')) {
    url.searchParams.set('sslmode', config.sslMode);
  }

  return url.toString();
};

// Singleton pattern for Prisma Client
// Prevents creating multiple instances in serverless/hot-reload environments
declare global {
  var prisma: PrismaClient | undefined;
}

let _prisma: PrismaClient | undefined;

// Lazy getter for Prisma instance
const getPrismaInstance = (): PrismaClient => {
  if (!_prisma) {
    if (global.prisma) {
      _prisma = global.prisma;
    } else {
      _prisma = new PrismaClient({
        datasources: {
          db: {
            url: getDatabaseUrl(),
          },
        },
        log:
          process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
        errorFormat: 'pretty',
      });

      // Store in global for hot-reload in development
      if (process.env.NODE_ENV !== 'production') {
        global.prisma = _prisma;
      }
    }
  }
  return _prisma;
};

// Export a proxy that lazily initializes Prisma on first access
// This prevents errors during Next.js build when DATABASE_URL is not set
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    // During build time, return a mock for type checking
    if (isBuildTime && !process.env.DATABASE_URL) {
      // Return a function that throws a helpful error
      if (prop === '$connect' || prop === '$disconnect') {
        return async () => {};
      }
      throw new Error(
        `Cannot access prisma.${String(prop)} during build time without DATABASE_URL`
      );
    }
    const instance = getPrismaInstance();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

// Graceful shutdown handler
// Ensures all database connections are properly closed before process exit
const shutdown = async (signal: string) => {
  if (_prisma) {
    console.log(`Received ${signal}, closing database connections...`);
    await _prisma.$disconnect();
    console.log('Database connections closed.');
  }
  process.exit(0);
};

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Health check helper
export const checkDatabaseHealth = async (): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> => {
  const start = Date.now();

  try {
    // Execute a simple query to verify database connectivity
    await prisma.$queryRaw`SELECT 1 AS health_check`;

    const latency = Date.now() - start;

    return {
      healthy: true,
      latency,
    };
  } catch (error) {
    const latency = Date.now() - start;

    return {
      healthy: false,
      latency,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Export configuration for monitoring and debugging
export const databaseConfig = config;
