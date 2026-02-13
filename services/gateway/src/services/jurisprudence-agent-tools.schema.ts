/**
 * Jurisprudence Agent Tool Schemas
 *
 * Defines the tools for the jurisprudence research agent:
 * - search_jurisprudence: Search Romanian court databases
 * - submit_jurisprudence_notes: Output tool for final research notes
 */

import { AIToolDefinition } from './ai-client.service';

// ============================================================================
// Tool 1: Search Jurisprudence
// ============================================================================

export const SEARCH_JURISPRUDENCE_TOOL: AIToolDefinition = {
  name: 'search_jurisprudence',
  description: `Caută decizii în bazele de date de jurisprudență românească (ReJust, SCJ, CCR, ROLII).

Returnează: decizii cu număr, instanță, dată, URL și fragment relevant.

IMPORTANT:
- Formulează căutări precise cu termeni juridici
- Folosește termeni în română pentru rezultate mai bune
- Poți filtra după instanță și interval de ani
- Fiecare căutare returnează maxim 10 rezultate`,
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Termeni de căutare (în română). Exemple: "rezoluțiune contract neexecutare", "răspundere civilă delictuală prejudiciu", "recurs în interesul legii clauze abuzive"',
      },
      courts: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['ÎCCJ', 'CCR', 'CA', 'Tribunal', 'Judecătorie'],
        },
        description:
          'Filtrează după instanță. ÎCCJ = Înalta Curte, CCR = Curtea Constituțională, CA = Curți de Apel',
      },
      yearRange: {
        type: 'object',
        properties: {
          from: {
            type: 'number',
            description: 'Anul de început (ex: 2020)',
          },
          to: {
            type: 'number',
            description: 'Anul de sfârșit (ex: 2025)',
          },
        },
        description: 'Filtrează după interval de ani',
      },
      maxResults: {
        type: 'number',
        description: 'Numărul maxim de rezultate (default: 10, max: 15)',
      },
    },
    required: ['query'],
  },
};

// ============================================================================
// Tool 2: Submit Jurisprudence Notes (Output Tool)
// ============================================================================

export const SUBMIT_JURISPRUDENCE_NOTES_TOOL: AIToolDefinition = {
  name: 'submit_jurisprudence_notes',
  description: `Trimite nota jurisprudențială finală. OBLIGATORIU: Apelează acest instrument la final.

ATENȚIE la format citări:
- Fiecare citare TREBUIE să aibă: număr decizie, instanță, dată, URL
- NU inventa decizii - folosește DOAR ce ai găsit în căutări
- Dacă nu ai găsit decizii relevante, lasă lista goală și documentează în "gaps"`,
  input_schema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Subiectul cercetării jurisprudențiale',
      },
      summary: {
        type: 'string',
        description: 'Rezumat executiv al constatărilor (2-3 paragrafe)',
      },
      citations: {
        type: 'array',
        description: 'Lista de citări cu toate detaliile necesare',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID intern (ex: "src1", "src2")',
            },
            decisionType: {
              type: 'string',
              enum: ['decizie', 'sentință', 'încheiere'],
              description: 'Tipul hotărârii',
            },
            decisionNumber: {
              type: 'string',
              description: 'Numărul hotărârii cu anul (ex: "30/2020", "456/2023")',
            },
            court: {
              type: 'string',
              description: 'Instanța prescurtat (ex: "ÎCCJ", "CCR", "CA București")',
            },
            courtFull: {
              type: 'string',
              description: 'Numele complet al instanței',
            },
            section: {
              type: 'string',
              description:
                'Secția/completul (ex: "Secția I civilă", "Completul RIL", "Completul pentru dezlegarea unor chestiuni de drept")',
            },
            date: {
              type: 'string',
              description: 'Data în format ISO (YYYY-MM-DD)',
            },
            dateFormatted: {
              type: 'string',
              description: 'Data formatată (DD.MM.YYYY)',
            },
            url: {
              type: 'string',
              description: 'URL-ul complet către decizie (rejust.ro, scj.ro, ccr.ro)',
            },
            caseNumber: {
              type: 'string',
              description: 'Numărul dosarului (ex: "Dosar nr. 1234/1/2020")',
            },
            summary: {
              type: 'string',
              description: 'Rezumat 2-3 propoziții al soluției/considerentelor relevante',
            },
            relevance: {
              type: 'string',
              description: 'De ce această decizie este relevantă pentru cercetare',
            },
            officialGazette: {
              type: 'string',
              description: 'Pentru CCR: publicarea în M.Of. (ex: "M.Of. nr. 517 din 08.07.2016")',
            },
          },
          required: [
            'id',
            'decisionType',
            'decisionNumber',
            'court',
            'courtFull',
            'date',
            'dateFormatted',
            'url',
            'summary',
            'relevance',
          ],
        },
      },
      analysis: {
        type: 'string',
        description:
          'Analiză sintetică a jurisprudenței găsite: tendințe, evoluție, divergențe, concluzii',
      },
      gaps: {
        type: 'array',
        items: {
          type: 'string',
        },
        description:
          'Ce nu s-a putut găsi sau verifica (ex: "Nu s-au găsit decizii ÎCCJ pe această temă după 2022")',
      },
    },
    required: ['topic', 'summary', 'citations', 'analysis', 'gaps'],
  },
};

// ============================================================================
// All Tools Export
// ============================================================================

export const JURISPRUDENCE_AGENT_TOOLS: AIToolDefinition[] = [
  SEARCH_JURISPRUDENCE_TOOL,
  SUBMIT_JURISPRUDENCE_NOTES_TOOL,
];
