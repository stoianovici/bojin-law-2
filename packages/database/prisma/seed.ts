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
    where: { email: 'partner@demo.lawfirm.ro' },
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
        lastActive: new Date(),
      },
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
        lastActive: randomPastDate(1),
      },
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
        lastActive: randomPastDate(3),
      },
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
        lastActive: randomPastDate(2),
      },
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
        lastActive: new Date(),
      },
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
        lastActive: randomPastDate(7),
      },
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
        lastActive: randomPastDate(180),
      },
    }),
  ]);
  console.log(
    `✓ Created ${users.length} users (${users.filter((u) => u.status === 'Active').length} Active, ${users.filter((u) => u.status === 'Pending').length} Pending, ${users.filter((u) => u.status === 'Inactive').length} Inactive)`
  );

  // Create Clients (2 clients for testing)
  console.log('Creating sample clients...');
  const firmId = 'demo-firm-' + randomUUID().substring(0, 8);

  const clients = await Promise.all([
    prisma.client.create({
      data: {
        id: randomUUID(),
        firmId: firmId,
        name: 'SC ABC Industries SRL',
        contactInfo: {
          email: 'contact@abc-industries.ro',
          phone: '+40-21-123-4567',
          primaryContact: 'Ion Marin',
        },
        address: 'Bulevardul Unirii 15, București, România',
        createdAt: randomPastDate(365),
        updatedAt: new Date(),
      },
    }),
    prisma.client.create({
      data: {
        id: randomUUID(),
        firmId: firmId,
        name: 'Familia Popescu',
        contactInfo: {
          email: 'ana.popescu@email.ro',
          phone: '+40-722-111-222',
          primaryContact: 'Ana Popescu',
        },
        address: 'Strada Florilor 42, Cluj-Napoca, România',
        createdAt: randomPastDate(200),
        updatedAt: new Date(),
      },
    }),
  ]);
  console.log(`✓ Created ${clients.length} clients`);

  // Create Cases (10 cases with various statuses and types)
  console.log('Creating sample cases...');
  const cases = await Promise.all([
    // Active Litigation case
    prisma.case.create({
      data: {
        id: randomUUID(),
        firmId: firmId,
        caseNumber: `${firmId.substring(0, 8)}-2025-001`,
        title: 'Contract Dispute - ABC Industries vs XYZ Logistics',
        clientId: clients[0].id,
        status: 'Active',
        type: 'Litigation',
        description: 'Dispute regarding breach of delivery contract and payment terms',
        openedDate: new Date('2025-01-15'),
        value: 150000.0,
        metadata: { courtName: 'Bucharest Tribunal', nextHearing: '2025-02-28' },
        createdAt: randomPastDate(30),
        updatedAt: new Date(),
      },
    }),
    // Active Contract case
    prisma.case.create({
      data: {
        id: randomUUID(),
        firmId: firmId,
        caseNumber: `${firmId.substring(0, 8)}-2025-002`,
        title: 'Commercial Contract Review - ABC Industries',
        clientId: clients[0].id,
        status: 'Active',
        type: 'Contract',
        description: 'Review and negotiation of supplier agreements',
        openedDate: new Date('2025-01-20'),
        value: 25000.0,
        metadata: { deadline: '2025-03-01' },
        createdAt: randomPastDate(25),
        updatedAt: new Date(),
      },
    }),
    // Active Advisory case
    prisma.case.create({
      data: {
        id: randomUUID(),
        firmId: firmId,
        caseNumber: `${firmId.substring(0, 8)}-2025-003`,
        title: 'Corporate Restructuring Advisory',
        clientId: clients[0].id,
        status: 'Active',
        type: 'Advisory',
        description: 'Legal advisory for company restructuring and compliance',
        openedDate: new Date('2025-02-01'),
        value: 75000.0,
        metadata: { phase: 'planning' },
        createdAt: randomPastDate(18),
        updatedAt: new Date(),
      },
    }),
    // OnHold case
    prisma.case.create({
      data: {
        id: randomUUID(),
        firmId: firmId,
        caseNumber: `${firmId.substring(0, 8)}-2024-015`,
        title: 'Employment Dispute - Former Employee',
        clientId: clients[0].id,
        status: 'OnHold',
        type: 'Litigation',
        description: 'Employment termination dispute, awaiting client decision',
        openedDate: new Date('2024-11-10'),
        value: 35000.0,
        metadata: { onHoldReason: 'Awaiting client decision on settlement offer' },
        createdAt: randomPastDate(90),
        updatedAt: new Date(),
      },
    }),
    // Closed case
    prisma.case.create({
      data: {
        id: randomUUID(),
        firmId: firmId,
        caseNumber: `${firmId.substring(0, 8)}-2024-008`,
        title: 'Real Estate Transaction - Property Purchase',
        clientId: clients[1].id,
        status: 'Closed',
        type: 'Contract',
        description: 'Residential property purchase legal support',
        openedDate: new Date('2024-09-15'),
        closedDate: new Date('2024-12-20'),
        value: 12000.0,
        metadata: { propertyValue: 250000, location: 'Cluj-Napoca' },
        createdAt: randomPastDate(120),
        updatedAt: new Date(),
      },
    }),
    // Archived case
    prisma.case.create({
      data: {
        id: randomUUID(),
        firmId: firmId,
        caseNumber: `${firmId.substring(0, 8)}-2024-003`,
        title: 'Estate Planning and Will',
        clientId: clients[1].id,
        status: 'Archived',
        type: 'Advisory',
        description: 'Estate planning and will preparation',
        openedDate: new Date('2024-03-10'),
        closedDate: new Date('2024-05-20'),
        value: 5000.0,
        metadata: { documentsExecuted: true },
        createdAt: randomPastDate(300),
        updatedAt: new Date(),
      },
    }),
    // Active Criminal case
    prisma.case.create({
      data: {
        id: randomUUID(),
        firmId: firmId,
        caseNumber: `${firmId.substring(0, 8)}-2025-004`,
        title: 'Criminal Defense - White Collar Crime',
        clientId: clients[0].id,
        status: 'Active',
        type: 'Criminal',
        description: 'Defense in fraud investigation',
        openedDate: new Date('2025-01-28'),
        value: 200000.0,
        metadata: { courtName: 'High Court of Cassation', urgent: true },
        createdAt: randomPastDate(10),
        updatedAt: new Date(),
      },
    }),
    // Active Litigation case 2
    prisma.case.create({
      data: {
        id: randomUUID(),
        firmId: firmId,
        caseNumber: `${firmId.substring(0, 8)}-2025-005`,
        title: 'Intellectual Property Dispute',
        clientId: clients[0].id,
        status: 'Active',
        type: 'Litigation',
        description: 'Trademark infringement case',
        openedDate: new Date('2025-02-05'),
        value: 85000.0,
        metadata: { courtName: 'Bucharest Court', trademark: 'ABC-BRAND' },
        createdAt: randomPastDate(12),
        updatedAt: new Date(),
      },
    }),
    // Other case type
    prisma.case.create({
      data: {
        id: randomUUID(),
        firmId: firmId,
        caseNumber: `${firmId.substring(0, 8)}-2025-006`,
        title: 'Regulatory Compliance Review',
        clientId: clients[0].id,
        status: 'Active',
        type: 'Other',
        description: 'GDPR and data protection compliance assessment',
        openedDate: new Date('2025-01-10'),
        value: 45000.0,
        metadata: { scope: 'Full compliance audit' },
        createdAt: randomPastDate(35),
        updatedAt: new Date(),
      },
    }),
    // Closed Litigation case
    prisma.case.create({
      data: {
        id: randomUUID(),
        firmId: firmId,
        caseNumber: `${firmId.substring(0, 8)}-2024-012`,
        title: 'Commercial Lease Dispute',
        clientId: clients[0].id,
        status: 'Closed',
        type: 'Litigation',
        description: 'Landlord-tenant dispute resolution',
        openedDate: new Date('2024-08-20'),
        closedDate: new Date('2024-12-15'),
        value: 28000.0,
        metadata: { outcome: 'Settled out of court' },
        createdAt: randomPastDate(150),
        updatedAt: new Date(),
      },
    }),
  ]);
  console.log(`✓ Created ${cases.length} cases`);

  // Create case team assignments
  console.log('Creating case team assignments...');
  const caseTeams = [];
  for (let i = 0; i < cases.length; i++) {
    // Assign Partner as Lead to all cases
    caseTeams.push(
      await prisma.caseTeam.create({
        data: {
          id: randomUUID(),
          caseId: cases[i].id,
          userId: users[0].id, // Partner
          role: 'Lead',
          assignedAt: cases[i].createdAt,
          assignedBy: users[0].id,
        },
      })
    );

    // Assign Associate to most cases
    if (i < 8) {
      caseTeams.push(
        await prisma.caseTeam.create({
          data: {
            id: randomUUID(),
            caseId: cases[i].id,
            userId: users[1 + (i % 2)].id, // Alternate between Associate 1 and 2
            role: 'Support',
            assignedAt: cases[i].createdAt,
            assignedBy: users[0].id,
          },
        })
      );
    }

    // Assign Paralegal to some cases
    if (i % 3 === 0) {
      caseTeams.push(
        await prisma.caseTeam.create({
          data: {
            id: randomUUID(),
            caseId: cases[i].id,
            userId: users[3 + (i % 2)].id, // Alternate between Paralegal 1 and 2
            role: 'Observer',
            assignedAt: cases[i].createdAt,
            assignedBy: users[0].id,
          },
        })
      );
    }
  }
  console.log(`✓ Created ${caseTeams.length} case team assignments`);

  // Create case actors for each case
  console.log('Creating case actors...');
  const caseActors = [];
  for (let i = 0; i < cases.length; i++) {
    // Add client actor
    caseActors.push(
      await prisma.caseActor.create({
        data: {
          id: randomUUID(),
          caseId: cases[i].id,
          role: 'Client',
          name: i < 7 ? 'Ion Marin' : 'Ana Popescu',
          organization: i < 7 ? 'SC ABC Industries SRL' : null,
          email: i < 7 ? 'ion.marin@abc-industries.ro' : 'ana.popescu@email.ro',
          phone: i < 7 ? '+40-21-123-4567' : '+40-722-111-222',
          address: i < 7 ? 'Bulevardul Unirii 15, București' : 'Strada Florilor 42, Cluj-Napoca',
          notes: 'Primary client contact',
          createdAt: cases[i].createdAt,
          updatedAt: new Date(),
          createdBy: users[0].id,
        },
      })
    );

    // Add opposing party for litigation cases
    if (cases[i].type === 'Litigation') {
      caseActors.push(
        await prisma.caseActor.create({
          data: {
            id: randomUUID(),
            caseId: cases[i].id,
            role: 'OpposingParty',
            name: i % 2 === 0 ? 'SC XYZ Logistics SRL' : 'Mihai Vasilescu',
            organization: i % 2 === 0 ? 'SC XYZ Logistics SRL' : null,
            email: i % 2 === 0 ? 'legal@xyz-logistics.ro' : 'mihai.vasilescu@email.ro',
            phone: i % 2 === 0 ? '+40-31-888-9999' : '+40-755-333-444',
            address: 'București, România',
            notes: 'Opposing party in litigation',
            createdAt: cases[i].createdAt,
            updatedAt: new Date(),
            createdBy: users[0].id,
          },
        })
      );

      // Add opposing counsel
      caseActors.push(
        await prisma.caseActor.create({
          data: {
            id: randomUUID(),
            caseId: cases[i].id,
            role: 'OpposingCounsel',
            name: 'Cabinet Avocat Marinescu & Asociații',
            organization: 'Cabinet Avocat Marinescu & Asociații',
            email: 'office@marinescu-law.ro',
            phone: '+40-21-555-7777',
            address: 'Calea Victoriei 120, București',
            notes: 'Opposing counsel representation',
            createdAt: cases[i].createdAt,
            updatedAt: new Date(),
            createdBy: users[0].id,
          },
        })
      );
    }

    // Add witnesses to some cases
    if (i % 3 === 0 && cases[i].type === 'Litigation') {
      caseActors.push(
        await prisma.caseActor.create({
          data: {
            id: randomUUID(),
            caseId: cases[i].id,
            role: 'Witness',
            name: 'Elena Radu',
            organization: null,
            email: 'elena.radu@email.ro',
            phone: '+40-733-222-111',
            address: 'București, România',
            notes: 'Key witness - former employee',
            createdAt: cases[i].createdAt,
            updatedAt: new Date(),
            createdBy: users[1].id,
          },
        })
      );
    }

    // Add expert to some cases
    if (i % 4 === 0) {
      caseActors.push(
        await prisma.caseActor.create({
          data: {
            id: randomUUID(),
            caseId: cases[i].id,
            role: 'Expert',
            name: 'Dr. Alexandru Popa',
            organization: 'Expert Contabil Autorizat',
            email: 'dr.popa@expert-accounting.ro',
            phone: '+40-21-444-5555',
            address: 'București, România',
            notes: 'Financial expert for damages assessment',
            createdAt: cases[i].createdAt,
            updatedAt: new Date(),
            createdBy: users[0].id,
          },
        })
      );
    }
  }
  console.log(`✓ Created ${caseActors.length} case actors`);

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
  console.log(`    • ${users.filter((u) => u.status === 'Active').length} Active users`);
  console.log(
    `    • ${users.filter((u) => u.status === 'Pending').length} Pending user (awaiting activation)`
  );
  console.log(`    • ${users.filter((u) => u.status === 'Inactive').length} Inactive user`);
  console.log(`  - Clients: ${clients.length} (Story 2.6 - Case Management)`);
  console.log(`  - Cases: ${cases.length} (Story 2.6 - Case Management)`);
  console.log(`    • ${cases.filter((c) => c.status === 'Active').length} Active cases`);
  console.log(`    • ${cases.filter((c) => c.status === 'OnHold').length} OnHold case`);
  console.log(`    • ${cases.filter((c) => c.status === 'Closed').length} Closed cases`);
  console.log(`    • ${cases.filter((c) => c.status === 'Archived').length} Archived case`);
  console.log(`  - Case Teams: ${caseTeams.length} assignments`);
  console.log(`  - Case Actors: ${caseActors.length} external parties`);
  console.log('');
  console.log('Note: Additional models will be added in future stories:');
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
