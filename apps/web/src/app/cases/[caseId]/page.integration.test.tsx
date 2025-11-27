/**
 * Integration Tests for Case Detail Page - Data Loading and Inline Editing
 * Story 2.8: Case CRUD Operations UI - Task 20
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from '@/lib/apollo-client';
import { setupMSW } from '@/test-utils/mocks/server';
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

// Mock Zustand notification store
jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: jest.fn(),
  }),
}));

describe('Case Detail Page Integration Tests', () => {
  const user = userEvent.setup();

  const renderCaseDetailPage = (caseId = 'case-1') => {
    // Mock params for Next.js 15 App Router
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

  describe('Case Detail Data Loading', () => {
    it('should load and display case details with all related data', async () => {
      renderCaseDetailPage('case-1');

      // Wait for case data to load
      await waitFor(
        () => {
          expect(screen.getByText('CASE-001')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Verify case title
      expect(screen.getByText('Contract Dispute Case')).toBeInTheDocument();

      // Verify case status
      expect(screen.getByText('Active')).toBeInTheDocument();

      // Verify case type
      expect(screen.getByText('Litigation')).toBeInTheDocument();

      // Verify client information
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();

      // Verify description
      expect(screen.getByText('Client contract dispute over terms')).toBeInTheDocument();

      // Verify team members section exists
      expect(screen.getByText(/team members/i)).toBeInTheDocument();

      // Verify case actors section exists
      expect(screen.getByText(/case actors/i)).toBeInTheDocument();
    });

    it('should display loading state while fetching case data', async () => {
      renderCaseDetailPage('case-1');

      // Verify loading skeleton or spinner is displayed
      // Note: Adjust selector based on actual loading component implementation
      expect(screen.getByTestId('loading-skeleton') || screen.getByText(/loading/i)).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });
    });

    it('should handle case not found (404) gracefully', async () => {
      renderCaseDetailPage('non-existent-case');

      await waitFor(
        () => {
          expect(screen.getByText(/case not found|not found/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Inline Editing', () => {
    it('should edit case title: click field → edit → save → verify update', async () => {
      renderCaseDetailPage('case-1');

      // Wait for case to load
      await waitFor(() => {
        expect(screen.getByText('Contract Dispute Case')).toBeInTheDocument();
      });

      // Find the title field (look for edit button or pencil icon)
      const titleContainer = screen.getByText('Contract Dispute Case').closest('div');
      expect(titleContainer).toBeInTheDocument();

      // Click to enter edit mode
      const editButton = within(titleContainer!).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Verify input field appears
      const titleInput = await waitFor(() => within(titleContainer!).getByRole('textbox'));

      // Clear and type new title
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Contract Dispute Case');

      // Save changes (press Enter or click save button)
      await user.keyboard('{Enter}');

      // Verify update is reflected
      await waitFor(() => {
        expect(screen.getByText('Updated Contract Dispute Case')).toBeInTheDocument();
      });
    });

    it('should cancel inline edit when Escape key is pressed', async () => {
      renderCaseDetailPage('case-1');

      await waitFor(() => {
        expect(screen.getByText('Contract Dispute Case')).toBeInTheDocument();
      });

      const titleContainer = screen.getByText('Contract Dispute Case').closest('div');
      const editButton = within(titleContainer!).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      const titleInput = await waitFor(() => within(titleContainer!).getByRole('textbox'));
      await user.clear(titleInput);
      await user.type(titleInput, 'Should Not Save');

      // Press Escape to cancel
      await user.keyboard('{Escape}');

      // Verify original title is still displayed
      await waitFor(() => {
        expect(screen.getByText('Contract Dispute Case')).toBeInTheDocument();
      });

      // Verify edited text is not saved
      expect(screen.queryByText('Should Not Save')).not.toBeInTheDocument();
    });

    it('should validate field changes before submission', async () => {
      renderCaseDetailPage('case-1');

      await waitFor(() => {
        expect(screen.getByText('Contract Dispute Case')).toBeInTheDocument();
      });

      const titleContainer = screen.getByText('Contract Dispute Case').closest('div');
      const editButton = within(titleContainer!).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      const titleInput = await waitFor(() => within(titleContainer!).getByRole('textbox'));

      // Try to submit empty title (should fail validation)
      await user.clear(titleInput);
      await user.keyboard('{Enter}');

      // Verify validation error is displayed
      await waitFor(() => {
        expect(screen.getByText(/title is required|title must be at least/i)).toBeInTheDocument();
      });

      // Verify field is still in edit mode
      expect(titleInput).toBeInTheDocument();
    });

    it('should revert changes on mutation error', async () => {
      // TODO: Implement after setting up error scenario in MSW handlers
      // This would test optimistic update rollback on GraphQL error
    });
  });

  describe('Team Management', () => {
    it('should add a team member to the case', async () => {
      renderCaseDetailPage('case-1');

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Find and click "Add Team Member" button
      const addButton = screen.getByRole('button', { name: /add team member/i });
      await user.click(addButton);

      // Verify modal/dialog appears
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');

      // Fill user ID
      const userInput = within(dialog).getByLabelText(/user|member/i);
      await user.type(userInput, 'user-3');

      // Select role
      const roleSelect = within(dialog).getByLabelText(/role/i);
      await user.click(roleSelect);
      await user.click(screen.getByRole('option', { name: /support/i }));

      // Submit
      const submitButton = within(dialog).getByRole('button', { name: /add|assign/i });
      await user.click(submitButton);

      // Verify modal closes
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Verify success notification
      // Note: This depends on notification implementation
    });

    it('should remove a team member with confirmation', async () => {
      renderCaseDetailPage('case-1');

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Find a team member and click remove button
      const teamSection = screen.getByText(/team members/i).closest('section');
      const removeButton = within(teamSection!).getByRole('button', { name: /remove/i });
      await user.click(removeButton);

      // Verify confirmation dialog appears
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Confirm removal
      const confirmButton = screen.getByRole('button', { name: /confirm|yes|remove/i });
      await user.click(confirmButton);

      // Verify confirmation dialog closes
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Case Actors Management', () => {
    it('should add a case actor', async () => {
      renderCaseDetailPage('case-1');

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Find and click "Add Actor" button
      const addButton = screen.getByRole('button', { name: /add actor/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');

      // Fill actor details
      await user.type(within(dialog).getByLabelText(/name/i), 'Jane Smith');
      await user.type(within(dialog).getByLabelText(/organization/i), 'Smith & Co');
      await user.type(within(dialog).getByLabelText(/email/i), 'jane@smith.com');

      // Select role
      const roleSelect = within(dialog).getByLabelText(/role/i);
      await user.click(roleSelect);
      await user.click(screen.getByRole('option', { name: /opposing counsel/i }));

      // Submit
      const submitButton = within(dialog).getByRole('button', { name: /add/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should update actor details inline', async () => {
      renderCaseDetailPage('case-1');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Find actor and click edit
      const actorContainer = screen.getByText('John Doe').closest('div');
      const editButton = within(actorContainer!).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Update email
      const emailInput = within(actorContainer!).getByLabelText(/email/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'john.doe@updated.com');

      // Save
      const saveButton = within(actorContainer!).getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('john.doe@updated.com')).toBeInTheDocument();
      });
    });
  });
});
