/**
 * Startup Migrations Index
 *
 * Register all startup migrations here in order of execution.
 * Migrations are run once on server startup and tracked in the database.
 */

import { runStartupMigrations, type Migration } from './runner';
import { migration as reclassifyEmailsSignalFirst } from './2026_01_30_reclassify_emails_signal_first';

/**
 * All registered migrations in order of execution.
 * Add new migrations to this array.
 */
const migrations: Migration[] = [
  reclassifyEmailsSignalFirst,
  // Add future migrations here
];

/**
 * Run all pending startup migrations.
 * Called from index.ts during server startup.
 */
export async function runMigrations(): Promise<void> {
  await runStartupMigrations(migrations);
}
