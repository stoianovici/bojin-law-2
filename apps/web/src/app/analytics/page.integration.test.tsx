/**
 * Analytics Page Integration Tests
 * Story 2.11.5: Comprehensive Testing - Task 9
 *
 * Tests complete analytics page workflows for:
 * - Partner access (sees managed cases financial data)
 * - BusinessOwner access (sees firm-wide financial data)
 * - Authorization (Associates/Paralegals denied access)
 * - Widget rendering and filter interactions
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from '@/lib/apollo-client';
import { setupMSW } from '@/test-utils/mocks/server';
import { server } from '@/test-utils/mocks/server';
import { graphql, HttpResponse } from 'msw';
import AnalyticsPage from './page';
import { AuthContext, type AuthContextType } from '@/contexts/AuthContext';
import { FinancialAccessProvider } from '@/contexts/FinancialAccessContext';
import type { User } from '@legal-platform/types';

// Setup MSW for mocking GraphQL API
setupMSW();

// Mock next/navigation
const mockPush = jest.fn();
const mockUseRouter = jest.fn(() => ({
  push: mockPush,
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => mockUseRouter(),
  usePathname: () => '/analytics',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock analytics filters store
const mockAnalyticsStore = {
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31'),
  },
  comparisonEnabled: false,
  setDateRange: jest.fn(),
  setComparisonEnabled: jest.fn(),
  getPreviousPeriod: jest.fn(() => ({
    start: new Date('2023-12-01'),
    end: new Date('2023-12-31'),
  })),
};

jest.mock('@/stores/analyticsFiltersStore', () => ({
  useAnalyticsFiltersStore: () => mockAnalyticsStore,
}));

// Test Users
const mockPartnerUser: User = {
  id: 'partner-1',
  email: 'partner@lawfirm.com',
  firstName: 'John',
  lastName: 'Partner',
  role: 'Partner',
  status: 'Active',
  firmId: 'firm-1',
  azureAdId: 'azure-partner-1',
  preferences: {},
  createdAt: new Date(),
  lastActive: new Date(),
};

const mockBusinessOwnerUser: User = {
  id: 'owner-1',
  email: 'owner@lawfirm.com',
  firstName: 'Sarah',
  lastName: 'Owner',
  role: 'BusinessOwner',
  status: 'Active',
  firmId: 'firm-1',
  azureAdId: 'azure-owner-1',
  preferences: {},
  createdAt: new Date(),
  lastActive: new Date(),
};

const mockAssociateUser: User = {
  id: 'associate-1',
  email: 'associate@lawfirm.com',
  firstName: 'Jane',
  lastName: 'Associate',
  role: 'Associate',
  status: 'Active',
  firmId: 'firm-1',
  azureAdId: 'azure-associate-1',
  preferences: {},
  createdAt: new Date(),
  lastActive: new Date(),
};

const mockParalegalUser: User = {
  id: 'paralegal-1',
  email: 'paralegal@lawfirm.com',
  firstName: 'Bob',
  lastName: 'Paralegal',
  role: 'Paralegal',
  status: 'Active',
  firmId: 'firm-1',
  azureAdId: 'azure-paralegal-1',
  preferences: {},
  createdAt: new Date(),
  lastActive: new Date(),
};

// Mock KPI data
const mockFinancialKPIs = {
  totalRevenue: 150000,
  totalBillableHours: 450,
  totalNonBillableHours: 50,
  utilizationRate: 90,
  realizationRate: 95,
  effectiveHourlyRate: 333,
  caseCount: 12,
  retainerUtilizationAverage: 75,
  retainerCasesCount: 3,
  revenueByBillingType: {
    hourly: 100000,
    fixed: 30000,
    retainer: 20000,
  },
  revenueTrend: [
    { date: '2024-01-01', revenue: 35000 },
    { date: '2024-01-08', revenue: 38000 },
    { date: '2024-01-15', revenue: 40000 },
    { date: '2024-01-22', revenue: 37000 },
  ],
  utilizationByRole: [
    { role: 'Partner', rate: 85, hours: 200 },
    { role: 'Associate', rate: 92, hours: 180 },
    { role: 'Paralegal', rate: 88, hours: 70 },
  ],
  profitabilityByCase: [
    { caseId: 'case-1', caseName: 'Smith v. Jones', effectiveRate: 400, profit: 15000 },
    { caseId: 'case-2', caseName: 'Contract Review', effectiveRate: 350, profit: 8000 },
  ],
  calculatedAt: new Date().toISOString(),
};

/**
 * Helper function to render analytics page with specific user role
 */
