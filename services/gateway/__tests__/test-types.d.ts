/**
 * Type declarations for test mocks
 *
 * This file provides type overrides for mocked modules so TypeScript
 * recognizes mock methods like mockResolvedValue, mockImplementation, etc.
 */

import { PrismaClient } from '@prisma/client';

// Extend Prisma client methods to include jest.Mock methods in test context
type DeepMocked<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? jest.Mock<ReturnType<T[K]>, Parameters<T[K]>> & T[K]
    : T[K] extends object
    ? DeepMocked<T[K]>
    : T[K];
} & T;

declare module '@legal-platform/database' {
  export const prisma: DeepMocked<PrismaClient> & {
    $transaction: jest.Mock;
    $connect: jest.Mock;
    $disconnect: jest.Mock;
    $queryRaw: jest.Mock;
    $queryRawUnsafe: jest.Mock;
    $executeRaw: jest.Mock;
    $executeRawUnsafe: jest.Mock;
  };

  export const redis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    expire: jest.Mock;
    ttl: jest.Mock;
    ping: jest.Mock;
    keys: jest.Mock;
    mget: jest.Mock;
    hget: jest.Mock;
    hset: jest.Mock;
    hdel: jest.Mock;
    hgetall: jest.Mock;
    sadd: jest.Mock;
    smembers: jest.Mock;
    srem: jest.Mock;
  };

  export const sessionManager: {
    get: jest.Mock;
    set: jest.Mock;
    delete: jest.Mock;
    exists: jest.Mock;
    ttl: jest.Mock;
  };

  export const cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    delete: jest.Mock;
    clear: jest.Mock;
    stats: jest.Mock;
  };
}
