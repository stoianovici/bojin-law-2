/**
 * Flipboard Agent Tool Schemas
 *
 * Defines the tools for the Flipboard agent:
 * - read_my_pending_actions: Unaddressed issues from user's cases
 * - read_my_case_alerts: Warnings and approaching deadlines
 * - read_my_case_news: Recent changes in user's cases
 * - submit_flipboard: Output tool for final items
 */

import { AIToolDefinition } from './ai-client.service';

// ============================================================================
// Tool 1: Read My Pending Actions
// ============================================================================

export const READ_MY_PENDING_ACTIONS_TOOL: AIToolDefinition = {
  name: 'read_my_pending_actions',
  description: `Citește acțiunile în așteptare din dosarele utilizatorului.
Returnează: emailuri care așteaptă răspuns, documente de revizuit, sarcini întârziate, solicitări neadresate.
Acestea sunt probleme nerezolvate care necesită atenție imediată.`,
  input_schema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Numărul maxim de acțiuni de returnat (default: 20)',
      },
      includeOverdue: {
        type: 'boolean',
        description: 'Include sarcinile întârziate (default: true)',
      },
      pendingResponseHours: {
        type: 'number',
        description: 'Pragul de ore pentru emailuri în așteptare (default: 48)',
      },
    },
    required: [],
  },
};

// ============================================================================
// Tool 2: Read My Case Alerts
// ============================================================================

export const READ_MY_CASE_ALERTS_TOOL: AIToolDefinition = {
  name: 'read_my_case_alerts',
  description: `Citește alertele și avertismentele din dosarele utilizatorului.
Returnează: termene apropiate, dosare cu probleme de sănătate, lipsă comunicare cu clienții, riscuri.
Acestea sunt situații care necesită atenție preventivă.`,
  input_schema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Numărul maxim de alerte de returnat (default: 15)',
      },
      deadlineDays: {
        type: 'number',
        description: 'Termene în următoarele N zile (default: 7)',
      },
      includeHealthAlerts: {
        type: 'boolean',
        description: 'Include alertele de sănătate a dosarelor (default: true)',
      },
      communicationGapDays: {
        type: 'number',
        description: 'Pragul de zile pentru lipsă comunicare (default: 30)',
      },
    },
    required: [],
  },
};

// ============================================================================
// Tool 3: Read My Case News
// ============================================================================

export const READ_MY_CASE_NEWS_TOOL: AIToolDefinition = {
  name: 'read_my_case_news',
  description: `Citește noutățile recente din dosarele utilizatorului.
Returnează: emailuri primite, documente încărcate, sarcini finalizate de colegi, termene programate, schimbări de status.
Acestea sunt schimbări care necesită conștientizare.`,
  input_schema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Numărul maxim de știri de returnat (default: 20)',
      },
      hoursBack: {
        type: 'number',
        description: 'Numărul de ore în urmă (default: 24)',
      },
      includeCourtEmails: {
        type: 'boolean',
        description: 'Prioritizează emailurile de la instanță (default: true)',
      },
    },
    required: [],
  },
};

// ============================================================================
// Tool 4: Read Firm Overview (Stats & Summary)
// ============================================================================

export const READ_FIRM_OVERVIEW_TOOL: AIToolDefinition = {
  name: 'read_firm_overview',
  description: `Citește o prezentare generală a firmei și statistici cheie.
Returnează: număr dosare active, sarcini totale, termene apropiate, clienți activi, statistici generale.
Folosește pentru context general și pentru a genera insight-uri interesante.`,
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

// ============================================================================
// Tool 5: Read Active Cases
// ============================================================================

export const READ_ACTIVE_CASES_TOOL: AIToolDefinition = {
  name: 'read_active_cases',
  description: `Citește lista dosarelor active cu detalii.
Returnează: dosare active cu client, tip, data creării, status, echipă, ultima activitate.
Folosește pentru a identifica dosare interesante sau care necesită atenție.`,
  input_schema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Numărul maxim de dosare de returnat (default: 10)',
      },
      sortBy: {
        type: 'string',
        enum: ['recent_activity', 'created_at', 'client_name'],
        description: 'Criteriul de sortare (default: recent_activity)',
      },
    },
    required: [],
  },
};

// ============================================================================
// Tool 6: Read Upcoming Events
// ============================================================================

export const READ_UPCOMING_EVENTS_TOOL: AIToolDefinition = {
  name: 'read_upcoming_events',
  description: `Citește evenimentele și termenele viitoare din calendar.
Returnează: ședințe de judecată, întâlniri cu clienți, termene procedurale, deadline-uri importante.
Folosește pentru a informa despre ce urmează în săptămâna viitoare.`,
  input_schema: {
    type: 'object',
    properties: {
      daysAhead: {
        type: 'number',
        description: 'Numărul de zile în viitor (default: 14)',
      },
      limit: {
        type: 'number',
        description: 'Numărul maxim de evenimente de returnat (default: 15)',
      },
    },
    required: [],
  },
};

