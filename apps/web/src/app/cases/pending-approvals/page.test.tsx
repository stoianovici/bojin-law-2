/**
 * Pending Approvals Queue Page Tests
 * Story 2.8.2: Case Approval Workflow - Task 15
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import PendingApprovalsPage from './page';

// Mock useAuth hook (used by useAuthorization)
jest.mock('../../../lib/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

// Mock usePendingCases hook
jest.mock('../../../hooks/usePendingCases', () => ({
  usePendingCases: jest.fn(),
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

const mockUseAuth = require('../../../lib/hooks/useAuth').useAuth;
const mockUsePendingCases = require('../../../hooks/usePendingCases').usePendingCases;

describe('PendingApprovalsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authorization', () => {
    it('should show access restricted message for non-Partners', () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'Associate' },
        isLoading: false,
      });

      mockUsePendingCases.mockReturnValue({
        cases: [],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<PendingApprovalsPage />);

      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(
        screen.getByText(/This page is only accessible to Partners/i)
      ).toBeInTheDocument();
    });

    it('should show page content for Partners', () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'Partner' },
        isLoading: false,
      });

      mockUsePendingCases.mockReturnValue({
        cases: [],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<PendingApprovalsPage />);

      expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
      expect(
        screen.getByText(/Review and approve cases submitted by Associates/i)
      ).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner while fetching cases', () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'Partner' },
        isLoading: false,
      });

      mockUsePendingCases.mockReturnValue({
        cases: [],
        loading: true,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<PendingApprovalsPage />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when query fails', () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'Partner' },
        isLoading: false,
      });

      mockUsePendingCases.mockReturnValue({
        cases: [],
        loading: false,
        error: new Error('Failed to fetch pending cases'),
        refetch: jest.fn(),
      });

      render(<PendingApprovalsPage />);

      expect(screen.getByText('Error loading pending cases')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch pending cases')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no pending cases', () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'Partner' },
        isLoading: false,
      });

      mockUsePendingCases.mockReturnValue({
        cases: [],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<PendingApprovalsPage />);

      expect(screen.getByText('No cases pending approval')).toBeInTheDocument();
      expect(
        screen.getByText(/All submitted cases have been reviewed/i)
      ).toBeInTheDocument();
    });
  });

  describe('Cases List', () => {
    it('should display pending cases in table format', () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'Partner' },
        isLoading: false,
      });

      const mockCases = [
        {
          id: '1',
          caseNumber: 'CASE-001',
          title: 'Contract Dispute',
          status: 'PendingApproval',
          type: 'Litigation',
          description: 'Client contract dispute',
          openedDate: '2024-01-15',
          client: {
            id: 'client-1',
            name: 'Acme Corp',
          },
          approval: {
            id: 'approval-1',
            submittedBy: {
              id: 'user-1',
              firstName: 'John',
              lastName: 'Doe',
            },
            submittedAt: '2024-01-15T10:00:00Z',
            reviewedBy: null,
            reviewedAt: null,
            status: 'Pending',
            rejectionReason: null,
            revisionCount: 0,
          },
        },
      ];

      mockUsePendingCases.mockReturnValue({
        cases: mockCases,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<PendingApprovalsPage />);

      expect(screen.getByText('Contract Dispute')).toBeInTheDocument();
      expect(screen.getByText('CASE-001')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('1 Pending')).toBeInTheDocument();
    });

    it('should display revision count badge when case has revisions', () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'Partner' },
        isLoading: false,
      });

      const mockCases = [
        {
          id: '1',
          caseNumber: 'CASE-001',
          title: 'Contract Dispute',
          status: 'PendingApproval',
          type: 'Litigation',
          description: 'Client contract dispute',
          openedDate: '2024-01-15',
          client: {
            id: 'client-1',
            name: 'Acme Corp',
          },
          approval: {
            id: 'approval-1',
            submittedBy: {
              id: 'user-1',
              firstName: 'John',
              lastName: 'Doe',
            },
            submittedAt: '2024-01-15T10:00:00Z',
            reviewedBy: null,
            reviewedAt: null,
            status: 'Pending',
            rejectionReason: null,
            revisionCount: 2,
          },
        },
      ];

      mockUsePendingCases.mockReturnValue({
        cases: mockCases,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<PendingApprovalsPage />);

      expect(screen.getByText('Revision #2')).toBeInTheDocument();
    });

    it('should show Review button for each pending case', () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'Partner' },
        isLoading: false,
      });

      const mockCases = [
        {
          id: '1',
          caseNumber: 'CASE-001',
          title: 'Contract Dispute',
          status: 'PendingApproval',
          type: 'Litigation',
          description: 'Client contract dispute',
          openedDate: '2024-01-15',
          client: {
            id: 'client-1',
            name: 'Acme Corp',
          },
          approval: {
            id: 'approval-1',
            submittedBy: {
              id: 'user-1',
              firstName: 'John',
              lastName: 'Doe',
            },
            submittedAt: '2024-01-15T10:00:00Z',
            reviewedBy: null,
            reviewedAt: null,
            status: 'Pending',
            rejectionReason: null,
            revisionCount: 0,
          },
        },
      ];

      mockUsePendingCases.mockReturnValue({
        cases: mockCases,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<PendingApprovalsPage />);

      expect(screen.getByRole('button', { name: /review/i })).toBeInTheDocument();
    });
  });

  describe('Table Structure', () => {
    it('should have correct table headers', () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'Partner' },
        isLoading: false,
      });

      mockUsePendingCases.mockReturnValue({
        cases: [],
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<PendingApprovalsPage />);

      // Empty state is shown, so no table headers
      expect(screen.queryByText('CASE TITLE')).not.toBeInTheDocument();
    });

    it('should show table headers when cases exist', () => {
      mockUseAuth.mockReturnValue({
        user: { role: 'Partner' },
        isLoading: false,
      });

      const mockCases = [
        {
          id: '1',
          caseNumber: 'CASE-001',
          title: 'Contract Dispute',
          status: 'PendingApproval',
          type: 'Litigation',
          description: 'Client contract dispute',
          openedDate: '2024-01-15',
          client: {
            id: 'client-1',
            name: 'Acme Corp',
          },
          approval: {
            id: 'approval-1',
            submittedBy: {
              id: 'user-1',
              firstName: 'John',
              lastName: 'Doe',
            },
            submittedAt: '2024-01-15T10:00:00Z',
            reviewedBy: null,
            reviewedAt: null,
            status: 'Pending',
            rejectionReason: null,
            revisionCount: 0,
          },
        },
      ];

      mockUsePendingCases.mockReturnValue({
        cases: mockCases,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      });

      render(<PendingApprovalsPage />);

      // Check that table headers exist by looking for column headers
      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBe(6);
      expect(screen.getByRole('columnheader', { name: /case title/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /client name/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /submitted by/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /submitted date/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /revision/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /actions/i })).toBeInTheDocument();
    });
  });
});
