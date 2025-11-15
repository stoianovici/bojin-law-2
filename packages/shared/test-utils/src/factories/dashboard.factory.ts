/**
 * Dashboard Factory
 * Creates test dashboard entities (KPIs, AI Suggestions, Widgets) with Romanian localization support
 */

import { faker } from '@faker-js/faker';
import type {
  SupervisedCasesWidget,
  FirmCasesOverviewWidget,
  FirmTasksOverviewWidget,
  EmployeeWorkloadWidget,
  WidgetPosition,
} from '@legal-platform/types';

/**
 * KPI Metric type
 */
export interface KPIMetric {
  id: string;
  label: string;
  value: number | string;
  trend: 'up' | 'down' | 'neutral';
  trendPercentage: number;
  comparisonText: string;
  icon?: string;
}

/**
 * AI Suggestion type
 */
export interface AISuggestion {
  id: string;
  type: 'insight' | 'alert' | 'recommendation';
  role: 'Partner' | 'Associate' | 'Paralegal';
  text: string;
  timestamp: Date;
  actionable: boolean;
  actionText?: string;
  dismissed: boolean;
}

/**
 * KPI Metric overrides
 */
export type KPIMetricOverrides = Partial<KPIMetric>;

/**
 * AI Suggestion overrides
 */
export type AISuggestionOverrides = Partial<AISuggestion>;

/**
 * Generate KPI label based on context
 */
function generateKPILabel(useRomanian: boolean): string {
  const labels = useRomanian
    ? [
        'Cazuri Active',
        'Ore Facturabile',
        'Progres Țintă Venit',
        'Utilizare Echipă',
        'Documente Generate',
        'Sarcini Finalizate',
        'Termene Respectate',
      ]
    : [
        'Active Cases',
        'Billable Hours',
        'Revenue Target Progress',
        'Team Utilization',
        'Documents Generated',
        'Tasks Completed',
        'Deadlines Met',
      ];

  return faker.helpers.arrayElement(labels);
}

/**
 * Generate comparison text
 */
function generateComparisonText(useRomanian: boolean): string {
  return useRomanian ? 'vs. luna trecută' : 'vs. last month';
}

/**
 * Create a KPI metric with realistic test data
 * @param overrides - Partial KPIMetric object to override default values
 * @param useRomanian - Whether to use Romanian labels (default: 50% chance)
 * @returns KPIMetric entity
 */
export function createKPIMetric(overrides: KPIMetricOverrides = {}, useRomanian: boolean = faker.datatype.boolean()): KPIMetric {
  const trend = overrides.trend || faker.helpers.arrayElement<'up' | 'down' | 'neutral'>(['up', 'down', 'neutral']);
  const trendPercentage = overrides.trendPercentage ?? faker.number.int({ min: 1, max: 30 });

  return {
    id: faker.string.uuid(),
    label: generateKPILabel(useRomanian),
    value: faker.number.int({ min: 50, max: 500 }),
    trend,
    trendPercentage,
    comparisonText: generateComparisonText(useRomanian),
    icon: faker.helpers.arrayElement(['briefcase', 'clock', 'target', 'users', 'file', 'check', 'calendar']),
    ...overrides,
  };
}

/**
 * Create multiple KPI metrics
 * @param count - Number of KPI metrics to create
 * @param overrides - Partial KPIMetric object to override default values
 * @param useRomanian - Whether to use Romanian labels
 * @returns Array of KPIMetric entities
 */
export function createKPIMetrics(count: number, overrides: KPIMetricOverrides = {}, useRomanian: boolean = faker.datatype.boolean()): KPIMetric[] {
  return Array.from({ length: count }, () => createKPIMetric(overrides, useRomanian));
}

/**
 * Generate AI suggestion text based on role
 */