// ============================================================================
// Tool 7: Submit Flipboard (Output Tool)
// ============================================================================

export const SUBMIT_FLIPBOARD_TOOL: AIToolDefinition = {
  name: 'submit_flipboard',
  description: `Trimite lista finală de elemente Flipboard. OBLIGATORIU: Apelează acest instrument la final.
Fiecare element trebuie să aibă headline captivant, summary clar și acțiuni relevante.
Prioritizează elementele acționabile și urgente.`,
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'Lista de elemente Flipboard (max 20)',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID unic pentru element',
            },
            headline: {
              type: 'string',
              description:
                'Titlu captivant, max 60 caractere. Exemplu: "SC Exemplu SRL așteaptă răspuns"',
            },
            summary: {
              type: 'string',
              description:
                'Descriere clară, max 150 caractere. Exemplu: "Email din 5 februarie în dosarul 123/2026"',
            },
            priority: {
              type: 'string',
              enum: ['featured', 'secondary'],
              description: 'Prioritate: featured pentru urgente, secondary pentru restul',
            },
            category: {
              type: 'string',
              enum: ['pending_action', 'alert', 'news', 'insight', 'summary', 'upcoming'],
              description: 'Categoria elementului',
            },
            source: {
              type: 'string',
              enum: [
                'pending_email_reply',
                'pending_document_review',
                'pending_signature',
                'pending_submission',
                'task_overdue',
                'task_due_today',
                'task_upcoming',
                'deadline_approaching',
                'communication_gap',
                'case_health_alert',
                'new_email_received',
                'new_document_uploaded',
                'task_completed_by_other',
                'hearing_scheduled',
                'case_status_changed',
                'court_email_received',
                'firm_overview',
                'case_insight',
                'calendar_event',
                'client_update',
                'weekly_summary',
              ],
              description: 'Sursa elementului pentru trasabilitate',
            },
            entityType: {
              type: 'string',
              enum: ['case', 'email_thread', 'task', 'document', 'deadline', 'client'],
              description: 'Tipul entității principale',
            },
            entityId: {
              type: 'string',
              description: 'UUID-ul entității',
            },
            caseId: {
              type: 'string',
              description: 'UUID-ul dosarului',
            },
            caseName: {
              type: 'string',
              description: 'Numele dosarului pentru afișare',
            },
            suggestedActions: {
              type: 'array',
              description: 'Acțiuni sugerate (max 4)',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: 'ID unic pentru acțiune',
                  },
                  label: {
                    type: 'string',
                    description: 'Eticheta acțiunii în română. Exemplu: "Răspunde", "Revizuiește"',
                  },
                  icon: {
                    type: 'string',
                    description: 'Numele iconului Lucide. Exemplu: "reply", "file-text", "check"',
                  },
                  type: {
                    type: 'string',
                    enum: [
                      'navigate',
                      'view_email',
                      'reply_email',
                      'view_document',
                      'draft_document',
                      'create_task',
                      'complete_task',
                      'add_note',
                      'call_client',
                      'schedule',
                      'snooze',
                      'dismiss',
                    ],
                    description: 'Tipul acțiunii',
                  },
                  isPrimary: {
                    type: 'boolean',
                    description: 'Acțiune principală (true) sau secundară (false)',
                  },
                },
                required: ['id', 'label', 'icon', 'type'],
              },
            },
            dueDate: {
              type: 'string',
              description: 'Data scadentă în format ISO (opțional)',
            },
            actorName: {
              type: 'string',
              description: 'Numele actorului implicat (client, parte adversă, etc.)',
            },
            createdAt: {
              type: 'string',
              description: 'Data evenimentului sursă în format ISO',
            },
          },
          required: [
            'id',
            'headline',
            'summary',
            'priority',
            'category',
            'source',
            'entityType',
            'entityId',
            'caseId',
            'caseName',
            'suggestedActions',
            'createdAt',
          ],
        },
      },
    },
    required: ['items'],
  },
};

// ============================================================================
// All Tools Export
// ============================================================================

export const FLIPBOARD_AGENT_TOOLS: AIToolDefinition[] = [
  READ_MY_PENDING_ACTIONS_TOOL,
  READ_MY_CASE_ALERTS_TOOL,
  READ_MY_CASE_NEWS_TOOL,
  READ_FIRM_OVERVIEW_TOOL,
  READ_ACTIVE_CASES_TOOL,
  READ_UPCOMING_EVENTS_TOOL,
  SUBMIT_FLIPBOARD_TOOL,
];
