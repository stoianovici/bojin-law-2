/**
 * Task Factory
 * Creates test Task entities with support for all 6 task types
 */

import { faker } from '@faker-js/faker';
import type { Task, TaskType, TaskOverrides } from '@legal-platform/types';

/**
 * Generate task title based on type
 */
function generateTaskTitle(type: TaskType): string {
  const titles: Record<TaskType, string[]> = {
    Research: [
      'Legal Research on Contract Law',
      'Case Law Review',
      'Statutory Analysis',
      'Precedent Research',
      'Cercetare jurisprudență',
      'Analiză doctrină',
    ],
    DocumentCreation: [
      'Draft Employment Contract',
      'Prepare Motion to Dismiss',
      'Create Settlement Agreement',
      'Write Legal Brief',
      'Redactare contract',
      'Întocmire cerere',
    ],
    DocumentRetrieval: [
      'Retrieve Court Files',
      'Obtain Medical Records',
      'Request Police Report',
      'Collect Evidence Documents',
      'Obținere documente dosar',
      'Solicitare acte stare civilă',
    ],
    CourtDate: [
      'Initial Hearing',
      'Pre-Trial Conference',
      'Motion Hearing',
      'Trial Date',
      'Termen judecată',
      'Ședință de judecată',
    ],
    Meeting: [
      'Client Consultation',
      'Strategy Meeting',
      'Deposition Prep',
      'Case Review Meeting',
      'Consultație client',
      'Întâlnire echipă',
    ],
    BusinessTrip: [
      'Court Appearance in Bucharest',
      'Client Meeting in Cluj',
      'Site Visit Investigation',
      'Deposition in Timișoara',
      'Deplasare tribunal',
      'Vizită sediu client',
    ],
  };

  return faker.helpers.arrayElement(titles[type]);
}

/**
 * Generate task description based on type
 */
function generateTaskDescription(type: TaskType): string {
  const descriptions: Record<TaskType, string[]> = {
    Research: [
      'Conduct thorough research on applicable statutes and case law',
      'Review recent court decisions and legal precedents',
      'Analyze legal doctrine and scholarly articles',
    ],
    DocumentCreation: [
      'Draft comprehensive legal document with all required clauses',
      'Prepare document according to court requirements and deadlines',
      'Create detailed legal brief with supporting arguments',
    ],
    DocumentRetrieval: [
      'Request and obtain necessary documents from relevant authorities',
      'Collect all supporting evidence and documentation',
      'Retrieve records needed for case preparation',
    ],
    CourtDate: [
      'Attend court proceeding and represent client',
      'Prepare for hearing and present arguments',
      'Participate in judicial conference',
    ],
    Meeting: [
      'Meet with client to discuss case strategy and progress',
      'Coordinate with team members on case handling',
      'Conduct consultation and gather information',
    ],
    BusinessTrip: [
      'Travel to location for court appearance or client meeting',
      'Conduct on-site investigation and evidence gathering',
      'Visit client premises for consultation',
    ],
  };

  return faker.helpers.arrayElement(descriptions[type]);
}

/**
 * Generate task metadata based on type
 */
