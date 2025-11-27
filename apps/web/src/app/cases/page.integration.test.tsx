/**
 * Integration Tests for Case List Page - Case Creation Flow
 * Story 2.8: Case CRUD Operations UI - Task 20
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from '@/lib/apollo-client';
import { setupMSW } from '@/test-utils/mocks/server';
import CasesPage from './page';

// Setup MSW for mocking GraphQL API
setupMSW();

// Mock next/navigation
const mockPush = jest.fn();
const mockUsePathname = jest.fn(() => '/cases');
const mockUseSearchParams = jest.fn(() => new URLSearchParams());

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

// Mock Zustand stores
jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: jest.fn(),
  }),
}));

jest.mock('@/stores/caseFiltersStore', () => ({
  useCaseFiltersStore: () => ({
    status: null,
    clientId: null,
    assignedToMe: false,
    setStatus: jest.fn(),
    setClientId: jest.fn(),
    setAssignedToMe: jest.fn(),
    clearFilters: jest.fn(),
    setFromURLParams: jest.fn(),
    toURLParams: jest.fn(() => new URLSearchParams()),
  }),
}));

describe('Case Creation Flow Integration Test', () => {
  const user = userEvent.setup();

  const renderCasesPage = () => {
    return render(
      <ApolloProvider client={apolloClient}>
        <CasesPage />
      </ApolloProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should complete full case creation flow: open modal → fill form → submit → verify in list', async () => {
    renderCasesPage();

    // Wait for cases to load
    await waitFor(() => {
      expect(screen.getByText('CASE-001')).toBeInTheDocument();
    });

    // Step 1: Open create case modal
    const newCaseButton = screen.getByRole('button', { name: /new case/i });
    await user.click(newCaseButton);

    // Verify modal is open
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/create new case/i)).toBeInTheDocument();
    });

    // Step 2: Fill form fields
    const dialog = screen.getByRole('dialog');

    // Fill title
    const titleInput = within(dialog).getByLabelText(/title/i);
    await user.type(titleInput, 'New Contract Case');

    // Fill description
    const descriptionInput = within(dialog).getByLabelText(/description/i);
    await user.type(descriptionInput, 'This is a new contract case for testing purposes');

    // Select case type
    const typeSelect = within(dialog).getByLabelText(/case type/i);
    await user.click(typeSelect);
    await user.click(screen.getByRole('option', { name: /contract/i }));

    // Fill client ID (UUID format for mocked backend)
    const clientInput = within(dialog).getByLabelText(/client/i);
    await user.type(clientInput, 'client-123');

    // Fill optional value
    const valueInput = within(dialog).getByLabelText(/value/i);
    await user.type(valueInput, '75000');

    // Step 3: Submit form
    const submitButton = within(dialog).getByRole('button', { name: /create case/i });
    await user.click(submitButton);

    // Step 4: Verify modal closes and new case appears in list
    await waitFor(
      () => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify new case appears in the list
    await waitFor(
      () => {
        expect(screen.getByText('New Contract Case')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify case details are displayed
    expect(screen.getByText('Contract')).toBeInTheDocument();
  });

  it('should show validation errors when form is submitted with invalid data', async () => {
    renderCasesPage();

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText('CASE-001')).toBeInTheDocument();
    });

    // Open modal
    const newCaseButton = screen.getByRole('button', { name: /new case/i });
    await user.click(newCaseButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');

    // Try to submit without filling required fields
    const submitButton = within(dialog).getByRole('button', { name: /create case/i });
    await user.click(submitButton);

    // Verify validation errors are displayed
    await waitFor(() => {
      expect(screen.getByText(/title is required|title must be at least/i)).toBeInTheDocument();
    });
  });

  it('should close modal without submitting when cancel button is clicked', async () => {
    renderCasesPage();

    await waitFor(() => {
      expect(screen.getByText('CASE-001')).toBeInTheDocument();
    });

    // Open modal
    const newCaseButton = screen.getByRole('button', { name: /new case/i });
    await user.click(newCaseButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Start filling form
    const dialog = screen.getByRole('dialog');
    const titleInput = within(dialog).getByLabelText(/title/i);
    await user.type(titleInput, 'Abandoned Case');

    // Click cancel
    const cancelButton = within(dialog).getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Verify modal is closed
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Verify case was not created
    expect(screen.queryByText('Abandoned Case')).not.toBeInTheDocument();
  });

  it('should display error notification when case creation fails', async () => {
    // TODO: Implement after setting up error scenario in MSW handlers
    // This would test GraphQL mutation error handling
  });
});
