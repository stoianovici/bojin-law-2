/**
 * Firm Operations Agent Tool Schemas
 *
 * Defines the 7 read-only tools for the Firm Operations agent.
 * These tools allow the agent to explore firm-wide data and build
 * a holistic understanding for the morning briefing.
 */

import { AIToolDefinition } from './ai-client.service';

// ============================================================================
// Tool 1: Read Active Cases Summary
// ============================================================================

export const READ_ACTIVE_CASES_SUMMARY_TOOL: AIToolDefinition = {
  name: 'read_active_cases_summary',
  description: `Citește un rezumat al tuturor dosarelor active din firmă.
Returnează: număr total, grupate pe status, top 10 după urgență, dosare cu alertă de risc.
Folosește pentru a înțelege volumul de lucru actual al firmei și prioritățile.`,
  input_schema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Numărul maxim de dosare urgente de returnat (default: 10, max: 50)',
      },
      includeRiskAlerts: {
        type: 'boolean',
        description: 'Include dosarele cu alerte de risc (health score < 0.5) (default: true)',
      },
    },
    required: [],
  },
};

// ============================================================================
// Tool 2: Read Deadlines Overview
// ============================================================================

export const READ_DEADLINES_OVERVIEW_TOOL: AIToolDefinition = {
  name: 'read_deadlines_overview',
  description: `Citește termenele viitoare din toate dosarele.
Grupează pe: azi, săptămâna aceasta, următoarele 2 săptămâni.
Identifică conflicte (termene multiple în aceeași zi).
Folosește pentru a înțelege ce trebuie făcut urgent.`,
  input_schema: {
    type: 'object',
    properties: {
      daysAhead: {
        type: 'number',
        description: 'Numărul de zile în viitor pentru care să returneze termene (default: 14)',
      },
      includeConflicts: {
        type: 'boolean',
        description:
          'Include analiza conflictelor de termene (multiple termene/zi) (default: true)',
      },
      groupByType: {
        type: 'boolean',
        description: 'Grupează termenele pe tip (judecată, depunere, task) (default: false)',
      },
    },
    required: [],
  },
};

// ============================================================================
// Tool 3: Read Team Workload
// ============================================================================

export const READ_TEAM_WORKLOAD_TOOL: AIToolDefinition = {
  name: 'read_team_workload',
  description: `Citește încărcarea echipei din firmă.
Returnează: sarcini per membru, întârzieri, încărcare viitoare, indicatori de disponibilitate.
Folosește pentru a înțelege capacitatea echipei și a identifica suprasarcini.`,
  input_schema: {
    type: 'object',
    properties: {
      includeOverdue: {
        type: 'boolean',
        description: 'Include sarcinile întârziate per utilizator (default: true)',
      },
      includeUpcoming: {
        type: 'boolean',
        description: 'Include sarcinile din următoarele 7 zile per utilizator (default: true)',
      },
    },
    required: [],
  },
};

// ============================================================================
// Tool 4: Read Client Portfolio
// ============================================================================

export const READ_CLIENT_PORTFOLIO_TOOL: AIToolDefinition = {
  name: 'read_client_portfolio',
  description: `Citește portofoliul de clienți al firmei.
Returnează: clienți activi cu număr dosare, activitate recentă, ultima comunicare.
Identifică clienții care necesită atenție (fără activitate 30+ zile).
Folosește pentru a înțelege relațiile cu clienții.`,
  input_schema: {
    type: 'object',
    properties: {
      activeOnly: {
        type: 'boolean',
        description: 'Returnează doar clienții cu dosare active (default: true)',
      },
      inactiveDaysThreshold: {
        type: 'number',
        description: 'Pragul de zile pentru a marca un client ca necesitând atenție (default: 30)',
      },
      limit: {
        type: 'number',
        description: 'Numărul maxim de clienți de returnat (default: 20)',
      },
    },
    required: [],
  },
};

// ============================================================================
// Tool 5: Read Email Status
// ============================================================================

