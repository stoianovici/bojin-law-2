/**
 * Database Package Main Entry Point
 * Story 2.2: Cloud Infrastructure and Database Setup
 *
 * Exports:
 * - prisma: Singleton Prisma Client instance with connection pooling
 * - checkDatabaseHealth: Health check function for monitoring
 * - databaseConfig: Current database configuration
 * - redis: Singleton Redis client instance (via separate import)
 * - sessionManager: Redis session management utilities (via separate import)
 * - cacheManager: Redis cache management utilities (via separate import)
 * - checkRedisHealth: Redis health check function (via separate import)
 *
 * Note: Redis exports are in a separate file to avoid initialization during build.
 * Import Redis separately: import { redis } from '@legal-platform/database/redis';
 */
export { prisma, checkDatabaseHealth, databaseConfig } from './client';
export { redis, sessionManager, cacheManager, checkRedisHealth } from './redis';
export type { PrismaClient } from '@prisma/client';
export * from '@prisma/client';
//# sourceMappingURL=index.d.ts.map