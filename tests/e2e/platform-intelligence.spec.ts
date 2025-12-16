/**
 * Platform Intelligence Dashboard E2E Tests
 * Story 5.7: Platform Intelligence Dashboard - Task 27
 *
 * End-to-end tests for platform intelligence features including:
 * - Dashboard access for Partner/BusinessOwner (AC: 1-6)
 * - Dashboard hidden from non-Partners
 * - Date range filtering
 * - Section navigation
 * - Export functionality
 *
 * NOTE: These tests use mocked responses for CI/CD environments.
 * For production validation, use the manual test plan below.
 *
 * =============================================================================
 * MANUAL TEST PLAN - Platform Intelligence Dashboard Testing
 * =============================================================================
 *
 * PREREQUISITES:
 * 1. Platform running with all services enabled
 * 2. Test firm with:
 *    - At least 30 days of email history
 *    - At least 50 documents created
 *    - Multiple AI feature usage
 *    - At least 10 users with varying adoption scores
 * 3. Authenticated user with Partner or BusinessOwner role
 * 4. Historical data for baseline comparison
 *
 * =============================================================================
 * TEST SCENARIOS
 * =============================================================================
 *
 * TC-1: Access Platform Intelligence Dashboard (AC: 1-6)
 * ----------------------------------------
 * Steps:
 * 1. Log in as Partner role
 * 2. Navigate to Analytics from sidebar
 * 3. Click "Inteligență Platformă" in sidebar
 * 4. Wait for dashboard to load
 * Expected Result:
 * - Dashboard loads successfully
 * - Platform health score gauge visible
 * - Key metrics summary row displays 6 cards
 * - All sections load without errors
 *
 * TC-2: Verify Dashboard Sections (AC: 1-6)
 * ----------------------------------------
 * Steps:
 * 1. On Platform Intelligence dashboard
 * 2. Click each tab: Communication, Quality, Tasks, AI, ROI
 * 3. Verify each section loads
 * Expected Result:
 * - Each tab navigates to correct section
 * - Communication: Response time charts visible
 * - Quality: Document metrics displayed
 * - Tasks: Completion rates shown
 * - AI: Utilization data loaded
 * - ROI: Value saved displayed
 *
 * TC-3: Date Range Filtering (AC: 1-6)
 * ----------------------------------------
 * Steps:
 * 1. Click date range picker
 * 2. Select "Last 7 days"
 * 3. Wait for data refresh
 * 4. Change to "Last 90 days"
 * Expected Result:
 * - Data refreshes on date change
 * - Metrics update to reflect new range
 * - Charts update accordingly
 *
 * TC-4: Dashboard Hidden from Non-Partners
 * ----------------------------------------
 * Steps:
 * 1. Log in as Associate role
 * 2. Navigate to Analytics
 * 3. Try to access /analytics/platform-intelligence directly
 * Expected Result:
 * - Platform Intelligence not shown in sidebar
 * - Direct URL shows access denied message
 *
 * TC-5: Export Functionality (AC: 1-6)
 * ----------------------------------------
 * Steps:
 * 1. On Platform Intelligence dashboard
 * 2. Click "Exportă" button
 * 3. Select PDF format
 * 4. Wait for export generation
 * 5. Download exported file
 * Expected Result:
 * - Export dialog opens
 * - Progress shown during generation
 * - Download link provided
 * - PDF contains all dashboard sections
 */

import { test, expect } from '@playwright/test';

// Test configuration
const PLATFORM_INTELLIGENCE_URL = '/analytics/platform-intelligence';
const ANALYTICS_URL = '/analytics';

// Mock data for testing
const mockHealthScore = 78;

