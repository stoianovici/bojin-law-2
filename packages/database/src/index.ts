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
 * - getRedisConfig: Redis configuration getter
 *
 * Usage:
 *   import { prisma, redis, sessionManager, cacheManager } from '@legal-platform/database';
 */

// PostgreSQL / Prisma exports
export { prisma, checkDatabaseHealth, databaseConfig } from './client';

// Redis exports
export { redis, sessionManager, cacheManager, checkRedisHealth, getRedisConfig } from './redis';

// Re-export Prisma Client types for convenience
export type { PrismaClient } from '@prisma/client';
export * from '@prisma/client';

// ============================================================================
// Story 5.2: Communication Intelligence - Helper Functions
// ============================================================================

/**
 * Confidence level type for extracted items
 * Maps Float confidence scores to human-readable labels
 */
export type ExtractionConfidenceLevel = 'Low' | 'Medium' | 'High';

/**
 * Converts a Float confidence score (0.0-1.0) to an ExtractionConfidenceLevel
 * - Low: confidence < 0.6
 * - Medium: confidence 0.6 - 0.8
 * - High: confidence > 0.8
 *
 * @param score - Float between 0.0 and 1.0
 * @returns ExtractionConfidenceLevel string
 */
export function getConfidenceLevel(score: number): ExtractionConfidenceLevel {
  if (score < 0.6) return 'Low';
  if (score <= 0.8) return 'Medium';
  return 'High';
}