export const READ_EMAIL_STATUS_TOOL: AIToolDefinition = {
  name: 'read_email_status',
  description: `Citește starea comunicărilor email ale firmei.
Returnează: necitite, așteaptă răspuns (48h+), thread-uri cu acțiuni necesare.
Folosește pentru a înțelege starea comunicărilor și ce necesită atenție.`,
  input_schema: {
    type: 'object',
    properties: {
      pendingResponseHours: {
        type: 'number',
        description: 'Pragul de ore pentru a marca un email ca așteaptă răspuns (default: 48)',
      },
      includeByCase: {
        type: 'boolean',
        description: 'Grupează emailurile pe dosar (default: false)',
      },
    },
    required: [],
  },
};

// ============================================================================
// Tool 6: Read Platform Metrics
// ============================================================================

export const READ_PLATFORM_METRICS_TOOL: AIToolDefinition = {
  name: 'read_platform_metrics',
  description: `Citește indicatorii cheie de performanță din platformă.
Returnează: scor sănătate platformă, rata de completare sarcini, rata adopție AI.
Include tendințe săptămânale.
Folosește pentru a înțelege performanța generală a firmei.`,
  input_schema: {
    type: 'object',
    properties: {
      includeTrends: {
        type: 'boolean',
        description: 'Include tendințe comparativ cu săptămâna anterioară (default: true)',
      },
      includeAIMetrics: {
        type: 'boolean',
        description: 'Include metrici de adopție AI (default: true)',
      },
    },
    required: [],
  },
};

// ============================================================================
// Tool 7: Read Recent Case Events
// ============================================================================

export const READ_RECENT_CASE_EVENTS_TOOL: AIToolDefinition = {
  name: 'read_recent_case_events',
  description: `Citește evenimentele recente din toate dosarele active.
Returnează: emailuri primite, documente încărcate, sarcini create/finalizate, termene apropiate.
Folosește pentru a înțelege ce s-a întâmplat recent și ce necesită atenția partenerului.`,
  input_schema: {
    type: 'object',
    properties: {
      hoursBack: {
        type: 'number',
        description: 'Numărul de ore în urmă pentru care să returneze evenimente (default: 24)',
      },
      eventTypes: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Tipuri de evenimente de inclus: CommunicationReceived, DocumentUploaded, TaskCreated, TaskCompleted, DeadlineApproaching (default: toate)',
      },
      limit: {
        type: 'number',
        description: 'Numărul maxim de evenimente de returnat (default: 50, max: 100)',
      },
    },
    required: [],
  },
};

// ============================================================================
// Tool 8: Submit Briefing (Output Tool)
// ============================================================================

