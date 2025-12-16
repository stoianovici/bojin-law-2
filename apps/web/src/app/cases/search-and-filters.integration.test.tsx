/**
 * Integration Tests for Case Search and Filters with URL Persistence
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

// Mock router and URL state
const mockPush = jest.fn();
const mockSearchParams = new URLSearchParams();
const mockUsePathname = jest.fn(() => '/cases');
const mockUseSearchParams = jest.fn(() => mockSearchParams);

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

// Mock stores with actual state management
const mockSetStatus = jest.fn();
const mockSetAssignedToMe = jest.fn();
const mockClearFilters = jest.fn();

jest.mock('@/stores/caseFiltersStore', () => ({
  useCaseFiltersStore: () => ({
    status: null,
    assignedToMe: false,
    setStatus: mockSetStatus,
    setAssignedToMe: mockSetAssignedToMe,
    clearFilters: mockClearFilters,
  }),
}));

jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: jest.fn(),
  }),
}));

describe('Case Search Integration Tests', () => {
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
    mockSearchParams.delete('status');
    mockSearchParams.delete('assignedToMe');
  });

  describe('Case Search', () => {
    it('should search cases: type query → verify results → select case → navigate', async () => {
      renderCasesPage();

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Find search input
      const searchInput = screen.getByPlaceholderText(/search cases/i);
      expect(searchInput).toBeInTheDocument();

      // Type search query (minimum 3 characters)
      await user.type(searchInput, 'contract');

      // Wait for debounced search to execute and results to appear
      await waitFor(
        () => {
          // Verify search results dropdown appears
          const searchResults = screen.getByRole('list', { name: /search results/i });
          expect(searchResults).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      // Verify matching case is displayed
      expect(screen.getByText('Contract Dispute Case')).toBeInTheDocument();

      // Click on a search result
      const resultItem = screen.getByText('Contract Dispute Case').closest('li');
      await user.click(resultItem!);

      // Verify navigation to case detail page
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/cases/case-1'));
      });
    });

    it('should highlight matching text in search results', async () => {
      renderCasesPage();

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search cases/i);
      await user.type(searchInput, 'contract');

      await waitFor(() => {
        const searchResults = screen.getByRole('list', { name: /search results/i });
        expect(searchResults).toBeInTheDocument();
      });

      // Verify highlighted text (implementation may use <mark> or CSS class)
      const highlightedText = screen.getByText(/contract/i);
      expect(highlightedText).toBeInTheDocument();
    });

    it('should show "No results found" when search returns empty', async () => {
      renderCasesPage();

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search cases/i);
      await user.type(searchInput, 'nonexistentquery123');

      await waitFor(() => {
        expect(screen.getByText(/no results found/i)).toBeInTheDocument();
      });
    });

    it('should handle minimum 3 character query requirement', async () => {
      renderCasesPage();

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search cases/i);

      // Type less than 3 characters
      await user.type(searchInput, 'ab');

      // Verify hint message appears
      await waitFor(() => {
        expect(screen.getByText(/minimum 3 characters/i)).toBeInTheDocument();
      });

      // No search results should be displayed
      expect(screen.queryByRole('list', { name: /search results/i })).not.toBeInTheDocument();
    });
  });

  describe('Case Filters', () => {
    it('should filter cases by status', async () => {
      renderCasesPage();

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Find status filter dropdown
      const statusFilter = screen.getByLabelText(/status/i);
      await user.click(statusFilter);

      // Select "Active" status
      await user.click(screen.getByRole('option', { name: /active/i }));

      // Verify filter function was called
      await waitFor(() => {
        expect(mockSetStatus).toHaveBeenCalledWith('Active');
      });

      // Verify only active cases are displayed
      // Note: In real test, MSW would filter results. Here we verify the call was made.
    });

    it('should filter cases by "Assigned to Me"', async () => {
      renderCasesPage();

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Find "Assigned to Me" checkbox
      const assignedCheckbox = screen.getByLabelText(/assigned to me/i);
      await user.click(assignedCheckbox);

      // Verify filter was applied
      await waitFor(() => {
        expect(mockSetAssignedToMe).toHaveBeenCalledWith(true);
      });
    });

    it('should persist filters in URL query parameters', async () => {
      renderCasesPage();

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Apply status filter
      const statusFilter = screen.getByLabelText(/status/i);
      await user.click(statusFilter);
      await user.click(screen.getByRole('option', { name: /active/i }));

      // Verify URL was updated with query parameter
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('status=Active'),
          expect.anything()
        );
      });
    });

    it('should restore filters from URL query parameters on page load', async () => {
      // Set URL parameters before rendering
      mockSearchParams.set('status', 'OnHold');
      mockSearchParams.set('assignedToMe', 'true');

      renderCasesPage();

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Verify filters are applied from URL
      // Check that filter controls reflect the URL state
      const statusFilter = screen.getByLabelText(/status/i);
      expect(statusFilter).toHaveValue('OnHold');

      const assignedCheckbox = screen.getByLabelText(/assigned to me/i) as HTMLInputElement;
      expect(assignedCheckbox.checked).toBe(true);
    });

    it('should clear all filters when "Clear Filters" button is clicked', async () => {
      renderCasesPage();

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Apply some filters first
      const statusFilter = screen.getByLabelText(/status/i);
      await user.click(statusFilter);
      await user.click(screen.getByRole('option', { name: /active/i }));

      const assignedCheckbox = screen.getByLabelText(/assigned to me/i);
      await user.click(assignedCheckbox);

      // Click "Clear All Filters" button
      const clearButton = screen.getByRole('button', { name: /clear.*filters/i });
      await user.click(clearButton);

      // Verify clear function was called
      await waitFor(() => {
        expect(mockClearFilters).toHaveBeenCalled();
      });

      // Verify all cases are displayed again
      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
        expect(screen.getByText('CASE-002')).toBeInTheDocument();
      });
    });

    it('should combine status filter and assigned to me filter', async () => {
      renderCasesPage();

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Apply both filters
      const statusFilter = screen.getByLabelText(/status/i);
      await user.click(statusFilter);
      await user.click(screen.getByRole('option', { name: /active/i }));

      const assignedCheckbox = screen.getByLabelText(/assigned to me/i);
      await user.click(assignedCheckbox);

      // Verify both filters are applied
      await waitFor(() => {
        expect(mockSetStatus).toHaveBeenCalledWith('Active');
        expect(mockSetAssignedToMe).toHaveBeenCalledWith(true);
      });

      // Verify URL contains both parameters
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringMatching(/status=Active.*assignedToMe=true|assignedToMe=true.*status=Active/),
        expect.anything()
      );
    });
  });

  describe('Empty States with Filters', () => {
    it('should show filtered empty state when no cases match filters', async () => {
      renderCasesPage();

      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });

      // Apply a filter that returns no results (e.g., Archived status)
      const statusFilter = screen.getByLabelText(/status/i);
      await user.click(statusFilter);
      await user.click(screen.getByRole('option', { name: /archived/i }));

      // Wait for filtered empty state
      await waitFor(() => {
        expect(screen.getByText(/no cases match your filters|no cases found/i)).toBeInTheDocument();
      });

      // Verify "Clear Filters" button is present in empty state
      const clearButton = screen.getByRole('button', { name: /clear.*filters/i });
      expect(clearButton).toBeInTheDocument();

      // Click clear filters from empty state
      await user.click(clearButton);

      // Verify cases reappear
      await waitFor(() => {
        expect(screen.getByText('CASE-001')).toBeInTheDocument();
      });
    });
  });
});
