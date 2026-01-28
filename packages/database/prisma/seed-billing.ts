/**
 * Billing Test Data Seed Script
 *
 * Creates completed tasks and billable time entries for testing invoicing.
 * Run: pnpm --filter database exec tsx prisma/seed-billing.ts
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// ============================================================================
// DETERMINISTIC UUID GENERATOR
// ============================================================================
const SEED_NAMESPACE = 'legal-platform-billing-seed-2025';

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
// DATA GENERATION HELPERS
// ============================================================================

function pastDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(0, 0, 0, 0);
  return date;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Work descriptions for time entries
const workDescriptions = [
  'Consultație telefonică cu clientul',
  'Redactare contract',
  'Revizuire documente',
  'Pregătire pentru instanță',
  'Research legislație',
  'Analiză jurisprudență',
  'Corespondență cu partea adversă',
  'Participare ședință',
  'Negocieri contract',
  'Întocmire cerere',
  'Verificare acte',
  'Consultanță juridică',
  'Redactare memoriu',
  'Pregătire pledoarie',
  'Deplasare tribunal',
  'Studiu dosar',
  'Întâlnire client',
  'Coordonare echipă',
  'Review documente primite',
  'Pregătire raport',
  'Analiză contract',
  'Due diligence',
  'Redactare notificare',
  'Verificare termen',
];

// Task titles
const taskTitles = [
  'Pregătire dosar pentru instanță',
  'Revizuire contract de prestări servicii',
  'Consultație client',
  'Depunere cerere la tribunal',
  'Obținere certificate de la registre',
  'Redactare memoriu de apărare',
  'Analiză documente caz',
  'Negociere contract furnizare',
  'Pregătire întâmpinare',
  'Verificare acte societate',
  'Întocmire proces-verbal AGA',
  'Pregătire pledoarie finală',
  'Research jurisprudență relevantă',
  'Comunicare cu partea adversă',
  'Pregătire apel',
  'Verificare termen procedural',
  'Actualizare dosar client',
  'Calcul despăgubiri',
  'Pregătire documentație GDPR',
  'Follow-up client pentru semnare',
];

const taskTypes = ['Research', 'DocumentCreation', 'DocumentRetrieval', 'CourtDate', 'Meeting'];

async function main() {
  console.log('💰 Starting billing test data generation...\n');

  // Get existing firm and users
  const firm = await prisma.firm.findFirst();
  if (!firm) {
    console.error('❌ No firm found. Run the main seed first: pnpm db:seed');
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    where: { status: 'Active', firmId: firm.id },
  });
  if (users.length === 0) {
    console.error('❌ No users found. Run the main seed first: pnpm db:seed');
    process.exit(1);
  }

  // Get all clients
  const clients = await prisma.client.findMany({
    where: { firmId: firm.id },
  });

  if (clients.length === 0) {
    console.error('❌ No clients found. Run the main seed first: pnpm db:seed');
    process.exit(1);
  }

  // Create test cases for each client if they don't have enough
  console.log('Ensuring test cases exist for each client...');
  const caseTitles = [
    'Consultanță juridică generală',
    'Redactare contracte comerciale',
    'Litigiu comercial',
    'Due diligence achiziție',
    'Reprezentare în instanță',
    'Negociere contract furnizare',
    'Asistență juridică GDPR',
    'Recuperare creanțe',
    'Restructurare societate',
    'Contract de închiriere',
  ];

  const caseTypes = ['Advisory', 'Contract', 'Litigation', 'Corporate', 'RealEstate'];
  const billingTypes = ['Hourly', 'Hourly', 'Hourly', 'Fixed', 'Retainer'];

  let casesCreated = 0;
  for (let clientIdx = 0; clientIdx < clients.length; clientIdx++) {
    const client = clients[clientIdx];

    // Check existing cases for this client
    const existingCases = await prisma.case.count({
      where: { clientId: client.id, status: 'Active' },
    });

    // Create 2-3 cases per client if needed
    const casesToCreate = Math.max(0, 3 - existingCases);

    for (let i = 0; i < casesToCreate; i++) {
      const caseIndex = clientIdx * 3 + i;
      const billingType = randomElement(billingTypes);

      try {
        await prisma.case.create({
          data: {
            id: seedUUID('billing-case', caseIndex),
            firmId: firm.id,
            caseNumber: `${firm.id.substring(0, 8)}-2025-T${(caseIndex + 1).toString().padStart(3, '0')}`,
            title: `${caseTitles[caseIndex % caseTitles.length]} - ${client.name.substring(0, 25)}`,
            clientId: client.id,
            status: 'Active',
            type: randomElement(caseTypes) as any,
            description: `Dosar de testare facturare pentru ${client.name}`,
            openedDate: pastDate(randomInt(30, 180)),
            billingType: billingType as any,
            fixedAmount: billingType === 'Fixed' ? randomInt(5000, 50000) : null,
            retainerAmount: billingType === 'Retainer' ? randomInt(10000, 30000) : null,
            customRates: {
              partnerRate: randomInt(400, 550),
              associateRate: randomInt(250, 350),
              paralegalRate: randomInt(100, 175),
            },
            createdAt: pastDate(randomInt(30, 180)),
            updatedAt: new Date(),
          },
        });
        casesCreated++;
      } catch (e) {
        // Skip on duplicate
      }

      // Add case team
      const leadUser = randomElement(users);
      try {
        await prisma.caseTeam.create({
          data: {
            id: seedUUID('billing-case-team', caseIndex),
            caseId: seedUUID('billing-case', caseIndex),
            userId: leadUser.id,
            role: 'Lead',
            assignedAt: pastDate(randomInt(1, 30)),
          },
        });
      } catch (e) {
        // Skip on duplicate
      }
    }
  }
  console.log(`✓ Created ${casesCreated} test cases\n`);

  // Get all cases with clients now
  const allCases = await prisma.case.findMany({
    where: {
      firmId: firm.id,
      status: 'Active',
    },
    include: { client: true },
  });
  // Filter to only cases that have a client
  const cases = allCases.filter((c) => c.clientId !== null);

  if (cases.length === 0) {
    console.error('❌ No cases with clients found after creation. Check data.');
    process.exit(1);
  }

  console.log(`Working with firm: ${firm.name}`);
  console.log(`Found ${users.length} active users`);
  console.log(`Found ${clients.length} clients`);
  console.log(`Found ${cases.length} cases with clients\n`);

  // Clean up existing billing seed data by deleting known seeded IDs
  console.log('Cleaning up existing billing test data...');
  const timeEntryIds = Array.from({ length: 200 }, (_, i) => seedUUID('time-entry', i));
  const taskIds = Array.from({ length: 50 }, (_, i) => seedUUID('task', i));

  await prisma.timeEntry.deleteMany({
    where: { id: { in: timeEntryIds } },
  });
  await prisma.task.deleteMany({
    where: { id: { in: taskIds } },
  });

  // ============================================================================
  // CREATE COMPLETED TASKS (50)
  // ============================================================================
  console.log('Creating completed tasks...');
  let tasksCreated = 0;

  for (let i = 0; i < 50; i++) {
    const caseData = randomElement(cases);
    const assignee = randomElement(users);
    const daysAgo = randomInt(1, 60);
    const estimatedHours = randomInt(1, 8);

    try {
      await prisma.task.create({
        data: {
          id: seedUUID('task', i),
          firmId: firm.id,
          caseId: caseData.id,
          clientId: caseData.clientId,
          type: randomElement(taskTypes) as any,
          title: randomElement(taskTitles),
          description: `Task pentru ${caseData.client?.name || 'client'}`,
          assignedTo: assignee.id,
          dueDate: pastDate(daysAgo),
          status: 'Completed',
          priority: randomElement(['Low', 'Medium', 'High']) as any,
          estimatedHours,
          completedAt: pastDate(daysAgo - randomInt(0, 2)),
          createdBy: randomElement(users).id,
          createdAt: pastDate(daysAgo + randomInt(1, 5)),
        },
      });
      tasksCreated++;
    } catch (e) {
      // Skip on duplicate key
    }
  }
  console.log(`✓ Created ${tasksCreated} completed tasks\n`);

  // ============================================================================
  // CREATE TIME ENTRIES (200 billable entries linked to tasks)
  // ============================================================================
  console.log('Creating billable time entries linked to tasks...');
  let entriesCreated = 0;
  const entriesByClient: Record<string, { count: number; totalHours: number; totalValue: number }> =
    {};

  // Get all created tasks to link time entries to them
  const createdTasks = await prisma.task.findMany({
    where: {
      id: { in: Array.from({ length: 50 }, (_, i) => seedUUID('task', i)) },
    },
    include: { case: { include: { client: true } } },
  });

  if (createdTasks.length === 0) {
    console.error('❌ No tasks found to link time entries. Check task creation.');
    process.exit(1);
  }

  // Create 4 time entries per task (200 total for 50 tasks)
  for (let i = 0; i < 200; i++) {
    const taskIndex = i % createdTasks.length;
    const task = createdTasks[taskIndex];
    const user = users.find((u) => u.id === task.assignedTo) || randomElement(users);
    // Focus 70% on last month (1-31 days ago), 30% on older (32-90 days)
    const daysAgo = Math.random() < 0.7 ? randomInt(1, 31) : randomInt(32, 90);
    const hours = (randomInt(1, 16) * 0.5).toFixed(2); // 0.5 to 8 hours in 30min increments

    // Determine rate based on user role
    let rate = 300; // default
    if (user.role === 'Partner' || user.role === 'BusinessOwner') {
      rate = randomInt(400, 550);
    } else if (user.role === 'Associate') {
      rate = randomInt(250, 350);
    } else if (user.role === 'Paralegal') {
      rate = randomInt(100, 175);
    }

    // 95% billable, 5% non-billable for realism
    const billable = Math.random() > 0.05;

    try {
      await prisma.timeEntry.create({
        data: {
          id: seedUUID('time-entry', i),
          caseId: task.caseId,
          clientId: task.clientId,
          taskId: task.id, // Link to task!
          userId: user.id,
          date: pastDate(daysAgo),
          hours: parseFloat(hours),
          hourlyRate: rate,
          description: randomElement(workDescriptions),
          narrative:
            Math.random() > 0.7 ? `Detalii suplimentare pentru ${task.case?.client?.name}` : null,
          billable,
          firmId: firm.id,
          createdAt: pastDate(daysAgo),
          updatedAt: new Date(),
        },
      });
      entriesCreated++;

      // Track stats per client
      if (billable && task.clientId) {
        if (!entriesByClient[task.clientId]) {
          entriesByClient[task.clientId] = { count: 0, totalHours: 0, totalValue: 0 };
        }
        entriesByClient[task.clientId].count++;
        entriesByClient[task.clientId].totalHours += parseFloat(hours);
        entriesByClient[task.clientId].totalValue += parseFloat(hours) * rate;
      }
    } catch (e: any) {
      // Log first error to diagnose
      if (entriesCreated === 0 && i === 0) {
        console.error('First time entry error:', e.message);
      }
    }
  }
  console.log(`✓ Created ${entriesCreated} time entries linked to tasks\n`);

  // ============================================================================
  // SUMMARY
  // ============================================================================
  const totalBillableEntries = await prisma.timeEntry.count({
    where: { firmId: firm.id, billable: true },
  });

  const billableStats = await prisma.timeEntry.aggregate({
    where: { firmId: firm.id, billable: true },
    _sum: { hours: true },
  });

  console.log('✅ Billing test data generation completed!\n');
  console.log('Summary:');
  console.log(`  - Completed tasks: ${tasksCreated}`);
  console.log(`  - Time entries created: ${entriesCreated}`);
  console.log(`  - Total billable entries in DB: ${totalBillableEntries}`);
  console.log(`  - Total billable hours: ${billableStats._sum.hours || 0}\n`);

  console.log('Top clients by billable value (from this seed):');
  const sortedClients = Object.entries(entriesByClient)
    .sort(([, a], [, b]) => b.totalValue - a.totalValue)
    .slice(0, 5);

  for (const [clientId, stats] of sortedClients) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { name: true },
    });
    console.log(
      `  - ${client?.name || clientId}: ${stats.count} entries, ${stats.totalHours.toFixed(1)} hours, €${stats.totalValue.toFixed(0)}`
    );
  }

  console.log('\nTo view data: npx prisma studio');
  console.log('To test invoicing: Navigate to the billing section in the app');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error during billing seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
