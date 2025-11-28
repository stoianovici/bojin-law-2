/**
 * Prisma Client for Legacy Import App
 *
 * IMPORTANT: We import from a local generated directory to avoid pnpm hoisting issues.
 * The Prisma client is generated to src/generated/prisma/ during build.
 * This ensures the client with all models is bundled correctly by Next.js.
 */

import { PrismaClient } from '@/generated/prisma';

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
