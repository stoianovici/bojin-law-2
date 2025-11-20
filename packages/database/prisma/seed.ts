/**
 * Prisma Seed Script for Legal Platform
 *
 * This script seeds the database with test data for development and testing.
 * See seed-data-schema.md for complete data structure documentation.
 *
 * Run with: pnpm db:seed
 *
 * NOTE: This script requires the full Prisma schema to be defined.
 * Models required: Firm, User, Case, Document, Task
 * These models will be added in Stories 2.4, 2.6, 2.7, 2.8
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Helper function to generate random past date
function randomPastDate(daysAgo: number): Date {
  const now = new Date();
  const randomDays = Math.floor(Math.random() * daysAgo);
  return new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000);
}

// Helper function to generate future date
function futureDateFromNow(daysAhead: number): Date {
  const now = new Date();
  return new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Check if seed data already exists (idempotency check)
  console.log('Checking for existing seed data...');

  // Check if users already exist (Story 2.4: User model)
  const existingUsers = await prisma.user.findFirst({
    where: { email: 'partner@demo.lawfirm.ro' }
  });

  if (existingUsers) {
    console.log('⚠️  Seed data already exists. Skipping seed.');
    console.log('To re-seed, first run: npx prisma migrate reset');
    return;
  }

  console.log('Creating test law firm...');

  // Create Law Firm
  // TODO: Uncomment once Firm model is added in Story 2.4
  // const firm = await prisma.firm.create({
  //   data: {
  //     id: randomUUID(),
  //     name: 'Demo Law Firm S.R.L.',
  //     vat_id: 'RO12345678',
  //     address: 'Strada Demo 123, Bucharest, Romania',
  //     email: 'demo@lawfirm.ro',
  //     phone: '+40-123-456-789',
  //     website: 'https://demo.lawfirm.ro',
  //     created_at: randomPastDate(365),
  //     updated_at: new Date()
  //   }
  // });
  // console.log(`✓ Created firm: ${firm.name}`);

  // Create Users (1 Partner, 2 Associates, 2 Paralegals)
  // Story 2.4: Users with Azure AD integration
  console.log('Creating users...');

  const users = await Promise.all([
    // Partner (Active)
    prisma.user.create({
      data: {
        id: randomUUID(),
        firmId: null, // Will be assigned when Firm model is added
        firstName: 'Alex',
        lastName: 'Popescu',
        email: 'partner@demo.lawfirm.ro',
        role: 'Partner',
        status: 'Active',
        azureAdId: 'aad-partner-demo-12345',
        preferences: { language: 'ro', aiSuggestionLevel: 'high' },
        createdAt: randomPastDate(300),
        lastActive: new Date()
      }
    }),
    // Associate 1 (Active)
    prisma.user.create({
      data: {
        id: randomUUID(),
        firmId: null, // Will be assigned when Firm model is added
        firstName: 'Maria',
        lastName: 'Ionescu',
        email: 'associate1@demo.lawfirm.ro',
        role: 'Associate',
        status: 'Active',
        azureAdId: 'aad-assoc1-demo-67890',
        preferences: { language: 'ro', aiSuggestionLevel: 'moderate' },
        createdAt: randomPastDate(250),
        lastActive: randomPastDate(1)
      }
    }),
    // Associate 2 (Active)
    prisma.user.create({
      data: {
        id: randomUUID(),
        firmId: null, // Will be assigned when Firm model is added
        firstName: 'Ion',
        lastName: 'Georgescu',
        email: 'associate2@demo.lawfirm.ro',
        role: 'Associate',
        status: 'Active',
        azureAdId: 'aad-assoc2-demo-11111',
        preferences: { language: 'ro', aiSuggestionLevel: 'moderate' },
        createdAt: randomPastDate(200),
        lastActive: randomPastDate(3)
      }
    }),
    // Paralegal 1 (Active)
    prisma.user.create({
      data: {
        id: randomUUID(),
        firmId: null, // Will be assigned when Firm model is added
        firstName: 'Elena',
        lastName: 'Popa',
        email: 'paralegal1@demo.lawfirm.ro',
        role: 'Paralegal',
        status: 'Active',
        azureAdId: 'aad-para1-demo-22222',
        preferences: { language: 'ro', aiSuggestionLevel: 'low' },
        createdAt: randomPastDate(150),
        lastActive: randomPastDate(2)
      }
    }),
    // Paralegal 2 (Active)
    prisma.user.create({
      data: {
        id: randomUUID(),
        firmId: null, // Will be assigned when Firm model is added
        firstName: 'Mihai',
        lastName: 'Dumitrescu',
        email: 'paralegal2@demo.lawfirm.ro',
        role: 'Paralegal',
        status: 'Active',
        azureAdId: 'aad-para2-demo-33333',
        preferences: { language: 'ro', aiSuggestionLevel: 'moderate' },
        createdAt: randomPastDate(100),
        lastActive: new Date()
      }
    }),
    // Test Pending User (awaiting activation)
    prisma.user.create({
      data: {
        id: randomUUID(),
        firmId: null,
        firstName: 'Test',
        lastName: 'Pending',
        email: 'pending@demo.lawfirm.ro',
        role: 'Paralegal',
        status: 'Pending',
        azureAdId: 'aad-pending-demo-44444',
        preferences: { language: 'ro', aiSuggestionLevel: 'moderate' },
        createdAt: randomPastDate(7),
        lastActive: randomPastDate(7)
      }
    }),
    // Test Inactive User
    prisma.user.create({
      data: {
        id: randomUUID(),
        firmId: null,
        firstName: 'Test',
        lastName: 'Inactive',
        email: 'inactive@demo.lawfirm.ro',
        role: 'Paralegal',
        status: 'Inactive',
        azureAdId: 'aad-inactive-demo-55555',
        preferences: { language: 'ro', aiSuggestionLevel: 'moderate' },
        createdAt: randomPastDate(365),
        lastActive: randomPastDate(180)
      }
    })
  ]);
  console.log(`✓ Created ${users.length} users (${users.filter(u => u.status === 'Active').length} Active, ${users.filter(u => u.status === 'Pending').length} Pending, ${users.filter(u => u.status === 'Inactive').length} Inactive)`);

  // Create Cases (10 cases with various statuses and types)
  console.log('Creating sample cases...');

  // TODO: Uncomment once Case model is added in Story 2.6
  // const cases = await Promise.all([
  //   // Active cases (4)
  //   prisma.case.create({
  //     data: {
  //       id: randomUUID(),
  //       firm_id: firm.id,
  //       case_number: 'CASE-2024-001',
  //       title: 'Contract Dispute - ABC Corp vs XYZ Ltd',
  //       case_type: 'Civil',
  //       status: 'Active',
  //       priority: 'High',
  //       description: 'Contract dispute regarding delivery terms and payment schedule',
  //       opened_date: new Date('2024-01-15'),
  //       assigned_partner_id: users[0].id,
  //       assigned_associate_id: users[1].id,
  //       court_name: 'Bucharest Tribunal',
  //       judge_name: 'Judge Ion Vasilescu',
  //       next_hearing_date: futureDateFromNow(30),
  //       created_at: new Date('2024-01-15'),
  //       updated_at: new Date()
  //     }
  //   }),
  //   // ... Additional cases defined in seed-data-schema.md
  // ]);
  // console.log(`✓ Created ${cases.length} cases`);

  // Create Documents (20 documents with various types and statuses)
  console.log('Creating sample documents...');

  // TODO: Uncomment once Document model is added in Story 2.7
  // const documents = [];
  // for (let i = 0; i < 20; i++) {
  //   const doc = await prisma.document.create({
  //     data: {
  //       id: randomUUID(),
  //       case_id: cases[i % cases.length].id,
  //       title: `Document ${i + 1}`,
  //       document_type: ['Contract', 'Pleading', 'Motion', 'Brief', 'Evidence'][i % 5],
  //       status: ['Draft', 'Review', 'Approved', 'Filed'][i % 4],
  //       file_name: `document_${i + 1}.pdf`,
  //       file_size_bytes: Math.floor(Math.random() * 5000000) + 100000,
  //       mime_type: 'application/pdf',
  //       storage_url: `r2://legal-docs/2024/doc_${i + 1}.pdf`,
  //       version: 1,
  //       ai_generated: i % 2 === 0,
  //       created_by_user_id: users[i % users.length].id,
  //       created_at: randomPastDate(90),
  //       updated_at: new Date()
  //     }
  //   });
  //   documents.push(doc);
  // }
  // console.log(`✓ Created ${documents.length} documents`);

  // Create Tasks (30 tasks with various types and statuses)
  console.log('Creating sample tasks...');

  // TODO: Uncomment once Task model is added in Story 2.8
  // const tasks = [];
  // for (let i = 0; i < 30; i++) {
  //   const dueDate = i < 5
  //     ? randomPastDate(7)  // Overdue
  //     : i < 13
  //       ? futureDateFromNow(Math.floor(Math.random() * 7) + 1)  // Due soon
  //       : futureDateFromNow(Math.floor(Math.random() * 30) + 7); // Due later
  //
  //   const status = i < 12 ? 'Pending' : i < 22 ? 'InProgress' : 'Completed';
  //
  //   const task = await prisma.task.create({
  //     data: {
  //       id: randomUUID(),
  //       case_id: cases[i % cases.length].id,
  //       title: `Task ${i + 1}`,
  //       description: `Description for task ${i + 1}`,
  //       task_type: ['Research', 'DocumentCreation', 'DocumentReview', 'ClientCommunication', 'CourtFiling', 'CasePreparation'][i % 6],
  //       status: status,
  //       priority: ['Low', 'Medium', 'High', 'Critical'][i % 4],
  //       assigned_to_user_id: users[1 + (i % 4)].id,  // Assign to Associates and Paralegals
  //       created_by_user_id: users[0].id,  // Partner creates tasks
  //       due_date: dueDate,
  //       estimated_hours: Math.floor(Math.random() * 8) + 1,
  //       actual_hours: status === 'Completed' ? Math.floor(Math.random() * 10) + 1 : null,
  //       completed_at: status === 'Completed' ? randomPastDate(30) : null,
  //       created_at: randomPastDate(60),
  //       updated_at: new Date()
  //     }
  //   });
  //   tasks.push(task);
  // }
  // console.log(`✓ Created ${tasks.length} tasks`);

  console.log('');
  console.log('✅ Database seed completed successfully!');
  console.log('');
  console.log('Summary:');
  console.log(`  - Users: ${users.length} (Story 2.4 - Authentication)`);
  console.log(`    • ${users.filter(u => u.status === 'Active').length} Active users`);
  console.log(`    • ${users.filter(u => u.status === 'Pending').length} Pending user (awaiting activation)`);
  console.log(`    • ${users.filter(u => u.status === 'Inactive').length} Inactive user`);
  console.log('');
  console.log('Note: Additional models will be added in future stories:');
  console.log('  - Firms: Story 2.6 (Case Management)');
  console.log('  - Cases: Story 2.6 (Case Management)');
  console.log('  - Documents: Story 2.7 (Document Management)');
  console.log('  - Tasks: Story 2.8 (Task Management)');
  console.log('');
  console.log('To view data: npx prisma studio');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error during seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
