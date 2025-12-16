/**
 * END-TO-END (E2E) TEST TEMPLATE
 *
 * This template demonstrates best practices for writing E2E tests using Playwright.
 * E2E tests verify complete user workflows from start to finish, testing the entire
 * application stack (frontend + backend + database) together.
 *
 * WHEN TO USE E2E TESTS:
 * - Testing critical user journeys (login, case creation, document upload)
 * - Testing AI features that require full integration
 * - Testing multi-page workflows
 * - Testing cross-browser compatibility
 * - Smoke testing after deployment
 * - Testing real user scenarios end-to-end
 *
 * TARGET: 10% of your test suite should be E2E tests (Testing Pyramid)
 */

import { test, expect, type Page } from '@playwright/test';

// ============================================================================
// PAGE OBJECT MODEL (POM) PATTERN
// ============================================================================

/**
 * Page Object Model Benefits:
 * 1. Encapsulates page structure and interactions
 * 2. Reduces code duplication
 * 3. Makes tests more maintainable
 * 4. Improves readability
 * 5. Centralizes locator changes
 *
 * Each page object represents a page or component in your application
 */

// -------------------------------------------------------------------------
// LOGIN PAGE OBJECT
// -------------------------------------------------------------------------

class LoginPage {
  constructor(private page: Page) {}

  // Locators - Define all selectors in one place
  get emailInput() {
    return this.page.getByLabel(/email/i);
  }

  get passwordInput() {
    return this.page.getByLabel(/password/i);
  }

  get submitButton() {
    return this.page.getByRole('button', { name: /sign in/i });
  }

  get errorMessage() {
    return this.page.getByRole('alert');
  }

  // Actions - High-level methods for page interactions
  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async loginAsPartner() {
    await this.login('partner@example.com', 'password123');
    // Wait for redirect after successful login
    await this.page.waitForURL('/dashboard');
  }

  async loginAsAssociate() {
    await this.login('associate@example.com', 'password123');
    await this.page.waitForURL('/dashboard');
  }

  async loginAsParalegal() {
    await this.login('paralegal@example.com', 'password123');
    await this.page.waitForURL('/dashboard');
  }

  // Assertions - Verification methods
  async expectToBeOnLoginPage() {
    await expect(this.page).toHaveURL(/\/login/);
    await expect(this.page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  }

  async expectLoginError(message: string) {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(message);
  }
}

// -------------------------------------------------------------------------
// DASHBOARD PAGE OBJECT
// -------------------------------------------------------------------------

class DashboardPage {
  constructor(private page: Page) {}

  // Locators
  get heading() {
    return this.page.getByRole('heading', { name: /dashboard/i });
  }

  get welcomeMessage() {
    return this.page.getByText(/welcome/i);
  }

  get createCaseButton() {
    return this.page.getByRole('button', { name: /create case/i });
  }

  get casesTable() {
    return this.page.getByRole('table', { name: /cases/i });
  }

  // Actions
  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async clickCreateCase() {
    await this.createCaseButton.click();
  }

  async getCaseByTitle(title: string) {
    return this.page.getByRole('row', { name: new RegExp(title, 'i') });
  }

  // Assertions
  async expectToBeOnDashboard() {
    await expect(this.page).toHaveURL(/\/dashboard/);
    await expect(this.heading).toBeVisible();
  }

  async expectCaseInList(title: string) {
    const caseRow = await this.getCaseByTitle(title);
    await expect(caseRow).toBeVisible();
  }
}

// -------------------------------------------------------------------------
// CASE CREATION PAGE OBJECT
// -------------------------------------------------------------------------

class CreateCasePage {
  constructor(private page: Page) {}

  // Locators
  get titleInput() {
    return this.page.getByLabel(/case title/i);
  }

  get clientSelect() {
    return this.page.getByLabel(/client/i);
  }

  get typeSelect() {
    return this.page.getByLabel(/case type/i);
  }

  get descriptionTextarea() {
    return this.page.getByLabel(/description/i);
  }

  get submitButton() {
    return this.page.getByRole('button', { name: /create case/i });
  }

  get cancelButton() {
    return this.page.getByRole('button', { name: /cancel/i });
  }

  // Actions
  async goto() {
    await this.page.goto('/cases/new');
    await this.page.waitForLoadState('networkidle');
  }

  async fillForm(data: { title: string; client: string; type: string; description?: string }) {
    await this.titleInput.fill(data.title);

    // Select from dropdown
    await this.clientSelect.click();
    await this.page.getByRole('option', { name: data.client }).click();

    await this.typeSelect.click();
    await this.page.getByRole('option', { name: data.type }).click();

    if (data.description) {
      await this.descriptionTextarea.fill(data.description);
    }
  }

  async submitForm() {
    await this.submitButton.click();
    // Wait for navigation or success message
    await this.page.waitForURL(/\/cases\/\w+/);
  }

