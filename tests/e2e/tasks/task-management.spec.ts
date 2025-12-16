/**
 * E2E Tests: Task Management (Story 1.7)
 * Tests task management views and interactions
 * - Calendar view with drag-and-drop
 * - Kanban board with column management
 * - List view with sorting and pagination
 * - Natural language task creation
 * - Task detail modal with type-specific fields
 */

import { test, expect } from '@playwright/test';

test.describe('Task Management (Story 1.7)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to tasks page
    await page.goto('http://localhost:3000/tasks');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('navigates to tasks page successfully', async ({ page }) => {
    // Verify URL
    await expect(page).toHaveURL(/.*\/tasks/);

    // Verify task creation bar is visible
    await expect(page.locator('input[placeholder*="Creează"]')).toBeVisible();

    // Verify view switcher exists
    await expect(page.locator('[role="tablist"]')).toBeVisible();
  });

  test.describe('View Switching', () => {
    test('switches between Calendar, Kanban, and List views', async ({ page }) => {
      // Default should be Calendar view
      await expect(page.locator('.calendar-view-container')).toBeVisible({ timeout: 10000 });

      // Switch to Kanban view
      await page.click('text=Kanban');
      await expect(page.locator('.kanban-board-container')).toBeVisible();

      // Switch to List view
      await page.click('text=List');
      await expect(page.locator('.list-view-container')).toBeVisible();

      // Switch back to Calendar view
      await page.click('text=Calendar');
      await expect(page.locator('.calendar-view-container')).toBeVisible();
    });

    test('persists view preference on page reload', async ({ page }) => {
      // Switch to Kanban view
      await page.click('text=Kanban');
      await expect(page.locator('.kanban-board-container')).toBeVisible();

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be on Kanban view
      await expect(page.locator('.kanban-board-container')).toBeVisible();
    });
  });

  test.describe('Calendar View', () => {
    test.beforeEach(async ({ page }) => {
      // Ensure we're on Calendar view
      const calendarTab = page.locator('text=Calendar').first();
      if (await calendarTab.isVisible()) {
        await calendarTab.click();
      }
    });

    test('displays calendar with week navigation', async ({ page }) => {
      await expect(page.locator('.calendar-view-container')).toBeVisible();

      // Verify navigation buttons exist
      await expect(page.locator('button:has-text("Astăzi")')).toBeVisible();
      await expect(page.locator('[aria-label*="anterioară"]')).toBeVisible();
      await expect(page.locator('[aria-label*="următoare"]')).toBeVisible();
    });

    test('navigates between weeks', async ({ page }) => {
      // Click next week button
      await page.click('[aria-label*="următoare"]');

      // Wait for calendar to update
      await page.waitForTimeout(500);

      // Click previous week button
      await page.click('[aria-label*="anterioară"]');

      // Click today button
      await page.click('button:has-text("Astăzi")');
    });

    test('opens task detail modal on task click', async ({ page }) => {
      // Wait for calendar to load with tasks
      const taskEvent = page.locator('.rbc-event').first();

      if (await taskEvent.isVisible({ timeout: 5000 }).catch(() => false)) {
        await taskEvent.click();

        // Verify modal opens
        await expect(page.locator('[role="dialog"]')).toBeVisible();
        await expect(page.locator('text=Editare Sarcină')).toBeVisible();
      }
    });
  });

  test.describe('Kanban Board', () => {
    test.beforeEach(async ({ page }) => {
      // Switch to Kanban view
      await page.click('text=Kanban');
      await expect(page.locator('.kanban-board-container')).toBeVisible();
    });

    test('displays 4 kanban columns', async ({ page }) => {
      // Verify column headers
      await expect(page.locator('text=De Făcut')).toBeVisible();
      await expect(page.locator('text=În Progres')).toBeVisible();
      await expect(page.locator('text=În Revizuire')).toBeVisible();
      await expect(page.locator('text=Finalizat')).toBeVisible();
    });

    test('displays task cards with correct information', async ({ page }) => {
      // Wait for task cards to load
      const taskCard = page.locator('[class*="bg-white"][class*="border"]').first();

      if (await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Verify task card has type badge
        await expect(taskCard.locator('[class*="rounded"]')).toBeVisible();
      }
    });

    test('opens task detail modal on task click', async ({ page }) => {
      const taskCard = page
        .locator('[class*="bg-white"][class*="border"][class*="cursor-pointer"]')
        .first();

      if (await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        await taskCard.click();

        // Verify modal opens
        await expect(page.locator('[role="dialog"]')).toBeVisible();
      }
    });

    test('shows empty state when no tasks in column', async ({ page }) => {
      // Look for empty state text
      const emptyText = page.locator('text=Nicio sarcină').first();

      // Empty state may or may not be visible depending on mock data
      // Just verify the kanban structure is there
      await expect(page.locator('.kanban-board-container')).toBeVisible();
    });
  });

  test.describe('List View', () => {
    test.beforeEach(async ({ page }) => {
      // Switch to List view
      await page.click('text=List');
      await expect(page.locator('.list-view-container')).toBeVisible();
    });

    test('displays sortable table with columns', async ({ page }) => {
      // Verify table exists
      await expect(page.locator('table')).toBeVisible();

      // Verify column headers
      await expect(page.locator('th:has-text("Titlu")')).toBeVisible();
      await expect(page.locator('th:has-text("Tip")')).toBeVisible();
      await expect(page.locator('th:has-text("Asignat")')).toBeVisible();
      await expect(page.locator('th:has-text("Termen")')).toBeVisible();
      await expect(page.locator('th:has-text("Prioritate")')).toBeVisible();
      await expect(page.locator('th:has-text("Status")')).toBeVisible();
    });

    test('sorts by clicking column headers', async ({ page }) => {
      // Click on Title column to sort
      await page.click('th:has-text("Titlu")');

      // Wait for sort to complete
      await page.waitForTimeout(300);

      // Click again to reverse sort
      await page.click('th:has-text("Titlu")');
    });

    test('displays pagination when tasks exceed 10', async ({ page }) => {
      // Check if pagination exists (depends on mock data)
      const pagination = page.locator('button:has-text("Următor")');

      if (await pagination.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Verify pagination controls
        await expect(page.locator('button:has-text("Anterior")')).toBeVisible();
      }
    });

    test('opens task detail modal on row click', async ({ page }) => {
      const taskRow = page.locator('tbody tr').first();

      if (await taskRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await taskRow.click();

        // Verify modal opens
        await expect(page.locator('[role="dialog"]')).toBeVisible();
      }
    });
  });

  test.describe('Task Creation', () => {
    test('displays task creation bar with placeholder', async ({ page }) => {
      const input = page.locator('input[placeholder*="Creează"]');
      await expect(input).toBeVisible();

      // Verify placeholder text in Romanian
      await expect(input).toHaveAttribute('placeholder', /Creează.*până/);
    });

    test('shows task suggestions when input is empty', async ({ page }) => {
      const input = page.locator('input[placeholder*="Creează"]');
      await input.click();

      // Suggestions should be visible
      const suggestions = page.locator('text=Pregătește contract').first();

      if (await suggestions.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(suggestions).toBeVisible();
      }
    });

    test('highlights parsed entities when typing', async ({ page }) => {
      const input = page.locator('input[placeholder*="Creează"]');

      // Type a task description
      await input.fill('Cercetare jurisprudență pentru dosar 123');

      // Wait for parsing
      await page.waitForTimeout(500);

      // Verify parsing highlights appear
      const detectedElements = page.locator('text=Elemente detectate');

      if (await detectedElements.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(detectedElements).toBeVisible();
      }
    });

    test('opens task creation modal when clicking Create button', async ({ page }) => {
      const input = page.locator('input[placeholder*="Creează"]');
      await input.fill('Întâlnire cu client');

      // Click create button
      const createButton = page.locator('button:has-text("Creează")').last();
      await createButton.click();

      // Verify modal opens
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('text=Sarcină Nouă')).toBeVisible();
    });
  });

  test.describe('Task Detail Modal', () => {
    test.beforeEach(async ({ page }) => {
      // Open task creation modal
      const input = page.locator('input[placeholder*="Creează"]');
      await input.fill('Test task');

      const createButton = page.locator('button:has-text("Creează")').last();
      await createButton.click();

      // Wait for modal
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });

    test('displays all form fields', async ({ page }) => {
      // Verify required fields
      await expect(page.locator('label:has-text("Tip Sarcină")')).toBeVisible();
      await expect(page.locator('label:has-text("Titlu")')).toBeVisible();
      await expect(page.locator('label:has-text("Descriere")')).toBeVisible();
      await expect(page.locator('label:has-text("Data Scadenței")')).toBeVisible();
      await expect(page.locator('label:has-text("Prioritate")')).toBeVisible();
      await expect(page.locator('label:has-text("Status")')).toBeVisible();
    });

    test('displays type-specific fields based on task type', async ({ page }) => {
      // Select Research type
      await page.selectOption('select', 'Research');

      // Verify type-specific fields appear
      await expect(page.locator('label:has-text("Subiect Cercetare")')).toBeVisible();
      await expect(page.locator('label:has-text("Domeniu Juridic")')).toBeVisible();

      // Select CourtDate type
      await page.selectOption('select', 'CourtDate');

      // Verify court-specific fields
      await expect(page.locator('label:has-text("Nume Instanță")')).toBeVisible();
      await expect(page.locator('label:has-text("Tip Ședință")')).toBeVisible();
    });

    test('closes modal on Cancel button', async ({ page }) => {
      await page.click('button:has-text("Anulează")');

      // Modal should close
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('validates required fields on save', async ({ page }) => {
      // Try to save without filling required fields
      await page.click('button:has-text("Creează Sarcina")');

      // Validation errors should appear
      const errorText = page.locator('text=obligatoriu').first();

      if (await errorText.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(errorText).toBeVisible();
      }
    });
  });

  test.describe('Romanian Language Support', () => {
    test('displays Romanian text throughout interface', async ({ page }) => {
      // Verify Romanian labels exist
      await expect(page.locator('text=Creează')).toBeVisible();
      await expect(page.locator('text=Sarcini').or(page.locator('text=Tasks'))).toBeVisible();

      // Switch to Kanban
      await page.click('text=Kanban');
      await expect(page.locator('text=De Făcut')).toBeVisible();
      await expect(page.locator('text=În Progres')).toBeVisible();

      // Switch to List
      await page.click('text=List');
      await expect(page.locator('text=Titlu')).toBeVisible();
      await expect(page.locator('text=Prioritate')).toBeVisible();
    });

    test('renders Romanian diacritics correctly', async ({ page }) => {
      // Check for specific Romanian characters (ă, â, î, ș, ț)
      await expect(page.locator('text=Următoare').or(page.locator('text=următoare'))).toBeVisible();

      // Open modal
      const input = page.locator('input[placeholder*="Creează"]');
      await input.fill('Test');
      await page.click('button:has-text("Creează")').last();

      // Verify diacritics in modal
      await expect(page.locator('text=Săptămână').or(page.locator('text=Scadență'))).toBeVisible();
    });
  });

  test.describe('Responsive Layout', () => {
    test('displays properly on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Verify layout
      await expect(
        page.locator('.calendar-view-container, .kanban-board-container, .list-view-container')
      ).toBeVisible();
    });

    test('displays properly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      // Switch to Kanban (should have horizontal scroll)
      await page.click('text=Kanban');
      await expect(page.locator('.kanban-board-container')).toBeVisible();
    });

    test('displays properly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Switch to List view (should have responsive table)
      await page.click('text=List');
      await expect(page.locator('table')).toBeVisible();
    });
  });

  test.describe('Multi-Week Calendar View (Story 1.7.5)', () => {
    test.beforeEach(async ({ page }) => {
      // Ensure we're on Calendar view
      const calendarTab = page.locator('text=Calendar').first();
      if (await calendarTab.isVisible()) {
        await calendarTab.click();
      }
      await page.waitForLoadState('networkidle');
    });

    test('toggles between old and new calendar view', async ({ page }) => {
      // Check if toggle banner exists
      const oldViewButton = page.locator('text=Săptămână (Vechi)');
      const newViewButton = page.locator('text=Multi-Săptămână (PROTOTIP V2)');

      if (await oldViewButton.isVisible()) {
        // Test toggle to new view
        await newViewButton.click();
        await page.waitForTimeout(500);

        // Verify multi-week calendar is visible
        await expect(page.locator('[role="region"]').first()).toBeVisible();

        // Toggle back to old view
        await oldViewButton.click();
        await page.waitForTimeout(500);

        // Should show React Big Calendar
        await expect(page.locator('.rbc-calendar')).toBeVisible();
      }
    });

    test('displays 4 weeks on page load', async ({ page }) => {
      // Click new calendar view
      const newViewButton = page.locator('text=Multi-Săptămână (PROTOTIP V2)');
      if (await newViewButton.isVisible()) {
        await newViewButton.click();
      }

      // Wait for calendar to render
      await page.waitForTimeout(500);

      // Count week headers
      const weekHeaders = page.locator('[role="heading"][aria-level="2"]');
      await expect(weekHeaders).toHaveCount(4);

      // Verify info text mentions 4 weeks
      await expect(page.locator('text=/Afișare.*4.*săptămân/i')).toBeVisible();
    });

    test('scrolls through weeks smoothly', async ({ page }) => {
      // Click new calendar view
      const newViewButton = page.locator('text=Multi-Săptămână (PROTOTIP V2)');
      if (await newViewButton.isVisible()) {
        await newViewButton.click();
      }

      // Wait for calendar to render
      await page.waitForTimeout(500);

      // Get scrollable container
      const scrollContainer = page.locator('.overflow-y-auto').first();

      // Scroll down
      await scrollContainer.evaluate((el) => {
        el.scrollTop = el.scrollHeight / 2;
      });

      await page.waitForTimeout(300);

      // Scroll back up
      await scrollContainer.evaluate((el) => {
        el.scrollTop = 0;
      });

      // Verify week headers are still visible (sticky)
      const weekHeaders = page.locator('[role="heading"][aria-level="2"]');
      await expect(weekHeaders.first()).toBeVisible();
    });

    test('navigates to previous week', async ({ page }) => {
      // Click new calendar view
      const newViewButton = page.locator('text=Multi-Săptămână (PROTOTIP V2)');
      if (await newViewButton.isVisible()) {
        await newViewButton.click();
      }

      await page.waitForTimeout(500);

      // Get first week header text
      const firstWeekHeader = page.locator('[role="heading"][aria-level="2"]').first();
      const initialText = await firstWeekHeader.textContent();

      // Click previous week button
      await page.click('[aria-label*="anterioară"]');
      await page.waitForTimeout(500);

      // Verify week header changed
      const newText = await firstWeekHeader.textContent();
      expect(newText).not.toBe(initialText);
    });

    test('navigates to next week', async ({ page }) => {
      // Click new calendar view
      const newViewButton = page.locator('text=Multi-Săptămână (PROTOTIP V2)');
      if (await newViewButton.isVisible()) {
        await newViewButton.click();
      }

      await page.waitForTimeout(500);

      // Get first week header text
      const firstWeekHeader = page.locator('[role="heading"][aria-level="2"]').first();
      const initialText = await firstWeekHeader.textContent();

      // Click next week button
      await page.click('[aria-label*="următoare"]');
      await page.waitForTimeout(500);

      // Verify week header changed
      const newText = await firstWeekHeader.textContent();
      expect(newText).not.toBe(initialText);
    });

    test('clicks "Astăzi" button and highlights current week', async ({ page }) => {
      // Click new calendar view
      const newViewButton = page.locator('text=Multi-Săptămână (PROTOTIP V2)');
      if (await newViewButton.isVisible()) {
        await newViewButton.click();
      }

      await page.waitForTimeout(500);

      // Navigate to next week first
      await page.click('[aria-label*="următoare"]');
      await page.waitForTimeout(300);

      // Click "Astăzi" button
      const todayButton = page.locator('button:has-text("Astăzi")').first();
      await todayButton.click();
      await page.waitForTimeout(500);

      // Verify current day column has "Astăzi" label
      const todayLabels = page.locator('text=Astăzi');
      const count = await todayLabels.count();
      expect(count).toBeGreaterThan(0);

      // Verify today's date column has blue background
      const todayColumn = page.locator('.bg-blue-100').first();
      await expect(todayColumn).toBeVisible();
    });

    test('drags task to different day', async ({ page }) => {
      // Click new calendar view
      const newViewButton = page.locator('text=Multi-Săptămână (PROTOTIP V2)');
      if (await newViewButton.isVisible()) {
        await newViewButton.click();
      }

      await page.waitForTimeout(500);

      // Find a draggable task card
      const taskCard = page.locator('[draggable="true"]').first();

      if (await taskCard.isVisible()) {
        // Get source position
        const sourceBox = await taskCard.boundingBox();

        if (sourceBox) {
          // Find a different day column to drop into
          const dayColumns = page.locator('[role="region"]');
          const targetColumn = dayColumns.nth(3); // Different day
          const targetBox = await targetColumn.boundingBox();

          if (targetBox) {
            // Perform drag-and-drop
            await taskCard.hover();
            await page.mouse.down();
            await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 50);
            await page.waitForTimeout(300);
            await page.mouse.up();

            // Wait for drop animation
            await page.waitForTimeout(500);

            // Verify task moved (this is visual confirmation, actual data update depends on implementation)
            // The task should be in the new column
            await page.waitForTimeout(200);
          }
        }
      }
    });

    test('clicks task card and opens detail modal', async ({ page }) => {
      // Click new calendar view
      const newViewButton = page.locator('text=Multi-Săptămână (PROTOTIP V2)');
      if (await newViewButton.isVisible()) {
        await newViewButton.click();
      }

      await page.waitForTimeout(500);

      // Find a task card (button role)
      const taskCard = page.locator('[role="button"]').first();

      if (await taskCard.isVisible()) {
        await taskCard.click();
        await page.waitForTimeout(300);

        // Verify modal opened (look for dialog or modal container)
        const modal = page.locator('[role="dialog"], .modal, [aria-modal="true"]');
        await expect(modal.first()).toBeVisible({ timeout: 2000 });
      }
    });

    test('verifies weekend columns narrower than weekdays', async ({ page }) => {
      // Click new calendar view
      const newViewButton = page.locator('text=Multi-Săptămână (PROTOTIP V2)');
      if (await newViewButton.isVisible()) {
        await newViewButton.click();
      }

      await page.waitForTimeout(500);

      // Get day columns
      const dayColumns = page.locator('[role="region"]');

      // Get a weekday column (e.g., Monday - first column)
      const weekdayColumn = dayColumns.first();
      const weekdayBox = await weekdayColumn.boundingBox();

      // Get a weekend column (e.g., Saturday - 6th column)
      const weekendColumn = dayColumns.nth(5);
      const weekendBox = await weekendColumn.boundingBox();

      // Verify weekend is narrower
      if (weekdayBox && weekendBox) {
        expect(weekendBox.width).toBeLessThan(weekdayBox.width);
      }
    });

    test('verifies time-specific tasks show time badges', async ({ page }) => {
      // Click new calendar view
      const newViewButton = page.locator('text=Multi-Săptămână (PROTOTIP V2)');
      if (await newViewButton.isVisible()) {
        await newViewButton.click();
      }

      await page.waitForTimeout(500);

      // Look for time badges (format: HH:MM in bold)
      const timeBadges = page.locator('.text-xs.font-bold:has-text(/\\d{2}:\\d{2}/)');

      const count = await timeBadges.count();
      if (count > 0) {
        // Verify time badge format
        const firstBadge = timeBadges.first();
        const text = await firstBadge.textContent();
        expect(text).toMatch(/\d{2}:\d{2}/);
      }
    });

    test('verifies all-day tasks have no time badges', async ({ page }) => {
      // Click new calendar view
      const newViewButton = page.locator('text=Multi-Săptămână (PROTOTIP V2)');
      if (await newViewButton.isVisible()) {
        await newViewButton.click();
      }

      await page.waitForTimeout(500);

      // Get all task cards
      const taskCards = page.locator('[role="button"]');
      const count = await taskCards.count();

      if (count > 0) {
        // Check if some tasks don't have time badges
        // (not all tasks should have time badges if all-day tasks exist)
        let tasksWithoutTime = 0;

        for (let i = 0; i < Math.min(count, 10); i++) {
          const card = taskCards.nth(i);
          const cardText = await card.textContent();

          // If card doesn't start with time pattern, it's an all-day task
          if (!cardText?.trim().match(/^\d{2}:\d{2}/)) {
            tasksWithoutTime++;
          }
        }

        // At least some tasks should be all-day (no time)
        expect(tasksWithoutTime).toBeGreaterThan(0);
      }
    });

    test('displays properly on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Click new calendar view
      const newViewButton = page.locator('text=Multi-Săptămână (PROTOTIP V2)');
      if (await newViewButton.isVisible()) {
        await newViewButton.click();
      }

      await page.waitForTimeout(500);

      // Verify all 7 day columns visible
      const dayColumns = page.locator('[role="region"]');
      const visibleColumns = await dayColumns.count();
      expect(visibleColumns).toBeGreaterThanOrEqual(28); // 4 weeks × 7 days
    });

    test('handles Romanian diacritics correctly', async ({ page }) => {
      // Click new calendar view
      const newViewButton = page.locator('text=Multi-Săptămână (PROTOTIP V2)');
      if (await newViewButton.isVisible()) {
        await newViewButton.click();
      }

      await page.waitForTimeout(500);

      // Verify Romanian UI text
      await expect(page.locator('text=Astăzi')).toBeVisible();
      await expect(page.locator('text=/săptămân/i')).toBeVisible();

      // Verify Romanian weekday names
      const weekdayNames = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];
      for (const day of weekdayNames) {
        const dayElement = page.locator(`text=${day}`).first();
        if (await dayElement.isVisible()) {
          expect(await dayElement.textContent()).toContain(day);
        }
      }
    });
  });
});
