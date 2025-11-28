/**
 * Prisma Client for Legacy Import App
 *
 * NOTE: In pnpm monorepos, @prisma/client is symlinked to the hoisted location.
 * The legacy-import build runs prisma generate AFTER packages/database build,
 * which overwrites the hoisted .prisma/client with our schema's models.
 */

import { PrismaClient } from '@prisma/client';

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
