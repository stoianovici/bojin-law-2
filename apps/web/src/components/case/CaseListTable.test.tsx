/**
 * Unit Tests for CaseListTable Component
 * Story 2.8: Case CRUD Operations UI - Task 19
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { CaseListTable } from './CaseListTable';
import type { CaseStatus } from '@legal-platform/types';

// Mock useRouter from next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('CaseListTable', () => {
  const mockCases = [
    {
      id: '1',
      caseNumber: 'CASE-001',
      title: 'Test Case 1',
      client: { id: 'client-1', name: 'Client A' },
      status: 'Active' as CaseStatus,
      type: 'Litigation',
      teamMembers: [{ id: 'user-1', firstName: 'John', lastName: 'Doe', role: 'Lead' }],
    },
    {
      id: '2',
      caseNumber: 'CASE-002',
      title: 'Test Case 2',
      client: { id: 'client-2', name: 'Client B' },
      status: 'Closed' as CaseStatus,
      type: 'Contract',
      teamMembers: [],
    },
  ];

  it('renders empty state when no cases provided', () => {
    const { container } = render(<CaseListTable cases={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders cases in table on desktop', () => {
    render(<CaseListTable cases={mockCases} />);

    // Check case numbers are displayed (both desktop table and mobile cards render)
    const caseNumbers = screen.getAllByText('CASE-001');
    expect(caseNumbers.length).toBeGreaterThanOrEqual(1);

    const caseNumbers2 = screen.getAllByText('CASE-002');
    expect(caseNumbers2.length).toBeGreaterThanOrEqual(1);

    // Check case titles are displayed
    const titles1 = screen.getAllByText('Test Case 1');
    expect(titles1.length).toBeGreaterThanOrEqual(1);

    const titles2 = screen.getAllByText('Test Case 2');
    expect(titles2.length).toBeGreaterThanOrEqual(1);

    // Check client names are displayed
    const clients1 = screen.getAllByText('Client A');
    expect(clients1.length).toBeGreaterThanOrEqual(1);

    const clients2 = screen.getAllByText('Client B');
    expect(clients2.length).toBeGreaterThanOrEqual(1);
  });

  it('displays correct status badges', () => {
    render(<CaseListTable cases={mockCases} />);

    const statusBadges = screen.getAllByText(/Active|Closed/);
    expect(statusBadges.length).toBeGreaterThan(0);
  });

  it('renders case types correctly', () => {
    render(<CaseListTable cases={mockCases} />);

    // Both desktop and mobile views render
    const litigationElements = screen.getAllByText('Litigation');
    expect(litigationElements.length).toBeGreaterThanOrEqual(1);

    const contractElements = screen.getAllByText('Contract');
    expect(contractElements.length).toBeGreaterThanOrEqual(1);
  });

  // Note: Additional tests should be added for:
  // - Click handlers and navigation
  // - Team member avatars and tooltips
  // - Mobile card view rendering
  // - Keyboard navigation
  // - Accessibility compliance
});
