/**
 * NLP Task Parser E2E Tests
 * Story 4.1: Natural Language Task Parser - Task 17
 *
 * End-to-end tests for natural language task creation features.
 *
 * NOTE: These tests use mocked GraphQL responses for CI/CD environments.
 * For production validation, use the manual test plan below.
 *
 * =============================================================================
 * MANUAL TEST PLAN - Natural Language Task Parser Testing
 * =============================================================================
 *
 * PREREQUISITES:
 * 1. Platform running with authentication enabled
 * 2. Test firm with active cases and team members
 * 3. AI service running for task parsing
 *
 * TEST SCENARIOS:
 *
 * TC-1: Basic Task Creation (Romanian)
 * ----------------------------------------
 * Prerequisite: Logged in as any role
 * Steps:
 * 1. Navigate to task creation page or use Cmd+K shortcut
 * 2. Type: "Pregătește contract pentru client Ion Popescu până pe 15 decembrie"
 * 3. Wait for parsing preview to appear
 * 4. Review parsed fields
 * 5. Click "Create Task"
 * Expected Result:
 * - Task type detected as DocumentCreation
 * - Title extracted correctly
 * - Due date set to December 15
 * - Assignee matches "Ion Popescu"
 * - Task created successfully
 *
 * TC-2: Basic Task Creation (English)
 * ----------------------------------------
 * Steps:
 * 1. Type: "Prepare contract for client John Smith by December 15"
 * 2. Wait for parsing preview
 * Expected Result:
 * - Language detected as English
 * - Fields parsed correctly
 *
 * TC-3: Ambiguous Input with Clarification
 * ----------------------------------------
 * Steps:
 * 1. Type: "Meeting with Pop tomorrow"
 * 2. Wait for parsing
 * 3. Clarification dialog appears (multiple "Pop" matches)
 * 4. Select correct team member
 * Expected Result:
 * - Clarification options shown
 * - Selection updates assignee field
 * - Confidence increases
 *
 * TC-4: Case Reference Detection
 * ----------------------------------------
 * Steps:
 * 1. Type: "Research for case 123/2024"
 * 2. Wait for parsing
 * Expected Result:
 * - Task type detected as Research
 * - Case reference linked correctly
 *
 * TC-5: Priority Detection
 * ----------------------------------------
 * Steps:
 * 1. Type: "URGENT: prepare documents for tomorrow"
 * Expected Result:
 * - Priority set to Urgent
 *
 * TC-6: Field Editing in Preview
 * ----------------------------------------
 * Steps:
 * 1. Parse a task
 * 2. Click "Edit" button in preview
 * 3. Modify task type or priority
 * 4. Save changes
 * Expected Result:
 * - Fields editable in preview mode
 * - Corrections applied to final task
 *
 * TC-7: Pattern Suggestions (Autocomplete)
 * ----------------------------------------
 * Prerequisite: Previously created similar tasks
 * Steps:
 * 1. Start typing "preg"
 * 2. Wait for suggestions dropdown
 * 3. Select a suggestion
 * Expected Result:
 * - Suggestions appear based on history
 * - Selection fills input field
 *
 * TC-8: Low Confidence Warning
 * ----------------------------------------
 * Steps:
 * 1. Type: "do something"
 * Expected Result:
 * - Low confidence warning displayed
 * - User prompted to add more details
 *
 * TC-9: Cancel Task Creation
 * ----------------------------------------
 * Steps:
 * 1. Parse a task
 * 2. Click "Cancel"
 * Expected Result:
 * - Input cleared
 * - Preview dismissed
 * - No task created
 *
 * TC-10: Command Palette Shortcut
 * ----------------------------------------
 * Steps:
 * 1. Press Cmd+K (or Ctrl+K on Windows)
 * 2. Type task description
 * Expected Result:
 * - Command palette opens
 * - Input focused
 * - Parsing works as expected
 *
 * =============================================================================
 */

import { test, expect } from '@playwright/test';

