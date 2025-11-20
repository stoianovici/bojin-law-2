/**
 * Manual mock for @legal-platform/database
 * Used in Jest tests to mock database and Redis functionality
 */

export const sessionManager = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
} as any;

export const cacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  stats: jest.fn(),
};

export const redis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  ping: jest.fn(),
};

export const prisma = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

export const checkDatabaseHealth = jest.fn();
export const checkRedisHealth = jest.fn();

export const databaseConfig = {
  url: 'mock-database-url',
  maxConnections: 10,
};

export const getRedisConfig = jest.fn(() => ({
  host: 'localhost',
  port: 6379,
}));
