// Re-export the shared prisma instance from the database package
// This ensures all apps in the monorepo use the same configured client
export { prisma } from '@legal-platform/database';
export type { PrismaClient } from '@legal-platform/database';
