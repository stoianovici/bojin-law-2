"use strict";
/**
 * Database Client Wrapper
 * Story 2.2: Cloud Infrastructure and Database Setup
 *
 * Provides a singleton Prisma Client instance with optimized connection pooling
 * for production deployment on Render.com.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = exports.checkDatabaseHealth = exports.prisma = void 0;
const client_1 = require("@prisma/client");
// Database configuration from environment variables
const config = {
    maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20', 10),
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
    connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '30000', 10),
    statementTimeout: parseInt(process.env.DATABASE_STATEMENT_TIMEOUT || '60000', 10),
    idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '10000', 10),
    sslMode: process.env.DATABASE_SSL_MODE || 'require',
};
const createPrismaClient = () => {
    return new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
        errorFormat: 'pretty',
    });
};
// Use globalThis for singleton in serverless/edge environments
exports.prisma = globalThis.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = exports.prisma;
}
// Health check helper
const checkDatabaseHealth = async () => {
    const start = Date.now();
    try {
        await exports.prisma.$queryRaw `SELECT 1 AS health_check`;
        const latency = Date.now() - start;
        return { healthy: true, latency };
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
exports.checkDatabaseHealth = checkDatabaseHealth;
// Export configuration for monitoring and debugging
exports.databaseConfig = config;
//# sourceMappingURL=client.js.map