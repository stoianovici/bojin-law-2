/**
 * Document Intelligence Dashboard E2E Tests
 * Story 3.7: AI Document Intelligence Dashboard - Task 16
 *
 * End-to-end tests for document intelligence dashboard features.
 *
 * NOTE: These tests use mocked data and simulated interactions.
 * For production validation, use the manual test plan below.
 *
 * =============================================================================
 * MANUAL TEST PLAN - Document Intelligence Dashboard Testing
 * =============================================================================
 *
 * PREREQUISITES:
 * 1. Platform running with authentication enabled
 * 2. Logged in as Partner, BusinessOwner, or Admin
 * 3. Test firm with:
 *    - Multiple users
 *    - AI-generated documents
 *    - Document reviews with AI concerns
 *    - Various document types
 *
 * TEST SCENARIOS:
 *
 * TC-1: Dashboard Access Control
 * ----------------------------------------
 * Steps:
 * 1. Login as Partner -> Navigate to /analytics/document-intelligence
 * 2. Login as BusinessOwner -> Navigate to /analytics/document-intelligence
 * 3. Login as Associate -> Navigate to /analytics/document-intelligence
 * Expected Result:
 * - Partner: Full access
 * - BusinessOwner: Full access
 * - Associate: Access denied message
 *
 * TC-2: Dashboard Overview
 * ----------------------------------------
 * Prerequisite: Logged in as Partner
 * Steps:
 * 1. Navigate to /analytics/document-intelligence
 * 2. Verify header with title and date range picker
 * 3. Verify 4 KPI summary cards
 * 4. Verify 6 widget sections load
 * Expected Result:
 * - Header shows "Document Intelligence Dashboard"
 * - Date range picker functional
 * - Export button present
 * - KPIs show: Total Documents, AI Rate, Time Saved, Quality Score
 * - All 6 widgets render without errors
 *
 * TC-3: Document Velocity Widget
 * ----------------------------------------
 * Steps:
 * 1. View Document Velocity widget
 * 2. Check bar chart by user
 * 3. Check pie chart by document type
 * 4. Verify footer stats (average/day, trend, types)
 * Expected Result:
 * - User bar chart shows top contributors
 * - Pie chart shows document type distribution
 * - Trend percentage shown with color coding
 *
 * TC-4: AI Utilization Widget
 * ----------------------------------------
 * Steps:
 * 1. View AI Utilization widget
 * 2. Check overall utilization rate
 * 3. Check adoption trend line chart
 * 4. Check AI vs Manual pie chart
 * 5. Verify per-user progress bars
 * Expected Result:
 * - Utilization percentage prominently displayed
 * - Line chart shows adoption over time
 * - Pie chart shows AI/Manual split
 * - User list with progress bars
 *
 * TC-5: Error Detection Widget
 * ----------------------------------------
 * Steps:
 * 1. View Error Detection widget
 * 2. Check resolution rate
 * 3. Check severity breakdown (ERROR/WARNING/INFO)
 * 4. Check trend line chart
 * 5. Check by-type breakdown
 * Expected Result:
 * - Resolution rate percentage in green
 * - Color-coded severity cards
 * - Dual-line trend chart (detected vs resolved)
 * - Concern types listed with counts
 *
 * TC-6: Time Savings Widget
 * ----------------------------------------
 * Steps:
 * 1. View Time Savings widget
 * 2. Check total time saved
 * 3. Check estimated cost savings in RON
 * 4. Check comparison bar chart
 * 5. Check methodology disclosure
 * Expected Result:
 * - Total hours/minutes saved
 * - Cost savings in RON
 * - Manual vs AI comparison per type
 * - Methodology explanation visible
 *
 * TC-7: Template Usage Widget
 * ----------------------------------------
 * Steps:
 * 1. View Template Usage widget
 * 2. Check adoption rate
 * 3. Check top templates bar chart
 * 4. Check popular clauses list
 * Expected Result:
 * - Adoption rate percentage
 * - Top templates with usage counts
 * - Clause cards with frequency
 *
 * TC-8: Quality Trends Widget
 * ----------------------------------------
 * Steps:
 * 1. View Quality Trends widget
 * 2. Check overall quality score (0-100)
 * 3. Check quality gauge visualization
 * 4. Check trend area chart
 * 5. Check by-type quality breakdown
 * Expected Result:
 * - Score with quality label (Excellent/Good/etc)
 * - Color-coded gauge
 * - Area chart showing improvement over time
 * - Type-specific scores with progress bars
 *
 * TC-9: Date Range Filtering
 * ----------------------------------------
 * Steps:
 * 1. Open date range picker
 * 2. Select "Last 30 Days" preset
 * 3. Select "Last Quarter" preset
 * 4. Select "Year to Date" preset
 * 5. Enter custom date range
 * 6. Apply each filter and verify data changes
 * Expected Result:
 * - Presets work correctly
 * - Custom dates applied
 * - All widgets refresh with new data
 * - Loading states shown during refresh
 *
 * TC-10: Data Export
 * ----------------------------------------
 * Steps:
 * 1. Click Export button
 * 2. Verify CSV download
 * 3. Open CSV and verify contents
 * Expected Result:
 * - CSV file downloads
 * - Contains summary of all metrics
 * - Data matches displayed values
 *
 * TC-11: Responsive Layout
 * ----------------------------------------
 * Steps:
 * 1. View dashboard on desktop (1920px)
 * 2. View dashboard on tablet (768px)
 * 3. View dashboard on mobile (375px)
 * Expected Result:
 * - Desktop: 2-column widget layout
 * - Tablet: Widgets stack appropriately
 * - Mobile: Single column, charts resize
 *
 * TC-12: Performance
 * ----------------------------------------
 * Steps:
 * 1. Clear browser cache
 * 2. Navigate to dashboard
 * 3. Measure initial load time
 * 4. Change date range
 * 5. Measure refresh time
 * Expected Result:
 * - Initial load < 3 seconds
 * - Refresh < 2 seconds
 * - No visible layout shifts
 *
 * =============================================================================
 * AUTOMATED TESTS
 * =============================================================================
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const DASHBOARD_URL = `${BASE_URL}/analytics/document-intelligence`;

// Mock authentication helper
async function mockAuthenticatedUser(page: Page, role: string) {
  // Set mock session cookie
  await page.context().addCookies([
    {
      name: 'mock-session',
      value: JSON.stringify({
        userId: 'test-user-123',
        firmId: 'test-firm-123',
        role: role,
        email: 'test@firm.com',
      }),
      domain: 'localhost',
      path: '/',
    },
  ]);
}

test.describe('Document Intelligence Dashboard', () => {
  test.describe('Access Control', () => {
    test('Partner should access dashboard', async ({ page }) => {
      await mockAuthenticatedUser(page, 'Partner');
      await page.goto(DASHBOARD_URL);

      // Should see dashboard title
      await expect(page.getByRole('heading', { name: /Document Intelligence/i })).toBeVisible();
    });

    test('BusinessOwner should access dashboard', async ({ page }) => {
      await mockAuthenticatedUser(page, 'BusinessOwner');
      await page.goto(DASHBOARD_URL);

      await expect(page.getByRole('heading', { name: /Document Intelligence/i })).toBeVisible();
    });

    test('Associate should see access denied', async ({ page }) => {
      await mockAuthenticatedUser(page, 'Associate');
      await page.goto(DASHBOARD_URL);

      // Should see access denied message
      await expect(page.getByText(/Acces Interzis/i)).toBeVisible();
    });
  });

  test.describe('Dashboard Layout', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, 'Partner');
      await page.goto(DASHBOARD_URL);
    });

    test('should display header with controls', async ({ page }) => {
      // Title
      await expect(
        page.getByRole('heading', { name: /Document Intelligence Dashboard/i })
      ).toBeVisible();

      // Date range picker
      await expect(page.getByRole('button', { name: /calendar/i })).toBeVisible();

      // Export button
      await expect(page.getByRole('button', { name: /export/i })).toBeVisible();

      // Refresh button
      await expect(page.getByTitle(/Reimprospatare/i)).toBeVisible();
    });

    test('should display KPI summary cards', async ({ page }) => {
      // Check all 4 KPI cards
      await expect(page.getByText(/Documente Totale/i)).toBeVisible();
      await expect(page.getByText(/Rata Utilizare AI/i)).toBeVisible();
      await expect(page.getByText(/Timp Economisit/i)).toBeVisible();
      await expect(page.getByText(/Scor Calitate/i)).toBeVisible();
    });

    test('should display all 6 widgets', async ({ page }) => {
      // All widget titles
      await expect(page.getByText(/Velocitate Documente/i)).toBeVisible();
      await expect(page.getByText(/Utilizare AI/i).first()).toBeVisible();
      await expect(page.getByText(/Detectie Erori/i)).toBeVisible();
      await expect(page.getByText(/Economii de Timp/i)).toBeVisible();
      await expect(page.getByText(/Utilizare Template-uri/i)).toBeVisible();
      await expect(page.getByText(/Tendinte Calitate/i)).toBeVisible();
    });
  });

  test.describe('Widget Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuthenticatedUser(page, 'Partner');
      await page.goto(DASHBOARD_URL);
    });

    test('Document Velocity widget should show charts', async ({ page }) => {
      const widget = page.locator('text=Velocitate Documente').locator('..');

      // Should have user section
      await expect(widget.getByText(/Per Utilizator/i)).toBeVisible();

      // Should have type section
      await expect(widget.getByText(/Per Tip Document/i)).toBeVisible();
    });

    test('AI Utilization widget should show adoption trend', async ({ page }) => {
      const widget = page.locator('text=Utilizare AI').first().locator('..').locator('..');

      // Should show rate percentage
      await expect(widget.locator('text=/%/')).toBeVisible();

      // Should have adoption trend section
      await expect(widget.getByText(/Tendinta Adoptie/i)).toBeVisible();
    });

    test('Error Detection widget should show severity breakdown', async ({ page }) => {
      const widget = page.locator('text=Detectie Erori').locator('..').locator('..');

      // Should show severity cards
      await expect(widget.getByText(/ERROR/i)).toBeVisible();
      await expect(widget.getByText(/WARNING/i)).toBeVisible();
      await expect(widget.getByText(/INFO/i)).toBeVisible();
    });

    test('Time Savings widget should show methodology', async ({ page }) => {
      const widget = page.locator('text=Economii de Timp').locator('..').locator('..');

      // Should show methodology explanation
      await expect(widget.getByText(/Time savings calculated/i)).toBeVisible();
    });

    test('Quality Trends widget should show score', async ({ page }) => {
      const widget = page.locator('text=Tendinte Calitate').locator('..').locator('..');

      // Should show quality score
      await expect(widget.getByText(/Scor General Calitate/i)).toBeVisible();
    });
  });

  test.describe('Data Export', () => {
    test('should export CSV when clicking export button', async ({ page }) => {
      await mockAuthenticatedUser(page, 'Partner');
      await page.goto(DASHBOARD_URL);

      // Setup download listener
      const downloadPromise = page.waitForEvent('download');

      // Click export button
      await page.getByRole('button', { name: /export/i }).click();

      // Wait for download
      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toContain('document-intelligence');
      expect(download.suggestedFilename()).toContain('.csv');
    });
  });

  test.describe('Refresh Functionality', () => {
    test('should show loading state when refreshing', async ({ page }) => {
      await mockAuthenticatedUser(page, 'Partner');
      await page.goto(DASHBOARD_URL);

      // Click refresh button
      await page.getByTitle(/Reimprospatare/i).click();

      // Check for spinning animation (class contains animate-spin)
      await expect(page.locator('.animate-spin')).toBeVisible();

      // Wait for refresh to complete
      await page.waitForTimeout(1500);

      // Spinner should be gone
      await expect(page.locator('.animate-spin')).not.toBeVisible();
    });
  });

  test.describe('Last Updated Timestamp', () => {
    test('should display last updated timestamp', async ({ page }) => {
      await mockAuthenticatedUser(page, 'Partner');
      await page.goto(DASHBOARD_URL);

      // Should show last updated footer
      await expect(page.getByText(/Ultima actualizare/i)).toBeVisible();
    });
  });
});
