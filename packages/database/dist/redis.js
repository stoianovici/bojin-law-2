"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisConfig = exports.checkRedisHealth = exports.cacheManager = exports.sessionManager = exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
// Check if we're in development without Redis
const isDevelopment = process.env.NODE_ENV !== 'production';
// Check if we're in a build context (no Redis needed)
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || !process.env.REDIS_URL;
// Redis configuration from environment variables
const redisConfig = {
    // Connection string from Render auto-injection
    ...(process.env.REDIS_URL && { url: process.env.REDIS_URL }),
    // Retry strategy - in development, use null to prevent max retries error
    // This allows the app to continue working without Redis (with degraded functionality)
    maxRetriesPerRequest: isDevelopment ? null : parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
    retryStrategy(times) {
        if ((isDevelopment || isBuildTime) && times > 3) {
            // In development/build, stop retrying after 3 attempts and just log
            console.warn('Redis unavailable - some features may not work');
            return null; // Stop retrying
        }
        const delay = Math.min(times * 50, 2000); // Exponential backoff up to 2 seconds
        return delay;
    },
    // Timeouts
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000', 10), // 5 seconds
    commandTimeout: 5000, // 5 seconds for command execution
    // Connection options - always lazy connect to avoid blocking during build
    lazyConnect: true,
    enableReadyCheck: true,
    enableOfflineQueue: !isDevelopment && !isBuildTime, // Disable offline queue in dev/build to fail fast
    // TLS for production
    // Render Redis provides valid TLS certificates signed by trusted CAs
    // rejectUnauthorized can be disabled via env var for local dev with self-signed certs
    ...(process.env.REDIS_URL?.startsWith('rediss://') && {
        tls: {
            rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
        },
    }),
};
let _redis;
// Lazy getter for Redis instance
const getRedisInstance = () => {
    if (!_redis) {
        if (global.redis) {
            _redis = global.redis;
        }
        else {
            _redis = new ioredis_1.default(redisConfig);
            // Store in global for hot-reload in development
            if (process.env.NODE_ENV !== 'production') {
                global.redis = _redis;
            }
            // Error handling
            _redis.on('error', (error) => {
                console.error('Redis connection error:', error);
            });
            _redis.on('connect', () => {
                console.log('Redis connected successfully');
            });
            _redis.on('ready', () => {
                console.log('Redis ready to accept commands');
            });
            _redis.on('reconnecting', () => {
                console.warn('Redis reconnecting...');
            });
        }
    }
    return _redis;
};
// Export a proxy that lazily initializes Redis on first access
exports.redis = new Proxy({}, {
    get(_, prop) {
        const instance = getRedisInstance();
        const value = instance[prop];
        return typeof value === 'function' ? value.bind(instance) : value;
    },
});
// Graceful shutdown - only if Redis was initialized
const shutdownRedis = async (signal) => {
    if (_redis) {
        console.log(`Received ${signal}, closing Redis connection...`);
        await _redis.quit();
        console.log('Redis connection closed.');
    }
    process.exit(0);
};
process.on('SIGINT', () => shutdownRedis('SIGINT'));
process.on('SIGTERM', () => shutdownRedis('SIGTERM'));
// Helper: Non-blocking key pattern matching using SCAN
// Replaces redis.keys() to prevent O(N) blocking operations
const scanKeys = async (pattern) => {
    const keys = [];
    let cursor = '0';
    do {
        // SCAN returns [cursor, keys[]]
        const [nextCursor, foundKeys] = await exports.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100 // Scan 100 keys per iteration
        );
        keys.push(...foundKeys);
        cursor = nextCursor;
    } while (cursor !== '0');
    return keys;
};
// Session Management
const SESSION_PREFIX = 'session';
const SESSION_TTL = parseInt(process.env.REDIS_SESSION_TTL || '86400', 10); // 24 hours in seconds
exports.sessionManager = {
    /**
     * Store user session data
     * @param sessionId - Unique session identifier
     * @param sessionData - Session data to store
     * @param ttl - Time to live in seconds (default: 24 hours)
     */
    async set(sessionId, sessionData, ttl = SESSION_TTL) {
        const key = `${SESSION_PREFIX}:${sessionId}`;
        await exports.redis.setex(key, ttl, JSON.stringify(sessionData));
    },
    /**
     * Retrieve user session data
     * @param sessionId - Unique session identifier
     * @returns Session data or null if not found/expired
     */
    async get(sessionId) {
        const key = `${SESSION_PREFIX}:${sessionId}`;
        const data = await exports.redis.get(key);
        if (!data) {
            return null;
        }
        return JSON.parse(data);
    },
    /**
     * Delete user session
     * @param sessionId - Unique session identifier
     */
    async delete(sessionId) {
        const key = `${SESSION_PREFIX}:${sessionId}`;
        await exports.redis.del(key);
    },
    /**
     * Refresh session TTL (extend expiration)
     * @param sessionId - Unique session identifier
     * @param ttl - Time to live in seconds (default: 24 hours)
     */
    async refresh(sessionId, ttl = SESSION_TTL) {
        const key = `${SESSION_PREFIX}:${sessionId}`;
        await exports.redis.expire(key, ttl);
    },
    /**
     * Check if session exists
     * @param sessionId - Unique session identifier
     */
    async exists(sessionId) {
        const key = `${SESSION_PREFIX}:${sessionId}`;
        const result = await exports.redis.exists(key);
        return result === 1;
    },
    /**
     * Get all active sessions for a user
     * @param userId - User identifier
     */
    async getUserSessions(userId) {
        const pattern = `${SESSION_PREFIX}:*`;
        const keys = await scanKeys(pattern);
        const sessions = [];
        for (const key of keys) {
            const data = await exports.redis.get(key);
            if (data) {
                const session = JSON.parse(data);
                if (session.userId === userId) {
                    sessions.push(key.replace(`${SESSION_PREFIX}:`, ''));
                }
            }
        }
        return sessions;
    },
    /**
     * Delete all sessions for a user
     * @param userId - User identifier
     */
    async deleteUserSessions(userId) {
        const sessions = await this.getUserSessions(userId);
        for (const sessionId of sessions) {
            await this.delete(sessionId);
        }
    },
    /**
     * Cleanup expired sessions (called by background job)
     * Note: Redis automatically expires keys, this is for additional cleanup/logging
     */
    async cleanup() {
        const pattern = `${SESSION_PREFIX}:*`;
        const keys = await scanKeys(pattern);
        let cleanedCount = 0;
        for (const key of keys) {
            const ttl = await exports.redis.ttl(key);
            // If TTL is -2, key doesn't exist (already expired)
            // If TTL is -1, key has no expiration (shouldn't happen, but clean it up)
            if (ttl === -2 || ttl === -1) {
                await exports.redis.del(key);
                cleanedCount++;
            }
        }
        return cleanedCount;
    },
};
// Cache Management
const CACHE_PREFIX = 'cache';
const CACHE_DEFAULT_TTL = parseInt(process.env.REDIS_CACHE_DEFAULT_TTL || '300', 10); // 5 minutes in seconds
exports.cacheManager = {
    /**
     * Store data in cache
     * @param key - Cache key (format: service:entity:id)
     * @param data - Data to cache
     * @param ttl - Time to live in seconds (default: 5 minutes)
     */
    async set(key, data, ttl = CACHE_DEFAULT_TTL) {
        const cacheKey = `${CACHE_PREFIX}:${key}`;
        await exports.redis.setex(cacheKey, ttl, JSON.stringify(data));
    },
    /**
     * Retrieve cached data
     * @param key - Cache key
     * @returns Cached data or null if not found/expired
     */
    async get(key) {
        const cacheKey = `${CACHE_PREFIX}:${key}`;
        const data = await exports.redis.get(cacheKey);
        if (!data) {
            return null;
        }
        return JSON.parse(data);
    },
    /**
     * Delete cached data
     * @param key - Cache key
     */
    async delete(key) {
        const cacheKey = `${CACHE_PREFIX}:${key}`;
        await exports.redis.del(cacheKey);
    },
    /**
     * Invalidate cache by pattern
     * @param pattern - Cache key pattern (e.g., "case:*" to invalidate all case caches)
     */
    async invalidate(pattern) {
        const cachePattern = `${CACHE_PREFIX}:${pattern}`;
        const keys = await scanKeys(cachePattern);
        if (keys.length === 0) {
            return 0;
        }
        await exports.redis.del(...keys);
        return keys.length;
    },
    /**
     * Check if cache key exists
     * @param key - Cache key
     */
    async exists(key) {
        const cacheKey = `${CACHE_PREFIX}:${key}`;
        const result = await exports.redis.exists(cacheKey);
        return result === 1;
    },
    /**
     * Get cache statistics
     */
    async stats() {
        const [sessionKeys, cacheKeys, info] = await Promise.all([
            scanKeys(`${SESSION_PREFIX}:*`),
            scanKeys(`${CACHE_PREFIX}:*`),
            exports.redis.info('memory'),
        ]);
        // Parse memory info
        const memoryMatch = info.match(/used_memory_human:(\S+)/);
        const memoryUsed = memoryMatch ? memoryMatch[1] : 'unknown';
        return {
            totalKeys: sessionKeys.length + cacheKeys.length,
            sessionKeys: sessionKeys.length,
            cacheKeys: cacheKeys.length,
            memoryUsed,
        };
    },
};
// Redis Health Check
const checkRedisHealth = async () => {
    const start = Date.now();
    try {
        // Execute a PING command to verify Redis is responsive
        const pong = await exports.redis.ping();
        if (pong !== 'PONG') {
            throw new Error('Redis PING returned unexpected response');
        }
        const latency = Date.now() - start;
        return {
            healthy: true,
            latency,
        };
    }
    catch (error) {
        const latency = Date.now() - start;
        return {
            healthy: false,
            latency,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
exports.checkRedisHealth = checkRedisHealth;
// Export Redis configuration for monitoring
const getRedisConfig = () => ({
    maxRetries: redisConfig.maxRetriesPerRequest,
    connectTimeout: redisConfig.connectTimeout,
    sessionTTL: SESSION_TTL,
    cacheDefaultTTL: CACHE_DEFAULT_TTL,
});
exports.getRedisConfig = getRedisConfig;
//# sourceMappingURL=redis.js.map