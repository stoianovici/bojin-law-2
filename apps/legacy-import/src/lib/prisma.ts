/**
 * Prisma Client for Legacy Import App
 * Uses locally generated client from app's own prisma schema
 *
 * IMPORTANT: Import from .prisma/client (our custom output location)
 * to avoid pnpm monorepo hoisting issues where @prisma/client
 * resolves to a different package without our generated models.
 */

import { PrismaClient } from '.prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

export const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export type { PrismaClient };
