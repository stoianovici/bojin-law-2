/**
 * AI Assistant Tool Schemas
 * OPS-082: Define Claude Tool Schemas
 *
 * Claude tool definitions for all AI assistant actions. These replace the
 * intent detection system with structured tool definitions that Claude can
 * call directly using native tool use.
 *
 * All descriptions are in Romanian to match the UI language. Claude will
 * naturally understand Romanian and call tools with correct parameters.
 */

// ============================================================================
// Claude Tool Schema Types
// (Matches Anthropic SDK's Tool type for compatibility)
// ============================================================================

/**
 * JSON Schema for tool input validation.
 * Matches the Anthropic API's expected format.
 */
export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, ToolPropertySchema>;
  required?: string[];
}

export interface ToolPropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: ToolPropertySchema;
}

/**
 * Claude tool definition.
 * Compatible with Anthropic SDK's Tool type.
 */
export interface Tool {
  name: string;
  description: string;
  input_schema: ToolInputSchema;
}

// ============================================================================
// Task Tools
// ============================================================================

const CREATE_TASK_TOOL: Tool = {
  name: 'create_task',
  description:
    'Creează o sarcină nouă. IMPORTANT: Necesită caseId valid. Dacă utilizatorul menționează un dosar după nume (ex: "cazul Popescu", "dosarul Solaria"), folosește MAI ÎNTÂI search_cases pentru a găsi dosarul, apoi creează sarcina cu caseId-ul găsit. Nu apela create_task fără caseId.',
  input_schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description:
          'Titlul sarcinii - ce trebuie făcut. Extrage titlul din textul utilizatorului.',
      },
      description: {
        type: 'string',
        description:
          'Descriere detaliată a sarcinii (opțional). Include detalii suplimentare menționate de utilizator.',
      },
      dueDate: {
        type: 'string',
        description:
          'Data limită în format ISO 8601 (YYYY-MM-DD). Interpretează expresii ca "mâine", "vineri", "vinerea viitoare", "peste 3 zile", "săptămâna viitoare", "luna viitoare" relativ la data curentă.',
      },
      priority: {
        type: 'string',
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        description:
          'Prioritatea sarcinii. Folosește Urgent pentru termene foarte apropiate sau când utilizatorul menționează urgența. Default: Medium.',
      },
      caseId: {
        type: 'string',
        description:
          'ID-ul dosarului asociat (OBLIGATORIU). Obține din: 1) contextul conversației dacă utilizatorul e pe pagina unui dosar, sau 2) rezultatul search_cases dacă utilizatorul a menționat dosarul după nume.',
      },
      taskType: {
        type: 'string',
        enum: [
          'Research',
          'Drafting',
          'Review',
          'Filing',
          'Communication',
          'Meeting',
          'Deadline',
          'Other',
        ],
        description:
          'Tipul sarcinii. Deduce din context: "redactează"→Drafting, "verifică"→Review, "depune"→Filing, etc. Default: Other.',
      },
      assignee: {
        type: 'string',
        description:
          'Numele persoanei căreia îi este asignată sarcina (ex: "Oana", "Ionescu", "Maria Popescu"). Dacă nu e specificat, sarcina se asignează utilizatorului curent.',
      },
    },
    required: ['title', 'caseId'],
  },
};

const LIST_TASKS_TOOL: Tool = {
  name: 'list_tasks',
  description:
    'Listează sarcinile utilizatorului. Folosește când întreabă despre taskuri, sarcini de făcut, deadline-uri, ce are de făcut azi/săptămâna aceasta.',
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description:
          'Filtrează după dosar (opțional). Folosește contextul conversației dacă e relevant.',
      },
      status: {
        type: 'string',
        enum: ['pending', 'in_progress', 'completed', 'overdue', 'all'],
        description:
          'Filtrează după status. "pending" = neîncepute, "in_progress" = în lucru, "overdue" = restante, "completed" = finalizate. Default: pending.',
      },
      timeRange: {
        type: 'string',
        enum: ['today', 'week', 'month', 'all'],
        description:
          'Perioada de timp. "today" = azi, "week" = săptămâna aceasta, "month" = luna aceasta. Default: week.',
      },
    },
  },
};

