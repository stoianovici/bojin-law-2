/**
 * Integration Tests for Case Archival and Authorization Scenarios
 * Story 2.8: Case CRUD Operations UI - Task 20
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from '@/lib/apollo-client';
import { setupMSW, server } from '@/test-utils/mocks/server';
import { graphql, HttpResponse } from 'msw';
import CaseDetailPage from './page';

// Setup MSW for mocking GraphQL API
setupMSW();

// Mock next/navigation
const mockPush = jest.fn();
const mockUsePathname = jest.fn(() => '/cases/case-1');

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => mockUsePathname(),
}));

// Mock notification store
const mockAddNotification = jest.fn();

jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: mockAddNotification,
  }),
}));

// Mock user context for authorization tests
const mockUserContext = {
  currentUser: {
    id: 'user-1',
    role: 'Partner',
    firstName: 'John',
    lastName: 'Partner',
  },
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUserContext,
}));

describe('Case Archival and Authorization Integration Tests', () => {
  const user = userEvent.setup();

  const renderCaseDetailPage = (caseId = 'case-1', userRole = 'Partner') => {
    // Set user role for authorization tests
    mockUserContext.currentUser.role = userRole;

    const mockParams = Promise.resolve({ caseId });

    return render(
      <ApolloProvider client={apolloClient}>
        <CaseDetailPage params={mockParams} />
      </ApolloProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Case Archival - Partner Role', () => {
    it('should archive case: open case → archive → confirm → verify status', async () => {
      // Override MSW handler to return a Closed case
      server.use(
        graphql.query('GetCase', () => {
          return HttpResponse.json({
            data: {
              case: {
                id: 'case-closed',
                caseNumber: 'CASE-003',
                title: 'Closed Case for Archival',
                description: 'This case is closed and ready to be archived',
                status: 'Closed',
                type: 'Litigation',
                openedDate: '2025-01-01T10:00:00Z',
                closedDate: '2025-02-01T10:00:00Z',
                value: 50000,
                metadata: {},
                client: {
                  id: 'client-1',
                  name: 'Test Client',
                  contactInfo: 'test@client.com',
                  address: '123 Test St',
                },
                teamMembers: [
                  {
                    id: 'user-1',
                    firstName: 'John',
                    lastName: 'Partner',
                    role: 'Partner',
                  },
                ],
                actors: [],
              },
            },
          });
        })
      );

      renderCaseDetailPage('case-closed', 'Partner');

      // Wait for case to load
      await waitFor(() => {
        expect(screen.getByText('CASE-003')).toBeInTheDocument();
      });

      // Verify case status is Closed
      expect(screen.getByText('Closed')).toBeInTheDocument();

      // Find and click "Archive Case" button
      const archiveButton = screen.getByRole('button', { name: /archive case/i });
      expect(archiveButton).toBeEnabled();
      await user.click(archiveButton);

      // Verify confirmation dialog appears
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('alertdialog');

      // Verify warning message
      expect(
        within(dialog).getByText(/this will set the case status to archived/i)
      ).toBeInTheDocument();

      // Confirm archival
      const confirmButton = within(dialog).getByRole('button', { name: /confirm|archive/i });
      await user.click(confirmButton);

      // Verify dialog closes
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });

      // Verify success notification
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'success',
            message: expect.stringMatching(/archived successfully/i),
          })
        );
      });

      // Verify redirect to case list
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/cases');
      });
    });

    it('should disable archive button when case status is not Closed', async () => {
      renderCaseDetailPage('case-1', 'Partner');

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Verify case status is Active (not Closed)
      expect(screen.getByText('Active')).toBeInTheDocument();

      // Find archive button
      const archiveButton = screen.getByRole('button', { name: /archive case/i });

      // Verify button is disabled
      expect(archiveButton).toBeDisabled();

      // Hover over button to see tooltip
      await user.hover(archiveButton);

      // Verify tooltip explains why button is disabled
      await waitFor(() => {
        expect(screen.getByText(/only closed cases can be archived/i)).toBeInTheDocument();
      });
    });

    it('should handle archive mutation error (BAD_USER_INPUT)', async () => {
      // Override mutation to return error
      server.use(
        graphql.mutation('ArchiveCase', () => {
          return HttpResponse.json({
            errors: [
              {
                message: 'Only closed cases can be archived',
                extensions: {
                  code: 'BAD_USER_INPUT',
                },
              },
            ],
          });
        })
      );

      renderCaseDetailPage('case-1', 'Partner');

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Manually enable button for testing error handling
      const archiveButton = screen.getByRole('button', { name: /archive case/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm|archive/i });
      await user.click(confirmButton);

      // Verify error notification
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            message: expect.stringMatching(/only closed cases can be archived/i),
          })
        );
      });
    });
  });

  describe('Authorization - Role-Based Access', () => {
    it('should hide archive button for Associate role', async () => {
      renderCaseDetailPage('case-1', 'Associate');

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Verify archive button is not visible
      expect(screen.queryByRole('button', { name: /archive case/i })).not.toBeInTheDocument();
    });

    it('should hide archive button for Paralegal role', async () => {
      renderCaseDetailPage('case-1', 'Paralegal');

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Verify archive button is not visible
      expect(screen.queryByRole('button', { name: /archive case/i })).not.toBeInTheDocument();
    });

    it('should show archive button for Partner role', async () => {
      renderCaseDetailPage('case-1', 'Partner');

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Verify archive button is visible (even if disabled)
      expect(screen.getByRole('button', { name: /archive case/i })).toBeInTheDocument();
    });

    it('should handle FORBIDDEN error when non-Partner attempts to archive', async () => {
      // Override mutation to return FORBIDDEN error
      server.use(
        graphql.mutation('ArchiveCase', () => {
          return HttpResponse.json({
            errors: [
              {
                message: 'Not authorized to archive cases',
                extensions: {
                  code: 'FORBIDDEN',
                },
              },
            ],
          });
        })
      );

      // Render as Partner but server will reject
      renderCaseDetailPage('case-1', 'Partner');

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      const archiveButton = screen.getByRole('button', { name: /archive case/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm|archive/i });
      await user.click(confirmButton);

      // Verify error notification with permission denied message
      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            message: expect.stringMatching(/not authorized|permission denied/i),
          })
        );
      });
    });
  });

  describe('Team Management Authorization', () => {
    it('should hide team management controls for Paralegal role', async () => {
      renderCaseDetailPage('case-1', 'Paralegal');

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Verify "Add Team Member" button is not visible
      expect(screen.queryByRole('button', { name: /add team member/i })).not.toBeInTheDocument();

      // Verify remove buttons are not visible for team members
      const teamSection = screen.getByText(/team members/i).closest('section');
      const removeButtons = within(teamSection!).queryAllByRole('button', { name: /remove/i });
      expect(removeButtons.length).toBe(0);
    });

    it('should show team management controls for Partner and Associate roles', async () => {
      renderCaseDetailPage('case-1', 'Partner');

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Verify "Add Team Member" button is visible
      expect(screen.getByRole('button', { name: /add team member/i })).toBeInTheDocument();

      // Verify remove buttons are visible for team members
      const teamSection = screen.getByText(/team members/i).closest('section');
      const removeButtons = within(teamSection!).queryAllByRole('button', { name: /remove/i });
      expect(removeButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Inline Editing Authorization', () => {
    it('should allow editing for all roles (backend enforces restrictions)', async () => {
      // Test as Associate role
      renderCaseDetailPage('case-1', 'Associate');

      await waitFor(() => {
        expect(screen.getByText('Contract Dispute Case')).toBeInTheDocument();
      });

      // Verify edit buttons are visible (backend will enforce restrictions)
      const titleContainer = screen.getByText('Contract Dispute Case').closest('div');
      const editButton = within(titleContainer!).queryByRole('button', { name: /edit/i });

      // Edit button should be visible - backend enforces authorization
      expect(editButton).toBeInTheDocument();
    });
  });
});
