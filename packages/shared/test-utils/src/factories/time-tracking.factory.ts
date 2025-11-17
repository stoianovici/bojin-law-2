/**
 * Time Tracking Mock Data Factory
 * Generates realistic Romanian time tracking data for prototyping
 */

import type {
  TimeEntry,
  TaskType,
  ActiveTimer,
  TimeSummary,
  NaturalLanguageParseResult,
} from '@legal-platform/types';

// Romanian task descriptions by task type
const taskDescriptions: Record<TaskType, string[]> = {
  Research: [
    'Cercetare jurisprudență pentru apărare',
    'Analiză legislație contracte comerciale',
    'Studiu precedente instanțe superioare',
    'Cercetare doctrină drept civil',
    'Analiză hotărâri CJUE relevante',
  ],
  Drafting: [
    'Redactare contract prestări servicii',
    'Întocmire cerere de chemare în judecată',
    'Redactare răspuns la întâmpinare',
    'Elaborare clauze contractuale',
    'Redactare notă de opinie juridică',
  ],
  ClientMeeting: [
    'Întâlnire client pentru strategia dosarului',
    'Consultație juridică inițială',
    'Prezentare opțiuni soluționare litigiu',
    'Discuție termeni contract',
    'Întâlnire finalizare documentație',
  ],
  CourtAppearance: [
    'Prezentare în instanță - termen fond',
    'Participare ședință judecată',
    'Susținere cerere măsuri asigurătorii',
    'Termen administrare probe',
    'Prezentare concluzii finale',
  ],
  Email: [
    'Corespondență cu client',
    'Răspuns solicitări instanță',
    'Comunicare cu partea adversă',
    'Email către experți',
    'Corespondență internă echipă',
  ],
  PhoneCall: [
    'Apel telefonic client urgență',
    'Discuție cu avocat parte adversă',
    'Consultare expert materie',
    'Clarificări cu instanța',
    'Coordonare cu colegul de dosar',
  ],
  Administrative: [
    'Organizare dosare și documente',
    'Arhivare corespondență',
    'Actualizare bază de date clienți',
    'Completare timesheet-uri',
    'Pregătire facturare client',
  ],
  Other: [
    'Participare curs formare profesională',
    'Revizuire politici interne',
    'Întâlnire echipă',
    'Activitate pro bono',
    'Mentenanță sistem',
  ],
};

// Sample case names (Romanian)
const caseNames = [
  'Dosar Popescu vs. SRL Construct',
  'Contract Ionescu - Furnizare Servicii',
  'Litigiu Georgescu - Proprietate',
  'Advisory Dumitrescu SRL',
  'Contencios Marin vs. Primărie',
  'Due Diligence Acquisition Tech Solutions',
  'Divorț Popa - Partaj',
  'Penal Stanciu - Fraudă',
  'Contract Radu - Vânzare-Cumpărare',
  'Litigiu Mureșan - Muncă',
];

// Sample user names (Romanian)
const userNames = [
  'Mihai Bojin',
  'Ana Popescu',
  'Ionuț Georgescu',
  'Elena Dumitrescu',
  'Alexandru Marin',
  'Maria Ionescu',
  'Andrei Radu',
  'Cristina Mureșan',
];

/**
 * Generates a single mock time entry
 */
export function createMockTimeEntry(overrides?: Partial<TimeEntry>): TimeEntry {
  const taskType: TimeTaskType =
    overrides?.taskType ||
    (['Research', 'Drafting', 'ClientMeeting', 'Email'] as TimeTaskType[])[
      Math.floor(Math.random() * 4)
    ];

  const descriptions = taskDescriptions[taskType];
  const description =
    overrides?.description ||
    descriptions[Math.floor(Math.random() * descriptions.length)];

  const isBillable = overrides?.isBillable ?? Math.random() < 0.7; // 70% billable

  // Random date within last 30 days
  const daysAgo = Math.floor(Math.random() * 30);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(9 + Math.floor(Math.random() * 8), 0, 0, 0); // 9 AM - 5 PM

  const now = new Date();

  return {
    id: `time-${Math.random().toString(36).substring(2, 11)}`,
    userId: 'user-001',
    userName: userNames[0], // Current user
    caseId: `case-${Math.floor(Math.random() * 10) + 1}`,
    caseName: caseNames[Math.floor(Math.random() * caseNames.length)],
    taskType,
    date: overrides?.date || date,
    duration: overrides?.duration ?? 30 + Math.floor(Math.random() * 210), // 30-240 minutes
    description,
    isBillable,
    createdAt: overrides?.createdAt || now,
    updatedAt: overrides?.updatedAt || now,
    ...overrides,
  };
}

/**
 * Generates multiple mock time entries
 */