const UPDATE_TASK_TOOL: Tool = {
  name: 'update_task',
  description:
    'Actualizează o sarcină existentă - schimbă status, deadline, sau prioritate. Folosește când utilizatorul vrea să marcheze un task ca finalizat, să schimbe termenul, sau prioritatea.',
  input_schema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description:
          'ID-ul sarcinii de actualizat. Obține din context dacă utilizatorul a menționat o sarcină anume.',
      },
      status: {
        type: 'string',
        enum: ['Pending', 'InProgress', 'Completed', 'Cancelled'],
        description:
          'Noul status. "Completed" când utilizatorul spune "gata", "finalizat", "am terminat".',
      },
      dueDate: {
        type: 'string',
        description: 'Noua dată limită în format ISO 8601 (YYYY-MM-DD).',
      },
      priority: {
        type: 'string',
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        description: 'Noua prioritate.',
      },
    },
    required: ['taskId'],
  },
};

// ============================================================================
// Case Tools
// ============================================================================

const GET_CASE_SUMMARY_TOOL: Tool = {
  name: 'get_case_summary',
  description:
    'Obține rezumatul unui dosar - status curent, părți implicate, deadline-uri apropiate, documente recente, rezumat AI. Folosește când utilizatorul întreabă despre un dosar, vrea să știe ce s-a întâmplat, sau cere o prezentare.',
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description:
          'ID-ul dosarului. Folosește din context dacă utilizatorul e pe pagina unui dosar, sau caută după referință.',
      },
      caseReference: {
        type: 'string',
        description:
          'Numărul dosarului, numele clientului, sau o parte din titlu pentru căutare. Folosește dacă caseId nu e disponibil.',
      },
    },
  },
};

const SEARCH_CASES_TOOL: Tool = {
  name: 'search_cases',
  description:
    'Caută dosare după nume, număr de dosar, nume client, sau status. Folosește când utilizatorul caută un dosar sau întreabă despre dosarele unui client.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Text de căutare - număr dosar, nume client, parte din titlu.',
      },
      status: {
        type: 'string',
        enum: ['Active', 'Pending', 'Closed', 'OnHold', 'Archived'],
        description: 'Filtrează după status. "Active" = active, "Closed" = închise, etc.',
      },
      clientName: {
        type: 'string',
        description: 'Filtrează după numele clientului.',
      },
    },
  },
};

const GET_CASE_DEADLINES_TOOL: Tool = {
  name: 'get_case_deadlines',
  description:
    'Listează termenele și deadline-urile unui dosar. Folosește când utilizatorul întreabă despre termene, când e următorul termen, deadline-uri apropiate.',
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'ID-ul dosarului. Folosește din context dacă e disponibil.',
      },
      caseReference: {
        type: 'string',
        description: 'Numărul dosarului sau numele pentru căutare dacă caseId nu e disponibil.',
      },
      upcoming: {
        type: 'boolean',
        description: 'Doar termenele viitoare (true) sau toate (false). Default: true.',
      },
    },
  },
};

const GET_CASE_ACTORS_TOOL: Tool = {
  name: 'get_case_actors',
  description:
    'Listează părțile și actorii implicați într-un dosar - client, părți adverse, martori, echipa firmei. Folosește când utilizatorul întreabă cine sunt părțile, actorii, sau echipa.',
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'ID-ul dosarului.',
      },
      caseReference: {
        type: 'string',
        description: 'Referință pentru căutare dacă caseId nu e disponibil.',
      },
    },
  },
};

// ============================================================================
// Email Tools
// ============================================================================

const SEARCH_EMAILS_TOOL: Tool = {
  name: 'search_emails',
  description:
    'Caută emailuri în dosare. Folosește când utilizatorul caută o corespondență, întreabă despre emailuri de la/către cineva, sau vrea să găsească un mesaj.',
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'Caută în dosarul specificat. Folosește din context dacă e relevant.',
      },
      query: {
        type: 'string',
        description: 'Text de căutare în subiect și corp email.',
      },
      sender: {
        type: 'string',
        description: 'Filtrează după expeditor (nume sau email).',
      },
      timeRange: {
        type: 'string',
        enum: ['today', 'week', 'month', 'all'],
        description: 'Perioada de timp. Default: all.',
      },
      hasAttachments: {
        type: 'boolean',
        description: 'Doar emailuri cu atașamente.',
      },
      isUnread: {
        type: 'boolean',
        description: 'Doar emailuri necitite.',
      },
    },
  },
};

const SUMMARIZE_EMAIL_THREAD_TOOL: Tool = {
  name: 'summarize_email_thread',
  description:
    'Rezumă un thread de emailuri - generează un rezumat cu punctele cheie ale conversației. Folosește când utilizatorul vrea să înțeleagă rapid o conversație email.',
  input_schema: {
    type: 'object',
    properties: {
      emailId: {
        type: 'string',
        description:
          'ID-ul emailului din thread. Folosește din context dacă utilizatorul a selectat un email.',
      },
      threadId: {
        type: 'string',
        description: 'ID-ul thread-ului de email (conversationId).',
      },
    },
  },
};

