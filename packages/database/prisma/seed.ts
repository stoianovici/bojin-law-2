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
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// ============================================================================
// DETERMINISTIC UUID GENERATOR
// ============================================================================
// Uses UUID v5-like approach: generates consistent UUIDs from namespace + name
// This ensures seed data has predictable, stable IDs across reseeds
// ============================================================================

const SEED_NAMESPACE = 'legal-platform-seed-2024';

/**
 * Generate a deterministic UUID from an entity type and identifier
 * Same inputs always produce the same UUID
 *
 * @example
 * seedUUID('user', 'partner') => always '22a5c5e8-...'
 * seedUUID('case', '001') => always '44b6d7f9-...'
 */
function seedUUID(entityType: string, identifier: string | number): string {
  const input = `${SEED_NAMESPACE}:${entityType}:${identifier}`;
  const hash = createHash('sha256').update(input).digest('hex');

  // Format as UUID v4-like string (8-4-4-4-12)
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16), // Version 4
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') +
      hash.substring(18, 20), // Variant
    hash.substring(20, 32),
  ].join('-');
}

// Pre-generate all fixed IDs for easy reference
const IDs = {
  // Firm
  firm: seedUUID('firm', 'demo'),

  // Users (11 total)
  users: {
    businessOwner: seedUUID('user', 'businessOwner'), // Story 2.11.1: Business Owner with firm-wide financial access
    partner: seedUUID('user', 'partner'),
    partner2: seedUUID('user', 'partner2'), // Lucian Bojin
    partner3: seedUUID('user', 'partner3'), // Mio Stoianovici
    partner4: seedUUID('user', 'partner4'), // Oana Mititelu
    associate1: seedUUID('user', 'associate1'),
    associate2: seedUUID('user', 'associate2'),
    paralegal1: seedUUID('user', 'paralegal1'),
    paralegal2: seedUUID('user', 'paralegal2'),
    pending: seedUUID('user', 'pending'),
    inactive: seedUUID('user', 'inactive'),
  },

  // Clients (4 total)
  clients: {
    abcIndustries: seedUUID('client', 'abc-industries'),
    familiaPopescu: seedUUID('client', 'familia-popescu'),
    techInnovations: seedUUID('client', 'tech-innovations'),
    familiaIonescu: seedUUID('client', 'familia-ionescu'),
  },

  // Cases (20 total) - using numbers for easy iteration
  case: (n: number) => seedUUID('case', n.toString().padStart(3, '0')),

  // Case Teams
  caseTeam: (caseNum: number, userKey: string) => seedUUID('case-team', `${caseNum}-${userKey}`),

  // Case Actors
  caseActor: (caseNum: number, role: string, index: number = 0) =>
    seedUUID('case-actor', `${caseNum}-${role}-${index}`),

  // Approvals
  approval: (caseNum: number) => seedUUID('approval', caseNum.toString()),

  // Rate History
  rateHistory: (caseNum: number, index: number) => seedUUID('rate-history', `${caseNum}-${index}`),

  // Time Entries
  timeEntry: (caseNum: number, index: number) => seedUUID('time-entry', `${caseNum}-${index}`),

  // Emails
  email: (index: number) => seedUUID('email', index.toString()),

  // Email Case Links
  emailCaseLink: (emailIndex: number, caseNum: number) =>
    seedUUID('email-case-link', `${emailIndex}-${caseNum}`),

  // Tasks
  task: (index: number) => seedUUID('task', index.toString()),
};