function generateAISuggestionText(role: 'Partner' | 'Associate' | 'Paralegal', type: 'insight' | 'alert' | 'recommendation'): string {
  const suggestions: Record<'Partner' | 'Associate' | 'Paralegal', Record<'insight' | 'alert' | 'recommendation', string[]>> = {
    Partner: {
      insight: [
        'Revizuiește cazul #2345 - termen urgent în 3 zile',
        'Echipa ta are 15% mai multe ore facturabile luna aceasta',
        'Team member Alex has 15% higher billable hours this month',
        'Case #5678 shows 25% increase in time spent vs. estimate',
        'Revenue target at 92% - on track to exceed goal',
      ],
      alert: [
        'Pending approval for 8 documents requires attention',
        '3 cases approaching budget limit',
        'Team utilization at 105% - consider workload rebalancing',
        'Cerințe de aprobare pentru 5 înregistrări de timp',
      ],
      recommendation: [
        'Consider delegating Case #9876 to reduce senior partner load',
        'Schedule quarterly review meeting with team',
        'Programează întâlnire trimestrială cu echipa',
      ],
    },
    Associate: {
      insight: [
        'Consideră folosirea șablonului Contract #12 pentru cazul #4567',
        '3 precedente relevante găsite pentru cercetarea ta',
        '3 related precedents found for your recent research query',
        'Case #2345 has similar issues to Case #6789 you worked on',
      ],
      alert: [
        'Deadline for Case #4567 motion filing in 2 days',
        'Client meeting scheduled for tomorrow - prepare case summary',
        'Termen depunere cerere pentru cazul #8901 în 2 zile',
      ],
      recommendation: [
        'Consider using Contract Template #12 for Case #4567',
        'Review recent court decision relevant to Case #3456',
        'Revizuiește decizia recentă relevantă pentru cazul #3456',
      ],
    },
    Paralegal: {
      insight: [
        'Cererea de document pentru cazul #8901 întârziată cu 2 zile',
        'Document request for Case #8901 is 2 days overdue',
        '5 tasks completed ahead of schedule this week',
        '5 sarcini finalizate înaintea termenului această săptămână',
      ],
      alert: [
        'Termen depunere instanță pentru cazul #6789 în 3 zile',
        'Court filing deadline for Case #6789 in 3 days',
        '3 document requests marked urgent require immediate attention',
        '3 cereri de documente marcate ca urgente necesită atenție imediată',
      ],
      recommendation: [
        'Prioritize document uploads for Case #4567',
        'Coordinate with attorney on Case #2345 document clarifications',
        'Coordonează cu avocatul pentru clarificări documente caz #2345',
      ],
    },
  };

  return faker.helpers.arrayElement(suggestions[role][type]);
}

/**
 * Generate action text based on type
 */
function generateActionText(type: 'insight' | 'alert' | 'recommendation', useRomanian: boolean): string | undefined {
  if (!faker.datatype.boolean({ probability: 0.7 })) {
    return undefined;
  }

  const actions: Record<'insight' | 'alert' | 'recommendation', string[]> = useRomanian
    ? {
        insight: ['Vezi detalii', 'Vizualizează raport', 'Analizează'],
        alert: ['Acționează acum', 'Revizuiește', 'Rezolvă'],
        recommendation: ['Aplică sugestia', 'Vezi opțiuni', 'Explorează'],
      }
    : {
        insight: ['View Details', 'View Report', 'Analyze'],
        alert: ['Take Action', 'Review', 'Resolve'],
        recommendation: ['Apply Suggestion', 'View Options', 'Explore'],
      };

  return faker.helpers.arrayElement(actions[type]);
}

/**
 * Create an AI suggestion with realistic test data
 * @param overrides - Partial AISuggestion object to override default values
 * @returns AISuggestion entity
 */
export function createAISuggestion(overrides: AISuggestionOverrides = {}): AISuggestion {
  const type = overrides.type || faker.helpers.arrayElement<'insight' | 'alert' | 'recommendation'>(['insight', 'alert', 'recommendation']);
  const role = overrides.role || faker.helpers.arrayElement<'Partner' | 'Associate' | 'Paralegal'>(['Partner', 'Associate', 'Paralegal']);
  const useRomanian = faker.datatype.boolean();
  const actionable = overrides.actionable ?? faker.datatype.boolean({ probability: 0.7 }); // 70% actionable

  return {
    id: faker.string.uuid(),
    type,
    role,
    text: generateAISuggestionText(role, type),
    timestamp: faker.date.recent({ days: 3 }),
    actionable,
    actionText: actionable ? generateActionText(type, useRomanian) : undefined,
    dismissed: false,
    ...overrides,
  };
}

/**
 * Create an AI insight suggestion
 * @param overrides - Partial AISuggestion object to override default values
 * @returns AISuggestion entity with insight type
 */