const DRAFT_EMAIL_REPLY_TOOL: Tool = {
  name: 'draft_email_reply',
  description:
    'Creează un draft de răspuns la un email. Returnează textul propus pentru aprobare înainte de trimitere. Folosește când utilizatorul vrea să răspundă la un email.',
  input_schema: {
    type: 'object',
    properties: {
      emailId: {
        type: 'string',
        description: 'ID-ul emailului la care răspundem. Folosește din context.',
      },
      tone: {
        type: 'string',
        enum: ['formal', 'professional', 'brief'],
        description:
          'Tonul răspunsului. "formal" = limbaj oficial, "professional" = profesional standard, "brief" = concis. Default: professional.',
      },
      recipientType: {
        type: 'string',
        enum: ['Client', 'Court', 'OpposingCounsel', 'ThirdParty'],
        description:
          'Tipul destinatarului pentru adaptarea tonului. "Client" = client, "Court" = instanță, "OpposingCounsel" = avocat adversar.',
      },
      instructions: {
        type: 'string',
        description:
          'Instrucțiuni specifice pentru conținutul răspunsului - ce să includă, ce ton să folosească, puncte de subliniat.',
      },
    },
    required: ['emailId'],
  },
};

const GET_RECENT_EMAILS_TOOL: Tool = {
  name: 'get_recent_emails',
  description:
    'Obține emailurile recente necitite din ultimele 24 de ore. Folosește când utilizatorul întreabă despre emailuri noi, mesaje recente, ce a primit.',
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'Filtrează după dosar (opțional).',
      },
    },
  },
};

// ============================================================================
// Document Tools
// ============================================================================

const SEARCH_DOCUMENTS_TOOL: Tool = {
  name: 'search_documents',
  description:
    'Caută documente în dosare. Folosește când utilizatorul caută un document, contract, cerere, sau alt fișier.',
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'Caută în dosarul specificat.',
      },
      query: {
        type: 'string',
        description: 'Text de căutare în nume sau conținut document.',
      },
      documentType: {
        type: 'string',
        description:
          'Tipul documentului: contract, cerere, sentință, hotărâre, scrisoare, memoriu, întâmpinare, etc.',
      },
    },
  },
};

const SUMMARIZE_DOCUMENT_TOOL: Tool = {
  name: 'summarize_document',
  description:
    'Generează un rezumat al unui document juridic - tip, părți, obiect, obligații, termene. Folosește când utilizatorul vrea să înțeleagă rapid un document.',
  input_schema: {
    type: 'object',
    properties: {
      documentId: {
        type: 'string',
        description:
          'ID-ul documentului de rezumat. Folosește din context dacă utilizatorul a selectat un document.',
      },
    },
    required: ['documentId'],
  },
};

const GENERATE_DOCUMENT_TOOL: Tool = {
  name: 'generate_document',
  description:
    'Generează un document nou (contract, cerere, scrisoare, notificare). Returnează draft pentru aprobare. Folosește când utilizatorul vrea să creeze un document nou.',
  input_schema: {
    type: 'object',
    properties: {
      templateType: {
        type: 'string',
        enum: ['Contract', 'Motion', 'Letter', 'Memo', 'Pleading', 'Other'],
        description:
          'Tipul documentului: Contract, Motion (cerere), Letter (scrisoare), Memo (notă internă), Pleading (întâmpinare).',
      },
      caseId: {
        type: 'string',
        description: 'Dosarul asociat - va fi folosit pentru context (părți, numere, etc.).',
      },
      instructions: {
        type: 'string',
        description:
          'Instrucțiuni specifice pentru conținut - ce să includă, stilul, puncte specifice.',
      },
    },
    required: ['templateType'],
  },
};

const LIST_CASE_DOCUMENTS_TOOL: Tool = {
  name: 'list_case_documents',
  description:
    'Listează documentele dintr-un dosar. Folosește când utilizatorul întreabă ce documente sunt în dosar.',
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'ID-ul dosarului. Folosește din context dacă e disponibil.',
      },
    },
    required: ['caseId'],
  },
};

// ============================================================================
// Calendar Tools
// ============================================================================