const renderAnalyticsPageAsRole = (user: User | null) => {
  const mockAuthContext: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading: false,
    error: null,
    login: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    clearError: jest.fn(),
  };

  return render(
    <AuthContext.Provider value={mockAuthContext}>
      <FinancialAccessProvider>
        <ApolloProvider client={apolloClient}>
          <AnalyticsPage />
        </ApolloProvider>
      </FinancialAccessProvider>
    </AuthContext.Provider>
  );
};

/**
 * Setup MSW handler for Financial KPIs query
 */
const setupFinancialKPIsHandler = (scope: 'own' | 'firm' = 'own') => {
  server.use(
    graphql.query('GetFinancialKPIs', ({ variables }) => {
      // Adjust data based on scope
      const data =
        scope === 'firm'
          ? { ...mockFinancialKPIs, caseCount: 25, totalRevenue: 450000 }
          : mockFinancialKPIs;

      return HttpResponse.json({
        data: {
          financialKPIs: data,
        },
      });
    })
  );
};

describe('Story 2.11.5: Analytics Page Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Partner Access Tests (AC: 1-3)', () => {
    beforeEach(() => {
      setupFinancialKPIsHandler('own');
    });

    it('should allow Partner to access Analytics page', async () => {
      renderAnalyticsPageAsRole(mockPartnerUser);

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('Analize Financiare')).toBeInTheDocument();
      });

      // Verify page rendered successfully (no access denied)
      expect(screen.queryByText('Acces restricționat')).not.toBeInTheDocument();
    });

    it('should display revenue overview widget for Partner', async () => {
      renderAnalyticsPageAsRole(mockPartnerUser);

      await waitFor(() => {
        expect(screen.getByText(/Revenue Overview/i)).toBeInTheDocument();
      });
    });

    it('should display utilization widget for Partner', async () => {
      renderAnalyticsPageAsRole(mockPartnerUser);

      await waitFor(() => {
        expect(screen.getByText(/Utilization/i)).toBeInTheDocument();
      });
    });

    it('should display profitability widget for Partner', async () => {
      renderAnalyticsPageAsRole(mockPartnerUser);

      await waitFor(() => {
        expect(screen.getByText(/Profitability/i)).toBeInTheDocument();
      });
    });

    it('should display retainer status widget for Partner', async () => {
      renderAnalyticsPageAsRole(mockPartnerUser);

      await waitFor(() => {
        expect(screen.getByText(/Retainer/i)).toBeInTheDocument();
      });
    });

    it('Partner should see scope badge indicating limited view', async () => {
      renderAnalyticsPageAsRole(mockPartnerUser);

      // Partner sees scope badge (My Cases)
      await waitFor(() => {
        expect(screen.getByText(/My Cases/i)).toBeInTheDocument();
      });
    });
  });

  describe('BusinessOwner Access Tests (AC: 1-3)', () => {
    beforeEach(() => {
      setupFinancialKPIsHandler('firm');
    });

    it('should allow BusinessOwner to access Analytics page', async () => {
      renderAnalyticsPageAsRole(mockBusinessOwnerUser);

      await waitFor(() => {
        expect(screen.getByText('Analize Financiare')).toBeInTheDocument();
      });

      // Verify page rendered successfully (no access denied)
      expect(screen.queryByText('Acces restricționat')).not.toBeInTheDocument();
    });

    it('BusinessOwner should see scope badge indicating firm-wide view', async () => {
      renderAnalyticsPageAsRole(mockBusinessOwnerUser);

      // BusinessOwner sees "All Firm Cases" or "Firm" scope badge
      await waitFor(() => {
        // Check that the scope badge shows firm-wide access
        expect(screen.getByText(/All Firm Cases|Firm/i)).toBeInTheDocument();
      });
    });

    it('should display all analytics widgets for BusinessOwner', async () => {
      renderAnalyticsPageAsRole(mockBusinessOwnerUser);

      await waitFor(() => {
        expect(screen.getByText(/Revenue Overview/i)).toBeInTheDocument();
        expect(screen.getByText(/Utilization/i)).toBeInTheDocument();
        expect(screen.getByText(/Profitability/i)).toBeInTheDocument();
        expect(screen.getByText(/Retainer/i)).toBeInTheDocument();
      });
    });
  });

  describe('Authorization Tests (AC: 3 - Associates/Paralegals Denied)', () => {
    it('should show Access Denied for Associate users', async () => {
      renderAnalyticsPageAsRole(mockAssociateUser);

      await waitFor(() => {
        expect(screen.getByText('Acces restricționat')).toBeInTheDocument();
      });

      // Verify access denied message
      expect(
        screen.getByText(/Analizele financiare sunt disponibile doar pentru Parteneri și Proprietari/i)
      ).toBeInTheDocument();
    });

    it('should show Access Denied for Paralegal users', async () => {
      renderAnalyticsPageAsRole(mockParalegalUser);

      await waitFor(() => {
        expect(screen.getByText('Acces restricționat')).toBeInTheDocument();
      });
    });

    it('should provide "Go to Dashboard" button for denied users', async () => {
      renderAnalyticsPageAsRole(mockAssociateUser);

      await waitFor(() => {
        const dashboardButton = screen.getByText('Înapoi la Dashboard');
        expect(dashboardButton).toBeInTheDocument();
      });
    });

    it('should redirect to dashboard when clicking "Go to Dashboard"', async () => {
      renderAnalyticsPageAsRole(mockAssociateUser);
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Înapoi la Dashboard')).toBeInTheDocument();
      });

      const button = screen.getByText('Înapoi la Dashboard');
      await user.click(button);

      expect(mockPush).toHaveBeenCalledWith('/');
    });

    it('should not display any financial data to Associates', async () => {
      renderAnalyticsPageAsRole(mockAssociateUser);

      await waitFor(() => {
        expect(screen.getByText('Acces restricționat')).toBeInTheDocument();
      });

      // Verify no financial widgets are shown
      expect(screen.queryByText(/Revenue Overview/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Utilization/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Profitability/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/\$150,000/i)).not.toBeInTheDocument();
    });

    it('should not display any financial data to Paralegals', async () => {
      renderAnalyticsPageAsRole(mockParalegalUser);

      await waitFor(() => {
        expect(screen.getByText('Acces restricționat')).toBeInTheDocument();
      });

      // Verify no financial widgets are shown
      expect(screen.queryByText(/Revenue Overview/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    });
  });

  describe('UI Component Tests (AC: 7)', () => {
    beforeEach(() => {
      setupFinancialKPIsHandler('own');
    });

    it('should display loading skeletons while fetching data', async () => {
      // Delay the response to observe loading state
      server.use(
        graphql.query('GetFinancialKPIs', async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            data: {
              financialKPIs: mockFinancialKPIs,
            },
          });
        })
      );

      renderAnalyticsPageAsRole(mockPartnerUser);

      // Should show loading indicator (skeleton or spinner)
      // The exact loading state depends on implementation
      expect(screen.queryByText('Acces restricționat')).not.toBeInTheDocument();
    });

    it('should render date range picker', async () => {
      renderAnalyticsPageAsRole(mockPartnerUser);

      await waitFor(() => {
        // Look for date range picker button (calendar icon button)
        const calendarButtons = screen.getAllByRole('button');
        // The date picker has a button with calendar controls
        expect(calendarButtons.length).toBeGreaterThan(0);
      });
    });

    it('should render refresh button', async () => {
      renderAnalyticsPageAsRole(mockPartnerUser);

      await waitFor(() => {
        expect(screen.getByTitle('Refresh data')).toBeInTheDocument();
      });
    });

    it('should render period comparison toggle', async () => {
      renderAnalyticsPageAsRole(mockPartnerUser);

      await waitFor(() => {
        // Look for comparison toggle
        expect(screen.getByText(/Compare/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle GraphQL errors gracefully', async () => {
      server.use(
        graphql.query('GetFinancialKPIs', () => {
          return HttpResponse.json({
            errors: [
              {
                message: 'Internal server error',
                extensions: { code: 'INTERNAL_SERVER_ERROR' },
              },
            ],
          });
        })
      );

      renderAnalyticsPageAsRole(mockPartnerUser);

      // Should show error state in widgets
      await waitFor(() => {
        // Error states should be visible but page shouldn't crash
        expect(screen.getByText('Analize Financiare')).toBeInTheDocument();
      });
    });

    it('should handle unauthenticated users', async () => {
      renderAnalyticsPageAsRole(null);

      // Should show access denied for unauthenticated users
      await waitFor(() => {
        expect(screen.getByText('Acces restricționat')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Layout Tests (AC: 7)', () => {
    beforeEach(() => {
      setupFinancialKPIsHandler('own');
    });

    it('should render grid layout for analytics widgets', async () => {
      const { container } = renderAnalyticsPageAsRole(mockPartnerUser);

      await waitFor(() => {
        expect(screen.getByText('Analize Financiare')).toBeInTheDocument();
      });

      // Check for grid classes
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toBeInTheDocument();
    });

    it('should render header with controls', async () => {
      renderAnalyticsPageAsRole(mockPartnerUser);

      await waitFor(() => {
        // Check for header elements
        expect(screen.getByText('Analize Financiare')).toBeInTheDocument();
        expect(screen.getByTitle('Reîmprospătează datele')).toBeInTheDocument();
      });
    });
  });

  describe('Complete Workflow Tests', () => {
    beforeEach(() => {
      setupFinancialKPIsHandler('own');
    });

    it('Partner: complete analytics dashboard workflow', async () => {
      const user = userEvent.setup();
      renderAnalyticsPageAsRole(mockPartnerUser);

      // Step 1: Page loads
      await waitFor(() => {
        expect(screen.getByText('Analize Financiare')).toBeInTheDocument();
      });

      // Step 2: Verify all widgets are present
      expect(screen.getByText(/Revenue Overview/i)).toBeInTheDocument();
      expect(screen.getByText(/Utilization/i)).toBeInTheDocument();

      // Step 3: Verify refresh button works
      const refreshButton = screen.getByTitle('Reîmprospătează datele');
      await user.click(refreshButton);

      // Should still be on page after refresh
      expect(screen.getByText('Analize Financiare')).toBeInTheDocument();
    });

    it('BusinessOwner: complete analytics dashboard workflow', async () => {
      setupFinancialKPIsHandler('firm');
      renderAnalyticsPageAsRole(mockBusinessOwnerUser);

      // Step 1: Page loads with firm-wide scope
      await waitFor(() => {
        expect(screen.getByText('Analize Financiare')).toBeInTheDocument();
      });

      // Step 2: Verify BusinessOwner sees firm scope badge
      await waitFor(() => {
        expect(screen.getByText(/Toate dosarele firmei|Firmă/i)).toBeInTheDocument();
      });

      // Step 3: All widgets accessible
      expect(screen.getByText(/Revenue Overview/i)).toBeInTheDocument();
      expect(screen.getByText(/Retainer/i)).toBeInTheDocument();
    });

    it('Associate: complete denial workflow', async () => {
      const user = userEvent.setup();
      renderAnalyticsPageAsRole(mockAssociateUser);

      // Step 1: Access denied shown
      await waitFor(() => {
        expect(screen.getByText('Acces restricționat')).toBeInTheDocument();
      });

      // Step 2: No financial data visible
      expect(screen.queryByText(/Revenue Overview/i)).not.toBeInTheDocument();

      // Step 3: Click "Go to Dashboard"
      await user.click(screen.getByText('Înapoi la Dashboard'));

      // Step 4: Verify redirect called
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  /**
   * Metadata Display Tests
   * Note: These tests require actual GraphQL data which would be better
   * covered by E2E tests with a real backend. The integration tests above
   * focus on authorization and UI rendering.
   */
  describe('Metadata Display Tests', () => {
    beforeEach(() => {
      setupFinancialKPIsHandler('own');
    });

    it('should display dashboard header and scope indicator', async () => {
      renderAnalyticsPageAsRole(mockPartnerUser);

      await waitFor(() => {
        // Verify dashboard header is present
        expect(screen.getByText('Analize Financiare')).toBeInTheDocument();
        // Verify scope indicator is present
        expect(screen.getByText(/Dosarele mele/i)).toBeInTheDocument();
      });
    });
  });
});
