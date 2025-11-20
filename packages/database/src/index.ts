/**
 * Database Package Main Entry Point
 * Story 2.2: Cloud Infrastructure and Database Setup
 *
 * Exports:
 * - prisma: Singleton Prisma Client instance with connection pooling
 * - checkDatabaseHealth: Health check function for monitoring
 * - databaseConfig: Current database configuration
 * - redis: Singleton Redis client instance
 * - sessionManager: Redis session management utilities
 * - cacheManager: Redis cache management utilities
 * - checkRedisHealth: Redis health check function
 */

// PostgreSQL / Prisma exports
export { prisma, checkDatabaseHealth, databaseConfig } from './client';

// Redis exports
export {
  redis,
  sessionManager,
  cacheManager,
  checkRedisHealth,
  getRedisConfig,
} from './redis';

// Re-export Prisma Client types for convenience
export type { PrismaClient } from '@prisma/client';
export * from '@prisma/client';