export function createAIInsight(overrides: AISuggestionOverrides = {}): AISuggestion {
  return createAISuggestion({ type: 'insight', ...overrides });
}

/**
 * Create an AI alert suggestion
 * @param overrides - Partial AISuggestion object to override default values
 * @returns AISuggestion entity with alert type
 */
export function createAIAlert(overrides: AISuggestionOverrides = {}): AISuggestion {
  return createAISuggestion({ type: 'alert', ...overrides });
}

/**
 * Create an AI recommendation suggestion
 * @param overrides - Partial AISuggestion object to override default values
 * @returns AISuggestion entity with recommendation type
 */
export function createAIRecommendation(overrides: AISuggestionOverrides = {}): AISuggestion {
  return createAISuggestion({ type: 'recommendation', ...overrides });
}

/**
 * Create role-specific AI suggestions
 * @param role - User role (Partner, Associate, Paralegal)
 * @param count - Number of suggestions to create (default: 3-5)
 * @param overrides - Partial AISuggestion object to override default values
 * @returns Array of role-specific AISuggestion entities
 */
export function createAISuggestionsForRole(
  role: 'Partner' | 'Associate' | 'Paralegal',
  count: number = faker.number.int({ min: 3, max: 5 }),
  overrides: AISuggestionOverrides = {}
): AISuggestion[] {
  return Array.from({ length: count }, () => createAISuggestion({ role, ...overrides }));
}

/**
 * Create multiple AI suggestions
 * @param count - Number of AI suggestions to create
 * @param overrides - Partial AISuggestion object to override default values
 * @returns Array of AISuggestion entities
 */
export function createAISuggestions(count: number, overrides: AISuggestionOverrides = {}): AISuggestion[] {
  return Array.from({ length: count }, () => createAISuggestion(overrides));
}

// =====================================
// Widget Factories for Story 1.6
// =====================================

/**
 * Romanian first names for realistic test data
 */
const ROMANIAN_FIRST_NAMES = [
  'Alexandru', 'Andrei', 'Adrian', 'Bogdan', 'Cătălin', 'Cristian', 'Dan', 'Emil',
  'Florin', 'Gabriel', 'Ion', 'Liviu', 'Marius', 'Mihai', 'Nicolae', 'Radu',
  'Ștefan', 'Vasile', 'Victor', 'Vlad',
  'Alexandra', 'Alina', 'Ana', 'Andreea', 'Cristina', 'Elena', 'Ioana', 'Larisa',
  'Maria', 'Mihaela', 'Monica', 'Ramona', 'Roxana', 'Simona', 'Valentina', 'Viorica'
];

/**
 * Romanian last names for realistic test data
 */
const ROMANIAN_LAST_NAMES = [
  'Popescu', 'Ionescu', 'Popa', 'Pop', 'Radu', 'Georgescu', 'Stan', 'Dumitrescu',
  'Munteanu', 'Constantin', 'Dima', 'Stoica', 'Nistor', 'Stanciu', 'Șerban', 'Țîrlea'
];

/**
 * Generate Romanian name with diacritics support
 */
function generateRomanianName(): string {
  const firstName = faker.helpers.arrayElement(ROMANIAN_FIRST_NAMES);
  const lastName = faker.helpers.arrayElement(ROMANIAN_LAST_NAMES);
  return `${firstName} ${lastName}`;
}

/**
 * Generate Romanian client name
 */
function generateRomanianClientName(): string {
  const types = [
    () => generateRomanianName(), // Individual
    () => `${faker.company.name()} SRL`,
    () => `${faker.company.name()} SA`,
    () => `SC ${faker.company.name()} SRL`,
  ];
  return faker.helpers.arrayElement(types)();
}

/**
 * Generate case title with Romanian support
 */
function generateCaseTitle(useRomanian: boolean): string {
  const romanianTitles = [
    'Contract Comercial - Furnizare Servicii',
    'Litigiu de Muncă - Concediere Abuzivă',
    'Consultanță Fiscală și Juridică',
    'Reorganizare Structurală Societate',
    'Achiziție Imobiliară Rezidențială',
    'Drept de Proprietate Intelectuală',
    'Litigiu Comercial cu Partener',
    'Revizuire Contract Închiriere',
  ];

  const englishTitles = [
    'Commercial Contract - Service Provision',
    'Employment Dispute - Wrongful Termination',
    'Tax and Legal Consultation',
    'Corporate Restructuring',
    'Residential Real Estate Acquisition',
    'Intellectual Property Rights',
    'Commercial Dispute with Partner',
    'Lease Contract Review',
  ];

  return faker.helpers.arrayElement(useRomanian ? romanianTitles : englishTitles);
}

