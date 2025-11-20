/**
 * Mock Firm Data
 * Temporary data for firm selection until Firm entity is fully implemented
 * Story 2.4.1: Partner User Management
 */

export interface Firm {
  id: string;
  name: string;
}

export const mockFirms: Firm[] = [
  {
    id: 'firm-001',
    name: 'Popescu & Ionescu Law Firm',
  },
  {
    id: 'firm-002',
    name: 'Bucuresti Legal Associates',
  },
  {
    id: 'firm-003',
    name: 'Cluj Corporate Law',
  },
];

/**
 * Get firm by ID
 */
export function getFirmById(id: string): Firm | undefined {
  return mockFirms.find((firm) => firm.id === id);
}

/**
 * Get all firms
 */
export function getAllFirms(): Firm[] {
  return mockFirms;
}
