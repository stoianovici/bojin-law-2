/**
 * Startup Migration Runner
 *
 * Runs one-time data migrations on server startup.
 * Migrations are tracked in the database to ensure they only run once.
 */

import { prisma } from '@legal-platform/database';

export interface Migration {
  /** Unique migration ID (use date prefix for ordering: 2026_01_30_description) */
  id: string;
  /** Human-readable description */
  description: string;
  /** Migration function - should be idempotent */
  run: () => Promise<MigrationResult>;
}

export interface MigrationResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Run all pending startup migrations.
 * Called during server startup before workers are initialized.
 */
export async function runStartupMigrations(migrations: Migration[]): Promise<void> {
  console.log('[Migrations] Checking for pending startup migrations...');

  // Ensure the migrations tracking table exists
  await ensureMigrationsTable();

  // Get list of already-applied migrations
  const applied = await getAppliedMigrations();
  const appliedSet = new Set(applied);

  // Filter to pending migrations
  const pending = migrations.filter((m) => !appliedSet.has(m.id));

  if (pending.length === 0) {
    console.log('[Migrations] No pending migrations');
    return;
  }

  console.log(`[Migrations] Running ${pending.length} pending migration(s)...`);

  for (const migration of pending) {
    console.log(`[Migrations] Running: ${migration.id} - ${migration.description}`);

    try {
      const result = await migration.run();

      if (result.success) {
        // Mark as applied
        await markMigrationApplied(migration.id);
        console.log(`[Migrations] ✅ ${migration.id}: ${result.message}`);
        if (result.details) {
          console.log(`[Migrations]    Details:`, result.details);
        }
      } else {
        console.error(`[Migrations] ❌ ${migration.id} failed: ${result.message}`);
        // Don't stop on failure - log and continue
        // The migration can be retried on next startup
      }
    } catch (error) {
      console.error(`[Migrations] ❌ ${migration.id} threw error:`, error);
      // Continue with other migrations
    }
  }

  console.log('[Migrations] Migration run complete');
}

/**
 * Ensure the startup_migrations table exists.
 */
async function ensureMigrationsTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS startup_migrations (
      id VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Get list of already-applied migration IDs.
 */
async function getAppliedMigrations(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM startup_migrations ORDER BY applied_at`
  );
  return rows.map((r) => r.id);
}

/**
 * Mark a migration as applied.
 */
async function markMigrationApplied(id: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO startup_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
    id
  );
}
