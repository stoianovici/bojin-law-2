/**
 * Task Management Factory
 * Creates mock task entities with Romanian localization and legal terminology
 */

import { faker } from '@faker-js/faker';
import type { Task, TaskType } from '@legal-platform/types';

/**
 * Romanian first names (common in legal profession)
 */
const romanianFirstNames = [
  'Andrei',
  'Maria',
  'Ion',
  'Elena',
  'Mihai',
  'Ana',
  'Alexandru',
  'Ioana',
  'Vasile',
  'Gabriela',
  'Cristian',
  'Diana',
  'George',
  'Laura',
  'Dan',
  'Carmen',
  'Adrian',
  'Monica',
  'Stefan',
  'Alina',
];

/**
 * Romanian last names
 */
const romanianLastNames = [
  'Popescu',
  'Ionescu',
  'Popa',
  'Constantinescu',
  'Dumitrescu',
  'Georgescu',
  'Stanciu',
  'Marin',
  'Tudor',
  'Ilie',
  'Radu',
  'Dobre',
  'Constantinescu',
  'Vasile',
];

/**
 * Task titles by type (Romanian)
 */
const taskTitlesByType: Record<TaskType, string[]> = {
  Research: [
    'Cercetare jurisprudență pentru dosar civil',
    'Analiză legislație nouă privind contractele de muncă',
    'Studiu precedente CEDO pentru cauză penal',
    'Cercetare doctrină în materie comercială',
    'Verificare jurisprudență ÎCCJ pe conflict de muncă',
    'Analiză amendamente Cod Civil aplicabile',
  ],
  DocumentCreation: [
    'Redactare contract de închiriere comercială',
    'Pregătire cerere de chemare în judecată',
    'Întocmire contract de vânzare-cumpărare',
    'Redactare act adițional la contract',
    'Pregătire memoriu de apărare',
    'Întocmire scrisoare de punere în întârziere',
  ],
  DocumentRetrieval: [
    'Găsire certificat fiscal client',
    'Recuperare hotărâre judecătorească din arhivă',
    'Obținere extras de carte funciară',
    'Căutare documente constituire societate',
    'Localizare procură specială semnată',
    'Recuperare registru agricol actualizat',
  ],
  CourtDate: [
    'Termen Judecătoria Sector 4 București',
    'Ședință Tribunal București',
    'Termen Curte de Apel București',
    'Audiere martor Tribunal Comercial',
    'Judecată fond Judecătoria Ilfov',
    'Pronunțare hotărâre Înalta Curte',
  ],
  Meeting: [
    'Consultare client pentru strategie litigiu',
    'Întâlnire negociere contract comercial',
    'Consultație inițială client nou',
    'Discuție partener despre progres dosar',
    'Întâlnire mediere conflict de muncă',
    'Consultare expertize necesare pentru proces',
  ],
  BusinessTrip: [
    'Deplasare Cluj-Napoca pentru termen',
    'Călătorie Timișoara întâlnire client',
    'Deplasare Constanța verificare proprietate',
    'Călătorie Brașov pentru due diligence',
    'Deplasare Iași participare conferință juridică',
    'Călătorie Craiova pentru arbitraj comercial',
  ],
};

/**
 * Task descriptions by type (Romanian)
 */
const taskDescriptionsByType: Record<TaskType, string[]> = {
  Research: [
    'Cercetare jurisprudență relevantă pentru susținerea argumentelor noastre în dosar.',
    'Analiză comparativă a legislației vechi și noi pentru identificarea clauzelor aplicabile.',
    'Studiu detaliat al precedentelor CEDO pentru identificarea elementelor de susținere.',
    'Verificare doctrină și jurisprudență pentru fundamentarea poziției clientului.',
  ],
  DocumentCreation: [
    'Redactare document legal conform cerințelor clientului și normelor în vigoare.',
    'Pregătire act procedural respectând termenul legal de depunere.',
    'Întocmire contract cu toate clauzele necesare pentru protecția părților.',
    'Redactare document oficial conform formularului aprobat.',
  ],
  DocumentRetrieval: [
    'Căutare și recuperare document necesar pentru completarea dosarului.',
    'Obținere documente oficiale de la instituțiile competente.',
    'Localizare acte din arhiva cabinetului pentru utilizare în procedura actuală.',
    'Solicitare documente de la client pentru completarea documentației.',
  ],
  CourtDate: [
    'Participare termen judecată pentru susținere poziție client.',
    'Prezență obligatorie în instanță pentru reprezentare client.',
    'Asistență juridică în ședință publică de judecată.',
    'Participare audiere pentru formulare concluzii în cauză.',
  ],
  Meeting: [
    'Întâlnire cu clientul pentru discutarea strategiei și clarifice aspecte de fapt.',
    'Consultare pentru informarea clientului despre evoluția dosarului.',
    'Discuție pentru negocierea condițiilor contractuale între părți.',
    'Întâlnire de coordonare a echipei pe dosar complex.',
  ],
  BusinessTrip: [
    'Deplasare în alt județ pentru participare la activități profesionale.',
    'Călătorie pentru întâlnire cu clientul la sediul acestuia.',
    'Deplasare pentru verificare pe teren a elementelor de fapt din dosar.',
    'Călătorie pentru participare la eveniment profesional de specialitate.',
  ],
};