// Helper function to generate deterministic past date
// Uses daysAgo as both the maximum and the actual offset (deterministic)
function pastDate(daysAgo: number): Date {
  // Use current date as reference so KPI date filters work correctly
  const referenceDate = new Date();
  return new Date(referenceDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

// Helper function to generate future date
// Commented out until tasks are implemented
// function futureDateFromNow(daysAhead: number): Date {
//   const now = new Date();
//   return new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
// }

// Helper function to generate recent date with hour precision (for briefing feed)
function recentDate(hoursAgo: number): Date {
  const now = new Date();
  return new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
}

// Helper function to generate future date (for task due dates)
function futureDate(daysAhead: number): Date {
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
  const firm = await prisma.firm.create({
    data: {
      id: IDs.firm,
      name: 'Demo Law Firm S.R.L.',
      defaultRates: {
        partnerRate: 450,
        associateRate: 300,
        paralegalRate: 150,
      },
      createdAt: pastDate(365),
      updatedAt: new Date(),
    },
  });
  console.log(`✓ Created firm: ${firm.name}`);

  // Create Users (1 Business Owner, 1 Partner, 2 Associates, 2 Paralegals)
  // Story 2.4: Users with Azure AD integration
  // Story 2.11.1: Business Owner role with firm-wide financial access
  console.log('Creating users...');

  const users = await Promise.all([
    // Business Owner (Active) - Story 2.11.1
    prisma.user.create({
      data: {
        id: IDs.users.businessOwner,
        firmId: firm.id,
        firstName: 'Stefan',
        lastName: 'Marinescu',
        email: 'owner@demo.lawfirm.ro',
        role: 'BusinessOwner',
        status: 'Active',
        azureAdId: 'aad-owner-demo-00001',
        preferences: { language: 'ro', aiSuggestionLevel: 'high' },
        createdAt: pastDate(365),
        lastActive: new Date(),
      },
    }),
    // Partner (Active)
    prisma.user.create({
      data: {
        id: IDs.users.partner,
        firmId: firm.id,
        firstName: 'Alex',
        lastName: 'Popescu',
        email: 'partner@demo.lawfirm.ro',
        role: 'Partner',
        status: 'Active',
        azureAdId: 'aad-partner-demo-12345',
        preferences: { language: 'ro', aiSuggestionLevel: 'high' },
        createdAt: pastDate(300),
        lastActive: new Date(),
      },
    }),
    // Partner 2 (Active) - Lucian Bojin
    prisma.user.create({
      data: {
        id: IDs.users.partner2,
        firmId: firm.id,
        firstName: 'Lucian',
        lastName: 'Bojin',
        email: 'lucian.bojin@demo.lawfirm.ro',
        role: 'Partner',
        status: 'Active',
        azureAdId: 'aad-partner2-demo-12346',
        preferences: { language: 'ro', aiSuggestionLevel: 'high' },
        createdAt: pastDate(350),
        lastActive: new Date(),
      },
    }),
    // Partner 3 (Active) - Mio Stoianovici
    prisma.user.create({
      data: {
        id: IDs.users.partner3,
        firmId: firm.id,
        firstName: 'Mio',
        lastName: 'Stoianovici',
        email: 'mio.stoianovici@demo.lawfirm.ro',
        role: 'Partner',
        status: 'Active',
        azureAdId: 'aad-partner3-demo-12347',
        preferences: { language: 'ro', aiSuggestionLevel: 'high' },
        createdAt: pastDate(280),
        lastActive: new Date(),
      },
    }),
    // Partner 4 (Active) - Oana Mititelu
    prisma.user.create({
      data: {
        id: IDs.users.partner4,
        firmId: firm.id,
        firstName: 'Oana',
        lastName: 'Mititelu',
        email: 'oana.mititelu@demo.lawfirm.ro',
        role: 'Partner',
        status: 'Active',
        azureAdId: 'aad-partner4-demo-12348',
        preferences: { language: 'ro', aiSuggestionLevel: 'high' },
        createdAt: pastDate(320),
        lastActive: new Date(),
      },
    }),
    // Associate 1 (Active)
    prisma.user.create({
      data: {
        id: IDs.users.associate1,
        firmId: firm.id,
        firstName: 'Maria',
        lastName: 'Ionescu',
        email: 'associate1@demo.lawfirm.ro',
        role: 'Associate',
        status: 'Active',
        azureAdId: 'aad-assoc1-demo-67890',
        preferences: { language: 'ro', aiSuggestionLevel: 'moderate' },
        createdAt: pastDate(250),
        lastActive: pastDate(1),
      },
    }),
    // Associate 2 (Active)
    prisma.user.create({
      data: {
        id: IDs.users.associate2,
        firmId: firm.id,
        firstName: 'Ion',
        lastName: 'Georgescu',
        email: 'associate2@demo.lawfirm.ro',
        role: 'Associate',
        status: 'Active',
        azureAdId: 'aad-assoc2-demo-11111',
        preferences: { language: 'ro', aiSuggestionLevel: 'moderate' },
        createdAt: pastDate(200),
        lastActive: pastDate(3),
      },
    }),
    // Paralegal 1 (Active)
    prisma.user.create({
      data: {
        id: IDs.users.paralegal1,
        firmId: firm.id,
        firstName: 'Elena',
        lastName: 'Popa',
        email: 'paralegal1@demo.lawfirm.ro',
        role: 'Paralegal',
        status: 'Active',
        azureAdId: 'aad-para1-demo-22222',
        preferences: { language: 'ro', aiSuggestionLevel: 'low' },
        createdAt: pastDate(150),
        lastActive: pastDate(2),
      },
    }),
    // Paralegal 2 (Active)
    prisma.user.create({
      data: {
        id: IDs.users.paralegal2,
        firmId: firm.id,
        firstName: 'Mihai',
        lastName: 'Dumitrescu',
        email: 'paralegal2@demo.lawfirm.ro',
        role: 'Paralegal',
        status: 'Active',
        azureAdId: 'aad-para2-demo-33333',
        preferences: { language: 'ro', aiSuggestionLevel: 'moderate' },
        createdAt: pastDate(100),
        lastActive: new Date(),
      },
    }),
    // Test Pending User (awaiting activation)
    prisma.user.create({
      data: {
        id: IDs.users.pending,
        firmId: firm.id,
        firstName: 'Test',
        lastName: 'Pending',
        email: 'pending@demo.lawfirm.ro',
        role: 'Paralegal',
        status: 'Pending',
        azureAdId: 'aad-pending-demo-44444',
        preferences: { language: 'ro', aiSuggestionLevel: 'moderate' },
        createdAt: pastDate(7),
        lastActive: pastDate(7),
      },
    }),
    // Test Inactive User
    prisma.user.create({
      data: {
        id: IDs.users.inactive,
        firmId: firm.id,
        firstName: 'Test',
        lastName: 'Inactive',
        email: 'inactive@demo.lawfirm.ro',
        role: 'Paralegal',
        status: 'Inactive',
        azureAdId: 'aad-inactive-demo-55555',
        preferences: { language: 'ro', aiSuggestionLevel: 'moderate' },
        createdAt: pastDate(365),
        lastActive: pastDate(180),
      },
    }),
  ]);
  console.log(
    `✓ Created ${users.length} users (${users.filter((u) => u.status === 'Active').length} Active [incl. 1 BusinessOwner], ${users.filter((u) => u.status === 'Pending').length} Pending, ${users.filter((u) => u.status === 'Inactive').length} Inactive)`
  );

  // Create Clients (2 clients for testing)
  console.log('Creating sample clients...');

  const allClients = await Promise.all([
    prisma.client.create({
      data: {
        id: IDs.clients.abcIndustries,
        firmId: firm.id,
        name: 'SC ABC Industries SRL',
        contactInfo: {
          email: 'contact@abc-industries.ro',
          phone: '+40-21-123-4567',
          primaryContact: 'Ion Marin',
        },
        address: 'Bulevardul Unirii 15, București, România',
        createdAt: pastDate(365),
        updatedAt: new Date(),
      },
    }),
    prisma.client.create({
      data: {
        id: IDs.clients.familiaPopescu,
        firmId: firm.id,
        name: 'Familia Popescu',
        contactInfo: {
          email: 'ana.popescu@email.ro',
          phone: '+40-722-111-222',
          primaryContact: 'Ana Popescu',
        },
        address: 'Strada Florilor 42, Cluj-Napoca, România',
        createdAt: pastDate(200),
        updatedAt: new Date(),
      },
    }),
    prisma.client.create({
      data: {
        id: IDs.clients.techInnovations,
        firmId: firm.id,
        name: 'Tech Innovations Romania SRL',
        contactInfo: {
          email: 'contact@tech-innovations.ro',
          phone: '+40-31-555-8888',
          primaryContact: 'Andrei Stoica',
        },
        address: 'Strada Progresului 90, Timișoara, România',
        createdAt: pastDate(180),
        updatedAt: new Date(),
      },
    }),
    prisma.client.create({
      data: {
        id: IDs.clients.familiaIonescu,
        firmId: firm.id,
        name: 'Familia Ionescu',
        contactInfo: {
          email: 'maria.ionescu@gmail.ro',
          phone: '+40-744-999-888',
          primaryContact: 'Maria Ionescu',
        },
        address: 'Bulevardul Independenței 25, Iași, România',
        createdAt: pastDate(90),
        updatedAt: new Date(),
      },
    }),
  ]);
  console.log(`✓ Created ${allClients.length} clients`);

  // Create Cases (20 cases with various statuses, types, billing, and approval data)
  console.log('Creating sample cases...');
  const cases = await Promise.all([
    // Active Litigation case - HOURLY billing with custom rates
    prisma.case.create({
      data: {
        id: IDs.case(1),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2025-001`,
        title: 'Contract Dispute - ABC Industries vs XYZ Logistics',
        clientId: allClients[0].id,
        status: 'Active',
        type: 'Litigation',
        description: 'Dispute regarding breach of delivery contract and payment terms',
        openedDate: pastDate(15),
        value: 150000.0,
        billingType: 'Hourly',
        customRates: {
          partnerRate: 500, // Higher than default
          associateRate: 350,
          paralegalRate: 175,
        },
        metadata: { courtName: 'Bucharest Tribunal', nextHearing: '2025-02-28' },
        createdAt: pastDate(30),
        updatedAt: new Date(),
      },
    }),
    // Active Contract case - FIXED billing (profitable - fixed > projected hourly)
    prisma.case.create({
      data: {
        id: IDs.case(2),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2025-002`,
        title: 'Commercial Contract Review - ABC Industries',
        clientId: allClients[0].id,
        status: 'Active',
        type: 'Contract',
        description: 'Review and negotiation of supplier agreements',
        openedDate: pastDate(15),
        value: 22000.0,
        billingType: 'Fixed',
        fixedAmount: 2200000, // $22,000 in cents - profitable vs ~$18k projected
        metadata: { deadline: '2025-03-01' },
        createdAt: pastDate(25),
        updatedAt: new Date(),
      },
    }),
    // Active Advisory case - HOURLY with default rates
    prisma.case.create({
      data: {
        id: IDs.case(3),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2025-003`,
        title: 'Corporate Restructuring Advisory',
        clientId: allClients[0].id,
        status: 'Active',
        type: 'Advisory',
        description: 'Legal advisory for company restructuring and compliance',
        openedDate: pastDate(15),
        value: 75000.0,
        billingType: 'Hourly',
        metadata: { phase: 'planning' },
        createdAt: pastDate(18),
        updatedAt: new Date(),
      },
    }),
    // PendingApproval case - Associate created, needs Partner approval
    prisma.case.create({
      data: {
        id: IDs.case(4),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2025-007`,
        title: 'New Client Onboarding - Tech Startup Advisory',
        clientId: allClients[2].id,
        status: 'PendingApproval',
        type: 'Advisory',
        description: 'Corporate structure and investment advisory for tech startup',
        openedDate: pastDate(15),
        value: 40000.0,
        billingType: 'Hourly',
        customRates: {
          partnerRate: 450,
          associateRate: 300,
        },
        metadata: { newClient: true },
        createdAt: pastDate(3),
        updatedAt: new Date(),
      },
    }),
    // OnHold case - HOURLY
    prisma.case.create({
      data: {
        id: IDs.case(5),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2024-015`,
        title: 'Employment Dispute - Former Employee',
        clientId: allClients[0].id,
        status: 'OnHold',
        type: 'Litigation',
        description: 'Employment termination dispute, awaiting client decision',
        openedDate: pastDate(15),
        value: 35000.0,
        billingType: 'Hourly',
        metadata: { onHoldReason: 'Awaiting client decision on settlement offer' },
        createdAt: pastDate(90),
        updatedAt: new Date(),
      },
    }),
    // Closed case - FIXED billing (profitable - efficient execution)
    prisma.case.create({
      data: {
        id: IDs.case(6),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2024-008`,
        title: 'Real Estate Transaction - Property Purchase',
        clientId: allClients[1].id,
        status: 'Closed',
        type: 'Contract',
        description: 'Residential property purchase legal support',
        openedDate: pastDate(15),
        closedDate: new Date('2024-12-20'),
        value: 8500.0,
        billingType: 'Fixed',
        fixedAmount: 850000, // $8,500 - profitable vs ~$7k projected (10 entries)
        metadata: { propertyValue: 250000, location: 'Cluj-Napoca' },
        createdAt: pastDate(120),
        updatedAt: new Date(),
      },
    }),
    // Archived case - FIXED billing
    prisma.case.create({
      data: {
        id: IDs.case(7),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2024-003`,
        title: 'Estate Planning and Will',
        clientId: allClients[1].id,
        status: 'Archived',
        type: 'Advisory',
        description: 'Estate planning and will preparation',
        openedDate: pastDate(15),
        closedDate: new Date('2024-05-20'),
        value: 5000.0,
        billingType: 'Fixed',
        fixedAmount: 500000,
        metadata: { documentsExecuted: true },
        createdAt: pastDate(300),
        updatedAt: new Date(),
      },
    }),
    // Active Criminal case - HOURLY with premium rates
    prisma.case.create({
      data: {
        id: IDs.case(8),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2025-004`,
        title: 'Criminal Defense - White Collar Crime',
        clientId: allClients[0].id,
        status: 'Active',
        type: 'Criminal',
        description: 'Defense in fraud investigation',
        openedDate: pastDate(15),
        value: 200000.0,
        billingType: 'Hourly',
        customRates: {
          partnerRate: 600, // Premium rates for criminal defense
          associateRate: 400,
        },
        metadata: { courtName: 'High Court of Cassation', urgent: true },
        createdAt: pastDate(10),
        updatedAt: new Date(),
      },
    }),
    // Active Litigation case 2 - FIXED (UNPROFITABLE - over budget)
    prisma.case.create({
      data: {
        id: IDs.case(9),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2025-005`,
        title: 'Intellectual Property Dispute',
        clientId: allClients[0].id,
        status: 'Active',
        type: 'Litigation',
        description: 'Trademark infringement case',
        openedDate: pastDate(15),
        value: 45000.0,
        billingType: 'Fixed',
        fixedAmount: 4500000, // $45,000 - UNPROFITABLE vs ~$52k projected (35 entries × 3hrs × $500)
        metadata: { courtName: 'Bucharest Court', trademark: 'ABC-BRAND' },
        createdAt: pastDate(12),
        updatedAt: new Date(),
      },
    }),
    // Active Other type - HOURLY
    prisma.case.create({
      data: {
        id: IDs.case(10),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2025-006`,
        title: 'Regulatory Compliance Review',
        clientId: allClients[0].id,
        status: 'Active',
        type: 'Other',
        description: 'GDPR and data protection compliance assessment',
        openedDate: pastDate(15),
        value: 45000.0,
        billingType: 'Hourly',
        metadata: { scope: 'Full compliance audit' },
        createdAt: pastDate(35),
        updatedAt: new Date(),
      },
    }),
    // Closed Litigation case - HOURLY
    prisma.case.create({
      data: {
        id: IDs.case(11),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2024-012`,
        title: 'Commercial Lease Dispute',
        clientId: allClients[0].id,
        status: 'Closed',
        type: 'Litigation',
        description: 'Landlord-tenant dispute resolution',
        openedDate: pastDate(15),
        closedDate: new Date('2024-12-15'),
        value: 28000.0,
        billingType: 'Hourly',
        metadata: { outcome: 'Settled out of court' },
        createdAt: pastDate(150),
        updatedAt: new Date(),
      },
    }),
    // Additional cases for KPI testing
    // High value case - Active (profitable - good scoping)
    prisma.case.create({
      data: {
        id: IDs.case(12),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2025-008`,
        title: 'Major M&A Transaction Advisory',
        clientId: allClients[2].id,
        status: 'Active',
        type: 'Advisory',
        description: 'Legal advisory for company acquisition',
        openedDate: pastDate(15),
        value: 65000.0,
        billingType: 'Fixed',
        fixedAmount: 6500000, // $65,000 - profitable vs ~$54k projected (40 entries × 3hrs × $450)
        metadata: { dealValue: 5000000, complexity: 'high' },
        createdAt: pastDate(40),
        updatedAt: new Date(),
      },
    }),
    // PendingApproval case 2
    prisma.case.create({
      data: {
        id: IDs.case(13),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2025-009`,
        title: 'Family Law - Divorce Proceedings',
        clientId: allClients[3].id,
        status: 'PendingApproval',
        type: 'Litigation',
        description: 'Complex divorce with asset division',
        openedDate: pastDate(15),
        value: 60000.0,
        billingType: 'Hourly',
        metadata: { sensitivity: 'high' },
        createdAt: pastDate(1),
        updatedAt: new Date(),
      },
    }),
    // Low value case - Active (profitable small case)
    prisma.case.create({
      data: {
        id: IDs.case(14),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2025-010`,
        title: 'Small Business Formation',
        clientId: allClients[2].id,
        status: 'Active',
        type: 'Contract',
        description: 'SRL formation and registration',
        openedDate: pastDate(15),
        value: 2500.0,
        billingType: 'Fixed',
        fixedAmount: 250000, // $2,500 - profitable vs ~$1.8k projected (4 entries)
        metadata: { businessType: 'SRL' },
        createdAt: pastDate(8),
        updatedAt: new Date(),
      },
    }),
    // More historical cases for trend analysis
    prisma.case.create({
      data: {
        id: IDs.case(15),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2024-020`,
        title: 'Construction Contract Dispute',
        clientId: allClients[0].id,
        status: 'Closed',
        type: 'Litigation',
        description: 'Dispute over construction delays and penalties',
        openedDate: pastDate(15),
        closedDate: new Date('2024-11-30'),
        value: 180000.0,
        billingType: 'Hourly',
        customRates: {
          partnerRate: 480,
          associateRate: 320,
        },
        metadata: { outcome: 'Won at trial', damages: 120000 },
        createdAt: pastDate(200),
        updatedAt: new Date(),
      },
    }),
    // Closed Fixed - UNPROFITABLE (scope creep)
    prisma.case.create({
      data: {
        id: IDs.case(16),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2024-018`,
        title: 'Employment Contract Negotiation',
        clientId: allClients[2].id,
        status: 'Closed',
        type: 'Contract',
        description: 'Executive employment contract',
        openedDate: pastDate(15),
        closedDate: new Date('2024-11-15'),
        value: 18000.0,
        billingType: 'Fixed',
        fixedAmount: 1800000, // $18,000 - UNPROFITABLE vs ~$22k projected (22 entries × 3hrs × $350)
        metadata: { executiveLevel: 'C-suite' },
        createdAt: pastDate(130),
        updatedAt: new Date(),
      },
    }),
    prisma.case.create({
      data: {
        id: IDs.case(17),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2024-005`,
        title: 'Tax Dispute Resolution',
        clientId: allClients[0].id,
        status: 'Closed',
        type: 'Litigation',
        description: 'Corporate tax assessment challenge',
        openedDate: pastDate(15),
        closedDate: new Date('2024-08-10'),
        value: 95000.0,
        billingType: 'Hourly',
        metadata: { taxAmount: 500000, outcome: 'Partially successful' },
        createdAt: pastDate(320),
        updatedAt: new Date(),
      },
    }),
    // Medium value cases
    prisma.case.create({
      data: {
        id: IDs.case(18),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2025-011`,
        title: 'Software Licensing Agreement',
        clientId: allClients[2].id,
        status: 'Active',
        type: 'Contract',
        description: 'Negotiation of enterprise software license',
        openedDate: pastDate(15),
        value: 35000.0,
        billingType: 'Hourly',
        metadata: { licenseValue: 2000000 },
        createdAt: pastDate(22),
        updatedAt: new Date(),
      },
    }),
    prisma.case.create({
      data: {
        id: IDs.case(19),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2025-012`,
        title: 'Partnership Dissolution',
        clientId: allClients[3].id,
        status: 'Active',
        type: 'Advisory',
        description: 'Legal advisory for partnership dissolution and asset split',
        openedDate: pastDate(15),
        value: 48000.0,
        billingType: 'Hourly',
        customRates: {
          partnerRate: 470,
          associateRate: 310,
        },
        metadata: { partnerCount: 3, complexity: 'medium' },
        createdAt: pastDate(10),
        updatedAt: new Date(),
      },
    }),
    // OnHold cases
    prisma.case.create({
      data: {
        id: IDs.case(20),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2024-025`,
        title: 'Product Liability Investigation',
        clientId: allClients[0].id,
        status: 'OnHold',
        type: 'Litigation',
        description: 'Product defect claim investigation',
        openedDate: pastDate(15),
        value: 72000.0,
        billingType: 'Hourly',
        metadata: { onHoldReason: 'Awaiting expert report' },
        createdAt: pastDate(70),
        updatedAt: new Date(),
      },
    }),
  ]);
  console.log(`✓ Created ${cases.length} cases`);

  // Create approval records for PendingApproval cases
  console.log('Creating case approval records...');
  const approvals = [];

  // Find PendingApproval cases (indices 3 and 12 based on the array above)
  const pendingCaseIndices = [3, 12]; // Cases at these indices have PendingApproval status

  for (const idx of pendingCaseIndices) {
    const caseNum = idx === 3 ? 4 : 13; // Map array index to case number
    approvals.push(
      await prisma.caseApproval.create({
        data: {
          id: IDs.approval(caseNum),
          caseId: cases[idx].id,
          submittedBy: users[1].id, // Associate 1 submitted
          submittedAt: cases[idx].createdAt,
          status: 'Pending',
          revisionCount: 0,
          firmId: firm.id,
        },
      })
    );
  }
  console.log(`✓ Created ${approvals.length} approval records`);

  // Create rate history for some cases with custom rates
  console.log('Creating rate history records...');
  const rateHistories = [];

  // Case 1 (index 0) - rate change
  rateHistories.push(
    await prisma.caseRateHistory.create({
      data: {
        id: IDs.rateHistory(1, 0),
        caseId: cases[0].id,
        changedBy: users[0].id,
        changedAt: new Date(cases[0].createdAt.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days after case created
        rateType: 'partner',
        oldRate: 450,
        newRate: 500,
        firmId: firm.id,
      },
    })
  );

  // Case 8 (index 7) - rate change for Criminal case
  rateHistories.push(
    await prisma.caseRateHistory.create({
      data: {
        id: IDs.rateHistory(8, 0),
        caseId: cases[7].id,
        changedBy: users[0].id,
        changedAt: new Date(cases[7].createdAt.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days after
        rateType: 'partner',
        oldRate: 450,
        newRate: 600,
        firmId: firm.id,
      },
    })
  );

  console.log(`✓ Created ${rateHistories.length} rate history records`);

  // Create case team assignments
  console.log('Creating case team assignments...');
  const caseTeams = [];
  for (let i = 0; i < cases.length; i++) {
    const caseNum = i + 1;
    // Assign Partner as Lead to all cases
    caseTeams.push(
      await prisma.caseTeam.create({
        data: {
          id: IDs.caseTeam(caseNum, 'partner'),
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
      const associateKey = i % 2 === 0 ? 'associate1' : 'associate2';
      caseTeams.push(
        await prisma.caseTeam.create({
          data: {
            id: IDs.caseTeam(caseNum, associateKey),
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
      const paralegalKey = i % 2 === 0 ? 'paralegal1' : 'paralegal2';
      caseTeams.push(
        await prisma.caseTeam.create({
          data: {
            id: IDs.caseTeam(caseNum, paralegalKey),
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
    const caseNum = i + 1;
    // Add client actor
    caseActors.push(
      await prisma.caseActor.create({
        data: {
          id: IDs.caseActor(caseNum, 'Client'),
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
            id: IDs.caseActor(caseNum, 'OpposingParty'),
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
            id: IDs.caseActor(caseNum, 'OpposingCounsel'),
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
            id: IDs.caseActor(caseNum, 'Witness'),
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
            id: IDs.caseActor(caseNum, 'Expert'),
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

  // Create Time Entries for KPI calculations
  console.log('Creating time entries for KPI calculations...');
  const timeEntries = [];

  // Fixed time entry counts per case (deterministic)
  // Designed to create realistic KPI data with mix of profitable/unprofitable Fixed Fee cases
  // Fixed Fee cases need enough time entries so projected hourly ≈ fixed amount (some above, some below)
  const timeEntryCountsPerCase: Record<number, number> = {
    1: 25, // Hourly case - high activity litigation
    2: 18, // Fixed $25k - should be ~profitable (18 entries × ~4.5hrs avg × $350 avg = ~$28k projected)
    3: 20, // Hourly Advisory
    4: 0, // PendingApproval - no time logged yet
    5: 12, // OnHold Hourly
    6: 10, // Closed Fixed $12k - profitable (10 × 3hrs × $300 = ~$9k projected)
    7: 0, // Archived Fixed - old case
    8: 22, // Hourly Criminal - premium rates
    9: 35, // Fixed $85k - UNPROFITABLE (35 × 4.5hrs × $400 avg = ~$63k, but need more for loss)
    10: 18, // Hourly Other
    11: 25, // Closed Hourly
    12: 40, // Fixed $500k - M&A, needs lots of hours to be realistic
    13: 0, // PendingApproval - no time yet
    14: 4, // Fixed $3k - small case, profitable (4 × 2hrs × $200 = ~$1.6k projected)
    15: 30, // Closed Hourly
    16: 22, // Closed Fixed $15k - slightly unprofitable
    17: 28, // Closed Hourly
    18: 15, // Hourly Contract
    19: 20, // Hourly Advisory
    20: 10, // OnHold Hourly
  };

  // Fixed hours per entry (deterministic) - varied realistic work sessions
  const fixedHours = [2.5, 1.5, 4, 3, 2, 5, 1, 3.5, 2, 4.5, 1.5, 3, 2.5, 4, 1.5, 3, 6, 2, 3.5, 2.5];

  // Add time entries for Active cases with billing types
  for (let i = 0; i < cases.length; i++) {
    const caseItem = cases[i];
    const caseNum = i + 1;

    // Only add time entries for Active, OnHold, or recently Closed cases
    if (!['Active', 'OnHold', 'Closed'].includes(caseItem.status)) {
      continue;
    }

    // Get deterministic entry count for this case
    const entryCount = timeEntryCountsPerCase[caseNum] || 0;
    if (entryCount === 0) continue;

    // Get team members for this case
    const caseTeamMembers = caseTeams.filter((ct) => ct.caseId === caseItem.id);

    for (let j = 0; j < entryCount; j++) {
      // Pick a team member deterministically
      const teamMember = caseTeamMembers[j % caseTeamMembers.length];
      const user = users.find((u) => u.id === teamMember.userId);

      // Determine hourly rate based on user role and case custom rates
      let hourlyRate: number;
      const defaultRates = firm.defaultRates as any;
      if (caseItem.customRates) {
        const customRates = caseItem.customRates as any;
        hourlyRate =
          user?.role === 'Partner'
            ? customRates.partnerRate || defaultRates.partnerRate
            : user?.role === 'Associate'
              ? customRates.associateRate || defaultRates.associateRate
              : customRates.paralegalRate || defaultRates.paralegalRate;
      } else {
        hourlyRate =
          user?.role === 'Partner'
            ? defaultRates.partnerRate
            : user?.role === 'Associate'
              ? defaultRates.associateRate
              : defaultRates.paralegalRate;
      }

      // Deterministic hours
      const hours = fixedHours[j % fixedHours.length];

      // Deterministic date within the case timeline
      const caseStartTime = caseItem.openedDate.getTime();
      const caseEndTime = (caseItem.closedDate || new Date()).getTime();
      const dateOffset = ((j + 1) / (entryCount + 1)) * (caseEndTime - caseStartTime);
      const entryDate = new Date(caseStartTime + dateOffset);

      const descriptions = [
        'Legal research on contract law precedents',
        'Client meeting and case strategy discussion',
        'Document review and analysis',
        'Drafted motion for summary judgment',
        'Court appearance and proceedings',
        'Reviewed and revised client correspondence',
        'Case preparation and evidence organization',
        'Conference call with opposing counsel',
        'Legal memorandum drafting',
        'Discovery document review',
      ];

      timeEntries.push(
        await prisma.timeEntry.create({
          data: {
            id: IDs.timeEntry(caseNum, j),
            caseId: caseItem.id,
            userId: teamMember.userId,
            date: entryDate,
            hours: hours,
            hourlyRate: hourlyRate,
            description: descriptions[j % descriptions.length],
            billable: true,
            firmId: firm.id,
            createdAt: entryDate,
            updatedAt: entryDate,
          },
        })
      );
    }
  }
  console.log(`✓ Created ${timeEntries.length} time entries`);

  // Create Documents with realistic Romanian legal document names
  console.log('Creating sample documents...');

  // Realistic Romanian legal documents data
  const documentTemplates = [
    // Client: ABC Industries (index 0) - Corporate/Commercial
    {
      clientIdx: 0,
      fileName: 'Contract de Furnizare Produse - ABC Industries.pdf',
      fileType: 'application/pdf',
      size: 245000,
      status: 'FINAL' as const,
      description: 'Contract furnizare produse industriale',
    },
    {
      clientIdx: 0,
      fileName: 'Anexa 1 - Specificatii Tehnice.pdf',
      fileType: 'application/pdf',
      size: 180000,
      status: 'FINAL' as const,
      description: 'Specificatii tehnice produse',
    },
    {
      clientIdx: 0,
      fileName: 'Cerere de Chemare in Judecata - Litigiu Comercial.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 85000,
      status: 'FINAL' as const,
      description: 'Actiune in instanta impotriva XYZ Logistics',
    },
    {
      clientIdx: 0,
      fileName: 'Intampinare - Dosar 1234-2025.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 92000,
      status: 'DRAFT' as const,
      description: 'Raspuns la cererea reconventionala',
    },
    {
      clientIdx: 0,
      fileName: 'Memoriu de Aparare.pdf',
      fileType: 'application/pdf',
      size: 156000,
      status: 'FINAL' as const,
      description: 'Memoriu pentru termenul din 15.02.2025',
    },
    {
      clientIdx: 0,
      fileName: 'Procura Speciala - Reprezentare Instanta.pdf',
      fileType: 'application/pdf',
      size: 45000,
      status: 'FINAL' as const,
      description: 'Imputernicire avocatiala',
    },
    {
      clientIdx: 0,
      fileName: 'Raport Expertiza Contabila.pdf',
      fileType: 'application/pdf',
      size: 890000,
      status: 'FINAL' as const,
      description: 'Expertiza privind prejudiciul',
    },
    {
      clientIdx: 0,
      fileName: 'Act Aditional nr. 2 - Contract Furnizare.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 67000,
      status: 'DRAFT' as const,
      description: 'Modificare termene livrare',
    },
    {
      clientIdx: 0,
      fileName: 'Notificare Reziliere Contract.pdf',
      fileType: 'application/pdf',
      size: 38000,
      status: 'FINAL' as const,
      description: 'Notificare conform art. 12 din contract',
    },
    {
      clientIdx: 0,
      fileName: 'Dovada Comunicare - Notificare.pdf',
      fileType: 'application/pdf',
      size: 125000,
      status: 'FINAL' as const,
      description: 'Confirmare primire notificare',
    },

    // Client: Familia Popescu (index 1) - Family/Real Estate
    {
      clientIdx: 1,
      fileName: 'Contract de Vanzare-Cumparare Imobil.pdf',
      fileType: 'application/pdf',
      size: 320000,
      status: 'FINAL' as const,
      description: 'Apartament str. Florilor 42, Cluj-Napoca',
    },
    {
      clientIdx: 1,
      fileName: 'Extras Carte Funciara.pdf',
      fileType: 'application/pdf',
      size: 89000,
      status: 'FINAL' as const,
      description: 'CF nr. 123456 Cluj-Napoca',
    },
    {
      clientIdx: 1,
      fileName: 'Certificat Fiscal.pdf',
      fileType: 'application/pdf',
      size: 56000,
      status: 'FINAL' as const,
      description: 'Certificat fiscal pentru vanzare',
    },
    {
      clientIdx: 1,
      fileName: 'Testament Olograf - Draft.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 42000,
      status: 'DRAFT' as const,
      description: 'Proiect testament',
    },
    {
      clientIdx: 1,
      fileName: 'Declaratie Notariala - Succesiune.pdf',
      fileType: 'application/pdf',
      size: 78000,
      status: 'FINAL' as const,
      description: 'Declaratie acceptare succesiune',
    },
    {
      clientIdx: 1,
      fileName: 'Certificat de Mostenitor.pdf',
      fileType: 'application/pdf',
      size: 95000,
      status: 'FINAL' as const,
      description: 'Certificat eliberat BNP Ionescu',
    },

    // Client: Tech Innovations (index 2) - IT/IP/Corporate
    {
      clientIdx: 2,
      fileName: 'Contract de Licenta Software.pdf',
      fileType: 'application/pdf',
      size: 210000,
      status: 'FINAL' as const,
      description: 'Licenta Enterprise pentru platforma SaaS',
    },
    {
      clientIdx: 2,
      fileName: 'NDA - Acord de Confidentialitate.pdf',
      fileType: 'application/pdf',
      size: 85000,
      status: 'FINAL' as const,
      description: 'NDA bilateral cu partener strategic',
    },
    {
      clientIdx: 2,
      fileName: 'Statut SRL - Actualizat 2025.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 125000,
      status: 'DRAFT' as const,
      description: 'Modificare obiect de activitate',
    },
    {
      clientIdx: 2,
      fileName: 'Hotarare AGA - Majorare Capital.pdf',
      fileType: 'application/pdf',
      size: 67000,
      status: 'FINAL' as const,
      description: 'HAGA majorare capital social',
    },
    {
      clientIdx: 2,
      fileName: 'Contract de Cesiune Parti Sociale.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 98000,
      status: 'DRAFT' as const,
      description: 'Cesiune 15% parti sociale',
    },
    {
      clientIdx: 2,
      fileName: 'Due Diligence Report - M&A.pdf',
      fileType: 'application/pdf',
      size: 1250000,
      status: 'FINAL' as const,
      description: 'Raport DD pentru achizitie',
    },
    {
      clientIdx: 2,
      fileName: 'Term Sheet - Investitie Serie A.pdf',
      fileType: 'application/pdf',
      size: 156000,
      status: 'DRAFT' as const,
      description: 'Termeni investitie 2M EUR',
    },
    {
      clientIdx: 2,
      fileName: 'Politica GDPR - Protectia Datelor.pdf',
      fileType: 'application/pdf',
      size: 189000,
      status: 'FINAL' as const,
      description: 'Politica conformitate GDPR',
    },
    {
      clientIdx: 2,
      fileName: 'Contract de Munca - Model Director.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 95000,
      status: 'FINAL' as const,
      description: 'CIM director executiv',
    },

    // Client: Familia Ionescu (index 3) - Family Law/Divorce
    {
      clientIdx: 3,
      fileName: 'Cerere de Divort.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 58000,
      status: 'DRAFT' as const,
      description: 'Cerere divort cu copii minori',
    },
    {
      clientIdx: 3,
      fileName: 'Conventie Privind Custodia.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 72000,
      status: 'DRAFT' as const,
      description: 'Proiect conventie custodie comuna',
    },
    {
      clientIdx: 3,
      fileName: 'Inventar Bunuri Comune.xlsx',
      fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 45000,
      status: 'DRAFT' as const,
      description: 'Lista bunuri de partajat',
    },
    {
      clientIdx: 3,
      fileName: 'Certificat de Casatorie.pdf',
      fileType: 'application/pdf',
      size: 28000,
      status: 'FINAL' as const,
      description: 'Copie certificat casatorie',
    },
    {
      clientIdx: 3,
      fileName: 'Acte Proprietate Apartament.pdf',
      fileType: 'application/pdf',
      size: 450000,
      status: 'FINAL' as const,
      description: 'Documente apartament comun',
    },

    // ========================================================================
    // DOCUMENTS FOR NEW PARTNERS - PENDING APPROVAL (for approval list testing)
    // ========================================================================
    // Partner 2 (Lucian Bojin) - documents pending approval
    {
      clientIdx: 0,
      fileName: 'Contract Consultanță Juridică - Draft.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 85000,
      status: 'DRAFT' as const,
      description: 'Contract consultanță pentru client ABC - așteptare aprobare',
      uploaderOverride: 2, // Partner 2 (Lucian)
    },
    {
      clientIdx: 0,
      fileName: 'Memoriu Juridic - Clauze Penale.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 120000,
      status: 'DRAFT' as const,
      description: 'Analiză clauze penale - draft pentru review',
      uploaderOverride: 2, // Partner 2 (Lucian)
    },
    // Partner 3 (Mio Stoianovici) - documents pending approval
    {
      clientIdx: 2,
      fileName: 'Raport Due Diligence - Preliminar.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 250000,
      status: 'DRAFT' as const,
      description: 'Raport DD preliminar pentru Tech Innovations',
      uploaderOverride: 3, // Partner 3 (Mio)
    },
    {
      clientIdx: 2,
      fileName: 'Proiect Contract Licență Software.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 95000,
      status: 'DRAFT' as const,
      description: 'Draft contract licență pentru aprobare',
      uploaderOverride: 3, // Partner 3 (Mio)
    },
    // Partner 4 (Oana Mititelu) - documents pending approval
    {
      clientIdx: 1,
      fileName: 'Cerere Ordonanță Președințială.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 65000,
      status: 'DRAFT' as const,
      description: 'Cerere urgentă - custodie copii',
      uploaderOverride: 4, // Partner 4 (Oana)
    },
    {
      clientIdx: 3,
      fileName: 'Proiect Convenție Partaj Bunuri.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 78000,
      status: 'DRAFT' as const,
      description: 'Convenție partaj - pending review',
      uploaderOverride: 4, // Partner 4 (Oana)
    },
  ];

  const documents = [];
  const caseDocuments = [];

  for (let i = 0; i < documentTemplates.length; i++) {
    const template = documentTemplates[i];
    const client = allClients[template.clientIdx];
    // Use uploaderOverride if specified, otherwise rotate through users
    const uploaderIdx = (template as { uploaderOverride?: number }).uploaderOverride ?? (i % 4) + 1;
    const uploader = users[uploaderIdx];
    const docId = seedUUID('document', i.toString());
    // Make first 8 documents recent, and partner docs (last 6) also recent for briefing feed
    const isPartnerDoc = i >= documentTemplates.length - 6;
    const uploadDate = i < 8 || isPartnerDoc ? recentDate((i % 8) * 8 + 2) : pastDate(90 - i * 3);

    // For recent FINAL documents, add reviewer info for DOCUMENT_APPROVED in briefing
    const isRecentFinal = i < 8 && template.status === 'FINAL';
    const reviewerId = isRecentFinal ? users[1].id : undefined; // Partner as reviewer
    const submittedAt = isRecentFinal ? recentDate(i * 12 + 1) : undefined; // Slightly after upload

    const doc = await prisma.document.create({
      data: {
        id: docId,
        clientId: client.id,
        firmId: firm.id,
        fileName: template.fileName,
        fileType: template.fileType,
        fileSize: template.size,
        storagePath: `/${firm.id}/clients/${client.id}/documents/${docId}-${template.fileName}`,
        uploadedBy: uploader.id,
        uploadedAt: uploadDate,
        metadata: { description: template.description, tags: [] },
        status: template.status,
        reviewerId: reviewerId,
        submittedAt: submittedAt,
        createdAt: uploadDate,
        updatedAt: new Date(),
      },
    });
    documents.push(doc);

    // Link document to appropriate case(s) based on client
    // Find cases for this client
    const clientCases = cases.filter((c) => c.clientId === client.id);
    if (clientCases.length > 0) {
      // Link to first matching case as original
      const primaryCase = clientCases[i % clientCases.length];
      const caseDocId = seedUUID('case-document', `${i}-primary`);

      const caseDoc = await prisma.caseDocument.create({
        data: {
          id: caseDocId,
          caseId: primaryCase.id,
          documentId: doc.id,
          linkedBy: uploader.id,
          linkedAt: uploadDate,
          isOriginal: true,
          firmId: firm.id,
        },
      });
      caseDocuments.push(caseDoc);

      // Some documents linked to multiple cases (cross-case linking)
      if (i % 5 === 0 && clientCases.length > 1) {
        const secondaryCase = clientCases[(i + 1) % clientCases.length];
        const secondaryCaseDocId = seedUUID('case-document', `${i}-secondary`);

        const secondaryCaseDoc = await prisma.caseDocument.create({
          data: {
            id: secondaryCaseDocId,
            caseId: secondaryCase.id,
            documentId: doc.id,
            linkedBy: uploader.id,
            linkedAt: pastDate(60 - i),
            isOriginal: false,
            firmId: firm.id,
          },
        });
        caseDocuments.push(secondaryCaseDoc);
      }
    }
  }
  console.log(`✓ Created ${documents.length} documents`);
  console.log(`✓ Created ${caseDocuments.length} case-document links`);

  // Note: Task model does not exist in schema - tasks are frontend-only for now
  console.log('ℹ️  Tasks are managed in frontend state (no Task model in schema)');

  // ============================================================================
  // EMAILS FOR MORNING BRIEFING
  // ============================================================================
  // Create emails with recent timestamps (last 7 days) to populate the brief feed
  // ============================================================================
  console.log('Creating emails for morning briefing...');

  // Email templates - realistic Romanian legal correspondence
  const emailTemplates = [
    // Very recent emails (last 2 hours) - will show in urgent section
    {
      hoursAgo: 1,
      subject: 'URGENT: Termen de răspuns mâine - Dosar 1234/2025',
      bodyContent:
        'Bună ziua,\n\nVă reamintesc că termenul pentru depunerea întâmpinării este mâine, 29.12.2025.\n\nVă rog să confirmați că documentele sunt gata.\n\nCu stimă,\nIon Marin',
      from: { name: 'Ion Marin', address: 'ion.marin@abc-industries.ro' },
      toRecipients: [{ name: 'Alex Popescu', address: 'partner@demo.lawfirm.ro' }],
      caseNum: 1,
      userId: 1, // Partner
      isReceived: true,
    },
    {
      hoursAgo: 2,
      subject: 'RE: Contract de Furnizare - Modificări acceptate',
      bodyContent:
        'Stimate domn avocat,\n\nAm analizat modificările propuse și suntem de acord cu noile termene de livrare.\n\nVă rugăm să pregătiți actul adițional pentru semnare.\n\nCu respect,\nAndrei Stoica\nDirector General',
      from: { name: 'Andrei Stoica', address: 'andrei.stoica@tech-innovations.ro' },
      toRecipients: [{ name: 'Maria Ionescu', address: 'associate1@demo.lawfirm.ro' }],
      caseNum: 18,
      userId: 5, // Associate 1 (index shifted +3 for new partners)
      isReceived: true,
    },

    // Recent emails (last 24 hours) - will show in my cases/team activity
    {
      hoursAgo: 4,
      subject: 'Documente solicitate - Expertiza contabilă',
      bodyContent:
        'Bună ziua,\n\nAtașat găsiți documentele financiare solicitate pentru expertiza contabilă.\n\nRămân la dispoziție pentru clarificări.\n\nDr. Alexandru Popa\nExpert Contabil',
      from: { name: 'Dr. Alexandru Popa', address: 'dr.popa@expert-accounting.ro' },
      toRecipients: [{ name: 'Alex Popescu', address: 'partner@demo.lawfirm.ro' }],
      caseNum: 1,
      userId: 1,
      isReceived: true,
    },
    {
      hoursAgo: 6,
      subject: 'Confirmare primire notificare reziliere',
      bodyContent:
        'Către Cabinet de Avocat Demo Law Firm,\n\nConfirmăm primirea notificării de reziliere a contractului nr. 456/2024.\n\nVom analiza situația și vom reveni cu un răspuns în termenul legal.\n\nDepartament Juridic\nSC XYZ Logistics SRL',
      from: { name: 'Departament Juridic XYZ', address: 'legal@xyz-logistics.ro' },
      toRecipients: [{ name: 'Alex Popescu', address: 'partner@demo.lawfirm.ro' }],
      caseNum: 1,
      userId: 1,
      isReceived: true,
    },
    {
      hoursAgo: 8,
      subject: 'Programare ședință de mediere',
      bodyContent:
        'Stimate domn avocat,\n\nVă propunem data de 15 ianuarie 2025, ora 10:00, pentru ședința de mediere.\n\nVă rugăm să confirmați disponibilitatea.\n\nCu stimă,\nCabinet Avocat Marinescu & Asociații',
      from: { name: 'Cabinet Marinescu', address: 'office@marinescu-law.ro' },
      toRecipients: [{ name: 'Ion Georgescu', address: 'associate2@demo.lawfirm.ro' }],
      caseNum: 9,
      userId: 6, // Associate 2 (index shifted +3 for new partners)
      isReceived: true,
    },
    {
      hoursAgo: 12,
      subject: 'RE: Programare ședință de mediere',
      bodyContent:
        'Bună ziua,\n\nConfirmăm disponibilitatea pentru data propusă, 15 ianuarie 2025, ora 10:00.\n\nClientul nostru va fi reprezentat de av. Ion Georgescu.\n\nCu stimă,\nDemo Law Firm',
      from: { name: 'Ion Georgescu', address: 'associate2@demo.lawfirm.ro' },
      toRecipients: [{ name: 'Cabinet Marinescu', address: 'office@marinescu-law.ro' }],
      caseNum: 9,
      userId: 6, // Associate 2
      isReceived: false, // Sent email
    },
    {
      hoursAgo: 16,
      subject: 'Solicitare acte dosarul de divorț',
      bodyContent:
        'Bună ziua doamna avocat,\n\nAm pregătit actele solicitate pentru dosarul de divorț:\n- Certificat de căsătorie\n- Acte de proprietate\n- Extrase de cont\n\nCând pot veni să le depun?\n\nMaria Ionescu',
      from: { name: 'Maria Ionescu (client)', address: 'maria.ionescu@gmail.ro' },
      toRecipients: [{ name: 'Maria Ionescu', address: 'associate1@demo.lawfirm.ro' }],
      caseNum: 13,
      userId: 5, // Associate 1
      isReceived: true,
    },
    {
      hoursAgo: 20,
      subject: 'Întrebare privind procedura de înființare SRL',
      bodyContent:
        'Stimate domn avocat,\n\nAș dori să știu care sunt pașii următori pentru înregistrarea firmei.\n\nAm pregătit capitalul social și am ales sediul.\n\nMulțumesc,\nAndrei Stoica',
      from: { name: 'Andrei Stoica', address: 'contact@tech-innovations.ro' },
      toRecipients: [{ name: 'Elena Popa', address: 'paralegal1@demo.lawfirm.ro' }],
      caseNum: 14,
      userId: 7, // Paralegal 1 (index shifted +3 for new partners)
      isReceived: true,
    },

    // Older emails (24-72 hours) - will show in archive section
    {
      hoursAgo: 28,
      subject: 'Contract licență software - versiunea finală',
      bodyContent:
        'Bună ziua,\n\nAtașat găsiți versiunea finală a contractului de licență, cu toate modificările agreate.\n\nVă rugăm să îl transmiteți clientului pentru semnare.\n\nMaria Ionescu\nAvocat Stagiar',
      from: { name: 'Maria Ionescu', address: 'associate1@demo.lawfirm.ro' },
      toRecipients: [{ name: 'Alex Popescu', address: 'partner@demo.lawfirm.ro' }],
      caseNum: 18,
      userId: 5, // Associate 1
      isReceived: false, // Internal email marked as sent
    },
    {
      hoursAgo: 36,
      subject: 'Actualizare dosar - audiere amânată',
      bodyContent:
        'Stimate client,\n\nVă informăm că audierea programată pentru data de 20.12.2024 a fost amânată din motive procedurale.\n\nNoul termen va fi comunicat de instanță.\n\nCu stimă,\nAlex Popescu\nPartner',
      from: { name: 'Alex Popescu', address: 'partner@demo.lawfirm.ro' },
      toRecipients: [{ name: 'Ion Marin', address: 'ion.marin@abc-industries.ro' }],
      caseNum: 1,
      userId: 1,
      isReceived: false,
    },
    {
      hoursAgo: 48,
      subject: 'Due Diligence - raport preliminar',
      bodyContent:
        'Stimate domn director,\n\nVă transmitem raportul preliminar de due diligence pentru achiziția propusă.\n\nAm identificat câteva aspecte care necesită clarificări suplimentare.\n\nVă rugăm să programăm o întâlnire pentru discuții.\n\nCu stimă,\nDemo Law Firm',
      from: { name: 'Alex Popescu', address: 'partner@demo.lawfirm.ro' },
      toRecipients: [{ name: 'Andrei Stoica', address: 'andrei.stoica@tech-innovations.ro' }],
      caseNum: 12,
      userId: 1,
      isReceived: false,
    },
    {
      hoursAgo: 60,
      subject: 'Solicitare prelungire termen răspuns',
      bodyContent:
        'Stimate domn avocat,\n\nVă rugăm să acceptați prelungirea termenului de răspuns cu 5 zile lucrătoare.\n\nClientul nostru are nevoie de timp suplimentar pentru a analiza propunerea.\n\nCu respect,\nCabinet Avocat Marinescu',
      from: { name: 'Cabinet Marinescu', address: 'office@marinescu-law.ro' },
      toRecipients: [{ name: 'Alex Popescu', address: 'partner@demo.lawfirm.ro' }],
      caseNum: 9,
      userId: 1,
      isReceived: true,
    },
    {
      hoursAgo: 72,
      subject: 'Factura servicii juridice - decembrie 2024',
      bodyContent:
        'Stimate client,\n\nAtașat găsiți factura pentru serviciile juridice prestate în luna decembrie 2024.\n\nTermenul de plată este de 30 de zile.\n\nMulțumim pentru colaborare!\n\nDemo Law Firm',
      from: { name: 'Demo Law Firm', address: 'billing@demo.lawfirm.ro' },
      toRecipients: [{ name: 'Ion Marin', address: 'ion.marin@abc-industries.ro' }],
      caseNum: 1,
      userId: 1,
      isReceived: false,
    },

    // More varied emails for realistic feed
    {
      hoursAgo: 84,
      subject: 'Întrebare clarificare clauze contractuale',
      bodyContent:
        'Bună ziua,\n\nAm câteva întrebări legate de clauzele de confidențialitate din contract.\n\nPutem programa un call mâine?\n\nMultumesc,\nAndrei',
      from: { name: 'Andrei Stoica', address: 'contact@tech-innovations.ro' },
      toRecipients: [{ name: 'Maria Ionescu', address: 'associate1@demo.lawfirm.ro' }],
      caseNum: 17,
      userId: 5, // Associate 1
      isReceived: true,
    },
    {
      hoursAgo: 96,
      subject: 'Memoriu de apărare - draft pentru review',
      bodyContent:
        'Stimate domn Partner,\n\nAm finalizat draft-ul memoriului de apărare.\n\nVă rog să îl verificați și să îmi comunicați eventualele modificări.\n\nElena Popa',
      from: { name: 'Elena Popa', address: 'paralegal1@demo.lawfirm.ro' },
      toRecipients: [{ name: 'Alex Popescu', address: 'partner@demo.lawfirm.ro' }],
      caseNum: 8,
      userId: 7, // Paralegal 1
      isReceived: false, // Internal
    },
    {
      hoursAgo: 120,
      subject: 'Confirmare înscriere la termen',
      bodyContent:
        'Către Cabinet Avocat,\n\nConfirmăm înscrierea la termenul din data de 05.01.2025.\n\nGrefa Tribunalului București',
      from: { name: 'Tribunal București', address: 'grefa@tribunalul-bucuresti.ro' },
      toRecipients: [{ name: 'Alex Popescu', address: 'partner@demo.lawfirm.ro' }],
      caseNum: 1,
      userId: 1,
      isReceived: true,
    },
    {
      hoursAgo: 144,
      subject: 'Propunere de tranzacție',
      bodyContent:
        'Stimate domn avocat,\n\nClientul nostru este dispus să negocieze o tranzacție.\n\nPropunem o întâlnire săptămâna viitoare pentru a discuta termenii.\n\nCu stimă,\nAv. Marinescu',
      from: { name: 'Av. Marinescu', address: 'office@marinescu-law.ro' },
      toRecipients: [{ name: 'Ion Georgescu', address: 'associate2@demo.lawfirm.ro' }],
      caseNum: 5,
      userId: 6, // Updated: associate2 is now at index 6
      isReceived: true,
    },

    // ========================================================================
    // EMAILS FOR PARTNER 2 (Lucian Bojin) - userId: 2
    // ========================================================================
    {
      hoursAgo: 2,
      subject: 'Urgență: Termen procedural mâine',
      bodyContent:
        'Stimate domn avocat Bojin,\n\nVă reamintim că termenul pentru depunerea întâmpinării în dosarul XYZ este mâine, ora 16:00.\n\nVă rugăm să confirmați primirea.\n\nCu stimă,\nGrefă Tribunal',
      from: { name: 'Grefa Tribunal', address: 'grefa@tribunalul-bucuresti.ro' },
      toRecipients: [{ name: 'Lucian Bojin', address: 'lucian.bojin@demo.lawfirm.ro' }],
      caseNum: 2,
      userId: 2,
      isReceived: true,
    },
    {
      hoursAgo: 5,
      subject: 'RE: Contract prestări servicii - revizuit',
      bodyContent:
        'Bună ziua,\n\nAm analizat modificările propuse și sunt de acord cu noua formulare a clauzei 5.3.\n\nPutem programa semnarea pentru săptămâna viitoare.\n\nMulțumesc,\nDirector ABC Industries',
      from: { name: 'Ion Marin', address: 'ion.marin@abc-industries.ro' },
      toRecipients: [{ name: 'Lucian Bojin', address: 'lucian.bojin@demo.lawfirm.ro' }],
      caseNum: 1,
      userId: 2,
      isReceived: true,
    },
    {
      hoursAgo: 18,
      subject: 'Solicitare întâlnire - strategie dosar',
      bodyContent:
        'Stimate domn avocat,\n\nAș dori să discutăm strategia pentru dosarul nostru.\n\nSunt disponibil joi sau vineri după-amiază.\n\nCu stimă,\nClient ABC',
      from: { name: 'Client ABC', address: 'client@abc-industries.ro' },
      toRecipients: [{ name: 'Lucian Bojin', address: 'lucian.bojin@demo.lawfirm.ro' }],
      caseNum: 3,
      userId: 2,
      isReceived: true,
    },

    // ========================================================================
    // EMAILS FOR PARTNER 3 (Mio Stoianovici) - userId: 3
    // ========================================================================
    {
      hoursAgo: 3,
      subject: 'Confirmare primire documente',
      bodyContent:
        'Stimate domn avocat Stoianovici,\n\nConfirmăm primirea documentelor transmise pentru dosarul de proprietate intelectuală.\n\nVom reveni cu o analiză în 48 de ore.\n\nCu stimă,\nOPIS',
      from: { name: 'OPIS', address: 'office@opis.ro' },
      toRecipients: [{ name: 'Mio Stoianovici', address: 'mio.stoianovici@demo.lawfirm.ro' }],
      caseNum: 9,
      userId: 3,
      isReceived: true,
    },
    {
      hoursAgo: 8,
      subject: 'Raport due diligence - observații',
      bodyContent:
        'Bună ziua,\n\nAm finalizat analiza raportului de due diligence.\n\nAm câteva observații privind structura corporativă care necesită clarificări.\n\nPutem discuta mâine dimineață?\n\nMulțumesc,\nAndrei',
      from: { name: 'Andrei Stoica', address: 'contact@tech-innovations.ro' },
      toRecipients: [{ name: 'Mio Stoianovici', address: 'mio.stoianovici@demo.lawfirm.ro' }],
      caseNum: 12,
      userId: 3,
      isReceived: true,
    },
    {
      hoursAgo: 24,
      subject: 'Actualizare jurisprudență CJUE',
      bodyContent:
        'Stimate coleg,\n\nVă transmit decizia recentă CJUE relevantă pentru dosarul Tech Innovations.\n\nAr putea fi utilă pentru argumentația noastră.\n\nCu stimă,\nAlex Popescu',
      from: { name: 'Alex Popescu', address: 'partner@demo.lawfirm.ro' },
      toRecipients: [{ name: 'Mio Stoianovici', address: 'mio.stoianovici@demo.lawfirm.ro' }],
      caseNum: 17,
      userId: 3,
      isReceived: true,
    },

    // ========================================================================
    // EMAILS FOR PARTNER 4 (Oana Mititelu) - userId: 4
    // ========================================================================
    {
      hoursAgo: 4,
      subject: 'Programare ședință mediere - confirmare',
      bodyContent:
        'Stimată doamnă avocat Mititelu,\n\nConfirmăm programarea ședinței de mediere pentru data de 03.01.2025, ora 14:00.\n\nLocația: Centrul de Mediere București.\n\nCu stimă,\nCentrul de Mediere',
      from: { name: 'Centrul de Mediere', address: 'programari@mediere-bucuresti.ro' },
      toRecipients: [{ name: 'Oana Mititelu', address: 'oana.mititelu@demo.lawfirm.ro' }],
      caseNum: 6,
      userId: 4,
      isReceived: true,
    },
    {
      hoursAgo: 12,
      subject: 'Întrebare custodie - urgentă',
      bodyContent:
        'Stimată doamnă avocat,\n\nAm o situație urgentă legată de programul de vizită al copiilor.\n\nFostul soț nu respectă înțelegerea.\n\nCând putem discuta?\n\nMulțumesc,\nAna Popescu',
      from: { name: 'Ana Popescu', address: 'ana.popescu@email.ro' },
      toRecipients: [{ name: 'Oana Mititelu', address: 'oana.mititelu@demo.lawfirm.ro' }],
      caseNum: 13,
      userId: 4,
      isReceived: true,
    },
    {
      hoursAgo: 36,
      subject: 'Răspuns contestație - termen prelungit',
      bodyContent:
        'Stimată doamnă avocat,\n\nVă informăm că termenul pentru răspunsul la contestație a fost prelungit cu 10 zile.\n\nNoul termen: 15.01.2025.\n\nCu stimă,\nInstanța',
      from: { name: 'Judecătoria Sector 1', address: 'grefa@judecatoria-s1.ro' },
      toRecipients: [{ name: 'Oana Mititelu', address: 'oana.mititelu@demo.lawfirm.ro' }],
      caseNum: 7,
      userId: 4,
      isReceived: true,
    },
  ];

  const emails = [];
  const emailCaseLinks = [];

  for (let i = 0; i < emailTemplates.length; i++) {
    const template = emailTemplates[i];
    const emailDate = recentDate(template.hoursAgo);
    const userIdx = template.userId; // Index into users array (0=businessOwner, 1=partner, etc.)

    const email = await prisma.email.create({
      data: {
        id: IDs.email(i),
        firmId: firm.id,
        userId: users[userIdx].id,
        graphMessageId: `AAMk-seed-${IDs.email(i)}`, // Unique Graph message ID
        subject: template.subject,
        bodyContent: template.bodyContent,
        bodyContentType: 'text',
        bodyPreview: template.bodyContent.substring(0, 150) + '...',
        from: template.from,
        toRecipients: template.toRecipients,
        ccRecipients: [],
        bccRecipients: [],
        receivedDateTime: emailDate, // Both fields are required
        sentDateTime: emailDate,
        hasAttachments: i % 4 === 0, // Some emails have attachments
        importance: i < 2 ? 'high' : 'normal',
        // Recent emails (hoursAgo < 12) are unread for all users
        isRead: template.hoursAgo > 12,
        folderType: template.isReceived ? 'inbox' : 'sent',
        internetMessageId: `<msg-${IDs.email(i)}@demo.lawfirm.ro>`,
        conversationId: `conv-${Math.floor(i / 2)}`, // Group some into conversations
        createdAt: emailDate,
        updatedAt: emailDate,
      },
    });
    emails.push(email);

    // Create EmailCaseLink to connect email to case
    const targetCase = cases[template.caseNum - 1]; // caseNum is 1-indexed
    if (targetCase) {
      const emailCaseLink = await prisma.emailCaseLink.create({
        data: {
          id: IDs.emailCaseLink(i, template.caseNum),
          emailId: email.id,
          caseId: targetCase.id,
          isPrimary: true,
          linkedAt: emailDate,
          linkedBy: users[userIdx].id,
          confidence: 0.95,
        },
      });
      emailCaseLinks.push(emailCaseLink);
    }
  }

  console.log(`✓ Created ${emails.length} emails`);
  console.log(`✓ Created ${emailCaseLinks.length} email-case links`);

  // ============================================================================
  // TASKS FOR MORNING BRIEFING
  // ============================================================================
  // Create tasks with various due dates to populate the brief feed
  // ============================================================================
  console.log('Creating tasks for morning briefing...');

  // Task templates - realistic Romanian legal tasks
  // Tasks are assigned to seeded demo users; briefing shows all firm tasks
  const taskTemplates = [
    // TODAY - Urgent tasks
    {
      daysFromNow: 0,
      type: 'CourtDate' as const,
      title: 'Termen judecată - Dosar ABC Industries vs XYZ Logistics',
      description: 'Prezentare la Tribunalul București, Secția Comercială, Sala 5. Ora 10:00.',
      priority: 'Urgent' as const,
      status: 'Pending' as const,
      caseNum: 1,
      assignedToIdx: 1, // Partner
      dueTime: '10:00',
    },
    {
      daysFromNow: 0,
      type: 'DocumentCreation' as const,
      title: 'Finalizare întâmpinare - Dosar 1234/2025',
      description: 'Finalizarea și depunerea întâmpinării pentru termenul de mâine.',
      priority: 'Urgent' as const,
      status: 'InProgress' as const,
      caseNum: 1,
      assignedToIdx: 5, // Associate 1 (index shifted +3 for new partners)
      dueTime: '18:00',
    },
    {
      daysFromNow: 0,
      type: 'Meeting' as const,
      title: 'Întâlnire client - Tech Innovations',
      description: 'Discuții privind contractul de licență software și termenii de negociere.',
      priority: 'High' as const,
      status: 'Pending' as const,
      caseNum: 18,
      assignedToIdx: 5, // Associate 1 (index shifted +3 for new partners)
      dueTime: '14:00',
    },

    // TOMORROW
    {
      daysFromNow: 1,
      type: 'Research' as const,
      title: 'Cercetare jurisprudență - Clauze penale în contracte comerciale',
      description:
        'Identificarea deciziilor relevante ÎCCJ și Curtea de Apel București din ultimii 3 ani.',
      priority: 'High' as const,
      status: 'Pending' as const,
      caseNum: 1,
      assignedToIdx: 7, // Paralegal 1 (index shifted +3 for new partners)
      dueTime: null,
    },
    {
      daysFromNow: 1,
      type: 'DocumentCreation' as const,
      title: 'Redactare memoriu de apărare',
      description: 'Pregătirea memoriului pentru termenul din 05.01.2025.',
      priority: 'High' as const,
      status: 'Pending' as const,
      caseNum: 8,
      assignedToIdx: 6, // Associate 2 (index shifted +3 for new partners)
      dueTime: '17:00',
    },

    // THIS WEEK
    {
      daysFromNow: 2,
      type: 'Meeting' as const,
      title: 'Ședință mediere - IP Dispute',
      description: 'Participare la ședința de mediere cu Cabinet Marinescu.',
      priority: 'High' as const,
      status: 'Pending' as const,
      caseNum: 9,
      assignedToIdx: 6, // Associate 2 (index shifted +3 for new partners)
      dueTime: '10:00',
    },
    {
      daysFromNow: 3,
      type: 'DocumentRetrieval' as const,
      title: 'Obținere extras CF actualizat',
      description: 'Solicitare extras de carte funciară pentru proprietatea din Cluj-Napoca.',
      priority: 'Medium' as const,
      status: 'Pending' as const,
      caseNum: 6,
      assignedToIdx: 8, // Paralegal 2 (index shifted +3 for new partners)
      dueTime: null,
    },
    {
      daysFromNow: 4,
      type: 'DocumentCreation' as const,
      title: 'Finalizare Due Diligence Report',
      description: 'Completarea raportului DD pentru tranzacția M&A.',
      priority: 'High' as const,
      status: 'InProgress' as const,
      caseNum: 12,
      assignedToIdx: 1, // Partner
      dueTime: null,
    },
    {
      daysFromNow: 5,
      type: 'CourtDate' as const,
      title: 'Termen judecată - Criminal Defense',
      description: 'Înfățișare la Înalta Curte de Casație și Justiție.',
      priority: 'Urgent' as const,
      status: 'Pending' as const,
      caseNum: 8,
      assignedToIdx: 1, // Partner
      dueTime: '09:00',
    },
    {
      daysFromNow: 6,
      type: 'Meeting' as const,
      title: 'Consultație client - Familie Ionescu',
      description: 'Discuții privind procedura de divorț și partajul bunurilor.',
      priority: 'Medium' as const,
      status: 'Pending' as const,
      caseNum: 13,
      assignedToIdx: 5, // Associate 1 (index shifted +3 for new partners)
      dueTime: '11:00',
    },

    // NEXT WEEK
    {
      daysFromNow: 7,
      type: 'DocumentCreation' as const,
      title: 'Pregătire contract cesiune părți sociale',
      description: 'Redactarea contractului de cesiune pentru Tech Innovations.',
      priority: 'Medium' as const,
      status: 'Pending' as const,
      caseNum: 14,
      assignedToIdx: 5, // Associate 1 (index shifted +3 for new partners)
      dueTime: null,
    },
    {
      daysFromNow: 8,
      type: 'Research' as const,
      title: 'Analiză conformitate GDPR',
      description: 'Verificarea politicilor de protecție a datelor pentru client.',
      priority: 'Medium' as const,
      status: 'Pending' as const,
      caseNum: 10,
      assignedToIdx: 7, // Paralegal 1 (index shifted +3 for new partners)
      dueTime: null,
    },
    {
      daysFromNow: 10,
      type: 'BusinessTrip' as const,
      title: 'Deplasare Cluj-Napoca - Semnare contract',
      description: 'Asistență client la semnarea contractului de vânzare-cumpărare imobil.',
      priority: 'Medium' as const,
      status: 'Pending' as const,
      caseNum: 6,
      assignedToIdx: 1, // Partner
      dueTime: '14:00',
    },

    // OVERDUE TASKS (past due dates)
    {
      daysFromNow: -1,
      type: 'DocumentCreation' as const,
      title: 'Răspuns la solicitare prelungire termen',
      description:
        'Formulare răspuns la cererea de prelungire a termenului de la Cabinet Marinescu.',
      priority: 'High' as const,
      status: 'Pending' as const,
      caseNum: 9,
      assignedToIdx: 1, // Partner
      dueTime: null,
    },
    {
      daysFromNow: -2,
      type: 'DocumentRetrieval' as const,
      title: 'Solicitare documente contabile',
      description: 'Obținerea documentelor financiare de la clientul ABC Industries.',
      priority: 'Medium' as const,
      status: 'Pending' as const,
      caseNum: 1,
      assignedToIdx: 8, // Paralegal 2 (index shifted +3 for new partners)
      dueTime: null,
    },

    // COMPLETED TASKS (for history)
    {
      daysFromNow: -3,
      type: 'Meeting' as const,
      title: 'Întâlnire client ABC Industries',
      description: 'Discuții strategie pentru litigiul cu XYZ Logistics.',
      priority: 'High' as const,
      status: 'Completed' as const,
      caseNum: 1,
      assignedToIdx: 1, // Partner
      dueTime: '10:00',
    },
    {
      daysFromNow: -5,
      type: 'DocumentCreation' as const,
      title: 'Redactare notificare reziliere contract',
      description: 'Pregătirea notificării conform art. 12 din contract.',
      priority: 'High' as const,
      status: 'Completed' as const,
      caseNum: 1,
      assignedToIdx: 5, // Associate 1 (index shifted +3 for new partners)
      dueTime: null,
    },

    // ========================================================================
    // TASKS FOR NEW PARTNERS (Lucian, Mio, Oana) - for morning briefing
    // ========================================================================
    // Partner 2 (Lucian Bojin) - assignedToIdx: 2
    {
      daysFromNow: 0,
      type: 'CourtDate' as const,
      title: 'Termen judecată - Litigiu comercial ABC',
      description: 'Reprezentare în fața Tribunalului București, Secția Comercială.',
      priority: 'Urgent' as const,
      status: 'Pending' as const,
      caseNum: 1,
      assignedToIdx: 2, // Partner 2 (Lucian)
      dueTime: '09:30',
    },
    {
      daysFromNow: 1,
      type: 'Meeting' as const,
      title: 'Întâlnire negociere contract furnizare',
      description: 'Negociere termeni contract cu furnizorul principal.',
      priority: 'High' as const,
      status: 'Pending' as const,
      caseNum: 3,
      assignedToIdx: 2, // Partner 2 (Lucian)
      dueTime: '15:00',
    },
    {
      daysFromNow: 3,
      type: 'DocumentCreation' as const,
      title: 'Revizuire contract prestări servicii',
      description: 'Actualizarea clauzelor contractuale conform noii legislații.',
      priority: 'Medium' as const,
      status: 'InProgress' as const,
      caseNum: 2,
      assignedToIdx: 2, // Partner 2 (Lucian)
      dueTime: null,
    },

    // Partner 3 (Mio Stoianovici) - assignedToIdx: 3
    {
      daysFromNow: 0,
      type: 'Meeting' as const,
      title: 'Call due diligence - Tech Innovations',
      description: 'Discuție clarificări raport DD preliminar.',
      priority: 'High' as const,
      status: 'Pending' as const,
      caseNum: 12,
      assignedToIdx: 3, // Partner 3 (Mio)
      dueTime: '11:00',
    },
    {
      daysFromNow: 1,
      type: 'DocumentCreation' as const,
      title: 'Finalizare contract licență software',
      description: 'Incorporare ultimele modificări și pregătire pentru semnare.',
      priority: 'Urgent' as const,
      status: 'InProgress' as const,
      caseNum: 17,
      assignedToIdx: 3, // Partner 3 (Mio)
      dueTime: '18:00',
    },
    {
      daysFromNow: 4,
      type: 'Research' as const,
      title: 'Analiză jurisprudență CJUE - protecție date',
      description: 'Cercetare decizii recente privind transferul datelor în UE.',
      priority: 'Medium' as const,
      status: 'Pending' as const,
      caseNum: 10,
      assignedToIdx: 3, // Partner 3 (Mio)
      dueTime: null,
    },

    // Partner 4 (Oana Mititelu) - assignedToIdx: 4
    {
      daysFromNow: 0,
      type: 'CourtDate' as const,
      title: 'Termen divorț - Familia Popescu',
      description: 'Reprezentare la Judecătoria Sector 1, discuții custodie.',
      priority: 'Urgent' as const,
      status: 'Pending' as const,
      caseNum: 13,
      assignedToIdx: 4, // Partner 4 (Oana)
      dueTime: '10:30',
    },
    {
      daysFromNow: 2,
      type: 'Meeting' as const,
      title: 'Ședință mediere - partaj bunuri',
      description: 'Participare la ședința de mediere pentru partaj bunuri comune.',
      priority: 'High' as const,
      status: 'Pending' as const,
      caseNum: 6,
      assignedToIdx: 4, // Partner 4 (Oana)
      dueTime: '14:00',
    },
    {
      daysFromNow: 5,
      type: 'DocumentCreation' as const,
      title: 'Pregătire cerere ordonanță președințială',
      description: 'Redactare cerere urgentă pentru stabilire program vizită.',
      priority: 'High' as const,
      status: 'Pending' as const,
      caseNum: 7,
      assignedToIdx: 4, // Partner 4 (Oana)
      dueTime: null,
    },
  ];

  const tasks = [];

  for (let i = 0; i < taskTemplates.length; i++) {
    const template = taskTemplates[i];
    const targetCase = cases[template.caseNum - 1];
    const assignee = users[template.assignedToIdx];

    // Calculate due date
    const dueDate =
      template.daysFromNow >= 0
        ? futureDate(template.daysFromNow)
        : pastDate(Math.abs(template.daysFromNow));

    const task = await prisma.task.create({
      data: {
        id: IDs.task(i),
        firmId: firm.id,
        caseId: targetCase.id,
        type: template.type,
        title: template.title,
        description: template.description,
        assignedTo: assignee.id,
        dueDate: dueDate,
        dueTime: template.dueTime,
        status: template.status,
        priority: template.priority,
        createdBy: users[1].id, // Partner created all tasks
        createdAt: pastDate(7), // Created a week ago
        completedAt:
          template.status === 'Completed' ? pastDate(Math.abs(template.daysFromNow)) : null,
      },
    });
    tasks.push(task);
  }

  console.log(`✓ Created ${tasks.length} tasks for demo users`);

  // ============================================================================
  // Create tasks for ALL existing users in the firm (including Azure AD users)
  // This ensures real users (like bojin-law.com accounts) have briefing data
  // ============================================================================
  console.log('Creating tasks for all firm users (including Azure AD provisioned)...');

  const allFirmUsers = await prisma.user.findMany({
    where: {
      firmId: firm.id,
      status: 'Active',
      id: { notIn: users.map((u) => u.id) }, // Exclude demo users (already have tasks)
    },
  });

  let extraTaskCount = 0;
  for (const realUser of allFirmUsers) {
    // Create a set of tasks for each real user (similar to demo users)
    const realUserTaskTemplates = [
      // TODAY - Urgent
      {
        daysFromNow: 0,
        type: 'CourtDate' as const,
        title: 'Termen judecată - Dosar ABC Industries vs XYZ Logistics',
        priority: 'Urgent' as const,
        status: 'Pending' as const,
        caseNum: 1,
        dueTime: '10:00',
      },
      {
        daysFromNow: 0,
        type: 'DocumentCreation' as const,
        title: 'Finalizare întâmpinare - Dosar 1234/2025',
        priority: 'Urgent' as const,
        status: 'InProgress' as const,
        caseNum: 1,
        dueTime: '18:00',
      },
      {
        daysFromNow: 0,
        type: 'Meeting' as const,
        title: 'Întâlnire client - Tech Innovations',
        priority: 'High' as const,
        status: 'Pending' as const,
        caseNum: 18,
        dueTime: '14:00',
      },
      {
        daysFromNow: 0,
        type: 'Research' as const,
        title: 'Analiză urgentă contract achiziție',
        priority: 'Urgent' as const,
        status: 'Pending' as const,
        caseNum: 3,
        dueTime: '16:00',
      },
      // TOMORROW
      {
        daysFromNow: 1,
        type: 'Research' as const,
        title: 'Cercetare jurisprudență - Clauze penale',
        priority: 'High' as const,
        status: 'Pending' as const,
        caseNum: 1,
        dueTime: null,
      },
      {
        daysFromNow: 1,
        type: 'DocumentCreation' as const,
        title: 'Redactare memoriu de apărare',
        priority: 'High' as const,
        status: 'Pending' as const,
        caseNum: 8,
        dueTime: '17:00',
      },
      // THIS WEEK
      {
        daysFromNow: 2,
        type: 'Meeting' as const,
        title: 'Ședință mediere - IP Dispute',
        priority: 'High' as const,
        status: 'Pending' as const,
        caseNum: 9,
        dueTime: '10:00',
      },
      {
        daysFromNow: 3,
        type: 'DocumentRetrieval' as const,
        title: 'Obținere extras CF actualizat',
        priority: 'Medium' as const,
        status: 'Pending' as const,
        caseNum: 6,
        dueTime: null,
      },
      {
        daysFromNow: 4,
        type: 'DocumentCreation' as const,
        title: 'Finalizare Due Diligence Report',
        priority: 'High' as const,
        status: 'InProgress' as const,
        caseNum: 12,
        dueTime: null,
      },
      {
        daysFromNow: 5,
        type: 'CourtDate' as const,
        title: 'Termen judecată - Criminal Defense',
        priority: 'Urgent' as const,
        status: 'Pending' as const,
        caseNum: 8,
        dueTime: '09:00',
      },
      {
        daysFromNow: 6,
        type: 'Meeting' as const,
        title: 'Consultație client - Familie Ionescu',
        priority: 'Medium' as const,
        status: 'Pending' as const,
        caseNum: 13,
        dueTime: '11:00',
      },
      // OVERDUE
      {
        daysFromNow: -1,
        type: 'DocumentCreation' as const,
        title: 'Răspuns la solicitare prelungire termen',
        priority: 'High' as const,
        status: 'Pending' as const,
        caseNum: 9,
        dueTime: null,
      },
      {
        daysFromNow: -2,
        type: 'DocumentRetrieval' as const,
        title: 'Solicitare documente contabile',
        priority: 'Medium' as const,
        status: 'Pending' as const,
        caseNum: 1,
        dueTime: null,
      },
    ];

    for (let i = 0; i < realUserTaskTemplates.length; i++) {
      const template = realUserTaskTemplates[i];
      const targetCase = cases[template.caseNum - 1];
      const dueDate =
        template.daysFromNow >= 0
          ? futureDate(template.daysFromNow)
          : pastDate(Math.abs(template.daysFromNow));

      await prisma.task.create({
        data: {
          id: seedUUID('real-user-task', `${realUser.id}-${i}`),
          firmId: firm.id,
          caseId: targetCase.id,
          type: template.type,
          title: template.title,
          description: `Task pentru ${realUser.firstName} ${realUser.lastName}`,
          assignedTo: realUser.id,
          dueDate: dueDate,
          dueTime: template.dueTime,
          status: template.status,
          priority: template.priority,
          createdBy: users[1].id,
          createdAt: pastDate(7),
        },
      });
      extraTaskCount++;
    }
    console.log(`  ✓ Created ${realUserTaskTemplates.length} tasks for ${realUser.email}`);
  }

  console.log(`✓ Created ${extraTaskCount} additional tasks for ${allFirmUsers.length} real users`);
  console.log(
    `  • ${tasks.filter((t) => t.status === 'Pending').length + extraTaskCount} Pending (approx)`
  );
  console.log(`  • ${tasks.filter((t) => t.status === 'InProgress').length} In Progress`);
  console.log(`  • ${tasks.filter((t) => t.status === 'Completed').length} Completed`);

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
  console.log(`  - Clients: ${allClients.length} (Story 2.6 - Case Management)`);
  console.log(`  - Cases: ${cases.length} (Story 2.6, 2.8.1, 2.8.2)`);
  console.log(`    • ${cases.filter((c) => c.status === 'Active').length} Active cases`);
  console.log(
    `    • ${cases.filter((c) => c.status === 'PendingApproval').length} Pending Approval cases`
  );
  console.log(`    • ${cases.filter((c) => c.status === 'OnHold').length} OnHold cases`);
  console.log(`    • ${cases.filter((c) => c.status === 'Closed').length} Closed cases`);
  console.log(`    • ${cases.filter((c) => c.status === 'Archived').length} Archived case`);
  console.log(`  - Billing Configuration:`);
  console.log(
    `    • ${cases.filter((c) => c.billingType === 'Hourly').length} Hourly billing cases`
  );
  console.log(`    • ${cases.filter((c) => c.billingType === 'Fixed').length} Fixed fee cases`);
  console.log(
    `    • ${cases.filter((c) => c.customRates !== null).length} cases with custom rates`
  );
  console.log(`  - Approval Workflow:`);
  console.log(`    • ${approvals.length} cases pending approval`);
  console.log(`  - Rate History: ${rateHistories.length} rate changes tracked`);
  console.log(`  - Case Teams: ${caseTeams.length} assignments`);
  console.log(`  - Case Actors: ${caseActors.length} external parties`);
  console.log(`  - Time Entries: ${timeEntries.length} billable hours logged`);
  console.log(`  - Documents: ${documents.length} legal documents`);
  console.log(`    • ${documents.filter((d) => d.status === 'FINAL').length} Final`);
  console.log(`    • ${documents.filter((d) => d.status === 'DRAFT').length} Draft`);
  console.log(`  - Case-Document Links: ${caseDocuments.length} links`);
  console.log(`  - Emails: ${emails.length} (for morning briefing)`);
  console.log(`    • ${emails.filter((e) => e.receivedDateTime).length} Received`);
  console.log(`    • ${emails.filter((e) => e.sentDateTime).length} Sent`);
  console.log(`  - Email-Case Links: ${emailCaseLinks.length} links`);
  console.log('');
  console.log('Morning Briefing Data:');
  console.log(`  - Recent emails (last 7 days): ${emails.length}`);
  console.log(`  - Recent documents (last 7 days): 8 (with uploads/approvals)`);
  console.log(`  - Tasks: ${tasks.length}`);
  console.log(
    `    • Today: ${tasks.filter((t) => t.dueDate.toDateString() === new Date().toDateString()).length}`
  );
  console.log(
    `    • This week: ${tasks.filter((t) => t.dueDate <= futureDate(7) && t.dueDate >= new Date()).length}`
  );
  console.log(
    `    • Overdue: ${tasks.filter((t) => t.dueDate < new Date() && t.status !== 'Completed').length}`
  );
  console.log('');
  console.log('Value Distribution:');
  const totalValue = cases.reduce((sum, c) => sum + Number(c.value || 0), 0);
  console.log(`  - Total case value: $${totalValue.toLocaleString()}`);
  console.log(`  - Average case value: $${Math.round(totalValue / cases.length).toLocaleString()}`);
  console.log(
    `  - Largest case: $${Math.max(...cases.map((c) => Number(c.value || 0))).toLocaleString()}`
  );
  console.log(
    `  - Smallest case: $${Math.min(...cases.map((c) => Number(c.value || 0))).toLocaleString()}`
  );
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
