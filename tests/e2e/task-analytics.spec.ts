/**
 * Task Analytics and Optimization E2E Tests
 * Story 4.7: Task Analytics and Optimization - Task 39
 *
 * End-to-end tests for task analytics features including:
 * - Completion time analytics (AC: 1)
 * - Overdue analysis (AC: 2)
 * - Velocity trends (AC: 3)
 * - Pattern detection (AC: 4)
 * - Delegation analytics (AC: 5)
 * - ROI dashboard (AC: 6)
 *
 * NOTE: These tests use mocked responses for CI/CD environments.
 * For production validation, use the manual test plan below.
 *
 * =============================================================================
 * MANUAL TEST PLAN - Task Analytics & Optimization Testing
 * =============================================================================
 *
 * PREREQUISITES:
 * 1. Platform running with all services enabled
 * 2. Test firm with:
 *    - At least 20 completed tasks in last 30 days
 *    - At least 5 overdue tasks
 *    - Multiple task types used
 *    - Multiple users with task assignments
 *    - At least 10 delegated tasks
 * 3. Authenticated user with analytics access permissions
 * 4. Historical task data for at least 90 days
 *
 * =============================================================================
 * TEST SCENARIOS
 * =============================================================================
 *
 * TC-1: View Completion Time Analytics (AC: 1)
 * ----------------------------------------
 * Steps:
 * 1. Navigate to Analytics > Task Analytics page
 * 2. Select "Completion Time" tab
 * 3. Set date range to last 30 days
 * 4. View firm-wide metrics
 * 5. Expand "By Task Type" section
 * 6. Expand "By User" section
 * Expected Result:
 * - Firm metrics show avg/median/min/max completion times in hours
 * - By Type section shows breakdown per task type with comparison %
 * - By User section shows each user's metrics vs team average
 * - Charts render correctly
 *
 * TC-2: Filter Completion Time Analytics
 * ----------------------------------------
 * Prerequisite: TC-1 completed
 * Steps:
 * 1. Apply task type filter: "Research"
 * 2. Apply user filter: Select 2-3 users
 * 3. Change date range to last 7 days
 * 4. Click "Apply Filters"
 * Expected Result:
 * - Results update to show only filtered data
 * - Metrics recalculate correctly
 * - Comparison percentages update
 *
 * TC-3: View Overdue Analysis (AC: 2)
 * ----------------------------------------
 * Steps:
 * 1. Navigate to Analytics > Task Analytics page
 * 2. Select "Overdue Analysis" tab
 * 3. View total overdue count
 * 4. Review "By Type" breakdown
 * 5. Review "By User" breakdown
 * 6. View "Bottleneck Patterns" section
 * 7. View "Critical Tasks" list
 * Expected Result:
 * - Total overdue count displayed prominently
 * - Type breakdown shows count and avg days overdue
 * - User breakdown sorted by count
 * - Bottleneck patterns identified with suggested actions
 * - Critical tasks sorted by impact (critical first)
 *
 * TC-4: Identify Bottleneck Patterns
 * ----------------------------------------
 * Prerequisite: TC-3 completed
 * Steps:
 * 1. Review bottleneck patterns section
 * 2. Expand "User Overload" pattern if present
 * 3. Expand "Task Type Delays" pattern if present
 * 4. Expand "Dependency Chain" pattern if present
 * 5. Click on suggested action
 * Expected Result:
 * - Each pattern shows description and affected task count
 * - Suggested actions are actionable
 * - Related users/task types are clickable
 *
 * TC-5: View Velocity Trends (AC: 3)
 * ----------------------------------------
 * Steps:
 * 1. Navigate to Analytics > Task Analytics page
 * 2. Select "Velocity Trends" tab
 * 3. View firm velocity score
 * 4. Select "Weekly" interval
 * 5. View time series chart
 * 6. View user velocity comparison
 * Expected Result:
 * - Firm velocity shows current vs previous with trend arrow
 * - Time series chart shows tasks created vs completed
 * - Velocity score per data point (ratio to target)
 * - User comparison shows improving/declining/stable indicators
 *
 * TC-6: Compare Velocity by User
 * ----------------------------------------
 * Prerequisite: TC-5 completed
 * Steps:
 * 1. Sort user velocity table by "Current Velocity"
 * 2. Sort by "Change %"
 * 3. Click on user row to view details
 * Expected Result:
 * - Table sortable by all columns
 * - Positive % shown in green, negative in red
 * - User detail shows historical trend
 *
 * TC-7: Detect Task Patterns (AC: 4)
 * ----------------------------------------
 * Steps:
 * 1. Navigate to Analytics > Task Analytics page
 * 2. Select "Pattern Detection" tab
 * 3. Review detected patterns
 * 4. View pattern confidence scores
 * 5. View sample cases for a pattern
 * Expected Result:
 * - Patterns sorted by confidence (high first)
 * - Each pattern shows task types and occurrence count
 * - High confidence (>80%) highlighted
 * - Sample cases clickable
 *
 * TC-8: Create Template from Pattern
 * ----------------------------------------
 * Prerequisite: TC-7 completed
 * Steps:
 * 1. Select a high-confidence pattern
 * 2. Click "Create Template" button
 * 3. Enter template name and description
 * 4. Click "Create"
 * 5. View created template
 * Expected Result:
 * - Template creation dialog opens
 * - Template created with correct task types
 * - Pattern marked as "Template Created"
 * - Template visible in Templates list
 *
 * TC-9: Dismiss Pattern
 * ----------------------------------------
 * Prerequisite: TC-7 completed
 * Steps:
 * 1. Click dismiss icon on a pattern
 * 2. Confirm dismissal
 * Expected Result:
 * - Pattern removed from list
 * - Confirmation message shown
 * - Pattern does not reappear in future analyses
 *
 * TC-10: View Delegation Analytics (AC: 5)
 * ----------------------------------------
 * Steps:
 * 1. Navigate to Analytics > Task Analytics page
 * 2. Select "Delegation Analytics" tab
 * 3. View firm-wide success rate
 * 4. View user delegation patterns
 * 5. View delegation flows
 * 6. View training opportunities
 * Expected Result:
 * - Firm success rate displayed prominently
 * - User patterns show received/given counts and success rates
 * - Flows show from-to relationships with counts
 * - Training opportunities sorted by priority
 *
 * TC-11: Review Training Suggestions
 * ----------------------------------------
 * Prerequisite: TC-10 completed
 * Steps:
 * 1. Expand a user with training opportunities
 * 2. View suggested training areas
 * 3. Review priority levels
 * 4. Click on suggested action
 * Expected Result:
 * - High priority suggestions highlighted
 * - Each suggestion shows skill area and reason
 * - Actions are specific and actionable
 *
 * TC-12: View ROI Dashboard (AC: 6)
 * ----------------------------------------
 * Steps:
 * 1. Navigate to Analytics > Task Analytics page
 * 2. Select "ROI Dashboard" tab
 * 3. View total time saved
 * 4. View total value saved
 * 5. View time series chart
 * 6. View savings by category
 * Expected Result:
 * - Time saved displayed in hours
 * - Value saved displayed in currency (RON)
 * - Chart shows monthly trend
 * - Categories show template, NLP, and automation breakdown
 *
 * TC-13: Project Annual Savings
 * ----------------------------------------
 * Prerequisite: TC-12 completed
 * Steps:
 * 1. View projected annual savings
 * 2. Change date range to 7 days
 * 3. View updated projection
 * 4. Change date range to 90 days
 * 5. View updated projection
 * Expected Result:
 * - Projection extrapolates from current period
 * - Shorter periods may show higher variance
 * - Longer periods show more stable projections
 *
 * TC-14: Review Template Adoption Rate
 * ----------------------------------------
 * Prerequisite: TC-12 completed
 * Steps:
 * 1. View template adoption rate %
 * 2. Compare template vs manual task counts
 * 3. View comparison to previous period
 * Expected Result:
 * - Adoption rate = template tasks / total tasks
 * - Comparison shows growth/decline %
 * - Higher adoption correlates with more time savings
 *
 * TC-15: Export Analytics Data
 * ----------------------------------------
 * Steps:
 * 1. Navigate to any analytics tab
 * 2. Click "Export" button
 * 3. Select format (CSV/Excel)
 * 4. Download file
 * 5. Open and verify data
 * Expected Result:
 * - Export includes all visible data
 * - Date range and filters preserved
 * - Numbers formatted correctly
 * - File opens without errors
 *
 * =============================================================================
 * PERFORMANCE VALIDATION
 * =============================================================================
 *
 * PV-1: Large Dataset Performance
 * Steps:
 * 1. Configure test data with 10,000+ tasks
 * 2. Navigate to analytics page
 * 3. Measure page load time
 * 4. Apply filters and measure response time
 * Expected: Initial load <3s, filter updates <1s
 *
 * PV-2: Caching Validation
 * Steps:
 * 1. Load analytics page
 * 2. Note response time
 * 3. Reload page within 15 minutes
 * 4. Compare response times
 * Expected: Cached response 50%+ faster
 *
 * PV-3: Real-time Updates
 * Steps:
 * 1. Open analytics in one browser
 * 2. Complete a task in another browser
 * 3. Wait for cache invalidation (15 min) or manually refresh
 * 4. Verify new data appears
 * Expected: Data updates after cache expiry or manual refresh
 *
 * =============================================================================
 * ACCESSIBILITY VALIDATION
 * =============================================================================
 *
 * A-1: Keyboard Navigation
 * Steps: Navigate all analytics tabs and controls using only keyboard
 * Expected: All interactive elements focusable and operable
 *
 * A-2: Screen Reader Compatibility
 * Steps: Use VoiceOver/NVDA to navigate analytics
 * Expected: All data tables and charts have appropriate labels
 *
 * A-3: Color Contrast
 * Steps: Use color contrast analyzer on charts
 * Expected: Meets WCAG 2.1 AA standards
 */

import { test, expect, type Page } from '@playwright/test';

// Test configuration
const TEST_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 30000;

// Test data
const testFirmId = 'test-firm-analytics';
const testUserId = 'test-user-partner';

// Helper functions
async function loginAsTestUser(page: Page): Promise<void> {
  // Mock authentication for e2e tests
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'auth-token',
      JSON.stringify({
        accessToken: 'test-token',
        user: {
          id: 'test-user-partner',
          email: 'partner@testfirm.com',
          firstName: 'Test',
          lastName: 'Partner',
          role: 'Partner',
          firmId: 'test-firm-analytics',
        },
      })
    );
  });
}

async function navigateToAnalytics(page: Page): Promise<void> {
  await page.goto(`${TEST_BASE_URL}/analytics/tasks`);
  await page.waitForLoadState('networkidle');
}

async function mockAnalyticsAPI(page: Page): Promise<void> {
  // Mock completion time analytics
  await page.route('**/graphql', async (route) => {
    const request = route.request();
    const body = request.postDataJSON();

    if (body?.query?.includes('completionTimeAnalytics')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            completionTimeAnalytics: {
              firmMetrics: {
                avgCompletionTimeHours: 36.5,
                medianCompletionTimeHours: 24.0,
                minCompletionTimeHours: 2.0,
                maxCompletionTimeHours: 168.0,
                totalTasksAnalyzed: 45,
              },
              byType: [
                {
                  taskType: 'Research',
                  metrics: {
                    avgCompletionTimeHours: 24.0,
                    totalTasksAnalyzed: 20,
                  },
                  comparedToPrevious: -15.5,
                },
                {
                  taskType: 'DocumentCreation',
                  metrics: {
                    avgCompletionTimeHours: 48.0,
                    totalTasksAnalyzed: 15,
                  },
                  comparedToPrevious: 10.2,
                },
              ],
              byUser: [
                {
                  userId: 'user-1',
                  userName: 'Jane Associate',
                  metrics: { avgCompletionTimeHours: 20.0, totalTasksAnalyzed: 18 },
                  taskCount: 18,
                  comparedToTeamAvg: -45.2,
                },
                {
                  userId: 'user-2',
                  userName: 'Bob Paralegal',
                  metrics: { avgCompletionTimeHours: 50.0, totalTasksAnalyzed: 12 },
                  taskCount: 12,
                  comparedToTeamAvg: 37.0,
                },
              ],
              dateRange: {
                start: '2025-11-01T00:00:00Z',
                end: '2025-11-30T23:59:59Z',
              },
            },
          },
        }),
      });
    }

    if (body?.query?.includes('overdueAnalytics')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            overdueAnalytics: {
              totalOverdue: 8,
              overdueByType: [
                { taskType: 'Research', count: 5, avgDaysOverdue: 4.5 },
                { taskType: 'Meeting', count: 3, avgDaysOverdue: 2.0 },
              ],
              overdueByUser: [
                { userId: 'user-2', userName: 'Bob Paralegal', count: 6 },
                { userId: 'user-1', userName: 'Jane Associate', count: 2 },
              ],
              bottleneckPatterns: [
                {
                  patternType: 'user_overload',
                  description: '1 user has significantly more overdue tasks than average',
                  affectedTasks: 6,
                  suggestedAction: 'Consider redistributing tasks',
                  relatedUsers: ['user-2'],
                },
              ],
              criticalTasks: [
                {
                  taskId: 'task-critical-1',
                  taskTitle: 'Critical Court Preparation',
                  taskType: 'CourtDate',
                  assigneeName: 'Bob Paralegal',
                  daysOverdue: 5,
                  estimatedImpact: 'critical',
                  blockedBy: [],
                },
              ],
            },
          },
        }),
      });
    }

    if (body?.query?.includes('velocityTrends')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            velocityTrends: {
              firmVelocity: {
                current: 1.15,
                previous: 0.95,
                trend: 'improving',
                percentageChange: 21.05,
              },
              timeSeries: [
                { date: '2025-11-04', tasksCreated: 12, tasksCompleted: 10, velocityScore: 0.9, trend: 'stable' },
                { date: '2025-11-11', tasksCreated: 15, tasksCompleted: 14, velocityScore: 1.05, trend: 'improving' },
                { date: '2025-11-18', tasksCreated: 18, tasksCompleted: 20, velocityScore: 1.25, trend: 'improving' },
                { date: '2025-11-25', tasksCreated: 14, tasksCompleted: 16, velocityScore: 1.15, trend: 'stable' },
              ],
              byUser: [
                { userId: 'user-1', userName: 'Jane Associate', currentVelocity: 1.3, previousVelocity: 1.0, trendDirection: 'up', percentageChange: 30 },
                { userId: 'user-2', userName: 'Bob Paralegal', currentVelocity: 0.8, previousVelocity: 0.9, trendDirection: 'down', percentageChange: -11.1 },
              ],
              interval: 'weekly',
            },
          },
        }),
      });
    }

    if (body?.query?.includes('taskPatterns')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            taskPatterns: {
              patterns: [
                {
                  id: 'pattern-1',
                  taskTypes: ['Research', 'DocumentCreation'],
                  caseTypes: ['Corporate'],
                  occurrenceCount: 8,
                  confidence: 0.85,
                  suggestedTemplateName: 'Research with Document Creation',
                  isTemplateCreated: false,
                  commonAssignees: [{ userId: 'user-1', userName: 'Jane Associate', frequency: 6 }],
                  sampleCases: [{ caseId: 'case-1', caseTitle: 'Smith Corp Merger' }],
                },
                {
                  id: 'pattern-2',
                  taskTypes: ['Meeting', 'Research'],
                  caseTypes: ['Civil'],
                  occurrenceCount: 5,
                  confidence: 0.72,
                  suggestedTemplateName: 'Meeting with Research',
                  avgSequenceGapDays: 2.5,
                  isTemplateCreated: false,
                  commonAssignees: [],
                  sampleCases: [],
                },
              ],
              analysisDate: '2025-11-30T10:00:00Z',
              totalPatternsFound: 2,
              highConfidenceCount: 1,
            },
          },
        }),
      });
    }

    if (body?.query?.includes('delegationAnalytics')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            delegationAnalytics: {
              byUser: [
                {
                  userId: 'user-1',
                  userName: 'Jane Associate',
                  role: 'Associate',
                  delegationsReceived: 12,
                  delegationsGiven: 5,
                  successRate: 0.92,
                  avgCompletionDays: 2.1,
                  strengthAreas: ['Research', 'DocumentCreation'],
                  struggleAreas: [],
                  suggestedTraining: [],
                },
                {
                  userId: 'user-2',
                  userName: 'Bob Paralegal',
                  role: 'Paralegal',
                  delegationsReceived: 15,
                  delegationsGiven: 0,
                  successRate: 0.4,
                  avgCompletionDays: 4.5,
                  strengthAreas: ['DocumentRetrieval'],
                  struggleAreas: ['Research'],
                  suggestedTraining: [
                    {
                      skillArea: 'Research',
                      reason: 'Low success rate on 8 research tasks',
                      priority: 'high',
                      suggestedAction: 'Review legal research methodology and database usage training',
                    },
                  ],
                },
              ],
              topDelegationFlows: [
                { fromUserId: 'user-partner', fromUserName: 'John Partner', toUserId: 'user-1', toUserName: 'Jane Associate', count: 10, avgSuccessRate: 0.9 },
                { fromUserId: 'user-partner', fromUserName: 'John Partner', toUserId: 'user-2', toUserName: 'Bob Paralegal', count: 8, avgSuccessRate: 0.5 },
              ],
              firmWideSuccessRate: 0.67,
              trainingOpportunities: [
                {
                  userId: 'user-2',
                  userName: 'Bob Paralegal',
                  suggestions: [
                    { skillArea: 'Research', priority: 'high', suggestedAction: 'Review legal research methodology' },
                  ],
                },
              ],
            },
          },
        }),
      });
    }

    if (body?.query?.includes('roiDashboard')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            roiDashboard: {
              currentPeriod: {
                templateTasksCreated: 25,
                manualTasksCreated: 40,
                templateAdoptionRate: 27.47,
                estimatedTemplateTimeSavedHours: 2.08,
                nlpTasksCreated: 18,
                estimatedNLPTimeSavedHours: 0.6,
                autoRemindersSet: 60,
                autoDependencyTriggers: 12,
                autoReassignments: 3,
                estimatedAutomationTimeSavedHours: 1.5,
                totalTimeSavedHours: 4.18,
                avgHourlyRate: 250,
                totalValueSaved: 1045,
                comparisonPeriod: {
                  start: '2025-11-01T00:00:00Z',
                  end: '2025-11-30T23:59:59Z',
                },
                previousPeriodSavings: 800,
                savingsGrowthPercent: 30.63,
              },
              timeSeries: [
                { date: '2025-11-01', timeSavedHours: 1.2, valueSaved: 300 },
                { date: '2025-12-01', timeSavedHours: 1.5, valueSaved: 375 },
              ],
              projectedAnnualSavings: 12696.17,
              topSavingsCategories: [
                { category: 'Template Tasks', hoursSaved: 2.08, valueSaved: 520, percentageOfTotal: 49.76 },
                { category: 'Automation Features', hoursSaved: 1.5, valueSaved: 375, percentageOfTotal: 35.89 },
                { category: 'NLP Task Creation', hoursSaved: 0.6, valueSaved: 150, percentageOfTotal: 14.35 },
              ],
            },
          },
        }),
      });
    }

    // Default: continue with actual request
    return route.continue();
  });
}

// Test suites
test.describe('Task Analytics E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await mockAnalyticsAPI(page);
  });

  test.describe('Completion Time Analytics (AC: 1)', () => {
    test('should display firm-wide completion metrics', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-completion-time"]');

      await expect(page.locator('[data-testid="avg-completion-time"]')).toContainText('36.5');
      await expect(page.locator('[data-testid="median-completion-time"]')).toContainText('24');
      await expect(page.locator('[data-testid="total-tasks-analyzed"]')).toContainText('45');
    });

    test('should display by-type breakdown', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-completion-time"]');

      await expect(page.locator('[data-testid="by-type-research"]')).toBeVisible();
      await expect(page.locator('[data-testid="by-type-research"]')).toContainText('24');
      await expect(page.locator('[data-testid="by-type-research"]')).toContainText('-15.5%');
    });

    test('should display by-user comparison', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-completion-time"]');

      await expect(page.locator('[data-testid="by-user-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-jane-associate"]')).toContainText('-45.2%');
    });
  });

  test.describe('Overdue Analysis (AC: 2)', () => {
    test('should display total overdue count', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-overdue"]');

      await expect(page.locator('[data-testid="total-overdue"]')).toContainText('8');
    });

    test('should display bottleneck patterns', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-overdue"]');

      await expect(page.locator('[data-testid="bottleneck-patterns"]')).toBeVisible();
      await expect(page.locator('[data-testid="pattern-user_overload"]')).toContainText(
        'redistribute'
      );
    });

    test('should display critical tasks with impact', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-overdue"]');

      await expect(page.locator('[data-testid="critical-tasks"]')).toBeVisible();
      await expect(page.locator('[data-testid="task-critical-1"]')).toContainText('critical');
    });
  });

  test.describe('Velocity Trends (AC: 3)', () => {
    test('should display firm velocity with trend', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-velocity"]');

      await expect(page.locator('[data-testid="firm-velocity"]')).toContainText('1.15');
      await expect(page.locator('[data-testid="velocity-trend"]')).toContainText('improving');
      await expect(page.locator('[data-testid="velocity-change"]')).toContainText('21.05%');
    });

    test('should display time series chart', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-velocity"]');

      await expect(page.locator('[data-testid="velocity-chart"]')).toBeVisible();
    });

    test('should display user velocity comparison', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-velocity"]');

      const janeRow = page.locator('[data-testid="user-velocity-user-1"]');
      await expect(janeRow).toContainText('1.3');
      await expect(janeRow).toContainText('up');

      const bobRow = page.locator('[data-testid="user-velocity-user-2"]');
      await expect(bobRow).toContainText('0.8');
      await expect(bobRow).toContainText('down');
    });
  });

  test.describe('Pattern Detection (AC: 4)', () => {
    test('should display detected patterns', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-patterns"]');

      await expect(page.locator('[data-testid="pattern-count"]')).toContainText('2');
      await expect(page.locator('[data-testid="high-confidence-count"]')).toContainText('1');
    });

    test('should display pattern details', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-patterns"]');

      const pattern1 = page.locator('[data-testid="pattern-pattern-1"]');
      await expect(pattern1).toContainText('Research');
      await expect(pattern1).toContainText('DocumentCreation');
      await expect(pattern1).toContainText('85%');
    });

    test('should allow creating template from pattern', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-patterns"]');

      await page.click('[data-testid="create-template-pattern-1"]');
      await expect(page.locator('[data-testid="template-dialog"]')).toBeVisible();
    });
  });

  test.describe('Delegation Analytics (AC: 5)', () => {
    test('should display firm-wide success rate', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-delegation"]');

      await expect(page.locator('[data-testid="firm-success-rate"]')).toContainText('67%');
    });

    test('should display delegation flows', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-delegation"]');

      await expect(page.locator('[data-testid="delegation-flows"]')).toBeVisible();
      await expect(page.locator('[data-testid="flow-0"]')).toContainText('John Partner');
      await expect(page.locator('[data-testid="flow-0"]')).toContainText('Jane Associate');
    });

    test('should display training opportunities', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-delegation"]');

      await expect(page.locator('[data-testid="training-opportunities"]')).toBeVisible();
      await expect(page.locator('[data-testid="training-user-2"]')).toContainText('Research');
      await expect(page.locator('[data-testid="training-user-2"]')).toContainText('high');
    });
  });

  test.describe('ROI Dashboard (AC: 6)', () => {
    test('should display total time and value saved', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-roi"]');

      await expect(page.locator('[data-testid="total-time-saved"]')).toContainText('4.18');
      await expect(page.locator('[data-testid="total-value-saved"]')).toContainText('1,045');
    });

    test('should display template adoption rate', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-roi"]');

      await expect(page.locator('[data-testid="template-adoption"]')).toContainText('27.47%');
    });

    test('should display projected annual savings', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-roi"]');

      await expect(page.locator('[data-testid="projected-annual"]')).toContainText('12,696');
    });

    test('should display savings by category', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-roi"]');

      await expect(page.locator('[data-testid="savings-categories"]')).toBeVisible();
      await expect(page.locator('[data-testid="category-template"]')).toContainText('49.76%');
    });

    test('should show savings growth compared to previous period', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-roi"]');

      await expect(page.locator('[data-testid="savings-growth"]')).toContainText('30.63%');
    });
  });

  test.describe('Filtering and Date Range', () => {
    test('should filter by date range', async ({ page }) => {
      await navigateToAnalytics(page);

      await page.click('[data-testid="date-range-picker"]');
      await page.fill('[data-testid="date-start"]', '2025-11-01');
      await page.fill('[data-testid="date-end"]', '2025-11-15');
      await page.click('[data-testid="apply-filters"]');

      await expect(page.locator('[data-testid="date-range-display"]')).toContainText('Nov 1');
    });

    test('should filter by task type', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-completion-time"]');

      await page.click('[data-testid="filter-task-type"]');
      await page.click('[data-testid="option-research"]');
      await page.click('[data-testid="apply-filters"]');

      // Verify filter is applied (mock would return filtered data in real scenario)
      await expect(page.locator('[data-testid="active-filter-research"]')).toBeVisible();
    });

    test('should filter by user', async ({ page }) => {
      await navigateToAnalytics(page);
      await page.click('[data-testid="tab-velocity"]');

      await page.click('[data-testid="filter-user"]');
      await page.click('[data-testid="option-user-1"]');
      await page.click('[data-testid="apply-filters"]');

      await expect(page.locator('[data-testid="active-filter-user-1"]')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      await navigateToAnalytics(page);

      const h1 = page.locator('h1');
      await expect(h1).toContainText('Analytics');
    });

    test('should have accessible tab navigation', async ({ page }) => {
      await navigateToAnalytics(page);

      const tablist = page.locator('[role="tablist"]');
      await expect(tablist).toBeVisible();

      const tabs = page.locator('[role="tab"]');
      await expect(tabs).toHaveCount(6); // All 6 tabs
    });

    test('should be keyboard navigable', async ({ page }) => {
      await navigateToAnalytics(page);

      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });
});