const GET_CALENDAR_TOOL: Tool = {
  name: 'get_calendar',
  description:
    'Obține evenimentele din calendar pentru o perioadă. Folosește când utilizatorul întreabă despre programul zilei, săptămânii, sau evenimente viitoare.',
  input_schema: {
    type: 'object',
    properties: {
      startDate: {
        type: 'string',
        description: 'Data de început în format ISO 8601 (YYYY-MM-DD). Default: azi.',
      },
      endDate: {
        type: 'string',
        description: 'Data de sfârșit în format ISO 8601. Default: +7 zile.',
      },
      caseId: {
        type: 'string',
        description: 'Filtrează după dosar (opțional).',
      },
    },
  },
};

const CREATE_CALENDAR_EVENT_TOOL: Tool = {
  name: 'create_calendar_event',
  description:
    'Creează un eveniment în calendar (ședință, termen, întâlnire). Folosește când utilizatorul vrea să programeze ceva. Interpretează expresii de dată și oră precum "mâine la 10", "vineri după-amiază", "săptămâna viitoare".',
  input_schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Titlul evenimentului.',
      },
      startTime: {
        type: 'string',
        description:
          'Data și ora de început în format ISO 8601 (YYYY-MM-DDTHH:MM:SS). Interpretează "mâine la 10" ca data de mâine + 10:00.',
      },
      endTime: {
        type: 'string',
        description: 'Data și ora de sfârșit. Dacă nu e specificat, adaugă 1 oră la startTime.',
      },
      isAllDay: {
        type: 'boolean',
        description: 'Eveniment pe toată ziua (fără oră specifică).',
      },
      caseId: {
        type: 'string',
        description: 'Dosarul asociat (opțional).',
      },
      location: {
        type: 'string',
        description: 'Locația evenimentului.',
      },
      attendees: {
        type: 'array',
        items: { type: 'string' },
        description: 'Lista de participanți (adrese email).',
      },
    },
    required: ['title', 'startTime'],
  },
};

// ============================================================================
// Briefing Tools
// ============================================================================

const GET_MORNING_BRIEFING_TOOL: Tool = {
  name: 'get_morning_briefing',
  description:
    'Generează briefingul zilei - sarcini urgente, termene apropiate, emailuri noi. Folosește când utilizatorul salută, cere un rezumat al zilei, sau întreabă ce are de făcut.',
  input_schema: {
    type: 'object',
    properties: {},
  },
};

const GET_PROACTIVE_ALERTS_TOOL: Tool = {
  name: 'get_proactive_alerts',
  description:
    'Obține alerte proactive - termene apropiate, emailuri fără răspuns, sarcini restante. Folosește pentru notificări în context.',
  input_schema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'Filtrează după dosar (opțional).',
      },
    },
  },
};

// ============================================================================
// Exported Tool List & Types
// ============================================================================

/**
 * Complete list of AI assistant tools.
 * These are passed to Claude Sonnet for native tool calling.
 */
export const AI_TOOLS: Tool[] = [
  // Task Tools
  CREATE_TASK_TOOL,
  LIST_TASKS_TOOL,
  UPDATE_TASK_TOOL,

  // Case Tools
  GET_CASE_SUMMARY_TOOL,
  SEARCH_CASES_TOOL,
  GET_CASE_DEADLINES_TOOL,
  GET_CASE_ACTORS_TOOL,

  // Email Tools
  SEARCH_EMAILS_TOOL,
  SUMMARIZE_EMAIL_THREAD_TOOL,
  DRAFT_EMAIL_REPLY_TOOL,
  GET_RECENT_EMAILS_TOOL,

  // Document Tools
  SEARCH_DOCUMENTS_TOOL,
  SUMMARIZE_DOCUMENT_TOOL,
  GENERATE_DOCUMENT_TOOL,
  LIST_CASE_DOCUMENTS_TOOL,

  // Calendar Tools
  GET_CALENDAR_TOOL,
  CREATE_CALENDAR_EVENT_TOOL,

  // Briefing Tools
  GET_MORNING_BRIEFING_TOOL,
  GET_PROACTIVE_ALERTS_TOOL,
];

/**
 * Tool name type extracted from the tools array.
 */
export type AIToolName =
  | 'create_task'
  | 'list_tasks'
  | 'update_task'
  | 'get_case_summary'
  | 'search_cases'
  | 'get_case_deadlines'
  | 'get_case_actors'
  | 'search_emails'
  | 'summarize_email_thread'
  | 'draft_email_reply'
  | 'get_recent_emails'
  | 'search_documents'
  | 'summarize_document'
  | 'generate_document'
  | 'list_case_documents'
  | 'get_calendar'
  | 'create_calendar_event'
  | 'get_morning_briefing'
  | 'get_proactive_alerts';

