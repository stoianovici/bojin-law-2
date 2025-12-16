/**
 * E2E TESTS: Communication Hub (Story 1.8.5)
 *
 * Tests the complete workflow for:
 * - Reply to messages with AI draft
 * - Create tasks from extracted items (deadlines, commitments, action items)
 * - Dismiss extracted items
 * - Mark threads as processed
 */

import { test, expect, type Page } from '@playwright/test';

// ============================================================================
// PAGE OBJECT MODEL
// ============================================================================

/**
 * Communication Hub Page Object
 * Represents the /communications page with thread list and message view
 */
class CommunicationHubPage {
  constructor(private page: Page) {}

  // Locators - Thread List
  get threadList() {
    return this.page.getByRole('list', { name: /threads/i });
  }

  getThreadBySubject(subject: string) {
    return this.page.getByRole('listitem').filter({ hasText: subject });
  }

  // Locators - Message View
  get threadHeader() {
    return this.page.getByRole('heading', { level: 2 });
  }

  get expandAllButton() {
    return this.page.getByRole('button', { name: /Extinde tot/i });
  }

  get collapseAllButton() {
    return this.page.getByRole('button', { name: /Restrânge tot/i });
  }

  get markAsProcessedButton() {
    return this.page.getByRole('button', { name: /Marchează ca Procesat/i });
  }

  getReplyButton(messageIndex = 0) {
    return this.page.getByRole('button', { name: /Răspunde/i }).nth(messageIndex);
  }

  // Locators - Extracted Items Sidebar
  get extractedItemsSidebar() {
    return this.page.getByText(/Elemente extrase/i).locator('..');
  }

  get deadlinesSection() {
    return this.page.getByRole('button', { name: /Termene/i });
  }

  get commitmentsSection() {
    return this.page.getByRole('button', { name: /Angajamente/i });
  }

  get actionsSection() {
    return this.page.getByRole('button', { name: /Acțiuni/i });
  }

  getCreateTaskButton(itemDescription: string) {
    return this.page
      .getByText(itemDescription)
      .locator('..')
      .getByRole('button', { name: /Creează Task/i });
  }

  getDismissButton(itemDescription: string) {
    return this.page
      .getByText(itemDescription)
      .locator('..')
      .getByTitle(/Respinge/i);
  }

  getTaskCreatedBadge(itemDescription: string) {
    return this.page
      .getByText(itemDescription)
      .locator('..')
      .getByText(/Task creat/i);
  }

  // Locators - Compose Modal
  get composeModal() {
    return this.page.getByRole('dialog', { name: /compose/i });
  }

  get composeTo() {
    return this.page.getByLabel(/To/i);
  }

  get composeSubject() {
    return this.page.getByLabel(/Subject/i);
  }

  get composeBody() {
    return this.page.getByLabel(/Message/i);
  }

  get useAIDraftButton() {
    return this.page.getByRole('button', { name: /Use AI Draft/i });
  }

  get toneSelector() {
    return this.page.getByLabel(/Tone/i);
  }

  get sendButton() {
    return this.page.getByRole('button', { name: /Send/i });
  }

  get closeComposeButton() {
    return this.page.getByRole('button', { name: /Close/i });
  }

  // Locators - Quick Task Creator
  get taskTypeSelect() {
    return this.page.getByLabel(/Tip Task/i);
  }

  get taskTitleInput() {
    return this.page.getByLabel(/Titlu/i);
  }

  get taskDescriptionTextarea() {
    return this.page.getByLabel(/Descriere/i);
  }

  get taskAssignedToSelect() {
    return this.page.getByLabel(/Atribuit/i);
  }

  get taskDueDateInput() {
    return this.page.getByLabel(/Scadență/i);
  }

  get taskPrioritySelect() {
    return this.page.getByLabel(/Prioritate/i);
  }

  get saveTaskButton() {
    return this.page.getByRole('button', { name: /Salvează Task/i });
  }

  get cancelTaskButton() {
    return this.page.getByRole('button', { name: /Anulează/i });
  }