/**
 * Generate employee utilization data
 * @param count - Number of employees to generate
 * @returns Array of employee utilization objects
 */
export function generateEmployeeUtilization(count: number) {
  return Array.from({ length: count }, () => {
    const dailyUtilization = faker.number.int({ min: 20, max: 180 });
    const weeklyUtilization = faker.number.int({ min: 30, max: 160 });
    const taskCount = faker.number.int({ min: 2, max: 15 });
    const estimatedHours = faker.number.int({ min: 4, max: 80 });

    // Determine status based on utilization
    let status: 'over' | 'optimal' | 'under';
    const utilization = dailyUtilization;
    if (utilization > 100) {
      status = 'over';
    } else if (utilization >= 50) {
      status = 'optimal';
    } else {
      status = 'under';
    }

    // Generate tasks for this employee
    const tasks = Array.from({ length: taskCount }, () => ({
      id: faker.string.uuid(),
      title: faker.helpers.arrayElement([
        'Revizuire Contract',
        'Cercetare Jurisprudență',
        'Redactare Memoriu',
        'Întâlnire Client',
        'Review Contract',
        'Legal Research',
        'Draft Memorandum',
        'Client Meeting',
      ]),
      estimate: faker.number.int({ min: 1, max: 8 }),
      type: faker.helpers.arrayElement(['Research', 'Document', 'Meeting', 'Court', 'Administrative']),
    }));

    return {
      employeeId: faker.string.uuid(),
      name: generateRomanianName(),
      dailyUtilization,
      weeklyUtilization,
      taskCount,
      estimatedHours,
      status,
      tasks,
    };
  });
}

/**
 * Generate at-risk cases
 * @param count - Number of at-risk cases to generate
 * @returns Array of at-risk case objects
 */
export function generateAtRiskCases(count: number) {
  return Array.from({ length: count }, () => {
    const daysUntilDeadline = faker.number.int({ min: 1, max: 7 });
    const useRomanian = faker.datatype.boolean();

    const reasons = useRomanian
      ? [
          `Termen în ${daysUntilDeadline} zile`,
          'Sarcini întârziate',
          'Fără activitate >14 zile',
          'Alertă AI - Necesită atenție',
        ]
      : [
          `Deadline in ${daysUntilDeadline} days`,
          'Overdue tasks',
          'No activity >14 days',
          'AI Alert - Requires attention',
        ];

    return {
      id: faker.string.uuid(),
      caseNumber: `C-${faker.number.int({ min: 1000, max: 9999 })}`,
      title: generateCaseTitle(useRomanian),
      reason: faker.helpers.arrayElement(reasons),
      assignedPartner: generateRomanianName(),
      daysUntilDeadline,
    };
  });
}

/**
 * Generate high-value cases
 * @param count - Number of high-value cases to generate
 * @returns Array of high-value case objects
 */
export function generateHighValueCases(count: number) {
  return Array.from({ length: count }, () => {
    const useRomanian = faker.datatype.boolean();
    const value = faker.number.int({ min: 25000, max: 500000 });

    return {
      id: faker.string.uuid(),
      caseNumber: `C-${faker.number.int({ min: 1000, max: 9999 })}`,
      title: generateCaseTitle(useRomanian),
      value,
      assignedPartner: generateRomanianName(),
      priority: faker.helpers.arrayElement<'strategic' | 'vip' | 'highValue'>(['strategic', 'vip', 'highValue']),
    };
  });
}

/**
 * Generate AI insights for firm cases
 * @param count - Number of AI insights to generate
 * @returns Array of AI insight objects
 */