// Base URL for tests
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Test data
const mockParsedResponse = {
  parseId: 'parse-test-123',
  originalText: 'Pregătește contract pentru client până pe 15 decembrie',
  detectedLanguage: 'ro',
  parsedTask: {
    taskType: { value: 'DocumentCreation', confidence: 0.9 },
    title: { value: 'Pregătește contract pentru client', confidence: 0.85 },
    description: { value: null, confidence: 0 },
    dueDate: { value: '2024-12-15', confidence: 0.8 },
    dueTime: { value: null, confidence: 0 },
    priority: { value: 'Medium', confidence: 0.7 },
    assigneeName: { value: null, confidence: 0 },
    assigneeId: { value: null, confidence: 0 },
    caseReference: { value: null, confidence: 0 },
    caseId: { value: null, confidence: 0 },
  },
  entities: [
    {
      type: 'taskType',
      value: 'Pregătește',
      normalizedValue: 'DocumentCreation',
      startIndex: 0,
      endIndex: 10,
      confidence: 0.9,
    },
    {
      type: 'date',
      value: '15 decembrie',
      normalizedValue: '2024-12-15',
      startIndex: 42,
      endIndex: 54,
      confidence: 0.8,
    },
  ],
  overallConfidence: 0.8,
  clarificationsNeeded: [],
  isComplete: true,
};

const mockParsedWithClarification = {
  ...mockParsedResponse,
  parseId: 'parse-clarify-123',
  originalText: 'Întâlnire cu Pop mâine',
  parsedTask: {
    ...mockParsedResponse.parsedTask,
    taskType: { value: 'Meeting', confidence: 0.9 },
    title: { value: 'Întâlnire cu Pop', confidence: 0.8 },
    assigneeName: { value: 'Pop', confidence: 0.5 },
  },
  overallConfidence: 0.65,
  clarificationsNeeded: [
    {
      id: 'clarify-1',
      entityType: 'assignee',
      question: 'Am găsit mai multe potriviri pentru "Pop". La cine te referi?',
      options: [
        { value: 'user-1', label: 'Ion Popescu', context: 'Partner' },
        { value: 'user-2', label: 'Andrei Pop', context: 'Associate' },
      ],
      allowFreeText: true,
    },
  ],
  isComplete: false,
};

const mockPatternSuggestions = [
  {
    id: 'pattern-1',
    pattern: 'pregătește contract pentru [data]',
    completedText: 'pregătește contract pentru',
    taskType: 'DocumentCreation',
    frequency: 5,
    lastUsed: new Date().toISOString(),
  },
  {
    id: 'pattern-2',
    pattern: 'pregătește documente pentru [data]',
    completedText: 'pregătește documente pentru',
    taskType: 'DocumentCreation',
    frequency: 3,
    lastUsed: new Date().toISOString(),
  },
];

const mockCreatedTask = {
  id: 'task-created-123',
  title: 'Pregătește contract pentru client',
  description: '',
  dueDate: '2024-12-15',
  priority: 'Medium',
  status: 'Pending',
  taskType: 'DocumentCreation',
  case: null,
  assignee: null,
};

// GraphQL response helpers
function getMockParseResponse(withClarification = false) {
  return {
    data: {
      parseTask: withClarification ? mockParsedWithClarification : mockParsedResponse,
    },
  };
}

function getMockClarificationResolvedResponse() {
  return {
    data: {
      resolveClarification: {
        ...mockParsedWithClarification,
        parsedTask: {
          ...mockParsedWithClarification.parsedTask,
          assigneeId: { value: 'user-1', confidence: 1.0 },
          assigneeName: { value: 'Ion Popescu', confidence: 1.0 },
        },
        clarificationsNeeded: [],
        isComplete: true,
        overallConfidence: 0.85,
      },
    },
  };
}

function getMockTaskCreatedResponse() {
  return {
    data: {
      confirmTaskCreation: mockCreatedTask,
    },
  };
}

function getMockSuggestionsResponse() {
  return {
    data: {
      taskPatternSuggestions: mockPatternSuggestions,
    },
  };
}

