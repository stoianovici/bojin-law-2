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

    // Check case numbers are displayed
    expect(screen.getByText('CASE-001')).toBeInTheDocument();
    expect(screen.getByText('CASE-002')).toBeInTheDocument();

    // Check case titles are displayed
    expect(screen.getByText('Test Case 1')).toBeInTheDocument();
    expect(screen.getByText('Test Case 2')).toBeInTheDocument();

    // Check client names are displayed
    expect(screen.getByText('Client A')).toBeInTheDocument();
    expect(screen.getByText('Client B')).toBeInTheDocument();
  });

  it('displays correct status badges', () => {
    render(<CaseListTable cases={mockCases} />);

    const statusBadges = screen.getAllByText(/Active|Closed/);
    expect(statusBadges.length).toBeGreaterThan(0);
  });

  it('renders case types correctly', () => {
    render(<CaseListTable cases={mockCases} />);

    expect(screen.getByText('Litigation')).toBeInTheDocument();
    expect(screen.getByText('Contract')).toBeInTheDocument();
  });

  // Note: Additional tests should be added for:
  // - Click handlers and navigation
  // - Team member avatars and tooltips
  // - Mobile card view rendering
  // - Keyboard navigation
  // - Accessibility compliance
});
