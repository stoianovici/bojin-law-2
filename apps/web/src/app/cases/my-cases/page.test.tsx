/**
 * Unit Tests for My Cases Page
 * Story 2.8.2: Case Approval Workflow - Task 27
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import MyCasesPage from './page';
import { useMyCases } from '../../../hooks/useMyCases';

// Mock hooks
jest.mock('../../../hooks/useMyCases');

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

describe('MyCasesPage', () => {
  const mockRefetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading spinner when loading', () => {
    (useMyCases as jest.Mock).mockReturnValue({
      cases: [],
      loading: true,
      error: undefined,
      refetch: mockRefetch,
    });

    const { container } = render(<MyCasesPage />);

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows error message when error occurs', () => {
    (useMyCases as jest.Mock).mockReturnValue({
      cases: [],
      loading: false,
      error: new Error('Failed to load cases'),
      refetch: mockRefetch,
    });

    render(<MyCasesPage />);

    expect(screen.getByText('Error loading cases')).toBeInTheDocument();
    expect(screen.getByText('Failed to load cases')).toBeInTheDocument();
  });

  it('shows empty state when no cases', () => {
    (useMyCases as jest.Mock).mockReturnValue({
      cases: [],
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    });

    render(<MyCasesPage />);

    expect(screen.getByText('No cases found')).toBeInTheDocument();
    expect(screen.getByText("You haven't created any cases yet.")).toBeInTheDocument();
  });

  it('displays cases in table format', () => {
    (useMyCases as jest.Mock).mockReturnValue({
      cases: [
        {
          id: '1',
          caseNumber: 'CASE-001',
          title: 'Test Case 1',
          status: 'Active',
          type: 'Litigation',
          description: 'Test description',
          openedDate: '2025-01-15T00:00:00.000Z',
          client: {
            id: 'client-1',
            name: 'Test Client',
          },
          approval: null,
        },
        {
          id: '2',
          caseNumber: 'CASE-002',
          title: 'Test Case 2',
          status: 'PendingApproval',
          type: 'Contract',
          description: 'Test description 2',
          openedDate: '2025-01-16T00:00:00.000Z',
          client: {
            id: 'client-2',
            name: 'Another Client',
          },
          approval: {
            id: 'approval-1',
            submittedAt: '2025-01-16T10:00:00.000Z',
            status: 'Pending',
            revisionCount: 0,
          },
        },
      ],
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    });

    render(<MyCasesPage />);

    expect(screen.getByText('Test Case 1')).toBeInTheDocument();
    expect(screen.getByText('CASE-001')).toBeInTheDocument();
    expect(screen.getByText('Test Client')).toBeInTheDocument();

    expect(screen.getByText('Test Case 2')).toBeInTheDocument();
    expect(screen.getByText('CASE-002')).toBeInTheDocument();
    expect(screen.getByText('Another Client')).toBeInTheDocument();
  });

  it('shows "Awaiting Approval" badge for pending cases', () => {
    (useMyCases as jest.Mock).mockReturnValue({
      cases: [
        {
          id: '1',
          caseNumber: 'CASE-001',
          title: 'Pending Case',
          status: 'PendingApproval',
          type: 'Litigation',
          description: 'Test description',
          openedDate: '2025-01-15T00:00:00.000Z',
          client: { id: 'client-1', name: 'Test Client' },
          approval: {
            id: 'approval-1',
            submittedAt: '2025-01-15T10:00:00.000Z',
            status: 'Pending',
            revisionCount: 0,
          },
        },
      ],
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    });

    render(<MyCasesPage />);

    expect(screen.getByText('Awaiting Approval')).toBeInTheDocument();
  });

  it('shows "Needs Revision" badge for rejected cases', () => {
    (useMyCases as jest.Mock).mockReturnValue({
      cases: [
        {
          id: '1',
          caseNumber: 'CASE-001',
          title: 'Rejected Case',
          status: 'PendingApproval',
          type: 'Litigation',
          description: 'Test description',
          openedDate: '2025-01-15T00:00:00.000Z',
          client: { id: 'client-1', name: 'Test Client' },
          approval: {
            id: 'approval-1',
            submittedAt: '2025-01-15T10:00:00.000Z',
            status: 'Rejected',
            rejectionReason: 'Missing client information',
            revisionCount: 1,
          },
        },
      ],
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    });

    render(<MyCasesPage />);

    expect(screen.getByText('Needs Revision')).toBeInTheDocument();
  });

  it('shows "Active" badge for active cases', () => {
    (useMyCases as jest.Mock).mockReturnValue({
      cases: [
        {
          id: '1',
          caseNumber: 'CASE-001',
          title: 'Active Case',
          status: 'Active',
          type: 'Litigation',
          description: 'Test description',
          openedDate: '2025-01-15T00:00:00.000Z',
          client: { id: 'client-1', name: 'Test Client' },
          approval: null,
        },
      ],
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    });

    render(<MyCasesPage />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows revision count badge for rejected cases', () => {
    (useMyCases as jest.Mock).mockReturnValue({
      cases: [
        {
          id: '1',
          caseNumber: 'CASE-001',
          title: 'Rejected Case',
          status: 'PendingApproval',
          type: 'Litigation',
          description: 'Test description',
          openedDate: '2025-01-15T00:00:00.000Z',
          client: { id: 'client-1', name: 'Test Client' },
          approval: {
            id: 'approval-1',
            submittedAt: '2025-01-15T10:00:00.000Z',
            status: 'Rejected',
            rejectionReason: 'Needs more details',
            revisionCount: 3,
          },
        },
      ],
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    });

    render(<MyCasesPage />);

    expect(screen.getByText('Revision #3')).toBeInTheDocument();
  });

  it('shows rejection reason inline for rejected cases', () => {
    (useMyCases as jest.Mock).mockReturnValue({
      cases: [
        {
          id: '1',
          caseNumber: 'CASE-001',
          title: 'Rejected Case',
          status: 'PendingApproval',
          type: 'Litigation',
          description: 'Test description',
          openedDate: '2025-01-15T00:00:00.000Z',
          client: { id: 'client-1', name: 'Test Client' },
          approval: {
            id: 'approval-1',
            submittedAt: '2025-01-15T10:00:00.000Z',
            status: 'Rejected',
            rejectionReason: 'Please add more details about the client',
            revisionCount: 1,
          },
        },
      ],
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    });

    render(<MyCasesPage />);

    expect(screen.getByText(/Please add more details about the client/)).toBeInTheDocument();
    expect(screen.getByText(/Reason:/)).toBeInTheDocument();
  });

  it('shows View Details link for each case', () => {
    (useMyCases as jest.Mock).mockReturnValue({
      cases: [
        {
          id: 'case-123',
          caseNumber: 'CASE-001',
          title: 'Test Case',
          status: 'Active',
          type: 'Litigation',
          description: 'Test description',
          openedDate: '2025-01-15T00:00:00.000Z',
          client: { id: 'client-1', name: 'Test Client' },
          approval: null,
        },
      ],
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    });

    render(<MyCasesPage />);

    const link = screen.getByText('View Details') as HTMLAnchorElement;
    expect(link).toBeInTheDocument();
    expect(link.href).toContain('/cases/case-123');
  });

  it('displays submitted date from approval if available', () => {
    (useMyCases as jest.Mock).mockReturnValue({
      cases: [
        {
          id: '1',
          caseNumber: 'CASE-001',
          title: 'Test Case',
          status: 'PendingApproval',
          type: 'Litigation',
          description: 'Test description',
          openedDate: '2025-01-10T00:00:00.000Z',
          client: { id: 'client-1', name: 'Test Client' },
          approval: {
            id: 'approval-1',
            submittedAt: '2025-01-15T10:00:00.000Z',
            status: 'Pending',
            revisionCount: 0,
          },
        },
      ],
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    });

    render(<MyCasesPage />);

    // The date should be formatted as "Jan 15, 2025"
    expect(screen.getByText(/Jan 15, 2025/)).toBeInTheDocument();
  });

  it('displays opened date if no approval submission date', () => {
    (useMyCases as jest.Mock).mockReturnValue({
      cases: [
        {
          id: '1',
          caseNumber: 'CASE-001',
          title: 'Test Case',
          status: 'Active',
          type: 'Litigation',
          description: 'Test description',
          openedDate: '2025-01-10T00:00:00.000Z',
          client: { id: 'client-1', name: 'Test Client' },
          approval: null,
        },
      ],
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    });

    render(<MyCasesPage />);

    // The date should be formatted as "Jan 10, 2025"
    expect(screen.getByText(/Jan 10, 2025/)).toBeInTheDocument();
  });
});
