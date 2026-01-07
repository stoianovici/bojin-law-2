import type { MapaTemplate } from '@/types/mapa';
import { ONRC_TEMPLATES } from '@/lib/onrc/templates-data';

// Re-export ONRC templates from the source of truth
// This ensures all 58 ONRC templates are available and never lost
export const MOCK_ONRC_TEMPLATES: MapaTemplate[] = ONRC_TEMPLATES;

// Mock user for firm templates
const MOCK_ADMIN_USER = {
  id: 'system',
  firstName: 'System',
  lastName: 'Admin',
  initials: 'SA',
};

// Firm-specific templates (custom)
export const MOCK_FIRM_TEMPLATES: MapaTemplate[] = [
  {
    id: 'firm-template-1',
    firmId: '99d685ee-1723-4d21-9634-ea414ceaba9b',
    name: 'Dosar Litigiu Civil',
    description: 'Șablon pentru dosare de litigii civile - acțiuni în instanță',
    isONRC: false,
    isActive: true,
    isLocked: false,
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2025-12-15T00:00:00Z',
    createdBy: MOCK_ADMIN_USER,
    slotDefinitions: [
      {
        name: 'Cerere de chemare în judecată',
        category: 'acte_procedurale',
        required: true,
        order: 1,
      },
      { name: 'Întâmpinare', category: 'acte_procedurale', required: true, order: 2 },
      { name: 'Răspuns la întâmpinare', category: 'acte_procedurale', required: false, order: 3 },
      { name: 'Probe scrise', category: 'dovezi', required: true, order: 4 },
      { name: 'Concluzii scrise', category: 'acte_procedurale', required: false, order: 5 },
    ],
    usageCount: 67,
  },
  {
    id: 'firm-template-2',
    firmId: '99d685ee-1723-4d21-9634-ea414ceaba9b',
    name: 'Dosar Due Diligence',
    description: 'Șablon pentru verificarea juridică a unei companii',
    isONRC: false,
    isActive: true,
    isLocked: false,
    createdAt: '2025-03-01T00:00:00Z',
    updatedAt: '2025-11-20T00:00:00Z',
    createdBy: MOCK_ADMIN_USER,
    slotDefinitions: [
      { name: 'Certificat constatator ONRC', category: 'certificate', required: true, order: 1 },
      { name: 'Act constitutiv', category: 'acte_constitutive', required: true, order: 2 },
      { name: 'Situații financiare 3 ani', category: 'financiar', required: true, order: 3 },
      { name: 'Contracte semnificative', category: 'contracte', required: true, order: 4 },
      { name: 'Lista litigii', category: 'litigii', required: true, order: 5 },
      { name: 'Raport final DD', category: 'rapoarte', required: true, order: 6 },
    ],
    usageCount: 23,
  },
];

// Combined templates
export const MOCK_TEMPLATES: MapaTemplate[] = [...MOCK_ONRC_TEMPLATES, ...MOCK_FIRM_TEMPLATES];

// Helper functions
export function getTemplateById(id: string): MapaTemplate | undefined {
  return MOCK_TEMPLATES.find((t) => t.id === id);
}

export function getONRCTemplates(): MapaTemplate[] {
  return MOCK_TEMPLATES.filter((t) => t.isONRC);
}

export function getFirmTemplates(): MapaTemplate[] {
  return MOCK_TEMPLATES.filter((t) => !t.isONRC);
}

export function getActiveTemplates(): MapaTemplate[] {
  return MOCK_TEMPLATES.filter((t) => t.isActive);
}
