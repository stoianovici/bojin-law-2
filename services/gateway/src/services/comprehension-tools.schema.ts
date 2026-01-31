/**
 * Comprehension Agent Tool Schemas
 *
 * Defines the 8 read-only tools for the Case Comprehension agent.
 * These tools allow the agent to deeply explore case data and build understanding.
 */

import { AIToolDefinition } from './ai-client.service';

// ============================================================================
// Tool 1: Read Case Identity
// ============================================================================

export const READ_CASE_IDENTITY_TOOL: AIToolDefinition = {
  name: 'read_case_identity',
  description: `Citește informațiile de bază ale dosarului: număr, titlu, status, tip, valoare, client.
Folosește acest tool PRIMUL pentru a înțelege despre ce este dosarul.`,
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'ID-ul dosarului',
      },
    },
    required: ['caseId'],
  },
};

// ============================================================================
// Tool 2: Read Case Actors
// ============================================================================

export const READ_CASE_ACTORS_TOOL: AIToolDefinition = {
  name: 'read_case_actors',
  description: `Citește toate părțile implicate în dosar: echipa internă, actori externi (pârâți, reclamanți, intervenienți), contacte client.
Folosește pentru a înțelege cine sunt jucătorii în acest dosar.`,
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'ID-ul dosarului',
      },
    },
    required: ['caseId'],
  },
};

// ============================================================================
// Tool 3: Read Case Documents
// ============================================================================

export const READ_CASE_DOCUMENTS_TOOL: AIToolDefinition = {
  name: 'read_case_documents',
  description: `Citește documentele cheie din dosar cu conținutul extras.
Poți filtra după status (toate, recente, finalizate) și controla lungimea conținutului.`,
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'ID-ul dosarului',
      },
      includeContent: {
        type: 'boolean',
        description: 'Include conținutul extras din documente (default: true)',
      },
      maxContentLength: {
        type: 'number',
        description: 'Lungimea maximă a conținutului per document în caractere (default: 2000)',
      },
      filter: {
        type: 'string',
        enum: ['all', 'recent', 'finalized'],
        description:
          'Filtru: all = toate documentele, recent = documente noi/modificate, finalized = doar documentele finale',
      },
      since: {
        type: 'string',
        description:
          'Pentru filtrul "recent": data ISO de la care să returneze documente modificate',
      },
    },
    required: ['caseId'],
  },
};

// ============================================================================
// Tool 4: Read Case Emails
// ============================================================================

export const READ_CASE_EMAILS_TOOL: AIToolDefinition = {
  name: 'read_case_emails',
  description: `Citește thread-urile de email asociate dosarului cu rezumate și puncte cheie.
Folosește pentru a înțelege comunicarea și pozițiile părților.`,
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'ID-ul dosarului',
      },
      includeBody: {
        type: 'boolean',
        description: 'Include corpul emailului dacă nu există rezumat (default: false)',
      },
      maxThreads: {
        type: 'number',
        description: 'Numărul maxim de thread-uri de returnat (default: 10)',
      },
    },
    required: ['caseId'],
  },
};

// ============================================================================
// Tool 5: Read Case Timeline
// ============================================================================

export const READ_CASE_TIMELINE_TOOL: AIToolDefinition = {
  name: 'read_case_timeline',
  description: `Citește cronologia dosarului: evenimente trecute și viitoare, termene, ședințe.
Folosește pentru a înțelege ce s-a întâmplat și ce urmează.`,
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'ID-ul dosarului',
      },
      includePast: {
        type: 'boolean',
        description: 'Include evenimente trecute (default: true)',
      },
      includeFuture: {
        type: 'boolean',
        description: 'Include evenimente viitoare (default: true)',
      },
    },
    required: ['caseId'],
  },
};

// ============================================================================
// Tool 6: Read Case Context
// ============================================================================

export const READ_CASE_CONTEXT_TOOL: AIToolDefinition = {
  name: 'read_case_context',
  description: `Citește comprehensiunea existentă pentru acest dosar (dacă există).
Folosește pentru actualizări incrementale - păstrează corecturile utilizatorului.`,
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'ID-ul dosarului',
      },
    },
    required: ['caseId'],
  },
};

// ============================================================================
// Tool 7: Read Client Context
// ============================================================================

export const READ_CLIENT_CONTEXT_TOOL: AIToolDefinition = {
  name: 'read_client_context',
  description: `Citește informațiile despre client: date de identificare, dosare active, relație.
Folosește pentru context despre clientul din dosar.`,
  input_schema: {
    type: 'object',
    properties: {
      clientId: {
        type: 'string',
        description: 'ID-ul clientului',
      },
    },
    required: ['clientId'],
  },
};

// ============================================================================
// Tool 8: Read Case Activities
// ============================================================================

export const READ_CASE_ACTIVITIES_TOOL: AIToolDefinition = {
  name: 'read_case_activities',
  description: `Citește activitățile recente în aplicație pentru acest dosar.
Folosește pentru a înțelege ce a lucrat echipa recent.`,
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'ID-ul dosarului',
      },
      limit: {
        type: 'number',
        description: 'Numărul maxim de activități de returnat (default: 20)',
      },
    },
    required: ['caseId'],
  },
};

// ============================================================================
// All Tools Export
// ============================================================================

export const COMPREHENSION_TOOLS: AIToolDefinition[] = [
  READ_CASE_IDENTITY_TOOL,
  READ_CASE_ACTORS_TOOL,
  READ_CASE_DOCUMENTS_TOOL,
  READ_CASE_EMAILS_TOOL,
  READ_CASE_TIMELINE_TOOL,
  READ_CASE_CONTEXT_TOOL,
  READ_CLIENT_CONTEXT_TOOL,
  READ_CASE_ACTIVITIES_TOOL,
];