  async createCase(data: { title: string; client: string; type: string; description?: string }) {
    await this.fillForm(data);
    await this.submitForm();
  }

  // Assertions
  async expectToBeOnCreateCasePage() {
    await expect(this.page).toHaveURL(/\/cases\/new/);
    await expect(this.page.getByRole('heading', { name: /create case/i })).toBeVisible();
  }

  async expectValidationError(field: string, message: string) {
    const errorElement = this.page.getByText(message);
    await expect(errorElement).toBeVisible();
  }
}

// -------------------------------------------------------------------------
// CASE DETAIL PAGE OBJECT
// -------------------------------------------------------------------------

class CaseDetailPage {
  constructor(private page: Page) {}

  // Locators
  get caseTitle() {
    return this.page.getByRole('heading', { level: 1 });
  }

  get statusBadge() {
    return this.page.getByTestId('case-status');
  }

  get documentsTab() {
    return this.page.getByRole('tab', { name: /documents/i });
  }

  get tasksTab() {
    return this.page.getByRole('tab', { name: /tasks/i });
  }

  get uploadDocumentButton() {
    return this.page.getByRole('button', { name: /upload document/i });
  }

  // Actions
  async gotoCase(caseId: string) {
    await this.page.goto(`/cases/${caseId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async switchToDocumentsTab() {
    await this.documentsTab.click();
    await this.page.waitForLoadState('networkidle');
  }

  async switchToTasksTab() {
    await this.tasksTab.click();
    await this.page.waitForLoadState('networkidle');
  }

  async uploadDocument(filePath: string) {
    await this.uploadDocumentButton.click();

    // Handle file input
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);

    // Wait for upload to complete
    await expect(this.page.getByText(/uploaded successfully/i)).toBeVisible();
  }

  // Assertions
  async expectCaseTitle(title: string) {
    await expect(this.caseTitle).toHaveText(title);
  }

  async expectCaseStatus(status: string) {
    await expect(this.statusBadge).toHaveText(status);
  }
}

// ============================================================================
// EXAMPLE E2E TEST SUITES
// ============================================================================

// -------------------------------------------------------------------------
// EXAMPLE 1: Authentication Flow
// -------------------------------------------------------------------------

test.describe('Authentication Flow', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await loginPage.login('partner@example.com', 'password123');

    // Should redirect to dashboard
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.expectToBeOnDashboard();
    await expect(dashboardPage.welcomeMessage).toBeVisible();
  });

  test('should show error for invalid credentials', async () => {
    await loginPage.login('invalid@example.com', 'wrongpassword');

    await loginPage.expectLoginError('Invalid email or password');
    await loginPage.expectToBeOnLoginPage();
  });

  test('should require email and password', async () => {
    await loginPage.submitButton.click();

    await loginPage.expectValidationError('Email is required');
    await loginPage.expectValidationError('Password is required');
  });

  test('should persist session after page reload', async ({ page }) => {
    await loginPage.loginAsPartner();

    // Reload page
    await page.reload();

    // Should still be logged in
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.expectToBeOnDashboard();
  });

  test('should redirect to login when accessing protected page', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard');

    // Should redirect to login
    await loginPage.expectToBeOnLoginPage();
  });
});

// -------------------------------------------------------------------------
// EXAMPLE 2: Complete Case Creation Workflow
// -------------------------------------------------------------------------

test.describe('Case Creation Workflow', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let createCasePage: CreateCasePage;
  let caseDetailPage: CaseDetailPage;

  test.beforeEach(async ({ page }) => {
    // Setup page objects
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    createCasePage = new CreateCasePage(page);
    caseDetailPage = new CaseDetailPage(page);

    // Login before each test
    await loginPage.goto();
    await loginPage.loginAsPartner();
    await dashboardPage.expectToBeOnDashboard();
  });

  test('should create new case successfully', async ({ page }) => {
    // Navigate to case creation
    await dashboardPage.clickCreateCase();
    await createCasePage.expectToBeOnCreateCasePage();

    // Fill and submit form
    const caseData = {
      title: 'New Legal Case 2024',
      client: 'ACME Corporation',
      type: 'Civil Law',
      description: 'Contract dispute regarding intellectual property rights',
    };

    await createCasePage.createCase(caseData);

    // Verify case created
    await caseDetailPage.expectCaseTitle(caseData.title);
    await caseDetailPage.expectCaseStatus('Active');
  });

  test('should validate required fields', async () => {
    await dashboardPage.clickCreateCase();
    await createCasePage.expectToBeOnCreateCasePage();

    // Try to submit empty form
    await createCasePage.submitButton.click();

    // Should show validation errors
    await createCasePage.expectValidationError('title', 'Case title is required');
    await createCasePage.expectValidationError('client', 'Client is required');
  });

  test('should cancel case creation', async ({ page }) => {
    await dashboardPage.clickCreateCase();
    await createCasePage.expectToBeOnCreateCasePage();

    // Start filling form
    await createCasePage.titleInput.fill('Test Case');

    // Cancel
    await createCasePage.cancelButton.click();

    // Should return to dashboard
    await dashboardPage.expectToBeOnDashboard();
  });

  test('should create case and upload document', async ({ page }) => {
    // Create case
    await dashboardPage.clickCreateCase();
    await createCasePage.createCase({
      title: 'Case with Document',
      client: 'Test Client',
      type: 'Civil Law',
    });

    // Switch to documents tab
    await caseDetailPage.switchToDocumentsTab();

    // Upload document
    // Note: In real test, provide path to test fixture file
    // await caseDetailPage.uploadDocument('./tests/fixtures/sample-contract.pdf');

    // Verify document appears in list
    // await expect(page.getByText('sample-contract.pdf')).toBeVisible();
  });
});

// -------------------------------------------------------------------------
// EXAMPLE 3: Cross-Page Navigation Test
// -------------------------------------------------------------------------

test.describe('Navigation and User Flows', () => {
  test('should navigate through multiple pages', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login
    await loginPage.goto();
    await loginPage.loginAsPartner();

    // Navigate to dashboard
    await dashboardPage.expectToBeOnDashboard();

    // Click on a case
    const caseRow = await dashboardPage.getCaseByTitle('Existing Case');
    await caseRow.click();

    // Should navigate to case detail
    const caseDetailPage = new CaseDetailPage(page);
    await caseDetailPage.expectCaseTitle('Existing Case');

    // Navigate back using browser back button
    await page.goBack();
    await dashboardPage.expectToBeOnDashboard();
  });
});

// -------------------------------------------------------------------------
// EXAMPLE 4: Role-Based Access Test
// -------------------------------------------------------------------------

test.describe('Role-Based Access Control', () => {
  test('Partner should see all features', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.loginAsPartner();

    await dashboardPage.expectToBeOnDashboard();

    // Partner should see create case button
    await expect(dashboardPage.createCaseButton).toBeVisible();
  });

  test('Paralegal should have limited features', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.loginAsParalegal();

    await dashboardPage.expectToBeOnDashboard();

    // Paralegal should not see create case button
    await expect(dashboardPage.createCaseButton).not.toBeVisible();
  });
});

// -------------------------------------------------------------------------
// EXAMPLE 5: Multi-Browser Test
// -------------------------------------------------------------------------

test.describe('Cross-Browser Compatibility', () => {
  test('should work in all browsers', async ({ page, browserName }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.loginAsPartner();

    // Basic functionality should work across all browsers
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.expectToBeOnDashboard();

    // Can add browser-specific expectations
    if (browserName === 'webkit') {
      // Safari-specific test
    }
  });
});

// ============================================================================
// PLAYWRIGHT BEST PRACTICES
// ============================================================================

/**
 * ✅ DO:
 * - Use Page Object Model for maintainability
 * - Use accessible locators (getByRole, getByLabel)
 * - Wait for elements properly (auto-waiting)
 * - Test real user workflows end-to-end
 * - Run tests in parallel for speed
 * - Use test fixtures for data setup
 * - Test cross-browser compatibility
 * - Capture screenshots/videos on failure
 * - Use page.waitForLoadState() after navigation
 * - Test authentication and sessions
 *
 * ❌ DON'T:
 * - Use hard-coded waits (page.waitForTimeout())
 * - Test too many scenarios in one test
 * - Use fragile CSS selectors
 * - Skip error scenarios
 * - Test unit-level logic in E2E tests
 * - Run E2E tests for every small change
 * - Ignore flaky tests
 * - Test external APIs directly
 */

/**
 * LOCATOR PRIORITY (Playwright):
 * 1. page.getByRole() - Most resilient
 * 2. page.getByLabel() - For form fields
 * 3. page.getByPlaceholder() - For inputs
 * 4. page.getByText() - For text content
 * 5. page.getByTestId() - Last resort
 *
 * WAITING STRATEGIES:
 * - Auto-waiting: Playwright waits automatically (preferred)
 * - page.waitForLoadState() - Wait for page load
 * - page.waitForURL() - Wait for navigation
 * - expect(locator).toBeVisible() - Wait for element
 * - page.waitForResponse() - Wait for API call
 *
 * FIXTURES:
 * - Store test data in tests/fixtures/
 * - Use factories to generate test data
 * - Clean up data in afterEach()
 *
 * DEBUGGING:
 * - Use --headed flag to see browser
 * - Use --debug flag for step-through
 * - Use page.pause() to pause execution
 * - Check screenshots in test-results/
 *
 * PERFORMANCE:
 * - Run tests in parallel (default)
 * - Use test.describe.configure({ mode: 'parallel' })
 * - Share authentication state across tests
 * - Use global setup for seeding
 *
 * Run: pnpm test:e2e
 * Debug: pnpm test:e2e:debug
 * UI Mode: pnpm test:e2e:ui
 */