  // Actions
  async goto() {
    await this.page.goto('/communications');
    await this.page.waitForLoadState('networkidle');
  }

  async selectThread(subject: string) {
    const thread = this.getThreadBySubject(subject);
    await thread.click();
    await this.page.waitForLoadState('networkidle');
  }

  async expandMessage(messageIndex = 0) {
    const messages = await this.page
      .getByRole('button', { name: /Elena Popescu|Current User/i })
      .all();
    if (messages[messageIndex]) {
      await messages[messageIndex].click();
    }
  }

  async clickReply(messageIndex = 0) {
    await this.expandMessage(messageIndex);
    const replyButton = this.getReplyButton(messageIndex);
    await replyButton.click();
  }

  async expandExtractedItemsSection(section: 'deadlines' | 'commitments' | 'actions') {
    const sectionButton =
      section === 'deadlines'
        ? this.deadlinesSection
        : section === 'commitments'
          ? this.commitmentsSection
          : this.actionsSection;

    await sectionButton.click();
    await this.page.waitForTimeout(300); // Wait for animation
  }

  async createTaskFromItem(itemDescription: string) {
    const createButton = this.getCreateTaskButton(itemDescription);
    await createButton.click();
    await this.page.waitForTimeout(300); // Wait for form to appear
  }

  async fillTaskForm(data: {
    title?: string;
    description?: string;
    assignedTo?: string;
    dueDate?: string;
    priority?: string;
  }) {
    if (data.title !== undefined) {
      await this.taskTitleInput.fill(data.title);
    }
    if (data.description !== undefined) {
      await this.taskDescriptionTextarea.fill(data.description);
    }
    if (data.assignedTo !== undefined) {
      await this.taskAssignedToSelect.selectOption(data.assignedTo);
    }
    if (data.dueDate !== undefined) {
      await this.taskDueDateInput.fill(data.dueDate);
    }
    if (data.priority !== undefined) {
      await this.taskPrioritySelect.selectOption(data.priority);
    }
  }

  async saveTask() {
    await this.saveTaskButton.click();
  }

  async dismissItem(itemDescription: string, reason?: string) {
    const dismissButton = this.getDismissButton(itemDescription);
    await dismissButton.click();

    // Handle browser prompt
    this.page.once('dialog', async (dialog) => {
      if (reason !== undefined) {
        await dialog.accept(reason);
      } else {
        await dialog.dismiss();
      }
    });
  }

  async markThreadAsProcessed() {
    await this.markAsProcessedButton.click();
  }

  // Assertions
  async expectToBeOnCommunicationHub() {
    await expect(this.page).toHaveURL(/\/communications/);
  }

  async expectThreadSelected(subject: string) {
    await expect(this.threadHeader).toContainText(subject);
  }

  async expectComposeModalOpen() {
    await expect(this.composeModal).toBeVisible();
  }

  async expectComposeModalClosed() {
    await expect(this.composeModal).not.toBeVisible();
  }

  async expectTaskCreated(itemDescription: string) {
    const badge = this.getTaskCreatedBadge(itemDescription);
    await expect(badge).toBeVisible();
  }

  async expectItemDismissed(itemDescription: string) {
    const item = this.page.getByText(itemDescription);
    await expect(item).not.toBeVisible();
  }

  async expectThreadProcessed() {
    // After processing, thread should disappear from /communications view
    // and alert should be shown
    this.page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Comunicare mutată în dosar');
      await dialog.accept();
    });
  }
}

/**
 * Case Page Object
 * For verifying processed threads appear in case communication tab
 */
class CasePage {
  constructor(private page: Page) {}

  get communicationTab() {
    return this.page.getByRole('tab', { name: /Comunicări|Communication/i });
  }

  get processedBadge() {
    return this.page.getByText(/Procesat/i);
  }

