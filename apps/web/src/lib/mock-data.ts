/**
 * Mock Data for Prototype
 *
 * This file provides mock data for prototype/demo purposes.
 * In production, this will be replaced with actual API calls.
 */

import type { CommunicationThread } from '@legal-platform/types';

/**
 * Generate mock communication threads for prototype
 */
export function generateMockCommunicationThreads(_count: number = 25): CommunicationThread[] {
  // For now, return empty array - mock data will be populated by test-utils in test/story files
  // In a real implementation, this would call an API endpoint
  return [];
}