function generateTaskMetadata(type: TaskType): Record<string, unknown> {
  const baseMetadata: Record<TaskType, Record<string, unknown>> = {
    Research: {
      jurisdiction: faker.helpers.arrayElement(['Romania', 'EU', 'International']),
      legalArea: faker.helpers.arrayElement(['Civil', 'Criminal', 'Commercial', 'Administrative']),
      estimatedHours: faker.number.int({ min: 2, max: 16 }),
    },
    DocumentCreation: {
      documentType: faker.helpers.arrayElement(['Contract', 'Motion', 'Brief', 'Letter']),
      template: faker.datatype.boolean(),
      aiAssisted: faker.datatype.boolean({ probability: 0.4 }),
      estimatedHours: faker.number.int({ min: 1, max: 8 }),
    },
    DocumentRetrieval: {
      source: faker.helpers.arrayElement(['Court', 'Registry', 'Hospital', 'Police', 'Client']),
      urgent: faker.datatype.boolean({ probability: 0.3 }),
      estimatedDays: faker.number.int({ min: 1, max: 14 }),
    },
    CourtDate: {
      courtName: faker.helpers.arrayElement(['Tribunalul București', 'Curtea de Apel', 'Judecătorie']),
      courtroom: faker.string.numeric({ length: 3 }),
      hearingType: faker.helpers.arrayElement(['Initial', 'Preliminary', 'Trial', 'Final']),
      requiresPreparation: true,
    },
    Meeting: {
      location: faker.helpers.arrayElement(['Office', 'Client Site', 'Video Call', 'Court']),
      attendees: faker.number.int({ min: 2, max: 8 }),
      duration: faker.number.int({ min: 30, max: 180 }),
      requiresPreparation: faker.datatype.boolean(),
    },
    BusinessTrip: {
      destination: faker.helpers.arrayElement(['București', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța']),
      transportType: faker.helpers.arrayElement(['Car', 'Train', 'Flight']),
      overnight: faker.datatype.boolean(),
      estimatedCost: faker.number.int({ min: 200, max: 2000 }),
    },
  };

  return baseMetadata[type];
}

/**
 * Create a Task entity with realistic test data
 * @param overrides - Partial Task object to override default values
 * @returns Task entity
 */
export function createTask(overrides: TaskOverrides = {}): Task {
  const type = overrides.type || faker.helpers.arrayElement<TaskType>([
    'Research',
    'DocumentCreation',
    'DocumentRetrieval',
    'CourtDate',
    'Meeting',
    'BusinessTrip',
  ]);

  const status = overrides.status || faker.helpers.arrayElement(['Pending', 'InProgress', 'Completed', 'Cancelled']);
  const priority = overrides.priority || faker.helpers.arrayElement(['Low', 'Medium', 'High', 'Urgent']);

  return {
    id: faker.string.uuid(),
    caseId: faker.string.uuid(),
    type,
    title: generateTaskTitle(type),
    description: generateTaskDescription(type),
    assignedTo: faker.string.uuid(),
    dueDate: faker.date.future({ years: 0.25 }), // Within next 3 months
    status,
    priority,
    metadata: generateTaskMetadata(type),
    createdAt: faker.date.past({ years: 0.5 }),
    updatedAt: faker.date.recent({ days: 7 }),
    ...overrides,
  };
}

/**
 * Create a Research task
 * @param overrides - Partial Task object to override default values
 * @returns Task entity with Research type
 */
export function createResearchTask(overrides: TaskOverrides = {}): Task {
  return createTask({ type: 'Research', ...overrides });
}

/**
 * Create a DocumentCreation task
 * @param overrides - Partial Task object to override default values
 * @returns Task entity with DocumentCreation type
 */
export function createDocumentCreationTask(overrides: TaskOverrides = {}): Task {
  return createTask({ type: 'DocumentCreation', ...overrides });
}

/**
 * Create a DocumentRetrieval task
 * @param overrides - Partial Task object to override default values
 * @returns Task entity with DocumentRetrieval type
 */
export function createDocumentRetrievalTask(overrides: TaskOverrides = {}): Task {
  return createTask({ type: 'DocumentRetrieval', ...overrides });
}

/**
 * Create a CourtDate task
 * @param overrides - Partial Task object to override default values
 * @returns Task entity with CourtDate type
 */
export function createCourtDateTask(overrides: TaskOverrides = {}): Task {
  return createTask({ type: 'CourtDate', ...overrides });
}

/**
 * Create a Meeting task
 * @param overrides - Partial Task object to override default values
 * @returns Task entity with Meeting type
 */
export function createMeetingTask(overrides: TaskOverrides = {}): Task {
  return createTask({ type: 'Meeting', ...overrides });
}

/**
 * Create a BusinessTrip task
 * @param overrides - Partial Task object to override default values
 * @returns Task entity with BusinessTrip type
 */
export function createBusinessTripTask(overrides: TaskOverrides = {}): Task {
  return createTask({ type: 'BusinessTrip', ...overrides });
}

/**
 * Create multiple Task entities
 * @param count - Number of tasks to create
 * @param overrides - Partial Task object to override default values
 * @returns Array of Task entities
 */
export function createTasks(count: number, overrides: TaskOverrides = {}): Task[] {
  return Array.from({ length: count }, () => createTask(overrides));
}