export function generateAIInsights(count: number) {
  return Array.from({ length: count }, () => {
    const useRomanian = faker.datatype.boolean();
    const caseNumber = `C-${faker.number.int({ min: 1000, max: 9999 })}`;

    const messages: Record<'pattern' | 'bottleneck' | 'opportunity', string[]> = useRomanian
      ? {
          pattern: [
            `Caz ${caseNumber}: Tipar detectat - similitudine cu 3 cazuri anterioare rezolvate`,
            `Flux de lucru repetat identificat în ${caseNumber}`,
            `Model de activitate neobișnuit în ${caseNumber}`,
          ],
          bottleneck: [
            `Caz ${caseNumber}: Blocaj detectat - așteptare aprobare >7 zile`,
            `${caseNumber}: Întârziere documentație - impact asupra termenului`,
            `Resurse insuficiente alocate pentru ${caseNumber}`,
          ],
          opportunity: [
            `Caz ${caseNumber}: Oportunitate automatizare - 40% reducere timp`,
            `Șablon refolosibil identificat în ${caseNumber}`,
            `Potențial de standardizare proces pentru ${caseNumber}`,
          ],
        }
      : {
          pattern: [
            `Case ${caseNumber}: Pattern detected - similarity with 3 prior resolved cases`,
            `Repeated workflow identified in ${caseNumber}`,
            `Unusual activity pattern in ${caseNumber}`,
          ],
          bottleneck: [
            `Case ${caseNumber}: Bottleneck detected - awaiting approval >7 days`,
            `${caseNumber}: Document delay - deadline impact`,
            `Insufficient resources allocated to ${caseNumber}`,
          ],
          opportunity: [
            `Case ${caseNumber}: Automation opportunity - 40% time reduction`,
            `Reusable template identified in ${caseNumber}`,
            `Process standardization potential for ${caseNumber}`,
          ],
        };

    const type = faker.helpers.arrayElement<'pattern' | 'bottleneck' | 'opportunity'>(['pattern', 'bottleneck', 'opportunity']);

    return {
      id: faker.string.uuid(),
      caseId: faker.string.uuid(),
      caseNumber,
      message: faker.helpers.arrayElement(messages[type]),
      type,
      timestamp: faker.date.recent({ days: 7 }).toISOString(),
    };
  });
}

/**
 * Create a default widget position
 */
function createWidgetPosition(id: string, x: number, y: number, w: number, h: number): WidgetPosition {
  return {
    i: id,
    x,
    y,
    w,
    h,
  };
}

/**
 * Create a Supervised Cases Widget with realistic test data
 * @param overrides - Partial widget object to override default values
 * @returns SupervisedCasesWidget entity
 */
export function createSupervisedCasesWidget(
  overrides: Partial<SupervisedCasesWidget> = {}
): SupervisedCasesWidget {
  const supervisorId = faker.string.uuid();
  const caseCount = faker.number.int({ min: 3, max: 20 });
  const useRomanian = faker.datatype.boolean();

  const cases = Array.from({ length: caseCount }, () => ({
    id: faker.string.uuid(),
    caseNumber: `C-${faker.number.int({ min: 1000, max: 9999 })}`,
    title: generateCaseTitle(useRomanian),
    clientName: generateRomanianClientName(),
    status: faker.helpers.arrayElement<'Active' | 'OnHold' | 'Closed' | 'Archived'>(['Active', 'OnHold', 'Closed', 'Archived']),
    supervisorId,
    teamSize: faker.number.int({ min: 2, max: 8 }),
    riskLevel: faker.helpers.arrayElement<'high' | 'medium' | 'low'>(['high', 'medium', 'low']),
    nextDeadline: faker.datatype.boolean() ? faker.date.future({ years: 0.5 }) : undefined,
  }));

  return {
    id: 'supervised-cases',
    type: 'supervisedCases',
    title: useRomanian ? 'Cazuri Supravegheate' : 'Supervised Cases',
    position: createWidgetPosition('supervised-cases', 0, 0, 6, 5),
    collapsed: false,
    cases,
    ...overrides,
  };
}

/**
 * Create a Firm Cases Overview Widget with realistic test data
 * @param overrides - Partial widget object to override default values
 * @returns FirmCasesOverviewWidget entity
 */