export function createMockTimeEntries(count: number = 50): TimeEntry[] {
  const entries: TimeEntry[] = [];

  for (let i = 0; i < count; i++) {
    // Distribute across different users for Partner view filtering
    const userIndex = Math.floor(Math.random() * userNames.length);

    entries.push(
      createMockTimeEntry({
        userId: `user-${String(userIndex + 1).padStart(3, '0')}`,
        userName: userNames[userIndex],
      })
    );
  }

  // Sort by date descending (most recent first)
  return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Generates mock active timer state
 */
export function createMockActiveTimer(
  state: 'stopped' | 'running' | 'paused' = 'stopped'
): ActiveTimer {
  if (state === 'stopped') {
    return {
      isRunning: false,
      isPaused: false,
      startTime: null,
      pausedTime: 0,
      caseId: null,
      caseName: null,
      taskType: null,
    };
  }

  const caseId = `case-${Math.floor(Math.random() * 10) + 1}`;
  const caseName = caseNames[Math.floor(Math.random() * caseNames.length)];
  const taskType: TimeTaskType = 'Research';

  if (state === 'running') {
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() - Math.floor(Math.random() * 30)); // Started 0-30 mins ago

    return {
      isRunning: true,
      isPaused: false,
      startTime,
      pausedTime: 0,
      caseId,
      caseName,
      taskType,
    };
  }

  // Paused state
  const startTime = new Date();
  startTime.setMinutes(startTime.getMinutes() - 45); // Started 45 mins ago

  return {
    isRunning: false,
    isPaused: true,
    startTime,
    pausedTime: 25, // 25 minutes accumulated
    caseId,
    caseName,
    taskType,
  };
}

/**
 * Generates mock time summary metrics
 */
export function createMockTimeSummary(
  entries: TimeEntry[] = []
): TimeSummary {
  if (entries.length === 0) {
    entries = createMockTimeEntries(20);
  }

  const totalMinutes = entries.reduce((sum, entry) => sum + entry.duration, 0);
  const billableMinutes = entries
    .filter((e) => e.isBillable)
    .reduce((sum, entry) => sum + entry.duration, 0);
  const nonBillableMinutes = totalMinutes - billableMinutes;
  const billableRate =
    totalMinutes > 0 ? (billableMinutes / totalMinutes) * 100 : 0;

  // Mock comparison to previous period
  const previousTotal = Math.floor(totalMinutes * (0.9 + Math.random() * 0.2)); // ±10%
  const totalDiff = totalMinutes - previousTotal;
  const percentChange =
    previousTotal > 0 ? (totalDiff / previousTotal) * 100 : 0;

  return {
    totalMinutes,
    billableMinutes,
    nonBillableMinutes,
    billableRate,
    comparisonToPrevious: {
      totalDiff,
      percentChange,
    },
  };
}

/**
 * Parses natural language Romanian input (mock/prototype implementation)
 */
export function mockParseNaturalLanguage(
  input: string
): NaturalLanguageParseResult {
  const errors: string[] = [];
  const parsedEntry: Partial<TimeEntry> = {};

  let matchedFields = 0;

  // Parse duration - Romanian units
  const durationPatternRo =
    /(\d+(?:\.\d+)?)\s*(ore|oră|hour|hours|min|minute|minutes|minut)/gi;
  const durationMatches = [...input.matchAll(durationPatternRo)];

  if (durationMatches.length > 0) {
    let totalMinutes = 0;
    durationMatches.forEach((match) => {
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase();

      if (unit.startsWith('ore') || unit.startsWith('oră') || unit.includes('hour')) {
        totalMinutes += value * 60;
      } else {
        totalMinutes += value;
      }
    });

    parsedEntry.duration = Math.round(totalMinutes);
    matchedFields++;
  } else {
    errors.push('Durata nu a fost detectată');
  }

  // Parse task type - Romanian keywords
  const taskKeywords: Record<string, TaskType> = {
    cercetare: 'Research',
    research: 'Research',
    redactare: 'Drafting',
    draft: 'Drafting',
    întâlnire: 'ClientMeeting',
    meeting: 'ClientMeeting',
    client: 'ClientMeeting',
    instanță: 'CourtAppearance',
    court: 'CourtAppearance',
    judecată: 'CourtAppearance',
    email: 'Email',
    apel: 'PhoneCall',
    telefon: 'PhoneCall',
    phone: 'PhoneCall',
    administrativ: 'Administrative',
  };

  const inputLower = input.toLowerCase();
  for (const [keyword, taskType] of Object.entries(taskKeywords)) {
    if (inputLower.includes(keyword)) {
      parsedEntry.taskType = taskType;
      matchedFields++;
      break;
    }
  }

  if (!parsedEntry.taskType) {
    errors.push('Tipul activității nu a fost detectat');
  }

  // Parse case reference
  const casePatterns = [
    /pentru\s+dosarul\s+(\w+)/i,
    /dosar\s+(\w+)/i,
    /client\s+(\w+)/i,
    /pentru\s+(\w+)\s+case/i,
  ];

  for (const pattern of casePatterns) {
    const match = input.match(pattern);
    if (match) {
      const caseName = `Dosar ${match[1]}`;
      parsedEntry.caseName = caseName;
      parsedEntry.caseId = `case-${Math.floor(Math.random() * 10) + 1}`;
      matchedFields++;
      break;
    }
  }

  if (!parsedEntry.caseName) {
    errors.push('Dosarul nu a fost detectat');
  }

  // Set description as original input
  parsedEntry.description = input;

  // Determine confidence level
  let confidence: 'Low' | 'Medium' | 'High';
  if (matchedFields >= 3) {
    confidence = 'High';
  } else if (matchedFields >= 2) {
    confidence = 'Medium';
  } else {
    confidence = 'Low';
  }

  return {
    success: matchedFields >= 2, // At least duration + task type or case
    confidence,
    parsedEntry,
    originalInput: input,
    errors,
  };
}
