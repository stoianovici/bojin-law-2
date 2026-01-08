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

    // Check and create personal_threads table if it doesn't exist
    const personalThreadsTable = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'personal_threads'
    `;

    if (personalThreadsTable.length === 0) {
      console.log('Creating personal_threads table...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "personal_threads" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "conversation_id" TEXT NOT NULL,
          "user_id" TEXT NOT NULL,
          "firm_id" TEXT NOT NULL,
          "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
          CONSTRAINT "personal_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
          CONSTRAINT "personal_threads_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "personal_threads_conversation_id_firm_id_key"
        ON "personal_threads"("conversation_id", "firm_id")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "personal_threads_user_id_idx" ON "personal_threads"("user_id")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "personal_threads_firm_id_idx" ON "personal_threads"("firm_id")
      `);
      console.log('personal_threads table created successfully');
    } else {
      console.log('personal_threads table already exists, skipping');
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