test.describe('Platform Intelligence Dashboard', () => {
  test.describe('Access Control', () => {
    test('should load dashboard for Partner role', async ({ page }) => {
      // Set up Partner auth mock
      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'partner-123',
              email: 'partner@testfirm.com',
              role: 'Partner',
              firmId: 'firm-123',
            },
          }),
        });
      });

      // Mock GraphQL response
      await page.route('**/graphql', async (route) => {
        const body = route.request().postDataJSON();
        if (body.operationName === 'PlatformIntelligenceDashboard') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                platformIntelligenceDashboard: {
                  firmId: 'firm-123',
                  platformHealthScore: mockHealthScore,
                  generatedAt: new Date().toISOString(),
                  efficiency: {
                    totalTimeSavedHours: 125,
                    aiAssistedActions: 450,
                    automationTriggers: 80,
                    manualVsAutomatedRatio: 0.65,
                  },
                  communication: {
                    currentResponseTime: {
                      avgResponseTimeHours: 4.2,
                      withinSLAPercent: 87,
                    },
                    baselineComparison: {
                      improvementPercent: 28,
                    },
                  },
                  documentQuality: {
                    revisionMetrics: {
                      firstTimeRightPercent: 72,
                    },
                  },
                  taskCompletion: {
                    completionRate: 91,
                    deadlineAdherence: 88,
                  },
                  aiUtilization: {
                    firmTotal: {
                      totalRequests: 5200,
                      avgRequestsPerUser: 260,
                    },
                  },
                  roi: {
                    totalValueSaved: 45000,
                    billableHoursRecovered: 225,
                    projectedAnnualSavings: 540000,
                  },
                  recommendations: [],
                },
              },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(PLATFORM_INTELLIGENCE_URL);

      // Wait for dashboard to load
      await expect(page.getByText('Inteligență Platformă')).toBeVisible();

      // Health score should be visible
      await expect(page.getByText(/78/)).toBeVisible();
    });

    test('should show access denied for Associate role', async ({ page }) => {
      // Set up Associate auth mock
      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'associate-123',
              email: 'associate@testfirm.com',
              role: 'Associate',
              firmId: 'firm-123',
            },
          }),
        });
      });

      await page.goto(PLATFORM_INTELLIGENCE_URL);

      // Should see access denied message
      await expect(page.getByText(/Acces restricționat/)).toBeVisible();
    });

    test('should allow BusinessOwner access', async ({ page }) => {
      // Set up BusinessOwner auth mock
      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'owner-123',
              email: 'owner@testfirm.com',
              role: 'BusinessOwner',
              firmId: 'firm-123',
            },
          }),
        });
      });

      // Mock GraphQL
      await page.route('**/graphql', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              platformIntelligenceDashboard: {
                firmId: 'firm-123',
                platformHealthScore: 75,
                recommendations: [],
              },
            },
          }),
        });
      });

      await page.goto(PLATFORM_INTELLIGENCE_URL);

      await expect(page.getByText('Inteligență Platformă')).toBeVisible();
    });
  });

  test.describe('Section Navigation', () => {
    test.beforeEach(async ({ page }) => {
      // Set up Partner auth and mocks
      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'partner-123', role: 'Partner', firmId: 'firm-123' },
          }),
        });
      });

      await page.route('**/graphql', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              platformIntelligenceDashboard: {
                firmId: 'firm-123',
                platformHealthScore: 80,
                efficiency: { totalTimeSavedHours: 100 },
                communication: { currentResponseTime: { avgResponseTimeHours: 4 } },
                documentQuality: { revisionMetrics: { firstTimeRightPercent: 75 } },
                taskCompletion: { completionRate: 90 },
                aiUtilization: { firmTotal: { totalRequests: 5000 } },
                roi: { totalValueSaved: 40000 },
                recommendations: [],
              },
            },
          }),
        });
      });
    });

    test('should navigate between tabs', async ({ page }) => {
      await page.goto(PLATFORM_INTELLIGENCE_URL);

      // Click Communication tab
      await page.click('button:has-text("Comunicare")');
      await expect(page).toHaveURL(/tab=communication/);

      // Click Document Quality tab
      await page.click('button:has-text("Calitate documente")');
      await expect(page).toHaveURL(/tab=quality/);

      // Click Tasks tab
      await page.click('button:has-text("Sarcini")');
      await expect(page).toHaveURL(/tab=tasks/);

      // Click AI tab
      await page.click('button:has-text("Utilizare AI")');
      await expect(page).toHaveURL(/tab=ai/);

      // Click ROI tab
      await page.click('button:has-text("ROI")');
      await expect(page).toHaveURL(/tab=roi/);

      // Return to overview
      await page.click('button:has-text("Prezentare generală")');
      await expect(page).not.toHaveURL(/tab=/);
    });

    test('should update URL on tab change', async ({ page }) => {
      await page.goto(PLATFORM_INTELLIGENCE_URL);

      await page.click('button:has-text("Comunicare")');

      const url = page.url();
      expect(url).toContain('tab=communication');
    });

    test('should load correct tab from URL', async ({ page }) => {
      await page.goto(`${PLATFORM_INTELLIGENCE_URL}?tab=quality`);

      // Quality tab should be active
      const qualityTab = page.locator('button:has-text("Calitate documente")');
      await expect(qualityTab).toHaveAttribute('aria-current', 'page');
    });
  });

  test.describe('Date Range Filtering', () => {
    test('should update data on date range change', async ({ page }) => {
      let queryCount = 0;

      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'partner-123', role: 'Partner', firmId: 'firm-123' },
          }),
        });
      });

      await page.route('**/graphql', async (route) => {
        queryCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              platformIntelligenceDashboard: {
                firmId: 'firm-123',
                platformHealthScore: queryCount === 1 ? 80 : 75,
                recommendations: [],
              },
            },
          }),
        });
      });

      await page.goto(PLATFORM_INTELLIGENCE_URL);

      // Wait for initial load
      await page.waitForLoadState('networkidle');
      const initialQueries = queryCount;

      // Open date range picker and change dates
      await page.click('[data-testid="date-range-picker"]');
      await page.click('button:has-text("Last 7 days")');

      // Wait for refetch
      await page.waitForLoadState('networkidle');

      // Should have made additional query
      expect(queryCount).toBeGreaterThan(initialQueries);
    });
  });

  test.describe('Export Functionality', () => {
    test('should open export dialog', async ({ page }) => {
      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'partner-123', role: 'Partner', firmId: 'firm-123' },
          }),
        });
      });

      await page.route('**/graphql', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              platformIntelligenceDashboard: {
                firmId: 'firm-123',
                platformHealthScore: 80,
                recommendations: [],
              },
            },
          }),
        });
      });

      await page.goto(PLATFORM_INTELLIGENCE_URL);

      // Click export button
      await page.click('button:has-text("Exportă")');

      // Export dialog should be visible
      await expect(page.getByText('Exportă Raport')).toBeVisible();

      // Format options should be visible
      await expect(page.getByText('PDF Document')).toBeVisible();
      await expect(page.getByText('Excel Spreadsheet')).toBeVisible();
      await expect(page.getByText('CSV Export')).toBeVisible();
    });

    test('should initiate PDF export', async ({ page }) => {
      let exportCalled = false;

      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'partner-123', role: 'Partner', firmId: 'firm-123' },
          }),
        });
      });

      await page.route('**/graphql', async (route) => {
        const body = route.request().postDataJSON();
        if (body.operationName === 'ExportPlatformIntelligence') {
          exportCalled = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                exportPlatformIntelligence: {
                  url: 'https://storage.example.com/report.pdf',
                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  format: 'PDF',
                },
              },
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                platformIntelligenceDashboard: {
                  firmId: 'firm-123',
                  platformHealthScore: 80,
                  recommendations: [],
                },
              },
            }),
          });
        }
      });

      await page.goto(PLATFORM_INTELLIGENCE_URL);

      // Open export dialog
      await page.click('button:has-text("Exportă")');

      // Click PDF option
      await page.click('button:has-text("PDF Document")');

      // Wait for export
      await page.waitForResponse(
        (response) =>
          response.request().postDataJSON()?.operationName === 'ExportPlatformIntelligence'
      );

      expect(exportCalled).toBe(true);

      // Download button should appear
      await expect(page.getByText('Descarcă')).toBeVisible();
    });

    test('should close export dialog', async ({ page }) => {
      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'partner-123', role: 'Partner', firmId: 'firm-123' },
          }),
        });
      });

      await page.route('**/graphql', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              platformIntelligenceDashboard: {
                firmId: 'firm-123',
                platformHealthScore: 80,
                recommendations: [],
              },
            },
          }),
        });
      });

      await page.goto(PLATFORM_INTELLIGENCE_URL);

      // Open export dialog
      await page.click('button:has-text("Exportă")');
      await expect(page.getByText('Exportă Raport')).toBeVisible();

      // Close dialog
      await page.click('button:has-text("Închide")');

      // Dialog should be hidden
      await expect(page.getByText('Exportă Raport')).not.toBeVisible();
    });
  });

  test.describe('Refresh Functionality', () => {
    test('should refresh data on refresh button click', async ({ page }) => {
      let queryCount = 0;

      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'partner-123', role: 'Partner', firmId: 'firm-123' },
          }),
        });
      });

      await page.route('**/graphql', async (route) => {
        queryCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              platformIntelligenceDashboard: {
                firmId: 'firm-123',
                platformHealthScore: 80,
                recommendations: [],
              },
              refreshPlatformIntelligence: true,
            },
          }),
        });
      });

      await page.goto(PLATFORM_INTELLIGENCE_URL);
      await page.waitForLoadState('networkidle');

      const initialQueries = queryCount;

      // Click refresh button
      await page.click('button:has-text("Reîmprospătare")');

      await page.waitForLoadState('networkidle');

      // Should have made additional queries
      expect(queryCount).toBeGreaterThan(initialQueries);
    });
  });

  test.describe('Recommendations Panel', () => {
    test('should display recommendations when present', async ({ page }) => {
      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'partner-123', role: 'Partner', firmId: 'firm-123' },
          }),
        });
      });

      await page.route('**/graphql', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              platformIntelligenceDashboard: {
                firmId: 'firm-123',
                platformHealthScore: 60,
                recommendations: [
                  {
                    category: 'EFFICIENCY',
                    priority: 'HIGH',
                    message: 'Task completion rate is below target',
                    actionableSteps: ['Review workload', 'Identify bottlenecks'],
                  },
                ],
              },
            },
          }),
        });
      });

      await page.goto(PLATFORM_INTELLIGENCE_URL);

      // Recommendations should be visible
      await expect(page.getByText('Recomandări de îmbunătățire')).toBeVisible();
      await expect(page.getByText(/Task completion rate/)).toBeVisible();
    });

    test('should expand recommendation to show action steps', async ({ page }) => {
      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'partner-123', role: 'Partner', firmId: 'firm-123' },
          }),
        });
      });

      await page.route('**/graphql', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              platformIntelligenceDashboard: {
                firmId: 'firm-123',
                platformHealthScore: 60,
                recommendations: [
                  {
                    category: 'EFFICIENCY',
                    priority: 'HIGH',
                    message: 'Task completion rate is below target',
                    actionableSteps: ['Review workload', 'Identify bottlenecks'],
                  },
                ],
              },
            },
          }),
        });
      });

      await page.goto(PLATFORM_INTELLIGENCE_URL);

      // Click to expand recommendation
      await page.click('text=Task completion rate');

      // Action steps should be visible
      await expect(page.getByText('Review workload')).toBeVisible();
      await expect(page.getByText('Identify bottlenecks')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'partner-123', role: 'Partner', firmId: 'firm-123' },
          }),
        });
      });

      await page.route('**/graphql', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              platformIntelligenceDashboard: {
                firmId: 'firm-123',
                platformHealthScore: 80,
                recommendations: [],
              },
            },
          }),
        });
      });

      await page.goto(PLATFORM_INTELLIGENCE_URL);

      // Main heading should exist
      const h1 = page.locator('h1');
      await expect(h1).toHaveText('Inteligență Platformă');
    });

    test('should have accessible tab navigation', async ({ page }) => {
      await page.route('**/api/auth/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { id: 'partner-123', role: 'Partner', firmId: 'firm-123' },
          }),
        });
      });

      await page.route('**/graphql', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              platformIntelligenceDashboard: {
                firmId: 'firm-123',
                platformHealthScore: 80,
                recommendations: [],
              },
            },
          }),
        });
      });

      await page.goto(PLATFORM_INTELLIGENCE_URL);

      // Tab navigation should have proper aria labels
      const nav = page.locator('nav[aria-label="Platform intelligence sections"]');
      await expect(nav).toBeVisible();

      // Active tab should have aria-current
      const activeTab = page.locator('button[aria-current="page"]');
      await expect(activeTab).toBeVisible();
    });
  });
});
