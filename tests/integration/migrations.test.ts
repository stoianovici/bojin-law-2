/**
 * Database Migration Integration Tests
 *
 * Tests migration infrastructure including:
 * - Prisma migration execution
 * - Migration rollback capability
 * - Migration history tracking
 * - Seed data execution
 * - Data anonymization
 * - Backup and restore
 *
 * NOTE: These tests require Prisma models to be defined.
 * Models will be added in Stories 2.4 (Auth), 2.6 (Cases), 2.7 (Docs), 2.8 (Tasks).
 */

import { PrismaClient } from '@prisma/client';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

describe('Database Migration Integration Tests', () => {
  let prisma: PrismaClient;
  const TEST_DATABASE_NAME = `test_migrations_${Date.now()}`;
  const TEST_DATABASE_URL = `postgresql://postgres:password@localhost:5432/${TEST_DATABASE_NAME}`;

  beforeAll(async () => {
    // Create test database
    try {
      execSync(`createdb ${TEST_DATABASE_NAME}`, { stdio: 'ignore' });
    } catch (error) {
      console.warn('Database might already exist or createdb not available');
    }

    // Initialize Prisma with test database
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    prisma = new PrismaClient({
      datasources: { db: { url: TEST_DATABASE_URL } },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.$disconnect();

    // Drop test database
    try {
      execSync(`dropdb ${TEST_DATABASE_NAME}`, { stdio: 'ignore' });
    } catch (error) {
      console.warn('Could not drop test database');
    }
  });

  describe('Prisma Migrations', () => {
    test('should apply migrations successfully', async () => {
      // Run migrations
      const { stdout, stderr } = await execAsync(
        'npx prisma migrate deploy --schema=./packages/database/prisma/schema.prisma',
        { env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL } }
      );

      expect(stderr).not.toContain('Error');
      expect(stdout).toContain('Applied') || expect(stdout).toContain('up to date');
    });

    test('should track migration history in _prisma_migrations table', async () => {
      // Query migration history
      const migrations = await prisma.$queryRaw<
        Array<{
          migration_name: string;
          finished_at: Date;
          applied_steps_count: number;
        }>
      >`
        SELECT migration_name, finished_at, applied_steps_count
        FROM _prisma_migrations
        ORDER BY finished_at DESC
      `;

      expect(migrations.length).toBeGreaterThan(0);
      expect(migrations[0]).toHaveProperty('migration_name');
      expect(migrations[0]).toHaveProperty('finished_at');
      expect(migrations[0].applied_steps_count).toBeGreaterThan(0);
    });

    test('should report migration status correctly', async () => {
      const { stdout } = await execAsync(
        'npx prisma migrate status --schema=./packages/database/prisma/schema.prisma',
        { env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL } }
      );

      expect(stdout).toContain('up to date') || expect(stdout).toContain('Applied');
    });

    test('migration history script should execute without errors', async () => {
      const { stdout, stderr } = await execAsync(
        './packages/database/scripts/migration-history.sh',
        { env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL } }
      );

      expect(stderr).not.toContain('Error');
      expect(stdout).toContain('Migration History');
    });
  });

  describe('Seed Data', () => {
    // TODO: Uncomment once Prisma models are added
    test.skip('should seed database with test data', async () => {
      /*
      // Run seed script
      await execAsync('npm run db:seed', {
        cwd: './packages/database',
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      });

      // Verify seeded data
      const firms = await prisma.firm.count();
      const users = await prisma.user.count();
      const cases = await prisma.case.count();
      const documents = await prisma.document.count();
      const tasks = await prisma.task.count();

      expect(firms).toBe(1); // 1 Demo Law Firm
      expect(users).toBe(5); // 1 Partner + 2 Associates + 2 Paralegals
      expect(cases).toBe(10); // 10 sample cases
      expect(documents).toBe(20); // 20 sample documents
      expect(tasks).toBe(30); // 30 sample tasks
      */
    });

    test.skip('should be idempotent (no duplicates on re-run)', async () => {
      /*
      // Run seed script twice
      await execAsync('npm run db:seed', {
        cwd: './packages/database',
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      });

      const firstCount = await prisma.firm.count();

      await execAsync('npm run db:seed', {
        cwd: './packages/database',
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      });

      const secondCount = await prisma.firm.count();

      expect(firstCount).toBe(secondCount); // No duplicates
      expect(firstCount).toBe(1); // Still only 1 firm
      */
    });

    test.skip('should maintain referential integrity', async () => {
      /*
      // Run seed script
      await execAsync('npm run db:seed', {
        cwd: './packages/database',
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      });

      // Check foreign keys are valid
      const invalidCases = await prisma.$queryRaw<Array<any>>`
        SELECT c.id FROM cases c
        LEFT JOIN users u ON c.assigned_partner_id = u.id
        WHERE c.assigned_partner_id IS NOT NULL AND u.id IS NULL
      `;

      expect(invalidCases.length).toBe(0); // No orphaned cases
      */
    });
  });

  describe('Data Anonymization', () => {
    test.skip('should anonymize PII fields correctly', async () => {
      /*
      // Insert test user with real-looking data
      await prisma.user.create({
        data: {
          id: '00000000-0000-0000-0000-000000000001',
          firm_id: '00000000-0000-0000-0000-000000000002',
          email: 'john.doe@realfirm.ro',
          first_name: 'John',
          last_name: 'Doe',
          azure_ad_id: 'real-azure-id-123',
          role: 'Associate',
          is_active: true,
        },
      });

      // Run anonymization
      await execAsync('npm run db:anonymize', {
        cwd: './packages/database',
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      });

      // Verify anonymization
      const user = await prisma.user.findUnique({
        where: { id: '00000000-0000-0000-0000-000000000001' },
      });

      expect(user).toBeDefined();
      expect(user!.email).toMatch(/demo\d+@example\.com/); // Anonymized email
      expect(user!.email).not.toContain('john.doe'); // Original email gone
      expect(user!.first_name).toMatch(/Demo User/); // Anonymized name
      expect(user!.azure_ad_id).not.toBe('real-azure-id-123'); // Azure ID changed
      */
    });

    test.skip('should preserve database structure and relationships', async () => {
      /*
      // Seed database
      await execAsync('npm run db:seed', {
        cwd: './packages/database',
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      });

      const beforeCounts = {
        users: await prisma.user.count(),
        cases: await prisma.case.count(),
        documents: await prisma.document.count(),
      };

      // Run anonymization
      await execAsync('npm run db:anonymize', {
        cwd: './packages/database',
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      });

      const afterCounts = {
        users: await prisma.user.count(),
        cases: await prisma.case.count(),
        documents: await prisma.document.count(),
      };

      // Counts should match (structure preserved)
      expect(afterCounts.users).toBe(beforeCounts.users);
      expect(afterCounts.cases).toBe(beforeCounts.cases);
      expect(afterCounts.documents).toBe(beforeCounts.documents);
      */
    });

    test('anonymization script should reject production database URLs', async () => {
      // Set production-like URL
      const prodUrl = 'postgresql://user:pass@render.com:5432/prod_db';

      // Should fail with error
      await expect(
        execAsync('npm run db:anonymize', {
          cwd: './packages/database',
          env: { ...process.env, DATABASE_URL: prodUrl },
        })
      ).rejects.toThrow();
    });
  });

  describe('Backup and Restore', () => {
    const backupDir = './packages/database/backups';
    const testBackupFile = path.join(backupDir, 'test-backup.sql.gz');

    beforeAll(() => {
      // Ensure backup directory exists
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
    });

    afterAll(() => {
      // Cleanup test backup file
      if (fs.existsSync(testBackupFile)) {
        fs.unlinkSync(testBackupFile);
      }
    });

    test('backup script should create backup file', async () => {
      // Run backup script
      const { stderr } = await execAsync('./packages/database/scripts/backup-database.sh', {
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      });

      expect(stderr).not.toContain('Error');

      // Verify backup file created
      const files = fs.readdirSync(backupDir);
      const backupFiles = files.filter((f) => f.startsWith('backup-'));

      expect(backupFiles.length).toBeGreaterThan(0);
    });

    test.skip('restore script should restore database from backup', async () => {
      /*
      // Insert test data
      await prisma.user.create({
        data: {
          id: '00000000-0000-0000-0000-000000000003',
          firm_id: '00000000-0000-0000-0000-000000000002',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          azure_ad_id: 'test-azure-id',
          role: 'Associate',
          is_active: true,
        },
      });

      const beforeCount = await prisma.user.count();

      // Create backup
      await execAsync('./packages/database/scripts/backup-database.sh', {
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      });

      // Delete test data
      await prisma.user.delete({
        where: { id: '00000000-0000-0000-0000-000000000003' },
      });

      const afterDeleteCount = await prisma.user.count();
      expect(afterDeleteCount).toBe(beforeCount - 1);

      // Restore from backup
      // Note: This would require interactive input, so we'll test the script exists
      const scriptExists = fs.existsSync('./packages/database/scripts/restore-database.sh');
      expect(scriptExists).toBe(true);

      // In real test, would restore and verify:
      // const afterRestoreCount = await prisma.user.count();
      // expect(afterRestoreCount).toBe(beforeCount);
      */
    });

    test('backup file should be compressed', async () => {
      // Create a backup
      await execAsync('./packages/database/scripts/backup-database.sh', {
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      });

      // Find latest backup
      const files = fs.readdirSync(backupDir);
      const backupFiles = files.filter((f) => f.startsWith('backup-') && f.endsWith('.gz'));

      expect(backupFiles.length).toBeGreaterThan(0);

      // Verify file is not empty
      const latestBackup = path.join(backupDir, backupFiles[backupFiles.length - 1]);
      const stats = fs.statSync(latestBackup);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Migration Rollback', () => {
    test('rollback script should exist and be executable', () => {
      const scriptPath = './packages/database/scripts/rollback-migration.sh';
      expect(fs.existsSync(scriptPath)).toBe(true);

      const stats = fs.statSync(scriptPath);
      const isExecutable = (stats.mode & 0o111) !== 0;
      expect(isExecutable).toBe(true);
    });

    test('rollback script should require confirmation for production', async () => {
      const prodUrl = 'postgresql://user:pass@render.com:5432/prod_db';

      // Script should detect production and require confirmation
      // (This will fail because we won't provide confirmation input)
      await expect(
        execAsync('./packages/database/scripts/rollback-migration.sh', {
          env: { ...process.env, DATABASE_URL: prodUrl },
          input: 'no\n', // Reject confirmation
        })
      ).rejects.toThrow();
    });
  });

  describe('Zero-Downtime Migration Patterns', () => {
    test.skip('expand phase: adding new column should not break existing code', async () => {
      /*
      // Simulate expand phase: add new column
      await prisma.$executeRaw`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(200);
      `;

      // Old code should still work (reading from 'name' column)
      const users = await prisma.$queryRaw`
        SELECT id, first_name, last_name FROM users LIMIT 1
      `;

      expect(users).toBeDefined();
      // Old code continues to work
      */
    });

    test.skip('dual-write phase: should write to both old and new columns', async () => {
      /*
      // Simulate dual-write
      await prisma.user.create({
        data: {
          first_name: 'Test', // Old column
          full_name: 'Test User', // New column
          // ... other fields
        },
      });

      const user = await prisma.user.findFirst({
        where: { first_name: 'Test' },
      });

      expect(user!.first_name).toBe('Test');
      expect(user!.full_name).toBe('Test User');
      // Both columns populated
      */
    });
  });

  describe('Migration Scripts Availability', () => {
    const scripts = [
      'run-migration.sh',
      'rollback-migration.sh',
      'migration-history.sh',
      'backup-database.sh',
      'restore-database.sh',
      'export-production.sh',
      'import-anonymized.sh',
    ];

    test.each(scripts)('%s should exist and be executable', (scriptName) => {
      const scriptPath = `./packages/database/scripts/${scriptName}`;
      expect(fs.existsSync(scriptPath)).toBe(true);

      const stats = fs.statSync(scriptPath);
      const isExecutable = (stats.mode & 0o111) !== 0;
      expect(isExecutable).toBe(true);
    });

    test('anonymize-data.ts should exist', () => {
      const scriptPath = './packages/database/scripts/anonymize-data.ts';
      expect(fs.existsSync(scriptPath)).toBe(true);
    });

    test('seed.ts should exist', () => {
      const seedPath = './packages/database/prisma/seed.ts';
      expect(fs.existsSync(seedPath)).toBe(true);
    });
  });

  describe('Documentation Availability', () => {
    const docs = [
      'docs/runbooks/database-migration-runbook.md',
      'docs/runbooks/database-quick-start.md',
      'docs/runbooks/migration-risk-assessment.md',
      'docs/templates/migration-announcement-template.md',
      'docs/architecture/database-migration-patterns.md',
    ];

    test.each(docs)('%s should exist', (docPath) => {
      expect(fs.existsSync(docPath)).toBe(true);
    });
  });

  describe('Package.json Scripts', () => {
    test('package.json should have all required scripts', () => {
      const packageJsonPath = './packages/database/package.json';
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      const requiredScripts = [
        'db:migrate',
        'db:migrate:deploy',
        'db:migrate:status',
        'db:migrate:undo',
        'db:migrate:history',
        'db:seed',
        'db:anonymize',
        'db:export',
        'db:import:anonymized',
        'db:backup',
        'db:restore',
        'db:validate',
      ];

      requiredScripts.forEach((script) => {
        expect(packageJson.scripts).toHaveProperty(script);
      });
    });

    test('prisma seed configuration should be present', () => {
      const packageJsonPath = './packages/database/package.json';
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      expect(packageJson.prisma).toHaveProperty('seed');
      expect(packageJson.prisma.seed).toContain('seed.ts');
    });
  });

  describe('Migration Performance', () => {
    test('migration should complete within timeout', async () => {
      const startTime = Date.now();

      await execAsync(
        'npx prisma migrate deploy --schema=./packages/database/prisma/schema.prisma',
        {
          env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
          timeout: 60000, // 60 seconds
        }
      );

      const duration = Date.now() - startTime;

      // Migration should complete in under 30 seconds for test schema
      expect(duration).toBeLessThan(30000);
    });
  });
});
