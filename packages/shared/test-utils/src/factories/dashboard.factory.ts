/**
 * Dashboard Factory
 * Creates test dashboard entities (KPIs, AI Suggestions) with Romanian localization support
 */

import { faker } from '@faker-js/faker';

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
