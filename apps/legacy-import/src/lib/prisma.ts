/**
 * Local Prisma Client for Legacy Import App
 *
 * Note: Using a local client instead of the shared @legal-platform/database package
 * because Next.js 16 Turbopack doesn't properly bundle the Proxy-based lazy
 * initialization from the monorepo package.
 */

import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client
declare global {
  var prisma: PrismaClient | undefined;
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export type { PrismaClient };
