/**
 * Database Client Wrapper
 * Story 2.2: Cloud Infrastructure and Database Setup
 *
 * Provides a singleton Prisma Client instance with optimized connection pooling
 * for production deployment on Render.com.
 */
import { PrismaClient } from '@prisma/client';
declare global {
    var prisma: PrismaClient | undefined;
}
export declare const prisma: PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
export declare const checkDatabaseHealth: () => Promise<{
    healthy: boolean;
    latency: number;
    error?: string;
}>;
export declare const databaseConfig: {
    maxConnections: number;
    poolSize: number;
    connectionTimeout: number;
    statementTimeout: number;
    idleTimeout: number;
    sslMode: string;
};
//# sourceMappingURL=client.d.ts.map