export function createFirmCasesOverviewWidget(
  overrides: Partial<FirmCasesOverviewWidget> = {}
): FirmCasesOverviewWidget {
  const useRomanian = faker.datatype.boolean();

  return {
    id: 'firm-cases-overview',
    type: 'firmCasesOverview',
    title: useRomanian ? 'Vedere de Ansamblu Cazuri Firmă' : 'Firm Cases Overview',
    position: createWidgetPosition('firm-cases-overview', 0, 5, 8, 5),
    collapsed: false,
    atRiskCases: generateAtRiskCases(faker.number.int({ min: 2, max: 8 })),
    highValueCases: generateHighValueCases(faker.number.int({ min: 1, max: 5 })),
    aiInsights: generateAIInsights(faker.number.int({ min: 2, max: 6 })),
    ...overrides,
  };
}

/**
 * Create a Firm Tasks Overview Widget with realistic test data
 * @param overrides - Partial widget object to override default values
 * @returns FirmTasksOverviewWidget entity
 */
export function createFirmTasksOverviewWidget(
  overrides: Partial<FirmTasksOverviewWidget> = {}
): FirmTasksOverviewWidget {
  const useRomanian = faker.datatype.boolean();
  const totalActiveTasks = faker.number.int({ min: 50, max: 300 });
  const overdueCount = faker.number.int({ min: 0, max: Math.floor(totalActiveTasks * 0.15) });
  const dueTodayCount = faker.number.int({ min: 0, max: Math.floor(totalActiveTasks * 0.1) });
  const dueThisWeekCount = faker.number.int({ min: 0, max: Math.floor(totalActiveTasks * 0.25) });
  const completionRate = faker.number.int({ min: 60, max: 95 });

  const taskTypes = useRomanian
    ? ['Cercetare', 'Redactare Document', 'Întâlnire', 'Instanță', 'Administrativ', 'Revizuire']
    : ['Research', 'Document Creation', 'Meeting', 'Court', 'Administrative', 'Review'];

  const taskBreakdown = taskTypes.map(type => ({
    type,
    count: faker.number.int({ min: 5, max: 50 }),
  }));

  const priorityTasks = Array.from({ length: 5 }, () => ({
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      useRomanian ? 'Depunere Memoriu Instanță' : 'Court Memorandum Filing',
      useRomanian ? 'Întâlnire Urgentă Client' : 'Urgent Client Meeting',
      useRomanian ? 'Revizuire Contract Important' : 'Critical Contract Review',
      useRomanian ? 'Cercetare Jurisprudență' : 'Legal Research',
      useRomanian ? 'Pregătire Audiere' : 'Hearing Preparation',
    ]),
    caseContext: `C-${faker.number.int({ min: 1000, max: 9999 })}`,
    priority: faker.helpers.arrayElement<'High' | 'Urgent'>(['High', 'Urgent']),
    assignee: generateRomanianName(),
    dueDate: faker.date.soon({ days: 7 }),
  }));

  return {
    id: 'firm-tasks-overview',
    type: 'firmTasksOverview',
    title: useRomanian ? 'Vedere de Ansamblu Sarcini Firmă' : 'Firm Tasks Overview',
    position: createWidgetPosition('firm-tasks-overview', 8, 5, 4, 5),
    collapsed: false,
    taskMetrics: {
      totalActiveTasks,
      overdueCount,
      dueTodayCount,
      dueThisWeekCount,
      completionRate,
      avgCompletionRateTrend: faker.helpers.arrayElement<'up' | 'down' | 'neutral'>(['up', 'down', 'neutral']),
    },
    taskBreakdown,
    priorityTasks,
    ...overrides,
  };
}

/**
 * Create an Employee Workload Widget with realistic test data
 * @param overrides - Partial widget object to override default values
 * @returns EmployeeWorkloadWidget entity
 */
export function createEmployeeWorkloadWidget(
  overrides: Partial<EmployeeWorkloadWidget> = {}
): EmployeeWorkloadWidget {
  const useRomanian = faker.datatype.boolean();
  const employeeCount = faker.number.int({ min: 5, max: 30 });

  return {
    id: 'employee-workload',
    type: 'employeeWorkload',
    title: useRomanian ? 'Sarcina de Lucru Angajați' : 'Employee Workload',
    position: createWidgetPosition('employee-workload', 0, 10, 12, 6),
    collapsed: false,
    viewMode: 'daily',
    employeeUtilization: generateEmployeeUtilization(employeeCount),
    ...overrides,
  };
}