/**
 * Input types for each tool, inferred from schemas.
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  caseId?: string;
  taskType?:
    | 'Research'
    | 'Drafting'
    | 'Review'
    | 'Filing'
    | 'Communication'
    | 'Meeting'
    | 'Deadline'
    | 'Other';
}

export interface ListTasksInput {
  caseId?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'all';
  timeRange?: 'today' | 'week' | 'month' | 'all';
}

export interface UpdateTaskInput {
  taskId: string;
  status?: 'Pending' | 'InProgress' | 'Completed' | 'Cancelled';
  dueDate?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
}

export interface GetCaseSummaryInput {
  caseId?: string;
  caseReference?: string;
}

export interface SearchCasesInput {
  query?: string;
  status?: 'Active' | 'Pending' | 'Closed' | 'OnHold' | 'Archived';
  clientName?: string;
}

export interface GetCaseDeadlinesInput {
  caseId?: string;
  caseReference?: string;
  upcoming?: boolean;
}

export interface GetCaseActorsInput {
  caseId?: string;
  caseReference?: string;
}

export interface SearchEmailsInput {
  caseId?: string;
  query?: string;
  sender?: string;
  timeRange?: 'today' | 'week' | 'month' | 'all';
  hasAttachments?: boolean;
  isUnread?: boolean;
}

export interface SummarizeEmailThreadInput {
  emailId?: string;
  threadId?: string;
}

export interface DraftEmailReplyInput {
  emailId: string;
  tone?: 'formal' | 'professional' | 'brief';
  recipientType?: 'Client' | 'Court' | 'OpposingCounsel' | 'ThirdParty';
  instructions?: string;
}

export interface GetRecentEmailsInput {
  caseId?: string;
}

export interface SearchDocumentsInput {
  caseId?: string;
  query?: string;
  documentType?: string;
}

export interface SummarizeDocumentInput {
  documentId: string;
}

export interface GenerateDocumentInput {
  templateType: 'Contract' | 'Motion' | 'Letter' | 'Memo' | 'Pleading' | 'Other';
  caseId?: string;
  instructions?: string;
}

export interface ListCaseDocumentsInput {
  caseId: string;
}

export interface GetCalendarInput {
  startDate?: string;
  endDate?: string;
  caseId?: string;
}

export interface CreateCalendarEventInput {
  title: string;
  startTime: string;
  endTime?: string;
  isAllDay?: boolean;
  caseId?: string;
  location?: string;
  attendees?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GetMorningBriefingInput {
  // No parameters - intentionally empty
}

export interface GetProactiveAlertsInput {
  caseId?: string;
}

/**
 * Union type for all tool inputs.
 */
export type AIToolInput =
  | { name: 'create_task'; input: CreateTaskInput }
  | { name: 'list_tasks'; input: ListTasksInput }
  | { name: 'update_task'; input: UpdateTaskInput }
  | { name: 'get_case_summary'; input: GetCaseSummaryInput }
  | { name: 'search_cases'; input: SearchCasesInput }
  | { name: 'get_case_deadlines'; input: GetCaseDeadlinesInput }
  | { name: 'get_case_actors'; input: GetCaseActorsInput }
  | { name: 'search_emails'; input: SearchEmailsInput }
  | { name: 'summarize_email_thread'; input: SummarizeEmailThreadInput }
  | { name: 'draft_email_reply'; input: DraftEmailReplyInput }
  | { name: 'get_recent_emails'; input: GetRecentEmailsInput }
  | { name: 'search_documents'; input: SearchDocumentsInput }
  | { name: 'summarize_document'; input: SummarizeDocumentInput }
  | { name: 'generate_document'; input: GenerateDocumentInput }
  | { name: 'list_case_documents'; input: ListCaseDocumentsInput }
  | { name: 'get_calendar'; input: GetCalendarInput }
  | { name: 'create_calendar_event'; input: CreateCalendarEventInput }
  | { name: 'get_morning_briefing'; input: GetMorningBriefingInput }
  | { name: 'get_proactive_alerts'; input: GetProactiveAlertsInput };

/**
 * Check if a tool name is valid.
 */
export function isValidToolName(name: string): name is AIToolName {
  return AI_TOOLS.some((tool) => tool.name === name);
}

/**
 * Get a tool by name.
 */
export function getToolByName(name: AIToolName): Tool | undefined {
  return AI_TOOLS.find((tool) => tool.name === name);
}