/**
 * Case references (Romanian format)
 */
const caseReferences = [
  'Dosar 1234/2025',
  'Dosar 5678/2025',
  'Cauză 3456/2025',
  'Dosar 7890/2024',
  'Litigiu 2345/2025',
  'Cauză 6789/2024',
  'Dosar 4567/2025',
  'Contract 8901/2025',
];

/**
 * Generate Romanian full name
 */
function generateRomanianName(): string {
  const firstName = faker.helpers.arrayElement(romanianFirstNames);
  const lastName = faker.helpers.arrayElement(romanianLastNames);
  return `${firstName} ${lastName}`;
}

/**
 * Create a single mock task
 */
export function createMockTask(overrides?: Partial<Task>): Task {
  const taskType = overrides?.type || faker.helpers.arrayElement([
    'Research',
    'DocumentCreation',
    'DocumentRetrieval',
    'CourtDate',
    'Meeting',
    'BusinessTrip',
  ] as TaskType[]);

  const now = new Date();
  const dueDate = overrides?.dueDate || faker.date.between({
    from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    to: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  });

  const title = overrides?.title || faker.helpers.arrayElement(taskTitlesByType[taskType]);
  const description =
    overrides?.description || faker.helpers.arrayElement(taskDescriptionsByType[taskType]);

  const status = overrides?.status || faker.helpers.arrayElement([
    'Pending',
    'InProgress',
    'Completed',
    'Cancelled',
  ] as Task['status'][]);

  const priority = overrides?.priority || faker.helpers.weightedArrayElement([
    { value: 'Low' as const, weight: 2 },
    { value: 'Medium' as const, weight: 4 },
    { value: 'High' as const, weight: 3 },
    { value: 'Urgent' as const, weight: 1 },
  ]);

  // Generate type-specific metadata
  const metadata: Record<string, unknown> = {};

  switch (taskType) {
    case 'Research':
      metadata.researchTopic = title;
      metadata.legalArea = faker.helpers.arrayElement([
        'Drept Civil',
        'Drept Penal',
        'Drept Comercial',
        'Drept Muncă',
        'Drept Administrativ',
      ]);
      metadata.targetCompletionDate = dueDate.toISOString();
      break;
    case 'DocumentCreation':
      metadata.documentType = faker.helpers.arrayElement([
        'Contract',
        'Cerere',
        'Memoriu',
        'Act Adițional',
        'Scrisoare',
      ]);
      metadata.templateId = `template-${faker.number.int({ min: 1, max: 20 })}`;
      metadata.clientName = generateRomanianName();
      break;
    case 'DocumentRetrieval':
      metadata.documentName = title;
      metadata.sourceLocation = faker.helpers.arrayElement([
        'Arhiva Cabinet',
        'Primărie',
        'Judecătorie',
        'ANCPI',
        'Client',
      ]);
      metadata.urgency = priority;
      break;
    case 'CourtDate':
      metadata.courtName = faker.helpers.arrayElement([
        'Judecătoria Sector 1',
        'Judecătoria Sector 4',
        'Tribunal București',
        'Curte de Apel București',
        'Înalta Curte de Casație și Justiție',
      ]);
      metadata.hearingType = faker.helpers.arrayElement([
        'Fond',
        'Apel',
        'Recurs',
        'Judecată',
        'Pronunțare',
      ]);
      metadata.caseNumber = faker.helpers.arrayElement(caseReferences);
      metadata.location = `${metadata.courtName}, Sala ${faker.number.int({ min: 1, max: 15 })}`;
      break;
    case 'Meeting':
      metadata.meetingType = faker.helpers.arrayElement([
        'Consultare Client',
        'Negociere',
        'Mediere',
        'Discuție Internă',
      ]);
      metadata.location = faker.helpers.arrayElement([
        'Cabinet',
        'Sediu Client',
        'Online (Zoom)',
        'Cafenea Centru',
      ]);
      metadata.attendees = [generateRomanianName(), generateRomanianName()];
      metadata.agenda = description;
      break;
    case 'BusinessTrip':
      metadata.destination = faker.helpers.arrayElement([
        'Cluj-Napoca',
        'Timișoara',
        'Constanța',
        'Brașov',
        'Iași',
        'Craiova',
      ]);
      metadata.travelDates = {
        departure: dueDate.toISOString(),
        return: new Date(dueDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      };
      metadata.purpose = description;
      metadata.accommodation = faker.helpers.arrayElement([
        'Hotel Continental',
        'Hotel Marriott',
        'Apartament AirBnB',
        'Hotel Hilton',
      ]);
      break;
  }

  return {
    id: `task-${faker.string.uuid()}`,
    caseId: `case-${faker.string.uuid()}`,
    type: taskType,
    title,
    description,
    assignedTo: `user-${faker.string.uuid()}`,
    dueDate,
    status,
    priority,
    metadata,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}

/**
 * Create multiple mock tasks (20-30 by default)
 */
export function createMockTasks(count?: number): Task[] {
  const taskCount = count || faker.number.int({ min: 20, max: 30 });
  const tasks: Task[] = [];

  // Ensure even distribution across all 6 task types
  const taskTypes: TaskType[] = [
    'Research',
    'DocumentCreation',
    'DocumentRetrieval',
    'CourtDate',
    'Meeting',
    'BusinessTrip',
  ];

  for (let i = 0; i < taskCount; i++) {
    const taskType = taskTypes[i % taskTypes.length]; // Rotate through types
    tasks.push(createMockTask({ type: taskType }));
  }

  // Shuffle to randomize order
  return faker.helpers.shuffle(tasks);
}

/**
 * Create mock tasks filtered by type
 */
export function createMockTasksByType(type: TaskType, count: number = 10): Task[] {
  return Array.from({ length: count }, () => createMockTask({ type }));
}

/**
 * Create mock tasks filtered by status
 */
export function createMockTasksByStatus(
  status: 'Pending' | 'InProgress' | 'Completed' | 'Cancelled',
  count: number = 10
): Task[] {
  return Array.from({ length: count }, () => createMockTask({ status }));
}

/**
 * Create mock tasks for the current week (calendar view)
 * Generates tasks with due dates within the current week
 */
export function createMockWeekTasks(count: number = 15): Task[] {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
  endOfWeek.setHours(23, 59, 59, 999);

  const tasks: Task[] = [];

  // Ensure even distribution across all 6 task types
  const taskTypes: TaskType[] = [
    'Research',
    'DocumentCreation',
    'DocumentRetrieval',
    'CourtDate',
    'Meeting',
    'BusinessTrip',
  ];

  for (let i = 0; i < count; i++) {
    const taskType = taskTypes[i % taskTypes.length];
    const dueDate = faker.date.between({ from: startOfWeek, to: endOfWeek });

    // Set random time during business hours (9 AM - 6 PM)
    dueDate.setHours(faker.number.int({ min: 9, max: 18 }));
    dueDate.setMinutes(faker.helpers.arrayElement([0, 15, 30, 45]));

    tasks.push(
      createMockTask({
        type: taskType,
        dueDate,
        // Most week tasks should be pending or in progress
        status: faker.helpers.weightedArrayElement([
          { value: 'Pending' as const, weight: 4 },
          { value: 'InProgress' as const, weight: 5 },
          { value: 'Completed' as const, weight: 1 },
        ]),
      })
    );
  }

  // Sort by due date
  return tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * Create mock task with Romanian client name (for testing Romanian diacritics)
 */
export function createMockTaskWithDiacritics(): Task {
  return createMockTask({
    title: 'Redactare contract pentru client Ștefan Țăran',
    description:
      'Întocmire contract de închiriere pentru proprietatea situată în str. Mihail Kogălniceanu nr. 15, București.',
    metadata: {
      clientName: 'Ștefan Țăran',
      location: 'Str. Mihail Kogălniceanu nr. 15, București',
      documentType: 'Contract Închiriere',
    },
  });
}
