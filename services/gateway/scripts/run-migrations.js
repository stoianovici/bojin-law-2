#!/usr/bin/env node
/**
 * Simple migration runner using Prisma Client
 * Runs pending migrations by executing raw SQL
 * Used in Docker container where Prisma CLI is not available
 */

const { PrismaClient } = require('@prisma/client');

async function runMigrations() {
  console.log('=== Running migrations via Prisma Client ===');

  const prisma = new PrismaClient();

  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connection OK');

    // Run the sync_error migration if column doesn't exist
    const result = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cases' AND column_name = 'sync_error'
    `;

    if (result.length === 0) {
      console.log('Adding sync_error column to cases table...');
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "sync_error" TEXT`
      );
      console.log('sync_error column added successfully');
    } else {
      console.log('sync_error column already exists, skipping');
    }

    console.log('=== Migrations complete ===');
  } catch (error) {
    console.error('Migration error:', error.message);
    // Don't exit with error - let the server start anyway
    // The column might already exist or there might be a different issue
    console.log('Continuing with server startup despite migration error');
  } finally {
    await prisma.$disconnect();
  }
}

runMigrations();