export const SUBMIT_BRIEFING_TOOL: AIToolDefinition = {
  name: 'submit_briefing',
  description: `Trimite briefingul final. OBLIGATORIU: Apelează acest instrument la final cu structura completă V2.
După ce ai explorat datele cu celelalte instrumente, folosește acest instrument pentru a returna briefingul structurat.
NU returna JSON în text - folosește EXCLUSIV acest instrument.`,
  input_schema: {
    type: 'object',
    properties: {
      edition: {
        type: 'object',
        description: 'Metadata despre această ediție a briefingului',
        properties: {
          date: { type: 'string', description: 'Data în format ISO (YYYY-MM-DD)' },
          mood: {
            type: 'string',
            enum: ['urgent', 'focused', 'celebratory', 'steady', 'cautious'],
            description: 'Starea generală a ediției',
          },
          editorNote: { type: 'string', description: 'Notă internă opțională' },
        },
        required: ['date', 'mood'],
      },
      lead: {
        type: 'array',
        description: 'Poveștile principale (1-2 elemente). Prima pagină.',
        minItems: 1,
        maxItems: 2,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID unic pentru element' },
            headline: { type: 'string', description: 'Titlu captivant, max 60 caractere' },
            summary: { type: 'string', description: 'Descriere clară, max 150 caractere' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  subtitle: { type: 'string' },
                  dueDate: { type: 'string' },
                  dueDateLabel: { type: 'string' },
                  status: { type: 'string', enum: ['on_track', 'at_risk', 'overdue'] },
                  href: { type: 'string' },
                },
                required: ['id', 'title', 'subtitle'],
              },
            },
            category: {
              type: 'string',
              enum: ['client', 'team', 'deadline', 'email', 'case'],
            },
            urgency: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
            href: { type: 'string', description: 'Link principal pentru navigare' },
            entityType: {
              type: 'string',
              enum: [
                'case',
                'client',
                'user',
                'email_thread',
                'task',
                'document',
                'event',
                'deadline',
              ],
              description: 'Tipul entității principale',
            },
            entityId: { type: 'string', description: 'UUID-ul EXACT din datele instrumentelor' },
            parentType: {
              type: 'string',
              enum: ['case', 'client'],
              description: 'Tipul entității părinte (pentru task/document/event)',
            },
            parentId: {
              type: 'string',
              description: 'UUID-ul entității părinte (ex: caseId pentru task-uri)',
            },
            dueDate: {
              type: 'string',
              description: 'Data scadentă în format ISO (YYYY-MM-DD) pentru task/deadline',
            },
            canAskFollowUp: { type: 'boolean' },
          },
          required: ['id', 'headline', 'summary', 'details', 'category'],
        },
      },
      secondary: {
        type: 'object',
        description: 'Secțiunea secundară cu titlu dinamic',
        properties: {
          title: { type: 'string', description: 'Titlu dinamic al secțiunii' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                headline: { type: 'string' },
                summary: { type: 'string' },
                details: { type: 'array', items: { type: 'object' } },
                category: { type: 'string', enum: ['client', 'team', 'deadline', 'email', 'case'] },
                urgency: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
                href: { type: 'string' },
                entityType: {
                  type: 'string',
                  enum: [
                    'case',
                    'client',
                    'user',
                    'email_thread',
                    'task',
                    'document',
                    'event',
                    'deadline',
                  ],
                },
                entityId: { type: 'string' },
                parentType: { type: 'string', enum: ['case', 'client'] },
                parentId: { type: 'string' },
                dueDate: { type: 'string' },
                canAskFollowUp: { type: 'boolean' },
              },
              required: ['id', 'headline', 'summary', 'details', 'category'],
            },
          },
        },
        required: ['title', 'items'],
      },
      tertiary: {
        type: 'object',
        description: 'Secțiunea terțiară (Pe Scurt) cu titlu dinamic',
        properties: {
          title: { type: 'string', description: 'Titlu dinamic al secțiunii' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                headline: { type: 'string' },
                summary: { type: 'string' },
                details: { type: 'array', items: { type: 'object' } },
                category: { type: 'string', enum: ['client', 'team', 'deadline', 'email', 'case'] },
                urgency: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
                href: { type: 'string' },
                entityType: {
                  type: 'string',
                  enum: [
                    'case',
                    'client',
                    'user',
                    'email_thread',
                    'task',
                    'document',
                    'event',
                    'deadline',
                  ],
                },
                entityId: { type: 'string' },
                parentType: { type: 'string', enum: ['case', 'client'] },
                parentId: { type: 'string' },
                dueDate: { type: 'string' },
                canAskFollowUp: { type: 'boolean' },
              },
              required: ['id', 'headline', 'summary', 'details', 'category'],
            },
          },
        },
        required: ['title', 'items'],
      },
      quickStats: {
        type: 'object',
        description: 'Statistici rapide calculate din datele instrumentelor',
        properties: {
          activeCases: { type: 'number', description: 'Număr dosare active' },
          urgentTasks: { type: 'number', description: 'Număr sarcini urgente' },
          teamUtilization: { type: 'number', description: 'Procent utilizare echipă (0-100)' },
          unreadEmails: { type: 'number', description: 'Număr emailuri necitite' },
          overdueItems: { type: 'number', description: 'Număr elemente întârziate' },
          upcomingDeadlines: { type: 'number', description: 'Număr termene următoarele 7 zile' },
        },
        required: [
          'activeCases',
          'urgentTasks',
          'teamUtilization',
          'unreadEmails',
          'overdueItems',
          'upcomingDeadlines',
        ],
      },
    },
    required: ['edition', 'lead', 'secondary', 'tertiary', 'quickStats'],
  },
};

// ============================================================================
// All Tools Export
// ============================================================================

export const FIRM_OPERATIONS_TOOLS: AIToolDefinition[] = [
  READ_ACTIVE_CASES_SUMMARY_TOOL,
  READ_DEADLINES_OVERVIEW_TOOL,
  READ_TEAM_WORKLOAD_TOOL,
  READ_CLIENT_PORTFOLIO_TOOL,
  READ_EMAIL_STATUS_TOOL,
  READ_PLATFORM_METRICS_TOOL,
  READ_RECENT_CASE_EVENTS_TOOL,
  SUBMIT_BRIEFING_TOOL,
];
