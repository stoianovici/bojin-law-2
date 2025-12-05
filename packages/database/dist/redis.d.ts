/**
 * Redis Client Wrapper
 * Story 2.2: Cloud Infrastructure and Database Setup
 *
 * Provides a singleton Redis client instance for session management and caching.
 *
 * Configuration:
 * - Session TTL: 24 hours (configurable via REDIS_SESSION_TTL)
 * - Cache TTL: 5 minutes default (configurable via REDIS_CACHE_DEFAULT_TTL)
 * - Max retries: 3 (configurable via REDIS_MAX_RETRIES)
 * - Connect timeout: 5 seconds (configurable via REDIS_CONNECT_TIMEOUT)
 *
 * Usage:
 *   import { redis, sessionManager, cacheManager } from '@legal-platform/database';
 *
 *   // Session management
 *   await sessionManager.set('user:123', { userId: '123', role: 'Partner' });
 *   const session = await sessionManager.get('user:123');
 *
 *   // Caching
 *   await cacheManager.set('case:456', caseData);
 *   const cachedCase = await cacheManager.get('case:456');
 */
import Redis from 'ioredis';
declare global {
    var redis: Redis | undefined;
}
export declare const redis: Redis;
export declare const sessionManager: {
    /**
     * Store user session data
     * @param sessionId - Unique session identifier
     * @param sessionData - Session data to store
     * @param ttl - Time to live in seconds (default: 24 hours)
     */
    set(sessionId: string, sessionData: Record<string, any>, ttl?: number): Promise<void>;
    /**
     * Retrieve user session data
     * @param sessionId - Unique session identifier
     * @returns Session data or null if not found/expired
     */
    get(sessionId: string): Promise<Record<string, any> | null>;
    /**
     * Delete user session
     * @param sessionId - Unique session identifier
     */
    delete(sessionId: string): Promise<void>;
    /**
     * Refresh session TTL (extend expiration)
     * @param sessionId - Unique session identifier
     * @param ttl - Time to live in seconds (default: 24 hours)
     */
    refresh(sessionId: string, ttl?: number): Promise<void>;
    /**
     * Check if session exists
     * @param sessionId - Unique session identifier
     */
    exists(sessionId: string): Promise<boolean>;
    /**
     * Get all active sessions for a user
     * @param userId - User identifier
     */
    getUserSessions(userId: string): Promise<string[]>;
    /**
     * Delete all sessions for a user
     * @param userId - User identifier
     */
    deleteUserSessions(userId: string): Promise<void>;
    /**
     * Cleanup expired sessions (called by background job)
     * Note: Redis automatically expires keys, this is for additional cleanup/logging
     */
    cleanup(): Promise<number>;
};
export declare const cacheManager: {
    /**
     * Store data in cache
     * @param key - Cache key (format: service:entity:id)
     * @param data - Data to cache
     * @param ttl - Time to live in seconds (default: 5 minutes)
     */
    set(key: string, data: any, ttl?: number): Promise<void>;
    /**
     * Retrieve cached data
     * @param key - Cache key
     * @returns Cached data or null if not found/expired
     */
    get<T = any>(key: string): Promise<T | null>;
    /**
     * Delete cached data
     * @param key - Cache key
     */
    delete(key: string): Promise<void>;
    /**
     * Invalidate cache by pattern
     * @param pattern - Cache key pattern (e.g., "case:*" to invalidate all case caches)
     */
    invalidate(pattern: string): Promise<number>;
    /**
     * Check if cache key exists
     * @param key - Cache key
     */
    exists(key: string): Promise<boolean>;
    /**
     * Get cache statistics
     */
    stats(): Promise<{
        totalKeys: number;
        sessionKeys: number;
        cacheKeys: number;
        memoryUsed: string;
    }>;
};
export declare const checkRedisHealth: () => Promise<{
    healthy: boolean;
    latency: number;
    error?: string;
}>;
export declare const getRedisConfig: () => {
    maxRetries: number | null | undefined;
    connectTimeout: number | undefined;
    sessionTTL: number;
    cacheDefaultTTL: number;
};
//# sourceMappingURL=redis.d.ts.map