  async gotoCase(caseId: string) {
    await this.page.goto(`/cases/${caseId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async switchToCommunicationTab() {
    await this.communicationTab.click();
    await this.page.waitForLoadState('networkidle');
  }

  async expectThreadInCommunicationTab(subject: string) {
    await expect(this.page.getByText(subject)).toBeVisible();
  }

  async expectThreadMarkedAsProcessed() {
    await expect(this.processedBadge).toBeVisible();
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

test.describe('Communication Hub - Reply Functionality', () => {
  let communicationHub: CommunicationHubPage;

  test.beforeEach(async ({ page }) => {
    communicationHub = new CommunicationHubPage(page);
    await communicationHub.goto();
    await communicationHub.expectToBeOnCommunicationHub();
  });

  test('User can reply to a message with AI draft', async ({ page }) => {
    // Select a thread
    await communicationHub.selectThread('Contract Review');
    await communicationHub.expectThreadSelected('Contract Review');

    // Click reply on a message
    await communicationHub.clickReply(0);

    // Verify compose modal opens
    await communicationHub.expectComposeModalOpen();

    // Verify pre-filled data
    await expect(communicationHub.composeTo).toHaveValue(/elena@example.com/i);
    await expect(communicationHub.composeSubject).toHaveValue(/Re: Contract Review/i);

    // Verify AI draft is available (mock for prototype)
    // In production, this would check if AI draft panel is visible
    await expect(page.getByText(/AI Draft|Use AI Draft/i)).toBeVisible();

    // User can select tone
    await communicationHub.toneSelector.selectOption('Professional');

    // Close compose modal
    await communicationHub.closeComposeButton.click();
    await communicationHub.expectComposeModalClosed();
  });

  test.skip('User can send reply with AI-generated content', async () => {
    // Skip for prototype - requires full compose integration
    // This would test the full flow of using AI draft and sending
  });
});

test.describe('Communication Hub - Task Creation from Extracted Items', () => {
  let communicationHub: CommunicationHubPage;

  test.beforeEach(async ({ page }) => {
    communicationHub = new CommunicationHubPage(page);
    await communicationHub.goto();

    // Select a thread with extracted items
    await communicationHub.selectThread('Contract Review');
    await communicationHub.expectThreadSelected('Contract Review');
  });

  test('User can create task from extracted deadline', async ({ page }) => {
    // Deadlines section should be expanded by default
    // Find a deadline and click "Creează Task"
    const deadlineDescription = 'Review contract';
    await communicationHub.createTaskFromItem(deadlineDescription);

    // Verify quick task creator appears with pre-filled data
    await expect(communicationHub.taskTitleInput).toHaveValue(deadlineDescription);
    await expect(communicationHub.taskDescriptionTextarea).toHaveValue(/Termen extras din email/i);
    await expect(communicationHub.taskTypeSelect).toHaveValue('CourtDate');
    await expect(communicationHub.taskDueDateInput).not.toBeEmpty();

    // User can edit fields if needed
    await communicationHub.fillTaskForm({
      priority: 'High',
    });

    // Save task
    await communicationHub.saveTask();

    // Verify success alert
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Task creat cu succes!');
      await dialog.accept();
    });

    // Verify task created badge appears
    await communicationHub.expectTaskCreated(deadlineDescription);

    // Verify "Creează Task" button is replaced with "Task creat" link
    await expect(communicationHub.getCreateTaskButton(deadlineDescription)).not.toBeVisible();
  });

  test('User can create task from extracted commitment', async ({ page }) => {
    // Expand commitments section
    await communicationHub.expandExtractedItemsSection('commitments');

    const commitmentParty = 'Elena Popescu';
    await communicationHub.createTaskFromItem(commitmentParty);

    // Verify pre-filled data
    await expect(communicationHub.taskTitleInput).toHaveValue(/Elena Popescu/i);
    await expect(communicationHub.taskTypeSelect).toHaveValue('Meeting');

    // Save task
    await communicationHub.saveTask();

    // Verify task created
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await communicationHub.expectTaskCreated(commitmentParty);
  });

  test('User can create task from extracted action item', async ({ page }) => {
    // Expand actions section
    await communicationHub.expandExtractedItemsSection('actions');

    const actionDescription = 'Pregătire raport legal';
    await communicationHub.createTaskFromItem(actionDescription);

    // Verify pre-filled data
    await expect(communicationHub.taskTitleInput).toHaveValue(actionDescription);
    await expect(communicationHub.taskDescriptionTextarea).toHaveValue(
      /Acțiune extrasă din email/i
    );
    await expect(communicationHub.taskTypeSelect).toHaveValue('Research');
    await expect(communicationHub.taskPrioritySelect).toHaveValue('High');

    // Save task
    await communicationHub.saveTask();

    // Verify task created
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await communicationHub.expectTaskCreated(actionDescription);
  });

  test('User can cancel task creation', async () => {
    const deadlineDescription = 'Review contract';
    await communicationHub.createTaskFromItem(deadlineDescription);

    // Verify form is visible
    await expect(communicationHub.taskTitleInput).toBeVisible();

    // Click cancel
    await communicationHub.cancelTaskButton.click();

    // Verify form is hidden and "Creează Task" button is back
    await expect(communicationHub.taskTitleInput).not.toBeVisible();
    await expect(communicationHub.getCreateTaskButton(deadlineDescription)).toBeVisible();
  });

  test('User can create multiple tasks from single thread', async ({ page }) => {
    // Create task from first deadline
    const deadline1 = 'Review contract';
    await communicationHub.createTaskFromItem(deadline1);
    await communicationHub.saveTask();

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await communicationHub.expectTaskCreated(deadline1);

    // Create task from second deadline
    const deadline2 = 'Depunere documente';
    await communicationHub.createTaskFromItem(deadline2);
    await communicationHub.saveTask();

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await communicationHub.expectTaskCreated(deadline2);

    // Both should show as created
    await expect(communicationHub.getTaskCreatedBadge(deadline1)).toBeVisible();
    await expect(communicationHub.getTaskCreatedBadge(deadline2)).toBeVisible();
  });
});

test.describe('Communication Hub - Dismiss Functionality', () => {
  let communicationHub: CommunicationHubPage;

  test.beforeEach(async ({ page }) => {
    communicationHub = new CommunicationHubPage(page);
    await communicationHub.goto();

    // Select a thread with extracted items
    await communicationHub.selectThread('Contract Review');
    await communicationHub.expectThreadSelected('Contract Review');
  });

  test('User can dismiss extracted action item', async ({ page }) => {
    // Expand actions section
    await communicationHub.expandExtractedItemsSection('actions');

    const actionDescription = 'Pregătire raport legal';

    // Verify item is visible
    await expect(page.getByText(actionDescription)).toBeVisible();

    // Dismiss the item with reason
    await communicationHub.dismissItem(actionDescription, '2'); // "Deja gestionat"

    // Verify item is hidden after dismissal
    await communicationHub.expectItemDismissed(actionDescription);
  });

  test('User can dismiss extracted deadline with custom reason', async ({ page }) => {
    const deadlineDescription = 'Review contract';

    // Verify item is visible
    await expect(page.getByText(deadlineDescription)).toBeVisible();

    // Dismiss with custom reason
    await communicationHub.dismissItem(deadlineDescription, 'Already completed in person');

    // Verify item is hidden
    await communicationHub.expectItemDismissed(deadlineDescription);
  });

  test('User can cancel dismissal', async ({ page }) => {
    const deadlineDescription = 'Review contract';

    // Attempt to dismiss but cancel the prompt
    const dismissButton = communicationHub.getDismissButton(deadlineDescription);
    await dismissButton.click();

    page.once('dialog', async (dialog) => {
      await dialog.dismiss(); // Cancel the dismissal
    });

    // Item should still be visible
    await expect(page.getByText(deadlineDescription)).toBeVisible();
  });
});

test.describe('Communication Hub - Mark as Processed Workflow', () => {
  let communicationHub: CommunicationHubPage;
  let casePage: CasePage;

  test.beforeEach(async ({ page }) => {
    communicationHub = new CommunicationHubPage(page);
    casePage = new CasePage(page);

    await communicationHub.goto();

    // Select a thread
    await communicationHub.selectThread('Contract Review');
    await communicationHub.expectThreadSelected('Contract Review');
  });

  test('User can mark thread as processed', async ({ page }) => {
    // Create at least one task before marking as processed
    const deadlineDescription = 'Review contract';
    await communicationHub.createTaskFromItem(deadlineDescription);
    await communicationHub.saveTask();

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await communicationHub.expectTaskCreated(deadlineDescription);

    // Mark thread as processed
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Comunicare mutată în dosar');
      await dialog.accept();
    });

    await communicationHub.markThreadAsProcessed();

    // Thread should disappear from /communications view
    // (In a full test, we'd verify the thread is no longer in the list)
  });

  test('Thread shows warning when unconverted items remain', async ({ page }) => {
    // Thread has extracted items that haven't been converted
    // Should show warning message
    await expect(page.getByText(/Au mai rămas.*elemente neconvertite/i)).toBeVisible();
  });

  test.skip('Processed thread appears in case communication tab', async ({ page }) => {
    // Skip for prototype - requires navigation to case page and mock data setup
    // This would:
    // 1. Mark thread as processed
    // 2. Navigate to case page
    // 3. Switch to communication tab
    // 4. Verify thread appears with "Procesat" badge
    // 5. Verify created tasks are linked
    /*
    await communicationHub.markThreadAsProcessed();

    // Navigate to case
    await casePage.gotoCase('case-1');
    await casePage.switchToCommunicationTab();

    // Verify thread appears
    await casePage.expectThreadInCommunicationTab('Contract Review');
    await casePage.expectThreadMarkedAsProcessed();
    */
  });
});

test.describe('Communication Hub - Romanian Language Support', () => {
  let communicationHub: CommunicationHubPage;

  test.beforeEach(async ({ page }) => {
    communicationHub = new CommunicationHubPage(page);
    await communicationHub.goto();
    await communicationHub.selectThread('Contract Review');
  });

  test('All UI elements display Romanian labels', async ({ page }) => {
    // Header actions
    await expect(page.getByText(/Extinde tot/i)).toBeVisible();
    await expect(page.getByText(/Marchează ca Procesat/i)).toBeVisible();

    // Sidebar
    await expect(page.getByText(/Elemente extrase/i)).toBeVisible();
    await expect(page.getByText(/Termene/i)).toBeVisible();

    // Expand sections
    await communicationHub.expandExtractedItemsSection('commitments');
    await expect(page.getByText(/Angajamente/i)).toBeVisible();

    await communicationHub.expandExtractedItemsSection('actions');
    await expect(page.getByText(/Acțiuni/i)).toBeVisible();

    // Task creation buttons
    await expect(page.getByText(/Creează Task/i).first()).toBeVisible();

    // Expand a message to see reply button
    await communicationHub.expandMessage(0);
    await expect(page.getByText(/Răspunde/i)).toBeVisible();
  });

  test('Task creation form displays Romanian labels', async ({ page }) => {
    await communicationHub.createTaskFromItem('Review contract');

    await expect(page.getByText(/Tip Task/i)).toBeVisible();
    await expect(page.getByText(/Titlu/i)).toBeVisible();
    await expect(page.getByText(/Descriere/i)).toBeVisible();
    await expect(page.getByText(/Atribuit/i)).toBeVisible();
    await expect(page.getByText(/Scadență/i)).toBeVisible();
    await expect(page.getByText(/Prioritate/i)).toBeVisible();
    await expect(page.getByText(/Salvează Task/i)).toBeVisible();
    await expect(page.getByText(/Anulează/i)).toBeVisible();
  });
});

// ============================================================================
// PLAYWRIGHT CONFIGURATION NOTES
// ============================================================================

/**
 * To run these tests:
 * - All tests: pnpm test:e2e --grep "Communication Hub"
 * - Single test: pnpm test:e2e --grep "User can reply to a message"
 * - Debug mode: pnpm test:e2e:debug --grep "Communication Hub"
 * - UI mode: pnpm test:e2e:ui
 *
 * Note: These tests assume mock data is available at /communications route.
 * For prototype, tests may need to be adjusted based on actual mock data structure.
 */
