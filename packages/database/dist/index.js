"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = exports.checkDatabaseHealth = exports.prisma = void 0;
// PostgreSQL / Prisma exports
var client_1 = require("./client");
Object.defineProperty(exports, "prisma", { enumerable: true, get: function () { return client_1.prisma; } });
Object.defineProperty(exports, "checkDatabaseHealth", { enumerable: true, get: function () { return client_1.checkDatabaseHealth; } });
Object.defineProperty(exports, "databaseConfig", { enumerable: true, get: function () { return client_1.databaseConfig; } });
__exportStar(require("@prisma/client"), exports);
//# sourceMappingURL=index.js.map