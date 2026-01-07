/**
 * Calendar Seed Script
 *
 * Seeds the database with events and tasks for January 2026 to test
 * the unified calendar scheduling feature.
 *
 * Distribution: 1/3 events, 2/3 tasks
 *
 * Run with: pnpm --filter database exec ts-node prisma/seed-calendar.ts
 */

import { PrismaClient, TaskStatus, TaskPriority, TaskTypeEnum } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// ============================================================================
// DETERMINISTIC UUID GENERATOR
// ============================================================================

const SEED_NAMESPACE = 'calendar-seed-january-2026';

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
// CONFIGURATION
// ============================================================================

// January 2026 dates (business days only: Mon-Fri)
const JANUARY_2026_BUSINESS_DAYS = [
  // Week 1 (starts Thursday)
  2, 3,  // Thu, Fri
  // Week 2
  5, 6, 7, 8, 9,
  // Week 3
  12, 13, 14, 15, 16,
  // Week 4
  19, 20, 21, 22, 23,
  // Week 5
  26, 27, 28, 29, 30,
];

// Business hours time slots (every 30 minutes from 08:00 to 17:30)
const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30',
];

// Event types with their typical durations
const EVENT_TEMPLATES = [
  { type: TaskTypeEnum.CourtDate, title: 'Termen instanta', duration: 2, location: 'Judecatoria' },
  { type: TaskTypeEnum.Hearing, title: 'Audiere martor', duration: 1.5, location: 'Sala 5' },
  { type: TaskTypeEnum.Meeting, title: 'Intalnire client', duration: 1 },
  { type: TaskTypeEnum.Meeting, title: 'Conferinta avocati', duration: 2 },
  { type: TaskTypeEnum.LegalDeadline, title: 'Termen depunere', duration: 0.5 },
  { type: TaskTypeEnum.Reminder, title: 'Follow-up dosar', duration: 0.5 },
];

// Task templates with estimated durations
const TASK_TEMPLATES = [
  { type: TaskTypeEnum.Research, title: 'Cercetare jurisprudenta', hours: 3, priority: TaskPriority.High },
  { type: TaskTypeEnum.Research, title: 'Analiza legislatie', hours: 2, priority: TaskPriority.Medium },
  { type: TaskTypeEnum.DocumentCreation, title: 'Redactare cerere', hours: 2.5, priority: TaskPriority.High },
  { type: TaskTypeEnum.DocumentCreation, title: 'Intocmire intampinare', hours: 3, priority: TaskPriority.High },
  { type: TaskTypeEnum.DocumentCreation, title: 'Redactare contract', hours: 4, priority: TaskPriority.Medium },
  { type: TaskTypeEnum.DocumentCreation, title: 'Concluzii scrise', hours: 2, priority: TaskPriority.High },
  { type: TaskTypeEnum.DocumentRetrieval, title: 'Obtinere extras CF', hours: 1, priority: TaskPriority.Medium },
  { type: TaskTypeEnum.DocumentRetrieval, title: 'Solicitare dosar instanta', hours: 0.5, priority: TaskPriority.Low },
  { type: TaskTypeEnum.GeneralTask, title: 'Pregatire dosar', hours: 1.5, priority: TaskPriority.Medium },
  { type: TaskTypeEnum.GeneralTask, title: 'Revizuire documente', hours: 1, priority: TaskPriority.Low },
  { type: TaskTypeEnum.GeneralTask, title: 'Comunicare client', hours: 0.5, priority: TaskPriority.Medium },
  { type: TaskTypeEnum.GeneralTask, title: 'Actualizare status', hours: 0.5, priority: TaskPriority.Low },
];

// Romanian case suffixes for variation
const CASE_SUFFIXES = [
  'Popescu', 'Ionescu', 'Georgescu', 'Marin', 'Popa', 'Stan', 'Rusu',
  'Stoica', 'Tudor', 'Dinu', 'ABC Industries', 'Tech Solutions', 'Construct SRL',
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + hours * 60;
  const newHours = Math.min(Math.floor(totalMinutes / 60), 18);
  const newMinutes = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
}

