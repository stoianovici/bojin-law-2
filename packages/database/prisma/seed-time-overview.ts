/**
 * Seed Script for /time (Team Activity Overview) Page
 *
 * Creates comprehensive test data for the hierarchical client → case → task view:
 * - Multiple clients with multiple cases each
 * - Tasks in various states (Completed, InProgress, Pending)
 * - "Stuck" tasks (not updated for 2+ days)
 * - Documents with various statuses
 * - Time entries for completed work
 *
 * Run with: pnpm tsx packages/database/prisma/seed-time-overview.ts
 */

import { PrismaClient, TaskStatus, TaskTypeEnum, DocumentStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { subDays, subHours, addDays } from 'date-fns';

const prisma = new PrismaClient();

// ============================================================================
// DETERMINISTIC UUID GENERATOR
// ============================================================================

const SEED_NAMESPACE = 'time-overview-seed-2026';

function seedUUID(entityType: string, identifier: string | number): string {
  const input = `${SEED_NAMESPACE}:${entityType}:${identifier}`;
  const hash = createHash('sha256').update(input).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') +
      hash.substring(18, 20),
    hash.substring(20, 32),
  ].join('-');
}

// ============================================================================
// IDs
// ============================================================================

const IDs = {
  // Clients
  clients: {
    acmeCorp: seedUUID('client', 'acme-corp'),
    globalTech: seedUUID('client', 'global-tech'),
    familiaPopescu: seedUUID('client', 'familia-popescu'),
  },
  // Cases
  cases: {
    acme1: seedUUID('case', 'acme-litigiu'),
    acme2: seedUUID('case', 'acme-contract'),
    global1: seedUUID('case', 'global-fuziune'),
    global2: seedUUID('case', 'global-gdpr'),
    popescu1: seedUUID('case', 'popescu-succesiune'),
  },
  // Tasks (grouped by case)
  tasks: {
    // Acme Litigiu tasks
    acme1_task1: seedUUID('task', 'acme1-redactare'),
    acme1_task2: seedUUID('task', 'acme1-cercetare'),
    acme1_task3: seedUUID('task', 'acme1-termen'),
    acme1_task4: seedUUID('task', 'acme1-raspuns'),
    acme1_task5: seedUUID('task', 'acme1-pregatire'),
    // Acme Contract tasks
    acme2_task1: seedUUID('task', 'acme2-redactare'),
    acme2_task2: seedUUID('task', 'acme2-revizie'),
    acme2_task3: seedUUID('task', 'acme2-negociere'),
    // Global Fuziune tasks
    global1_task1: seedUUID('task', 'global1-due-diligence'),
    global1_task2: seedUUID('task', 'global1-raport'),
    global1_task3: seedUUID('task', 'global1-documentatie'),
    global1_task4: seedUUID('task', 'global1-prezentare'),
    // Global GDPR tasks
    global2_task1: seedUUID('task', 'global2-audit'),
    global2_task2: seedUUID('task', 'global2-politici'),
    // Popescu Succesiune tasks
    popescu1_task1: seedUUID('task', 'popescu1-acte'),
    popescu1_task2: seedUUID('task', 'popescu1-certificat'),
    popescu1_task3: seedUUID('task', 'popescu1-partaj'),
  },
  // Documents
  documents: {
    acme1_doc1: seedUUID('doc', 'acme1-intampinare'),
    acme1_doc2: seedUUID('doc', 'acme1-probe'),
    acme2_doc1: seedUUID('doc', 'acme2-contract'),
    global1_doc1: seedUUID('doc', 'global1-raport'),
    global2_doc1: seedUUID('doc', 'global2-politici'),
    popescu1_doc1: seedUUID('doc', 'popescu1-certificat'),
  },
  // Document folders
  folders: {
    acme1: seedUUID('folder', 'acme1'),
    acme2: seedUUID('folder', 'acme2'),
    global1: seedUUID('folder', 'global1'),
    global2: seedUUID('folder', 'global2'),
    popescu1: seedUUID('folder', 'popescu1'),
  },
  // Time entries
  timeEntry: (taskId: string, index: number) => seedUUID('time-entry', `${taskId}-${index}`),
};

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  console.log('🌱 Seeding data for /time page...');

  // ============================================================================
  // CLEANUP - Remove previously seeded data
  // ============================================================================

  console.log('Cleaning up existing seed data...');

  // Delete in correct order (most dependent first)
  await prisma.timeEntry.deleteMany({
    where: { id: { in: Object.values(IDs.tasks).map((taskId) => IDs.timeEntry(taskId, 1)) } },
  });
  await prisma.caseDocument.deleteMany({
    where: { documentId: { in: Object.values(IDs.documents) } },
  });
  await prisma.document.deleteMany({
    where: { id: { in: Object.values(IDs.documents) } },
  });
  await prisma.documentFolder.deleteMany({
    where: { id: { in: Object.values(IDs.folders) } },
  });
  await prisma.task.deleteMany({
    where: { id: { in: Object.values(IDs.tasks) } },
  });
  await prisma.case.deleteMany({
    where: { id: { in: Object.values(IDs.cases) } },
  });
  await prisma.client.deleteMany({
    where: { id: { in: Object.values(IDs.clients) } },
  });

  console.log('✓ Cleanup complete');

  // ============================================================================
  // GET EXISTING ENTITIES
  // ============================================================================

  // Get the firm with "Test Client SRL" - this is the production firm the user is logged into
  // First try to find the firm by known client, then fall back to any firm
  const testClient = await prisma.client.findFirst({
    where: { name: 'Test Client SRL' },
    select: { firmId: true },
  });

  let firmId: string;
  if (testClient) {
    firmId = testClient.firmId;
    console.log(`Found production firm via Test Client SRL: ${firmId}`);
  } else {
    const firm = await prisma.firm.findFirst();
    if (!firm) {
      console.error('❌ No firm found. Run the main seed first: pnpm db:seed');
      process.exit(1);
    }
    firmId = firm.id;
    console.log(`Using first firm: ${firmId}`);
  }

  const firm = { id: firmId };

  const users = await prisma.user.findMany({
    where: { firmId: firm.id, status: 'Active' },
  });
  if (users.length === 0) {
    console.error('❌ No users found. Run the main seed first: pnpm db:seed');
    process.exit(1);
  }

  // Get specific users
  const lucian = users.find((u) => u.firstName === 'Lucian') || users[0];
  const maria = users.find((u) => u.firstName === 'Maria') || users[1] || users[0];
  const ion = users.find((u) => u.firstName === 'Ion') || users[2] || users[0];

  console.log(`Using users: ${lucian.firstName}, ${maria?.firstName}, ${ion?.firstName}`);

  const now = new Date();

  // ============================================================================
  // CLIENTS
  // ============================================================================

  console.log('Creating clients...');

  // Client names for seed data
  const clientNames = {
    acmeCorp: 'ACME Corporation SRL [Seed]',
    globalTech: 'Global Tech Solutions SA [Seed]',
    familiaPopescu: 'Familia Popescu [Seed]',
  };

  const clients = await Promise.all([
    prisma.client.upsert({
      where: { firmId_name: { firmId: firm.id, name: clientNames.acmeCorp } },
      update: {},
      create: {
        id: IDs.clients.acmeCorp,
        firmId: firm.id,
        name: clientNames.acmeCorp,
        clientType: 'company',
        contactInfo: {
          email: 'contact@acme-corp.ro',
          phone: '021-123-4567',
          contactPerson: 'George Marinescu',
        },
        address: 'Str. Victoriei 100, București',
        createdAt: subDays(now, 180),
      },
    }),
    prisma.client.upsert({
      where: { firmId_name: { firmId: firm.id, name: clientNames.globalTech } },
      update: {},
      create: {
        id: IDs.clients.globalTech,
        firmId: firm.id,
        name: clientNames.globalTech,
        clientType: 'company',
        contactInfo: {
          email: 'legal@globaltech.ro',
          phone: '021-987-6543',
          contactPerson: 'Ana Dumitrescu',
        },
        address: 'Bd. Unirii 50, București',
        createdAt: subDays(now, 120),
      },
    }),
    prisma.client.upsert({
      where: { firmId_name: { firmId: firm.id, name: clientNames.familiaPopescu } },
      update: {},
      create: {
        id: IDs.clients.familiaPopescu,
        firmId: firm.id,
        name: clientNames.familiaPopescu,
        clientType: 'individual',
        contactInfo: {
          email: 'ion.popescu@email.ro',
          phone: '0722-123-456',
          contactPerson: 'Ion Popescu',
        },
        address: 'Str. Primăverii 25, Cluj-Napoca',
        createdAt: subDays(now, 90),
      },
    }),
  ]);

  console.log(`✓ Created ${clients.length} clients`);

  // ============================================================================
  // CASES
  // ============================================================================

  console.log('Creating cases...');

  const cases = await Promise.all([
    // ACME Corporation - 2 cases
    prisma.case.upsert({
      where: { id: IDs.cases.acme1 },
      update: { status: 'Active' },
      create: {
        id: IDs.cases.acme1,
        firmId: firm.id,
        clientId: IDs.clients.acmeCorp,
        caseNumber: 'BL-2026-101',
        title: 'Litigiu comercial - ACME vs XYZ Industries',
        description: 'Litigiu comercial privind nerespectarea obligațiilor contractuale.',
        status: 'Active',
        type: 'LITIGATION',
        openedDate: subDays(now, 60),
        createdAt: subDays(now, 60),
        updatedAt: subHours(now, 2),
      },
    }),
    prisma.case.upsert({
      where: { id: IDs.cases.acme2 },
      update: { status: 'Active' },
      create: {
        id: IDs.cases.acme2,
        firmId: firm.id,
        clientId: IDs.clients.acmeCorp,
        caseNumber: 'BL-2026-102',
        title: 'Contract furnizare echipamente industriale',
        description: 'Redactare și negociere contract cadru pentru furnizare echipamente.',
        status: 'Active',
        type: 'CONTRACT',
        openedDate: subDays(now, 45),
        createdAt: subDays(now, 45),
        updatedAt: subHours(now, 5),
      },
    }),
    // Global Tech - 2 cases
    prisma.case.upsert({
      where: { id: IDs.cases.global1 },
      update: { status: 'Active' },
      create: {
        id: IDs.cases.global1,
        firmId: firm.id,
        clientId: IDs.clients.globalTech,
        caseNumber: 'BL-2026-103',
        title: 'Fuziune cu TechStart SRL',
        description: 'Asistență juridică pentru procedura de fuziune prin absorbție.',
        status: 'Active',
        type: 'CORPORATE',
        openedDate: subDays(now, 30),
        createdAt: subDays(now, 30),
        updatedAt: subHours(now, 1),
      },
    }),
    prisma.case.upsert({
      where: { id: IDs.cases.global2 },
      update: { status: 'Active' },
      create: {
        id: IDs.cases.global2,
        firmId: firm.id,
        clientId: IDs.clients.globalTech,
        caseNumber: 'BL-2026-104',
        title: 'Conformitate GDPR și protecția datelor',
        description: 'Audit și implementare măsuri de conformitate GDPR.',
        status: 'Active',
        type: 'COMPLIANCE',
        openedDate: subDays(now, 20),
        createdAt: subDays(now, 20),
        updatedAt: subHours(now, 8),
      },
    }),
    // Familia Popescu - 1 case
    prisma.case.upsert({
      where: { id: IDs.cases.popescu1 },
      update: { status: 'Active' },
      create: {
        id: IDs.cases.popescu1,
        firmId: firm.id,
        clientId: IDs.clients.familiaPopescu,
        caseNumber: 'BL-2026-105',
        title: 'Succesiune și partaj bunuri imobile',
        description: 'Procedură succesorală și partaj voluntar bunuri moștenite.',
        status: 'Active',
        type: 'SUCCESSION',
        openedDate: subDays(now, 15),
        createdAt: subDays(now, 15),
        updatedAt: subHours(now, 3),
      },
    }),
  ]);

  console.log(`✓ Created ${cases.length} cases`);

  // ============================================================================
  // TASKS
  // ============================================================================

  console.log('Creating tasks...');

  const tasks = await Promise.all([
    // ========== ACME LITIGIU (BL-2026-001) ==========
    // Completed task (this week)
    prisma.task.upsert({
      where: { id: IDs.tasks.acme1_task1 },
      update: {},
      create: {
        id: IDs.tasks.acme1_task1,
        firmId: firm.id,
        caseId: IDs.cases.acme1,
        type: TaskTypeEnum.DocumentCreation,
        title: 'Redactare întâmpinare',
        description: 'Redactare întâmpinare pentru dosar litigiu comercial',
        assignedTo: lucian.id,
        createdBy: lucian.id,
        dueDate: subDays(now, 2),
        status: TaskStatus.Completed,
        completedAt: subDays(now, 1),
        estimatedHours: 3,
        priority: 'High',
        createdAt: subDays(now, 10),
        updatedAt: subDays(now, 1),
      },
    }),
    // In progress task (active, recently updated)
    prisma.task.upsert({
      where: { id: IDs.tasks.acme1_task2 },
      update: {},
      create: {
        id: IDs.tasks.acme1_task2,
        firmId: firm.id,
        caseId: IDs.cases.acme1,
        type: TaskTypeEnum.Research,
        title: 'Cercetare jurisprudență relevantă',
        description: 'Căutare decizii similare în ultimii 5 ani',
        assignedTo: maria.id,
        createdBy: lucian.id,
        dueDate: addDays(now, 3),
        status: TaskStatus.InProgress,
        estimatedHours: 4,
        priority: 'Medium',
        createdAt: subDays(now, 5),
        updatedAt: subHours(now, 6), // Recently updated - NOT stuck
      },
    }),
    // In progress task - STUCK (not updated for 3 days)
    prisma.task.upsert({
      where: { id: IDs.tasks.acme1_task3 },
      update: {},
      create: {
        id: IDs.tasks.acme1_task3,
        firmId: firm.id,
        caseId: IDs.cases.acme1,
        type: TaskTypeEnum.CourtDate,
        title: 'Pregătire termen judecată 15 feb',
        description: 'Pregătire documente și strategie pentru termenul din 15 februarie',
        assignedTo: lucian.id,
        createdBy: lucian.id,
        dueDate: addDays(now, 5),
        status: TaskStatus.InProgress,
        estimatedHours: 2,
        priority: 'High',
        createdAt: subDays(now, 8),
        updatedAt: subDays(now, 3), // STUCK - 3 days without update
      },
    }),
    // Pending task (not started)
    prisma.task.upsert({
      where: { id: IDs.tasks.acme1_task4 },
      update: {},
      create: {
        id: IDs.tasks.acme1_task4,
        firmId: firm.id,
        caseId: IDs.cases.acme1,
        type: TaskTypeEnum.DocumentCreation,
        title: 'Răspuns la interogatoriu',
        description: 'Pregătire răspunsuri la interogatoriul primit',
        assignedTo: lucian.id,
        createdBy: lucian.id,
        dueDate: addDays(now, 10),
        status: TaskStatus.Pending,
        estimatedHours: 2,
        priority: 'Medium',
        createdAt: subDays(now, 3),
        updatedAt: subDays(now, 3),
      },
    }),
    // Another pending task
    prisma.task.upsert({
      where: { id: IDs.tasks.acme1_task5 },
      update: {},
      create: {
        id: IDs.tasks.acme1_task5,
        firmId: firm.id,
        caseId: IDs.cases.acme1,
        type: TaskTypeEnum.Meeting,
        title: 'Întâlnire client pentru strategie',
        description: 'Discuție cu clientul despre strategia procesului',
        assignedTo: lucian.id,
        createdBy: lucian.id,
        dueDate: addDays(now, 7),
        status: TaskStatus.Pending,
        estimatedHours: 1,
        priority: 'Medium',
        createdAt: subDays(now, 2),
        updatedAt: subDays(now, 2),
      },
    }),

    // ========== ACME CONTRACT (BL-2026-002) ==========
    // In progress - STUCK
    prisma.task.upsert({
      where: { id: IDs.tasks.acme2_task1 },
      update: {},
      create: {
        id: IDs.tasks.acme2_task1,
        firmId: firm.id,
        caseId: IDs.cases.acme2,
        type: TaskTypeEnum.DocumentCreation,
        title: 'Redactare contract cadru furnizare',
        description: 'Redactare contract cadru pentru furnizare echipamente',
        assignedTo: maria.id,
        createdBy: lucian.id,
        dueDate: addDays(now, 2),
        status: TaskStatus.InProgress,
        estimatedHours: 5,
        priority: 'High',
        createdAt: subDays(now, 7),
        updatedAt: subDays(now, 4), // STUCK
      },
    }),
    // Pending
    prisma.task.upsert({
      where: { id: IDs.tasks.acme2_task2 },
      update: {},
      create: {
        id: IDs.tasks.acme2_task2,
        firmId: firm.id,
        caseId: IDs.cases.acme2,
        type: TaskTypeEnum.DocumentRetrieval,
        title: 'Revizie clauze penalități',
        description: 'Verificare și actualizare clauze de penalități',
        assignedTo: maria.id,
        createdBy: lucian.id,
        dueDate: addDays(now, 5),
        status: TaskStatus.Pending,
        estimatedHours: 2,
        priority: 'Medium',
        createdAt: subDays(now, 3),
        updatedAt: subDays(now, 3),
      },
    }),
    // Pending
    prisma.task.upsert({
      where: { id: IDs.tasks.acme2_task3 },
      update: {},
      create: {
        id: IDs.tasks.acme2_task3,
        firmId: firm.id,
        caseId: IDs.cases.acme2,
        type: TaskTypeEnum.Meeting,
        title: 'Negociere cu furnizorul',
        description: 'Participare la negocierea termenilor cu furnizorul',
        assignedTo: lucian.id,
        createdBy: lucian.id,
        dueDate: addDays(now, 8),
        status: TaskStatus.Pending,
        estimatedHours: 3,
        priority: 'Medium',
        createdAt: subDays(now, 2),
        updatedAt: subDays(now, 2),
      },
    }),

    // ========== GLOBAL TECH FUZIUNE (BL-2026-003) ==========
    // Completed
    prisma.task.upsert({
      where: { id: IDs.tasks.global1_task1 },
      update: {},
      create: {
        id: IDs.tasks.global1_task1,
        firmId: firm.id,
        caseId: IDs.cases.global1,
        type: TaskTypeEnum.Research,
        title: 'Due diligence juridic',
        description: 'Analiză completă due diligence pentru TechStart',
        assignedTo: ion.id,
        createdBy: lucian.id,
        dueDate: subDays(now, 5),
        status: TaskStatus.Completed,
        completedAt: subDays(now, 3),
        estimatedHours: 8,
        priority: 'High',
        createdAt: subDays(now, 15),
        updatedAt: subDays(now, 3),
      },
    }),
    // Completed this week
    prisma.task.upsert({
      where: { id: IDs.tasks.global1_task2 },
      update: {},
      create: {
        id: IDs.tasks.global1_task2,
        firmId: firm.id,
        caseId: IDs.cases.global1,
        type: TaskTypeEnum.DocumentCreation,
        title: 'Raport due diligence',
        description: 'Redactare raport final due diligence',
        assignedTo: ion.id,
        createdBy: lucian.id,
        dueDate: subDays(now, 1),
        status: TaskStatus.Completed,
        completedAt: subHours(now, 12),
        estimatedHours: 4,
        priority: 'High',
        createdAt: subDays(now, 7),
        updatedAt: subHours(now, 12),
      },
    }),
    // In progress (active)
    prisma.task.upsert({
      where: { id: IDs.tasks.global1_task3 },
      update: {},
      create: {
        id: IDs.tasks.global1_task3,
        firmId: firm.id,
        caseId: IDs.cases.global1,
        type: TaskTypeEnum.DocumentCreation,
        title: 'Pregătire documentație fuziune',
        description: 'Pregătire acte pentru procedura de fuziune',
        assignedTo: ion.id,
        createdBy: lucian.id,
        dueDate: addDays(now, 10),
        status: TaskStatus.InProgress,
        estimatedHours: 6,
        priority: 'High',
        createdAt: subDays(now, 5),
        updatedAt: subHours(now, 4), // Recently updated
      },
    }),
    // Pending
    prisma.task.upsert({
      where: { id: IDs.tasks.global1_task4 },
      update: {},
      create: {
        id: IDs.tasks.global1_task4,
        firmId: firm.id,
        caseId: IDs.cases.global1,
        type: TaskTypeEnum.Meeting,
        title: 'Prezentare board pentru aprobare fuziune',
        description: 'Pregătire și susținere prezentare în fața board-ului',
        assignedTo: lucian.id,
        createdBy: lucian.id,
        dueDate: addDays(now, 15),
        status: TaskStatus.Pending,
        estimatedHours: 2,
        priority: 'Medium',
        createdAt: subDays(now, 3),
        updatedAt: subDays(now, 3),
      },
    }),

    // ========== GLOBAL TECH GDPR (BL-2026-004) ==========
    // In progress - STUCK
    prisma.task.upsert({
      where: { id: IDs.tasks.global2_task1 },
      update: {},
      create: {
        id: IDs.tasks.global2_task1,
        firmId: firm.id,
        caseId: IDs.cases.global2,
        type: TaskTypeEnum.Research,
        title: 'Audit conformitate GDPR',
        description: 'Audit complet al proceselor de prelucrare date',
        assignedTo: maria.id,
        createdBy: lucian.id,
        dueDate: addDays(now, 5),
        status: TaskStatus.InProgress,
        estimatedHours: 6,
        priority: 'High',
        createdAt: subDays(now, 10),
        updatedAt: subDays(now, 5), // STUCK
      },
    }),
    // Pending
    prisma.task.upsert({
      where: { id: IDs.tasks.global2_task2 },
      update: {},
      create: {
        id: IDs.tasks.global2_task2,
        firmId: firm.id,
        caseId: IDs.cases.global2,
        type: TaskTypeEnum.DocumentCreation,
        title: 'Actualizare politici confidențialitate',
        description: 'Revizuire și actualizare politici conform GDPR',
        assignedTo: maria.id,
        createdBy: lucian.id,
        dueDate: addDays(now, 12),
        status: TaskStatus.Pending,
        estimatedHours: 4,
        priority: 'Medium',
        createdAt: subDays(now, 3),
        updatedAt: subDays(now, 3),
      },
    }),

    // ========== FAMILIA POPESCU SUCCESIUNE (BL-2026-005) ==========
    // Completed
    prisma.task.upsert({
      where: { id: IDs.tasks.popescu1_task1 },
      update: {},
      create: {
        id: IDs.tasks.popescu1_task1,
        firmId: firm.id,
        caseId: IDs.cases.popescu1,
        type: TaskTypeEnum.DocumentRetrieval,
        title: 'Obținere acte stare civilă',
        description: 'Obținere certificate naștere, căsătorie, deces',
        assignedTo: ion.id,
        createdBy: lucian.id,
        dueDate: subDays(now, 3),
        status: TaskStatus.Completed,
        completedAt: subDays(now, 2),
        estimatedHours: 2,
        priority: 'Medium',
        createdAt: subDays(now, 10),
        updatedAt: subDays(now, 2),
      },
    }),
    // In progress
    prisma.task.upsert({
      where: { id: IDs.tasks.popescu1_task2 },
      update: {},
      create: {
        id: IDs.tasks.popescu1_task2,
        firmId: firm.id,
        caseId: IDs.cases.popescu1,
        type: TaskTypeEnum.LegalDeadline,
        title: 'Depunere cerere certificat moștenitor',
        description: 'Depunere cerere la notariat pentru certificat de moștenitor',
        assignedTo: ion.id,
        createdBy: lucian.id,
        dueDate: addDays(now, 3),
        status: TaskStatus.InProgress,
        estimatedHours: 2,
        priority: 'High',
        createdAt: subDays(now, 5),
        updatedAt: subHours(now, 8), // Recently updated
      },
    }),
    // Pending
    prisma.task.upsert({
      where: { id: IDs.tasks.popescu1_task3 },
      update: {},
      create: {
        id: IDs.tasks.popescu1_task3,
        firmId: firm.id,
        caseId: IDs.cases.popescu1,
        type: TaskTypeEnum.Meeting,
        title: 'Negociere partaj între moștenitori',
        description: 'Facilitare discuții între moștenitori pentru partaj amiabil',
        assignedTo: lucian.id,
        createdBy: lucian.id,
        dueDate: addDays(now, 14),
        status: TaskStatus.Pending,
        estimatedHours: 3,
        priority: 'Medium',
        createdAt: subDays(now, 2),
        updatedAt: subDays(now, 2),
      },
    }),
  ]);

  console.log(`✓ Created ${tasks.length} tasks`);

  // ============================================================================
  // DOCUMENT FOLDERS
  // ============================================================================

  console.log('Creating document folders...');

  await Promise.all([
    prisma.documentFolder.upsert({
      where: { id: IDs.folders.acme1 },
      update: {},
      create: {
        id: IDs.folders.acme1,
        firmId: firm.id,
        caseId: IDs.cases.acme1,
        name: 'Documente proces',
        createdAt: subDays(now, 60),
      },
    }),
    prisma.documentFolder.upsert({
      where: { id: IDs.folders.acme2 },
      update: {},
      create: {
        id: IDs.folders.acme2,
        firmId: firm.id,
        caseId: IDs.cases.acme2,
        name: 'Contracte',
        createdAt: subDays(now, 45),
      },
    }),
    prisma.documentFolder.upsert({
      where: { id: IDs.folders.global1 },
      update: {},
      create: {
        id: IDs.folders.global1,
        firmId: firm.id,
        caseId: IDs.cases.global1,
        name: 'Due Diligence',
        createdAt: subDays(now, 30),
      },
    }),
    prisma.documentFolder.upsert({
      where: { id: IDs.folders.global2 },
      update: {},
      create: {
        id: IDs.folders.global2,
        firmId: firm.id,
        caseId: IDs.cases.global2,
        name: 'GDPR',
        createdAt: subDays(now, 20),
      },
    }),
    prisma.documentFolder.upsert({
      where: { id: IDs.folders.popescu1 },
      update: {},
      create: {
        id: IDs.folders.popescu1,
        firmId: firm.id,
        caseId: IDs.cases.popescu1,
        name: 'Acte succesiune',
        createdAt: subDays(now, 15),
      },
    }),
  ]);

  console.log('✓ Created document folders');

  // ============================================================================
  // DOCUMENTS
  // ============================================================================

  console.log('Creating documents...');

  const documents = await Promise.all([
    // ACME Litigiu - DRAFT document (old, should trigger attention)
    prisma.document.upsert({
      where: { id: IDs.documents.acme1_doc1 },
      update: {},
      create: {
        id: IDs.documents.acme1_doc1,
        firmId: firm.id,
        clientId: IDs.clients.acmeCorp,
        fileName: 'Intampinare_v2.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 45000,
        storagePath: `/seed/${firm.id}/documents/acme1_intampinare.docx`,
        status: DocumentStatus.DRAFT, // DRAFT - should show attention
        uploadedBy: lucian.id,
        createdAt: subDays(now, 5), // Old draft
        updatedAt: subDays(now, 3),
      },
    }),
    // ACME Litigiu - FINAL document
    prisma.document.upsert({
      where: { id: IDs.documents.acme1_doc2 },
      update: {},
      create: {
        id: IDs.documents.acme1_doc2,
        firmId: firm.id,
        clientId: IDs.clients.acmeCorp,
        fileName: 'Lista_probe.pdf',
        fileType: 'application/pdf',
        fileSize: 125000,
        storagePath: `/seed/${firm.id}/documents/acme1_probe.pdf`,
        status: DocumentStatus.FINAL,
        uploadedBy: lucian.id,
        createdAt: subDays(now, 10),
        updatedAt: subDays(now, 8),
      },
    }),
    // ACME Contract - DRAFT
    prisma.document.upsert({
      where: { id: IDs.documents.acme2_doc1 },
      update: {},
      create: {
        id: IDs.documents.acme2_doc1,
        firmId: firm.id,
        clientId: IDs.clients.acmeCorp,
        fileName: 'Contract_cadru_v1.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 78000,
        storagePath: `/seed/${firm.id}/documents/acme2_contract.docx`,
        status: DocumentStatus.DRAFT,
        uploadedBy: maria.id,
        createdAt: subDays(now, 4),
        updatedAt: subDays(now, 4),
      },
    }),
    // Global Fuziune - READY_FOR_REVIEW
    prisma.document.upsert({
      where: { id: IDs.documents.global1_doc1 },
      update: {},
      create: {
        id: IDs.documents.global1_doc1,
        firmId: firm.id,
        clientId: IDs.clients.globalTech,
        fileName: 'Raport_DueDiligence.pdf',
        fileType: 'application/pdf',
        fileSize: 256000,
        storagePath: `/seed/${firm.id}/documents/global1_raport.pdf`,
        status: DocumentStatus.READY_FOR_REVIEW,
        uploadedBy: ion.id,
        createdAt: subHours(now, 12),
        updatedAt: subHours(now, 12),
      },
    }),
    // Global GDPR - DRAFT (old)
    prisma.document.upsert({
      where: { id: IDs.documents.global2_doc1 },
      update: {},
      create: {
        id: IDs.documents.global2_doc1,
        firmId: firm.id,
        clientId: IDs.clients.globalTech,
        fileName: 'Politica_confidentialitate_draft.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 52000,
        storagePath: `/seed/${firm.id}/documents/global2_politica.docx`,
        status: DocumentStatus.DRAFT,
        uploadedBy: maria.id,
        createdAt: subDays(now, 6),
        updatedAt: subDays(now, 5),
      },
    }),
    // Popescu - FINAL
    prisma.document.upsert({
      where: { id: IDs.documents.popescu1_doc1 },
      update: {},
      create: {
        id: IDs.documents.popescu1_doc1,
        firmId: firm.id,
        clientId: IDs.clients.familiaPopescu,
        fileName: 'Certificate_stare_civila.pdf',
        fileType: 'application/pdf',
        fileSize: 180000,
        storagePath: `/seed/${firm.id}/documents/popescu1_certificate.pdf`,
        status: DocumentStatus.FINAL,
        uploadedBy: ion.id,
        createdAt: subDays(now, 2),
        updatedAt: subDays(now, 2),
      },
    }),
  ]);

  console.log(`✓ Created ${documents.length} documents`);

  // ============================================================================
  // CASE DOCUMENTS (link documents to cases)
  // ============================================================================

  console.log('Linking documents to cases...');

  await Promise.all([
    prisma.caseDocument.upsert({
      where: {
        caseId_documentId: { caseId: IDs.cases.acme1, documentId: IDs.documents.acme1_doc1 },
      },
      update: {},
      create: {
        firmId: firm.id,
        caseId: IDs.cases.acme1,
        documentId: IDs.documents.acme1_doc1,
        linkedBy: lucian.id,
        linkedAt: subDays(now, 5),
      },
    }),
    prisma.caseDocument.upsert({
      where: {
        caseId_documentId: { caseId: IDs.cases.acme1, documentId: IDs.documents.acme1_doc2 },
      },
      update: {},
      create: {
        firmId: firm.id,
        caseId: IDs.cases.acme1,
        documentId: IDs.documents.acme1_doc2,
        linkedBy: lucian.id,
        linkedAt: subDays(now, 10),
      },
    }),
    prisma.caseDocument.upsert({
      where: {
        caseId_documentId: { caseId: IDs.cases.acme2, documentId: IDs.documents.acme2_doc1 },
      },
      update: {},
      create: {
        firmId: firm.id,
        caseId: IDs.cases.acme2,
        documentId: IDs.documents.acme2_doc1,
        linkedBy: maria.id,
        linkedAt: subDays(now, 4),
      },
    }),
    prisma.caseDocument.upsert({
      where: {
        caseId_documentId: { caseId: IDs.cases.global1, documentId: IDs.documents.global1_doc1 },
      },
      update: {},
      create: {
        firmId: firm.id,
        caseId: IDs.cases.global1,
        documentId: IDs.documents.global1_doc1,
        linkedBy: ion.id,
        linkedAt: subHours(now, 12),
      },
    }),
    prisma.caseDocument.upsert({
      where: {
        caseId_documentId: { caseId: IDs.cases.global2, documentId: IDs.documents.global2_doc1 },
      },
      update: {},
      create: {
        firmId: firm.id,
        caseId: IDs.cases.global2,
        documentId: IDs.documents.global2_doc1,
        linkedBy: maria.id,
        linkedAt: subDays(now, 6),
      },
    }),
    prisma.caseDocument.upsert({
      where: {
        caseId_documentId: { caseId: IDs.cases.popescu1, documentId: IDs.documents.popescu1_doc1 },
      },
      update: {},
      create: {
        firmId: firm.id,
        caseId: IDs.cases.popescu1,
        documentId: IDs.documents.popescu1_doc1,
        linkedBy: ion.id,
        linkedAt: subDays(now, 2),
      },
    }),
  ]);

  console.log('✓ Linked documents to cases');

  // ============================================================================
  // TIME ENTRIES (for completed tasks)
  // ============================================================================

  console.log('Creating time entries...');

  await Promise.all([
    // Time entries for completed tasks
    prisma.timeEntry.upsert({
      where: { id: IDs.timeEntry(IDs.tasks.acme1_task1, 1) },
      update: {},
      create: {
        id: IDs.timeEntry(IDs.tasks.acme1_task1, 1),
        firmId: firm.id,
        taskId: IDs.tasks.acme1_task1,
        userId: lucian.id,
        hours: 3,
        hourlyRate: 150,
        date: subDays(now, 1),
        description: 'Redactare întâmpinare finalizată',
        createdAt: subDays(now, 1),
      },
    }),
    prisma.timeEntry.upsert({
      where: { id: IDs.timeEntry(IDs.tasks.global1_task1, 1) },
      update: {},
      create: {
        id: IDs.timeEntry(IDs.tasks.global1_task1, 1),
        firmId: firm.id,
        taskId: IDs.tasks.global1_task1,
        userId: ion.id,
        hours: 8,
        hourlyRate: 100,
        date: subDays(now, 3),
        description: 'Due diligence complet',
        createdAt: subDays(now, 3),
      },
    }),
    prisma.timeEntry.upsert({
      where: { id: IDs.timeEntry(IDs.tasks.global1_task2, 1) },
      update: {},
      create: {
        id: IDs.timeEntry(IDs.tasks.global1_task2, 1),
        firmId: firm.id,
        taskId: IDs.tasks.global1_task2,
        userId: ion.id,
        hours: 4,
        hourlyRate: 100,
        date: now,
        description: 'Raport due diligence finalizat',
        createdAt: subHours(now, 12),
      },
    }),
    prisma.timeEntry.upsert({
      where: { id: IDs.timeEntry(IDs.tasks.popescu1_task1, 1) },
      update: {},
      create: {
        id: IDs.timeEntry(IDs.tasks.popescu1_task1, 1),
        firmId: firm.id,
        taskId: IDs.tasks.popescu1_task1,
        userId: ion.id,
        hours: 2,
        hourlyRate: 100,
        date: subDays(now, 2),
        description: 'Obținere certificate stare civilă',
        createdAt: subDays(now, 2),
      },
    }),
  ]);

  console.log('✓ Created time entries');

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('\n✅ Seed completed successfully!\n');
  console.log('Summary:');
  console.log(
    `  - 3 clients (ACME Corporation [Seed], Global Tech [Seed], Familia Popescu [Seed])`
  );
  console.log(`  - 5 cases (2 for ACME, 2 for Global Tech, 1 for Popescu)`);
  console.log(`  - ${tasks.length} tasks:`);
  console.log(`    - 4 Completed (this week)`);
  console.log(`    - 6 In Progress (3 stuck, 3 active)`);
  console.log(`    - 7 Pending (not started)`);
  console.log(`  - ${documents.length} documents (3 DRAFT, 2 FINAL, 1 READY_FOR_REVIEW)`);
  console.log(`  - 4 time entries`);
  console.log('\nRefresh /time to see the data!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