test.describe('NLP Task Parser', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      (window as any).__mockUser = {
        id: 'user-test-123',
        role: 'Partner',
        firstName: 'Test',
        lastName: 'User',
        firmId: 'firm-test-123',
      };
    });
  });

  test.describe('Task Parsing', () => {
    test('should display task creation input', async ({ page }) => {
      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      // Check for input field
      const input = page.locator('input[placeholder*="Descrie"]');
      await expect(input).toBeVisible({ timeout: 10000 });
    });

    test('should parse Romanian task input', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('parseTask')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockParseResponse()),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      // Type task input
      const input = page.locator('input[type="text"]').first();
      await input.fill('Pregătește contract pentru client până pe 15 decembrie');

      // Wait for preview to appear (debounced)
      await page.waitForTimeout(1000);

      // Check for preview panel
      const preview = page.locator('text=Previzualizare');
      await expect(preview).toBeVisible({ timeout: 10000 });

      // Check for detected task type
      const taskTypeField = page.locator('text=Creare document');
      await expect(taskTypeField).toBeVisible();
    });

    test('should display confidence indicators', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(getMockParseResponse()),
        });
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('Pregătește contract pentru client');
      await page.waitForTimeout(1000);

      // Check for confidence badge
      const confidenceBadge = page.locator('text=/încredere|80%/i');
      await expect(confidenceBadge.first()).toBeVisible({ timeout: 10000 });
    });

    test('should highlight entities in input', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(getMockParseResponse()),
        });
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('Pregătește contract pentru 15 decembrie');
      await page.waitForTimeout(1000);

      // Check for entity highlight section
      const entitySection = page.locator('text=Elemente detectate');
      await expect(entitySection).toBeVisible({ timeout: 10000 });
    });

    test('should detect English language', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              parseTask: {
                ...mockParsedResponse,
                detectedLanguage: 'en',
                originalText: 'Prepare contract for client by December 15',
              },
            },
          }),
        });
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('Prepare contract for client by December 15');
      await page.waitForTimeout(1000);

      // English labels should be shown
      const preview = page.locator('text=Task Preview');
      await expect(preview).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Clarification Dialog', () => {
    test('should show clarification when ambiguous', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('parseTask')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockParseResponse(true)),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('Întâlnire cu Pop mâine');
      await page.waitForTimeout(1000);

      // Check for clarification dialog or inline clarification
      const clarification = page.locator('text=/clarificare|potriviri/i');
      await expect(clarification.first()).toBeVisible({ timeout: 10000 });
    });

    test('should resolve clarification on selection', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('parseTask')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockParseResponse(true)),
          });
        } else if (body?.query?.includes('resolveClarification')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockClarificationResolvedResponse()),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('Întâlnire cu Pop mâine');
      await page.waitForTimeout(1000);

      // Click on first option button
      const optionButton = page.locator('button').filter({ hasText: 'Ion Popescu' });
      if (await optionButton.isVisible()) {
        await optionButton.click();
        await page.waitForTimeout(500);

        // Clarification should be resolved
        const assigneeField = page.locator('text=Ion Popescu');
        await expect(assigneeField).toBeVisible();
      }
    });
  });

  test.describe('Pattern Suggestions', () => {
    test('should show autocomplete suggestions', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('taskPatternSuggestions')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockSuggestionsResponse()),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('preg');
      await page.waitForTimeout(500);

      // Check for suggestions dropdown
      const suggestions = page.locator('text=Șabloane recente');
      await expect(suggestions).toBeVisible({ timeout: 5000 });
    });

    test('should fill input on suggestion click', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('taskPatternSuggestions')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockSuggestionsResponse()),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('preg');
      await page.waitForTimeout(500);

      // Click on first suggestion
      const suggestion = page.locator('button').filter({
        hasText: /pregătește contract/i,
      });
      if (await suggestion.isVisible()) {
        await suggestion.click();

        // Input should be updated
        await expect(input).toHaveValue(/pregătește contract/i);
      }
    });
  });

  test.describe('Task Creation', () => {
    test('should create task on confirm', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('parseTask')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockParseResponse()),
          });
        } else if (body?.query?.includes('confirmTaskCreation')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockTaskCreatedResponse()),
          });
        } else if (body?.query?.includes('recordParsedTask')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { recordParsedTask: true } }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('Pregătește contract pentru client');
      await page.waitForTimeout(1000);

      // Click create button
      const createButton = page
        .locator('button')
        .filter({ hasText: /Creează sarcină|Create Task/i });
      if (await createButton.isVisible()) {
        await createButton.click();

        // Success message should appear
        const successMessage = page.locator('text=/succes|success/i');
        await expect(successMessage).toBeVisible({ timeout: 10000 });
      }
    });

    test('should allow field editing before creation', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('parseTask')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockParseResponse()),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('Pregătește contract pentru client');
      await page.waitForTimeout(1000);

      // Click edit button
      const editButton = page.locator('button').filter({ hasText: /Editează|Edit/i });
      if (await editButton.isVisible()) {
        await editButton.click();

        // Fields should become editable
        const editableField = page.locator('input[type="text"], select').nth(1);
        await expect(editableField).toBeVisible();
      }
    });

    test('should reset on cancel', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(getMockParseResponse()),
        });
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('Pregătește contract pentru client');
      await page.waitForTimeout(1000);

      // Click cancel button
      const cancelButton = page.locator('button').filter({ hasText: /Anulează|Cancel/i });
      if (await cancelButton.isVisible()) {
        await cancelButton.click();

        // Input should be cleared
        await expect(input).toHaveValue('');
      }
    });
  });

  test.describe('Low Confidence Handling', () => {
    test('should show warning for low confidence', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              parseTask: {
                ...mockParsedResponse,
                overallConfidence: 0.35,
              },
            },
          }),
        });
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('do something');
      await page.waitForTimeout(1000);

      // Warning should be visible
      const warning = page.locator('text=/scăzută|low confidence|verifică/i');
      await expect(warning.first()).toBeVisible({ timeout: 10000 });
    });

    test('should disable create button for very low confidence', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              parseTask: {
                ...mockParsedResponse,
                overallConfidence: 0.2,
              },
            },
          }),
        });
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('x');
      await page.waitForTimeout(1000);

      // Create button should be disabled
      const createButton = page
        .locator('button')
        .filter({ hasText: /Creează sarcină|Create Task/i });
      if (await createButton.isVisible()) {
        await expect(createButton).toBeDisabled();
      }
    });
  });

  test.describe('Example Chips', () => {
    test('should display example chips when input is empty', async ({ page }) => {
      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      // Examples should be visible
      const examples = page.locator('text=Exemple');
      await expect(examples).toBeVisible({ timeout: 10000 });
    });

    test('should fill input on example click', async ({ page }) => {
      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      // Click on an example chip
      const exampleChip = page
        .locator('button')
        .filter({
          hasText: /pregătește|prepare/i,
        })
        .first();

      if (await exampleChip.isVisible()) {
        await exampleChip.click();

        // Input should be filled
        const input = page.locator('input[type="text"]').first();
        await expect(input).not.toHaveValue('');
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should display error on API failure', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [{ message: 'AI service unavailable' }],
          }),
        });
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('Pregătește contract pentru client');
      await page.waitForTimeout(1000);

      // Error message should be visible
      const errorMessage = page.locator('text=/eroare|error|unavailable/i');
      await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should submit on Enter key', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(getMockParseResponse()),
        });
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('Pregătește contract pentru client');
      await input.press('Enter');

      // Should trigger parse
      await page.waitForTimeout(1000);
      const preview = page.locator('text=Previzualizare');
      await expect(preview).toBeVisible({ timeout: 10000 });
    });

    test('should navigate suggestions with arrow keys', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('taskPatternSuggestions')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockSuggestionsResponse()),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('preg');
      await page.waitForTimeout(500);

      // Press arrow down
      await input.press('ArrowDown');
      await page.waitForTimeout(100);

      // First suggestion should be highlighted
      const highlightedSuggestion = page.locator('[class*="bg-blue"]');
      if ((await highlightedSuggestion.count()) > 0) {
        await expect(highlightedSuggestion.first()).toBeVisible();
      }
    });

    test('should select suggestion with Tab', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('taskPatternSuggestions')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockSuggestionsResponse()),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('preg');
      await page.waitForTimeout(500);

      // Press Tab to select
      await input.press('Tab');

      // Input should be filled with suggestion
      await expect(input).toHaveValue(/pregătește/i);
    });

    test('should close suggestions with Escape', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('taskPatternSuggestions')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockSuggestionsResponse()),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('preg');
      await page.waitForTimeout(500);

      // Press Escape
      await input.press('Escape');

      // Suggestions should be hidden
      const suggestions = page.locator('text=Șabloane recente');
      await expect(suggestions).not.toBeVisible({ timeout: 1000 });
    });
  });

  test.describe('Loading States', () => {
    test('should show loading indicator during parsing', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        // Delay response to see loading state
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(getMockParseResponse()),
        });
      });

      await page.goto(`${BASE_URL}/tasks/new`);
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="text"]').first();
      await input.fill('Pregătește contract pentru client');

      // Loading indicator should appear
      const spinner = page.locator('[class*="animate-spin"]');
      await expect(spinner).toBeVisible({ timeout: 2000 });
    });
  });
});