function getJanuaryDate(day: number): Date {
  return new Date(2026, 0, day); // Month is 0-indexed
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  console.log('📅 Starting calendar seed for January 2026...\n');

  // Get the firm
  const firm = await prisma.firm.findFirst();
  if (!firm) {
    throw new Error('No firm found. Run the main seed first: pnpm db:seed');
  }
  console.log(`✓ Found firm: ${firm.name}`);

  // Get active users
  const users = await prisma.user.findMany({
    where: {
      firmId: firm.id,
      status: 'Active',
    },
  });
  console.log(`✓ Found ${users.length} active users`);

  // Get active cases
  const cases = await prisma.case.findMany({
    where: {
      firmId: firm.id,
      status: 'Active',
    },
    take: 20, // Use up to 20 cases
  });
  console.log(`✓ Found ${cases.length} active cases\n`);

  if (users.length === 0 || cases.length === 0) {
    throw new Error('No users or cases found. Run the main seed first.');
  }

  // Delete existing calendar tasks for January 2026 (clean slate)
  const janStart = new Date(2026, 0, 1);
  const janEnd = new Date(2026, 1, 1);

  const deleted = await prisma.task.deleteMany({
    where: {
      firmId: firm.id,
      dueDate: {
        gte: janStart,
        lt: janEnd,
      },
    },
  });
  console.log(`🗑️  Deleted ${deleted.count} existing January tasks\n`);

  // Track created items
  let eventCount = 0;
  let taskCount = 0;
  let itemIndex = 0;

  // Create items for each user and day
  for (const user of users) {
    console.log(`👤 Creating schedule for ${user.firstName} ${user.lastName}...`);

    let userEventCount = 0;
    let userTaskCount = 0;

    for (const day of JANUARY_2026_BUSINESS_DAYS) {
      const date = getJanuaryDate(day);

      // Each user gets 1-3 items per day (reasonable workload)
      const itemsPerDay = 1 + Math.floor(Math.random() * 3);

      // Track used time slots to avoid overlaps
      const usedSlots = new Set<string>();

      for (let i = 0; i < itemsPerDay; i++) {
        itemIndex++;
        const caseObj = randomElement(cases);
        const caseSuffix = randomElement(CASE_SUFFIXES);

        // Find an available time slot
        let timeSlot = randomElement(TIME_SLOTS);
        let attempts = 0;
        while (usedSlots.has(timeSlot) && attempts < 20) {
          timeSlot = randomElement(TIME_SLOTS);
          attempts++;
        }
        usedSlots.add(timeSlot);

        // Decide: event (1/3) or task (2/3)
        const isEvent = Math.random() < 0.33;

        if (isEvent) {
          // Create event
          const template = randomElement(EVENT_TEMPLATES);
          const endTime = addHoursToTime(timeSlot, template.duration);

          await prisma.task.create({
            data: {
              id: seedUUID('calendar-event', `${user.id}-${day}-${i}`),
              firmId: firm.id,
              caseId: caseObj.id,
              type: template.type,
              title: `${template.title} - ${caseSuffix}`,
              description: `Eveniment generat automat pentru testare calendar`,
              assignedTo: user.id,
              dueDate: date,
              dueTime: timeSlot,
              status: TaskStatus.Pending,
              priority: TaskPriority.High,
              estimatedHours: template.duration,
              createdBy: user.id,
              typeMetadata: {
                isEvent: true,
                startDate: date.toISOString().split('T')[0],
                startTime: timeSlot,
                endDate: date.toISOString().split('T')[0],
                endTime: endTime,
                location: template.location || null,
              },
            },
          });
          eventCount++;
          userEventCount++;

          // Mark duration slots as used
          let t = timeSlot;
          for (let h = 0; h < template.duration * 2; h++) {
            usedSlots.add(t);
            t = addHoursToTime(t, 0.5);
          }
        } else {
          // Create task
          const template = randomElement(TASK_TEMPLATES);

          await prisma.task.create({
            data: {
              id: seedUUID('calendar-task', `${user.id}-${day}-${i}`),
              firmId: firm.id,
              caseId: caseObj.id,
              type: template.type,
              title: `${template.title} - ${caseSuffix}`,
              description: `Task generat automat pentru testare calendar`,
              assignedTo: user.id,
              dueDate: date,
              status: TaskStatus.Pending,
              priority: template.priority,
              estimatedHours: template.hours,
              createdBy: user.id,
              // Tasks will get scheduled by the auto-scheduler
              // For now, pre-schedule some to show in the time grid
              scheduledDate: date,
              scheduledStartTime: timeSlot,
              pinned: Math.random() < 0.1, // 10% are pinned
            },
          });
          taskCount++;
          userTaskCount++;

          // Mark estimated duration slots as used
          let t = timeSlot;
          for (let h = 0; h < template.hours * 2; h++) {
            usedSlots.add(t);
            t = addHoursToTime(t, 0.5);
          }
        }
      }
    }

    console.log(`   ✓ ${userEventCount} events, ${userTaskCount} tasks`);
  }

  console.log('\n========================================');
  console.log(`✅ Calendar seed complete!`);
  console.log(`   📅 Events: ${eventCount} (${((eventCount / (eventCount + taskCount)) * 100).toFixed(1)}%)`);
  console.log(`   📋 Tasks: ${taskCount} (${((taskCount / (eventCount + taskCount)) * 100).toFixed(1)}%)`);
  console.log(`   👥 Users: ${users.length}`);
  console.log(`   📆 Days: ${JANUARY_2026_BUSINESS_DAYS.length} business days`);
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
