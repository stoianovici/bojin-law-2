#!/usr/bin/env ts-node

/**
 * Test Database Seeding Script
 * Seeds the test database with sample data for integration and E2E testing
 */

import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import {
  createPartner,
  createAssociate,
  createParalegal,
  createActiveCase,
  createOnHoldCase,
  createContract,
  createMotion,
  createResearchTask,
  createDocumentCreationTask,
} from '../packages/shared/test-utils/src/factories';

// Load test environment variables
dotenv.config({ path: '.env.test' });

/**
 * Database connection pool
 */
let pool: Pool;

/**
 * Connect to the test database
 */
async function connectToDatabase(): Promise<Pool> {
  const connectionString =
    process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5433/legal_platform_test';

  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Test the connection
  await pool.query('SELECT NOW()');
  console.log(`📦 Connected to test database`);

  return pool;
}

/**
 * Clean existing test data
 */
async function cleanDatabase() {
  console.log('🧹 Cleaning existing test data...');
  await pool.query('TRUNCATE TABLE tasks, documents, cases, users CASCADE');
}

/**
 * Create test users
 */
async function createTestUsers() {
  console.log('👤 Creating test users...');

  // Create users with factory functions
  const partner = createPartner({
    email: 'partner@legal-platform.test',
    firstName: 'Ion',
    lastName: 'Popescu',
  });
  const associate = createAssociate({
    email: 'associate@legal-platform.test',
    firstName: 'Maria',
    lastName: 'Ionescu',
  });
  const paralegal = createParalegal({
    email: 'paralegal@legal-platform.test',
    firstName: 'Ștefan',
    lastName: 'Văduva',
  });

  const users = [partner, associate, paralegal];

  // Insert users into database
  for (const user of users) {
    await pool.query(
      `INSERT INTO users (id, email, first_name, last_name, role, firm_id, azure_ad_id, preferences, created_at, last_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        user.id,
        user.email,
        user.firstName,
        user.lastName,
        user.role,
        user.firmId,
        user.azureAdId,
        JSON.stringify(user.preferences),
        user.createdAt,
        user.lastActive,
      ]
    );
  }

  console.log(`   ✓ Created ${users.length} users`);
  return users;
}

/**
 * Create test cases
 */
async function createTestCases(users: any[]) {
  console.log('📂 Creating test cases...');

  // Create cases with factory functions
  const activeCase = createActiveCase();
  const onHoldCase = createOnHoldCase();

  const cases = [activeCase, onHoldCase];

  // Insert cases into database
  for (const caseItem of cases) {
    await pool.query(
      `INSERT INTO cases (id, case_number, title, client_id, status, case_type, description, opened_date, closed_date, value, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        caseItem.id,
        caseItem.caseNumber,
        caseItem.title,
        caseItem.clientId,
        caseItem.status,
        caseItem.type,
        caseItem.description,
        caseItem.openedDate,
        caseItem.closedDate,
        caseItem.value,
        JSON.stringify(caseItem.metadata),
        caseItem.createdAt,
        caseItem.updatedAt,
      ]
    );
  }

  console.log(`   ✓ Created ${cases.length} cases`);
  return cases;
}

/**
 * Create test documents
 */
async function createTestDocuments(users: any[], cases: any[]) {
  console.log('📄 Creating test documents...');

  const partner = users[0];
  const activeCase = cases[0];

  // Create documents with factory functions
  const contract = createContract({
    caseId: activeCase.id,
    createdBy: partner.id,
  });
  const motion = createMotion({
    caseId: activeCase.id,
    createdBy: partner.id,
  });

  const documents = [contract, motion];

  // Insert documents into database
  for (const doc of documents) {
    await pool.query(
      `INSERT INTO documents (id, case_id, title, type, current_version, status, blob_storage_url, ai_generated, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        doc.id,
        doc.caseId,
        doc.title,
        doc.type,
        doc.currentVersion,
        doc.status,
        doc.blobStorageUrl,
        doc.aiGenerated,
        doc.createdBy,
        doc.createdAt,
        doc.updatedAt,
      ]
    );
  }

  console.log(`   ✓ Created ${documents.length} documents`);
  return documents;
}

/**
 * Create test tasks
 */
async function createTestTasks(users: any[], cases: any[]) {
  console.log('✅ Creating test tasks...');

  const associate = users[1];
  const activeCase = cases[0];

  // Create tasks with factory functions
  const researchTask = createResearchTask({
    caseId: activeCase.id,
    assignedTo: associate.id,
  });
  const docCreationTask = createDocumentCreationTask({
    caseId: activeCase.id,
    assignedTo: associate.id,
  });

  const tasks = [researchTask, docCreationTask];

  // Insert tasks into database
  for (const task of tasks) {
    await pool.query(
      `INSERT INTO tasks (id, case_id, title, description, type, assigned_to, status, priority, due_date, completed_date, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        task.id,
        task.caseId,
        task.title,
        task.description,
        task.type,
        task.assignedTo,
        task.status,
        task.priority,
        task.dueDate,
        task.completedDate,
        JSON.stringify(task.metadata),
        task.createdAt,
        task.updatedAt,
      ]
    );
  }

  console.log(`   ✓ Created ${tasks.length} tasks`);
  return tasks;
}

/**
 * Main seeding function
 */
async function seedTestDatabase() {
  console.log('🌱 Starting test database seeding...');

  try {
    // Connect to database
    const connectionString = process.env.TEST_DATABASE_URL;
    if (!connectionString) {
      console.warn('⚠️  TEST_DATABASE_URL not set, using default connection');
    }

    await connectToDatabase();

    // Clean existing data
    await cleanDatabase();

    // Create test data using factories
    const users = await createTestUsers();
    const cases = await createTestCases(users);
    const documents = await createTestDocuments(users, cases);
    const tasks = await createTestTasks(users, cases);

    console.log('\n✅ Test database seeding completed successfully!');
    console.log(
      `   📊 Summary: ${users.length} users, ${cases.length} cases, ${documents.length} documents, ${tasks.length} tasks`
    );
  } catch (error) {
    console.error('❌ Test database seeding failed:', error);
    throw error;
  } finally {
    // Close database connection
    if (pool) {
      await pool.end();
    }
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedTestDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedTestDatabase };
