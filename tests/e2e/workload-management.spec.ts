/**
 * Workload Management E2E Tests
 * Story 4.5: Team Workload Management
 *
 * End-to-end tests for workload management features
 * using Playwright for browser automation
 */

import { test, expect, Page } from '@playwright/test';

// Test user credentials
const TEST_USER = {
  email: 'test-partner@testfirm.com',
  password: 'test-password-123',
};

// Helper to log in
async function login(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', TEST_USER.email);
  await page.fill('[data-testid="password-input"]', TEST_USER.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

test.describe('Team Workload Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.describe('AC: 1 - Team Calendar', () => {
    test('should display team calendar with all members', async ({ page }) => {
      await page.goto('/team/calendar');

      // Verify calendar view is visible
      await expect(page.locator('[data-testid="team-calendar"]')).toBeVisible();

      // Verify team members are listed
      await expect(page.locator('[data-testid="team-member-row"]')).toHaveCount({ minimum: 1 });
    });

    test('should show tasks on calendar for each day', async ({ page }) => {
      await page.goto('/team/calendar');

      // Click on a day with tasks
      await page.click('[data-testid="calendar-day-with-tasks"]');

      // Verify task details popup
      await expect(page.locator('[data-testid="task-list-popup"]')).toBeVisible();
    });

    test('should display availability overlays', async ({ page }) => {
      await page.goto('/team/calendar');

      // Check for availability indicator (vacation, OOO, etc.)
      const availabilityBadge = page.locator('[data-testid="availability-badge"]');

      if ((await availabilityBadge.count()) > 0) {
        await expect(availabilityBadge.first()).toBeVisible();
      }
    });

    test('should navigate between weeks', async ({ page }) => {
      await page.goto('/team/calendar');

      // Get current week dates
      const currentWeek = await page.locator('[data-testid="current-week-label"]').textContent();

      // Navigate to next week
      await page.click('[data-testid="next-week-button"]');

      // Verify week changed
      const newWeek = await page.locator('[data-testid="current-week-label"]').textContent();
      expect(newWeek).not.toBe(currentWeek);
    });
  });

  test.describe('AC: 2 - Workload Meter', () => {
    test('should display workload meter for team', async ({ page }) => {
      await page.goto('/team/workload');

      await expect(page.locator('[data-testid="workload-meter"]')).toBeVisible();
    });

    test('should show color-coded workload status', async ({ page }) => {
      await page.goto('/team/workload');

      // Check for status indicators
      const statusBadges = page.locator('[data-testid="workload-status-badge"]');
      await expect(statusBadges).toHaveCount({ minimum: 1 });

      // Verify one of the expected statuses is present
      const badgeText = await statusBadges.first().textContent();
      expect(['Under-utilized', 'Optimal', 'Near Capacity', 'Overloaded']).toContain(
        badgeText?.trim()
      );
    });

    test('should show allocated vs capacity hours', async ({ page }) => {
      await page.goto('/team/workload');

      // Verify hours display
      await expect(page.locator('[data-testid="allocated-hours"]')).toBeVisible();
      await expect(page.locator('[data-testid="capacity-hours"]')).toBeVisible();
    });

    test('should update when date range changes', async ({ page }) => {
      await page.goto('/team/workload');

      // Change date range
      await page.click('[data-testid="date-range-selector"]');
      await page.click('[data-testid="next-week-option"]');

      // Verify data refreshes (loading indicator appears/disappears)
      await expect(page.locator('[data-testid="workload-meter"]')).toBeVisible();
    });
  });

  test.describe('AC: 3 - AI Assignment Suggestions', () => {
    test('should show assignment suggestions when creating task', async ({ page }) => {
      await page.goto('/tasks/new');

      // Fill in task details
      await page.fill('[data-testid="task-title-input"]', 'Legal Research Task');
      await page.selectOption('[data-testid="task-type-select"]', 'Research');
      await page.fill('[data-testid="estimated-hours-input"]', '4');

      // Wait for suggestions panel
      await expect(page.locator('[data-testid="assignment-suggestion-panel"]')).toBeVisible({
        timeout: 5000,
      });
    });

    test('should display match scores for suggested assignees', async ({ page }) => {
      await page.goto('/tasks/new');

      await page.fill('[data-testid="task-title-input"]', 'Contract Drafting');
      await page.selectOption('[data-testid="task-type-select"]', 'DocumentCreation');

      // Wait for suggestions
      await page.waitForSelector('[data-testid="suggestion-card"]');

      // Verify match score is visible
      await expect(page.locator('[data-testid="match-score"]').first()).toBeVisible();
    });

    test('should highlight recommended assignee', async ({ page }) => {
      await page.goto('/tasks/new');

      await page.fill('[data-testid="task-title-input"]', 'Court Filing');
      await page.selectOption('[data-testid="task-type-select"]', 'CourtDate');

      await page.waitForSelector('[data-testid="suggestion-card"]');

      // Check for recommended badge
      const recommendedBadge = page.locator('[data-testid="recommended-badge"]');
      await expect(recommendedBadge).toBeVisible();
    });

    test('should allow selecting suggested assignee', async ({ page }) => {
      await page.goto('/tasks/new');

      await page.fill('[data-testid="task-title-input"]', 'Research Task');
      await page.selectOption('[data-testid="task-type-select"]', 'Research');

      await page.waitForSelector('[data-testid="suggestion-card"]');

      // Click assign button
      await page.click('[data-testid="assign-button"]');

      // Verify assignee is selected
      await expect(page.locator('[data-testid="selected-assignee"]')).toBeVisible();
    });
  });

  test.describe('AC: 4 - Delegation Handoff', () => {
    test('should show handoff form when delegating task', async ({ page }) => {
      await page.goto('/tasks');

      // Click on a task to open details
      await page.click('[data-testid="task-row"]');

      // Click delegate button
      await page.click('[data-testid="delegate-button"]');

      // Verify handoff form appears
      await expect(page.locator('[data-testid="handoff-form"]')).toBeVisible();
    });

    test('should generate AI handoff notes', async ({ page }) => {
      await page.goto('/tasks');
      await page.click('[data-testid="task-row"]');
      await page.click('[data-testid="delegate-button"]');

      // Click generate AI button
      await page.click('[data-testid="generate-ai-handoff"]');

      // Wait for generation
      await page.waitForSelector('[data-testid="handoff-notes-textarea"]');

      // Verify notes are populated
      const notesValue = await page.inputValue('[data-testid="handoff-notes-textarea"]');
      expect(notesValue.length).toBeGreaterThan(0);
    });

    test('should link related tasks and documents', async ({ page }) => {
      await page.goto('/tasks');
      await page.click('[data-testid="task-row"]');
      await page.click('[data-testid="delegate-button"]');

      // Check related items section
      await expect(page.locator('[data-testid="related-tasks-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="related-docs-section"]')).toBeVisible();
    });
  });

  test.describe('AC: 5 - OOO Reassignment', () => {
    test('should show OOO banner when viewing unavailable user', async ({ page }) => {
      await page.goto('/team/calendar');

      // Look for OOO user row
      const oooUser = page.locator('[data-testid="user-ooo-indicator"]');

      if ((await oooUser.count()) > 0) {
        await oooUser.first().click();

        // Verify OOO banner
        await expect(page.locator('[data-testid="ooo-banner"]')).toBeVisible();
      }
    });

    test('should display reassignment information', async ({ page }) => {
      // Navigate to availability settings
      await page.goto('/settings/availability');

      // Create OOO entry with auto-reassign
      await page.click('[data-testid="add-availability-button"]');
      await page.selectOption('[data-testid="availability-type"]', 'Vacation');
      await page.fill('[data-testid="start-date"]', '2025-12-15');
      await page.fill('[data-testid="end-date"]', '2025-12-20');
      await page.check('[data-testid="auto-reassign-checkbox"]');

      // Verify delegate selector appears
      await expect(page.locator('[data-testid="delegate-selector"]')).toBeVisible();
    });
  });

  test.describe('AC: 6 - Capacity Planning', () => {
    test('should display capacity forecast', async ({ page }) => {
      await page.goto('/team/capacity');

      await expect(page.locator('[data-testid="capacity-forecast"]')).toBeVisible();
    });

    test('should show bottleneck warnings', async ({ page }) => {
      await page.goto('/team/capacity');

      // Check for bottleneck indicators
      const bottlenecks = page.locator('[data-testid="bottleneck-alert"]');

      if ((await bottlenecks.count()) > 0) {
        await expect(bottlenecks.first()).toBeVisible();

        // Verify severity indicator
        await expect(page.locator('[data-testid="bottleneck-severity"]').first()).toBeVisible();
      }
    });

    test('should display team capacity chart', async ({ page }) => {
      await page.goto('/team/capacity');

      await expect(page.locator('[data-testid="capacity-chart"]')).toBeVisible();
    });

    test('should show recommendations for bottlenecks', async ({ page }) => {
      await page.goto('/team/capacity');

      const recommendations = page.locator('[data-testid="capacity-recommendation"]');

      if ((await recommendations.count()) > 0) {
        await expect(recommendations.first()).toBeVisible();
      }
    });

    test('should indicate overall risk level', async ({ page }) => {
      await page.goto('/team/capacity');

      await expect(page.locator('[data-testid="overall-risk-badge"]')).toBeVisible();

      const riskText = await page.locator('[data-testid="overall-risk-badge"]').textContent();
      expect(['Low', 'Medium', 'High']).toContain(riskText?.trim());
    });
  });

  test.describe('User Skills Management', () => {
    test('should allow user to manage their skills', async ({ page }) => {
      await page.goto('/settings/skills');

      await expect(page.locator('[data-testid="skills-manager"]')).toBeVisible();
    });

    test('should add new skill', async ({ page }) => {
      await page.goto('/settings/skills');

      // Click add skill
      await page.click('[data-testid="add-skill-button"]');

      // Select skill type
      await page.click('[data-testid="skill-option-LegalResearch"]');

      // Verify skill added
      await expect(page.locator('[data-testid="skill-card-LegalResearch"]')).toBeVisible();
    });

    test('should update skill proficiency', async ({ page }) => {
      await page.goto('/settings/skills');

      // Find existing skill and update proficiency
      const proficiencySlider = page.locator('[data-testid="proficiency-slider"]').first();

      if ((await proficiencySlider.count()) > 0) {
        // Click on level 4
        await page.click('[data-testid="proficiency-level-4"]');

        // Save changes
        await page.click('[data-testid="save-skills-button"]');

        // Verify success
        await expect(page.locator('[data-testid="save-success-toast"]')).toBeVisible();
      }
    });

    test('should show verified badge for partner-verified skills', async ({ page }) => {
      await page.goto('/settings/skills');

      const verifiedBadge = page.locator('[data-testid="verified-skill-badge"]');

      if ((await verifiedBadge.count()) > 0) {
        await expect(verifiedBadge.first()).toBeVisible();
      }
    });
  });
});
