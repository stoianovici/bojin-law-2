/**
 * Firm Data
 * CLEANED: Mock data removed - use real API calls instead
 */

export interface Firm {
  id: string;
  name: string;
}

// Empty array - firms should be fetched from API
export const mockFirms: Firm[] = [];

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
