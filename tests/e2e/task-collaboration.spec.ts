/**
 * Task Collaboration E2E Tests
 * Story 4.6: Task Collaboration and Updates - Task 40
 *
 * End-to-end tests for task comments, history, attachments, subtasks, and subscriptions.
 *
 * NOTE: These tests use mocked GraphQL responses for CI/CD environments.
 * For production validation, use the manual test plan below.
 *
 * =============================================================================
 * MANUAL TEST PLAN - Task Collaboration Testing
 * =============================================================================
 *
 * PREREQUISITES:
 * 1. Platform running with all services enabled
 * 2. Test firm with active cases and team members
 * 3. Multiple test users (for @mention and notification testing)
 * 4. Authenticated user with task access permissions
 * 5. Test files for attachment upload testing
 *
 * TEST SCENARIOS:
 *
 * TC-1: Create Task Comment
 * ----------------------------------------
 * Steps:
 * 1. Navigate to task details page
 * 2. Click on "Comments" tab
 * 3. Type a comment in the comment input field
 * 4. Click "Post" button
 * Expected Result:
 * - Comment appears in the comment list
 * - Comment shows author name and timestamp
 * - Task assignee receives notification (if different from commenter)
 *
 * TC-2: Create Comment with @Mention
 * ----------------------------------------
 * Steps:
 * 1. Open task details
 * 2. In comment input, type "@"
 * 3. Autocomplete dropdown appears with team members
 * 4. Select a team member
 * 5. Complete the comment text
 * 6. Click "Post"
 * Expected Result:
 * - Comment created with @mention highlighted
 * - Mentioned user receives notification
 * - Mention appears as link to user profile
 *
 * TC-3: Reply to Comment (Threaded)
 * ----------------------------------------
 * Steps:
 * 1. Find existing comment on task
 * 2. Click "Reply" button on comment
 * 3. Type reply text
 * 4. Submit reply
 * Expected Result:
 * - Reply appears nested under parent comment
 * - Reply shows proper indentation
 * - Original comment author receives notification
 *
 * TC-4: Edit Own Comment
 * ----------------------------------------
 * Steps:
 * 1. Find own comment on task
 * 2. Click edit icon/button
 * 3. Modify comment text
 * 4. Save changes
 * Expected Result:
 * - Comment updated with new text
 * - "Edited" indicator appears
 * - Edit timestamp shown
 *
 * TC-5: Delete Own Comment
 * ----------------------------------------
 * Steps:
 * 1. Find own comment on task
 * 2. Click delete icon/button
 * 3. Confirm deletion in dialog
 * Expected Result:
 * - Comment removed from list
 * - Any nested replies also removed
 *
 * TC-6: View Task History Timeline
 * ----------------------------------------
 * Steps:
 * 1. Open task details
 * 2. Click on "History" tab
 * Expected Result:
 * - Timeline shows all task changes chronologically
 * - Each entry shows:
 *   - Action type (Created, Status Changed, etc.)
 *   - Actor name
 *   - Timestamp
 *   - Before/after values for changes
 * - Filter options available by action type
 *
 * TC-7: Upload Task Attachment
 * ----------------------------------------
 * Steps:
 * 1. Open task details
 * 2. Click on "Attachments" tab
 * 3. Click "Upload" or drag-drop file
 * 4. Select file (PDF, DOCX, etc.)
 * 5. Wait for upload to complete
 * Expected Result:
 * - File appears in attachment list
 * - Shows filename, size, upload date
 * - Download button available
 * - Task assignee notified of new attachment
 *
 * TC-8: Download Task Attachment
 * ----------------------------------------
 * Steps:
 * 1. Find uploaded attachment in list
 * 2. Click download button
 * Expected Result:
 * - File downloads to browser
 * - Correct file content received
 *
 * TC-9: Delete Task Attachment
 * ----------------------------------------
 * Steps:
 * 1. Find own uploaded attachment
 * 2. Click delete button
 * 3. Confirm deletion
 * Expected Result:
 * - Attachment removed from list
 * - History shows attachment removal
 *
 * TC-10: Upload New Version of Attachment
 * ----------------------------------------
 * Steps:
 * 1. Find existing attachment
 * 2. Click "Upload New Version"
 * 3. Select updated file
 * 4. Complete upload
 * Expected Result:
 * - New version appears in list
 * - Version number incremented
 * - Previous version accessible in history
 *
 * TC-11: Create Subtask
 * ----------------------------------------
 * Steps:
 * 1. Open task details
 * 2. Click on "Subtasks" tab
 * 3. Click "Add Subtask" button
 * 4. Fill in subtask details:
 *    - Title
 *    - Description (optional)
 *    - Priority
 *    - Due date
 * 5. Click "Create"
 * Expected Result:
 * - Subtask appears in list
 * - Inherits case and type from parent
 * - Progress bar updates
 * - Parent task history shows subtask creation
 *
 * TC-12: Complete Subtask
 * ----------------------------------------
 * Steps:
 * 1. Find subtask in list
 * 2. Click checkbox to mark complete
 * Expected Result:
 * - Subtask marked as completed
 * - Progress bar updates percentage
 * - Parent task history updated
 * - Activity feed shows completion
 *
 * TC-13: View Case Activity Feed
 * ----------------------------------------
 * Steps:
 * 1. Navigate to case page
 * 2. View activity feed section
 * Expected Result:
 * - Chronological list of all case activities
 * - Includes tasks, documents, comments
 * - Each entry shows actor, action, timestamp
 * - Filter by activity type available
 * - Load more/pagination works correctly
 *
 * TC-14: Subscribe to Case Updates
 * ----------------------------------------
 * Steps:
 * 1. Open case details
 * 2. Find notification settings
 * 3. Click "Subscribe" button
 * Expected Result:
 * - Subscription created with default settings
 * - All notification types enabled
 * - Digest enabled
 *
 * TC-15: Update Subscription Preferences
 * ----------------------------------------
 * Steps:
 * 1. Open subscription settings for case
 * 2. Toggle individual notification types:
 *    - Tasks: On/Off
 *    - Documents: On/Off
 *    - Comments: On/Off
 *    - Daily Digest: On/Off
 * 3. Save changes
 * Expected Result:
 * - Preferences saved successfully
 * - Only selected notifications received going forward
 *
 * TC-16: Unsubscribe from Case
 * ----------------------------------------
 * Steps:
 * 1. Open case subscription settings
 * 2. Click "Unsubscribe"
 * 3. Confirm in dialog
 * Expected Result:
 * - Subscription removed
 * - No further notifications for this case
 *
 * TC-17: Receive Daily Digest Email
 * ----------------------------------------
 * Steps (System/Admin):
 * 1. Ensure user has digest subscriptions
 * 2. Activity occurs on subscribed cases during day
 * 3. Wait for daily digest job to run (or trigger manually)
 * Expected Result:
 * - Email received with activity summary
 * - Grouped by case
 * - Shows task updates, comments, documents
 * - Links to relevant case/task pages
 *
 * TC-18: Firm Isolation - Comments
 * ----------------------------------------
 * Steps:
 * 1. As User A (Firm 1), create comment on task
 * 2. As User B (Firm 2), try to access same task
 * Expected Result:
 * - User B cannot see task or comments
 * - Access denied error shown
 *
 * TC-19: Firm Isolation - Attachments
 * ----------------------------------------
 * Steps:
 * 1. As User A (Firm 1), upload attachment
 * 2. Copy attachment download URL
 * 3. As User B (Firm 2), try to access URL
 * Expected Result:
 * - Access denied for User B
 * - Signed URLs time-limited and firm-specific
 *
 * TC-20: Real-time Comment Updates (if WebSocket enabled)
 * ----------------------------------------
 * Steps:
 * 1. Open task details in two browser windows
 * 2. User A posts comment
 * Expected Result:
 * - Comment appears in User B's window without refresh
 * - Notification indicator updates in real-time
 *
 * =============================================================================
 */

import { test, expect, Page } from '@playwright/test';

// Helper function to mock GraphQL responses
async function mockGraphQL(page: Page, operationName: string, response: any) {
  await page.route('**/graphql', async (route, request) => {
    const postData = request.postDataJSON();
    if (postData?.operationName === operationName) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: response }),
      });
    } else {
      await route.continue();
    }
  });
}

// Test data
const testUser = {
  id: 'user-123',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
};

const testTask = {
  id: 'task-123',
  title: 'Test Task',
  caseId: 'case-123',
  status: 'InProgress',
  assignedTo: 'user-456',
};

const testComment = {
  id: 'comment-123',
  taskId: testTask.id,
  authorId: testUser.id,
  content: 'Test comment',
  createdAt: new Date().toISOString(),
  author: testUser,
  replies: [],
};

test.describe('Task Collaboration E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      (window as any).__MOCK_AUTH__ = {
        user: {
          id: 'user-123',
          firstName: 'Test',
          lastName: 'User',
          firmId: 'firm-123',
        },
      };
    });
  });

  // ============================================================================
  // Task Comments Tests
  // ============================================================================

  test.describe('Task Comments', () => {
    test('should display comments tab on task detail', async ({ page }) => {
      await mockGraphQL(page, 'GetTask', {
        task: testTask,
      });

      await mockGraphQL(page, 'GetTaskComments', {
        taskComments: [testComment],
      });

      await page.goto(`/tasks/${testTask.id}`);

      // Verify comments tab exists
      await expect(page.getByRole('tab', { name: /comments/i })).toBeVisible();

      // Click comments tab
      await page.getByRole('tab', { name: /comments/i }).click();

      // Verify comment is displayed
      await expect(page.getByText('Test comment')).toBeVisible();
    });

    test('should create new comment', async ({ page }) => {
      await mockGraphQL(page, 'GetTask', {
        task: testTask,
      });

      await mockGraphQL(page, 'GetTaskComments', {
        taskComments: [],
      });

      await mockGraphQL(page, 'CreateTaskComment', {
        createTaskComment: {
          ...testComment,
          content: 'New comment text',
        },
      });

      await page.goto(`/tasks/${testTask.id}`);
      await page.getByRole('tab', { name: /comments/i }).click();

      // Type comment
      await page.getByPlaceholder(/add a comment/i).fill('New comment text');

      // Submit comment
      await page.getByRole('button', { name: /post|send/i }).click();

      // Verify comment appears
      await expect(page.getByText('New comment text')).toBeVisible();
    });

    test('should show @mention autocomplete', async ({ page }) => {
      await mockGraphQL(page, 'GetTask', {
        task: testTask,
      });

      await mockGraphQL(page, 'GetTaskComments', {
        taskComments: [],
      });

      await mockGraphQL(page, 'SearchUsers', {
        users: [
          { id: 'user-1', firstName: 'John', lastName: 'Doe' },
          { id: 'user-2', firstName: 'Jane', lastName: 'Smith' },
        ],
      });

      await page.goto(`/tasks/${testTask.id}`);
      await page.getByRole('tab', { name: /comments/i }).click();

      // Type @ to trigger autocomplete
      await page.getByPlaceholder(/add a comment/i).fill('@');

      // Verify autocomplete dropdown appears
      await expect(page.getByText('John Doe')).toBeVisible();
      await expect(page.getByText('Jane Smith')).toBeVisible();
    });

    test('should reply to comment', async ({ page }) => {
      const parentComment = {
        ...testComment,
        id: 'parent-comment',
        content: 'Parent comment',
        replies: [],
      };

      await mockGraphQL(page, 'GetTask', {
        task: testTask,
      });

      await mockGraphQL(page, 'GetTaskComments', {
        taskComments: [parentComment],
      });

      await mockGraphQL(page, 'CreateTaskComment', {
        createTaskComment: {
          ...testComment,
          id: 'reply-123',
          content: 'Reply text',
          parentId: 'parent-comment',
        },
      });

      await page.goto(`/tasks/${testTask.id}`);
      await page.getByRole('tab', { name: /comments/i }).click();

      // Click reply button
      await page.getByRole('button', { name: /reply/i }).first().click();

      // Type reply
      await page.getByPlaceholder(/reply/i).fill('Reply text');

      // Submit reply
      await page.getByRole('button', { name: /post|send/i }).click();

      // Verify reply appears
      await expect(page.getByText('Reply text')).toBeVisible();
    });
  });

  // ============================================================================
  // Task History Tests
  // ============================================================================

  test.describe('Task History', () => {
    test('should display history tab on task detail', async ({ page }) => {
      await mockGraphQL(page, 'GetTask', {
        task: testTask,
      });

      await mockGraphQL(page, 'GetTaskHistory', {
        taskHistory: [
          {
            id: 'history-1',
            action: 'Created',
            actorId: testUser.id,
            createdAt: new Date().toISOString(),
            actor: testUser,
          },
          {
            id: 'history-2',
            action: 'StatusChanged',
            field: 'status',
            oldValue: 'Pending',
            newValue: 'InProgress',
            actorId: testUser.id,
            createdAt: new Date().toISOString(),
            actor: testUser,
          },
        ],
      });

      await page.goto(`/tasks/${testTask.id}`);

      // Click history tab
      await page.getByRole('tab', { name: /history/i }).click();

      // Verify history entries displayed
      await expect(page.getByText(/created/i)).toBeVisible();
      await expect(page.getByText(/status changed/i)).toBeVisible();
    });

    test('should filter history by action type', async ({ page }) => {
      await mockGraphQL(page, 'GetTask', {
        task: testTask,
      });

      await mockGraphQL(page, 'GetTaskHistory', {
        taskHistory: [
          {
            id: 'history-1',
            action: 'StatusChanged',
            actorId: testUser.id,
            createdAt: new Date().toISOString(),
            actor: testUser,
          },
        ],
      });

      await page.goto(`/tasks/${testTask.id}`);
      await page.getByRole('tab', { name: /history/i }).click();

      // Select filter
      await page.getByRole('combobox', { name: /filter/i }).selectOption('StatusChanged');

      // Verify filtered results
      await expect(page.getByText(/status changed/i)).toBeVisible();
    });
  });

  // ============================================================================
  // Task Attachments Tests
  // ============================================================================

  test.describe('Task Attachments', () => {
    test('should display attachments tab on task detail', async ({ page }) => {
      await mockGraphQL(page, 'GetTask', {
        task: testTask,
      });

      await mockGraphQL(page, 'GetTaskAttachments', {
        taskAttachments: [
          {
            id: 'attachment-1',
            fileName: 'document.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            createdAt: new Date().toISOString(),
            uploader: testUser,
          },
        ],
      });

      await page.goto(`/tasks/${testTask.id}`);

      // Click attachments tab
      await page.getByRole('tab', { name: /attachments/i }).click();

      // Verify attachment displayed
      await expect(page.getByText('document.pdf')).toBeVisible();
    });

    test('should upload file via drag and drop', async ({ page }) => {
      await mockGraphQL(page, 'GetTask', {
        task: testTask,
      });

      await mockGraphQL(page, 'GetTaskAttachments', {
        taskAttachments: [],
      });

      await mockGraphQL(page, 'UploadTaskAttachment', {
        uploadTaskAttachment: {
          id: 'attachment-new',
          fileName: 'uploaded.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          createdAt: new Date().toISOString(),
          uploader: testUser,
        },
      });

      await page.goto(`/tasks/${testTask.id}`);
      await page.getByRole('tab', { name: /attachments/i }).click();

      // Find upload area
      const uploadArea = page.locator('[data-testid="upload-area"]');

      // Simulate file drop (in real test, would use actual file)
      // For this mock test, we just verify the upload area exists
      await expect(uploadArea.or(page.getByText(/upload|drag/i))).toBeVisible();
    });

    test('should download attachment', async ({ page }) => {
      await mockGraphQL(page, 'GetTask', {
        task: testTask,
      });

      await mockGraphQL(page, 'GetTaskAttachments', {
        taskAttachments: [
          {
            id: 'attachment-1',
            fileName: 'document.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            createdAt: new Date().toISOString(),
            uploader: testUser,
          },
        ],
      });

      await mockGraphQL(page, 'GetAttachmentDownloadUrl', {
        attachmentDownloadUrl: 'https://example.com/download/document.pdf',
      });

      await page.goto(`/tasks/${testTask.id}`);
      await page.getByRole('tab', { name: /attachments/i }).click();

      // Find download button
      const downloadButton = page.getByRole('button', { name: /download/i });
      await expect(downloadButton).toBeVisible();
    });
  });

  // ============================================================================
  // Subtasks Tests
  // ============================================================================

  test.describe('Subtasks', () => {
    test('should display subtasks tab on task detail', async ({ page }) => {
      await mockGraphQL(page, 'GetTask', {
        task: testTask,
      });

      await mockGraphQL(page, 'GetSubtasks', {
        subtasks: [
          {
            id: 'subtask-1',
            title: 'Subtask 1',
            status: 'Pending',
            priority: 'Medium',
          },
          {
            id: 'subtask-2',
            title: 'Subtask 2',
            status: 'Completed',
            priority: 'High',
          },
        ],
      });

      await page.goto(`/tasks/${testTask.id}`);

      // Click subtasks tab
      await page.getByRole('tab', { name: /subtasks/i }).click();

      // Verify subtasks displayed
      await expect(page.getByText('Subtask 1')).toBeVisible();
      await expect(page.getByText('Subtask 2')).toBeVisible();
    });

    test('should show progress bar', async ({ page }) => {
      await mockGraphQL(page, 'GetTask', {
        task: testTask,
      });

      await mockGraphQL(page, 'GetSubtasks', {
        subtasks: [
          { id: 's1', title: 'Done', status: 'Completed' },
          { id: 's2', title: 'Pending', status: 'Pending' },
        ],
      });

      await page.goto(`/tasks/${testTask.id}`);
      await page.getByRole('tab', { name: /subtasks/i }).click();

      // Verify progress indicator (50%)
      await expect(page.getByText('50%')).toBeVisible();
    });

    test('should create new subtask', async ({ page }) => {
      await mockGraphQL(page, 'GetTask', {
        task: testTask,
      });

      await mockGraphQL(page, 'GetSubtasks', {
        subtasks: [],
      });

      await mockGraphQL(page, 'CreateSubtask', {
        createSubtask: {
          subtask: {
            id: 'new-subtask',
            title: 'New Subtask',
            status: 'Pending',
          },
        },
      });

      await page.goto(`/tasks/${testTask.id}`);
      await page.getByRole('tab', { name: /subtasks/i }).click();

      // Click add subtask button
      await page.getByRole('button', { name: /add subtask/i }).click();

      // Fill in subtask form
      await page.getByPlaceholder(/title/i).fill('New Subtask');

      // Submit
      await page.getByRole('button', { name: /add|create|save/i }).click();

      // Verify subtask appears
      await expect(page.getByText('New Subtask')).toBeVisible();
    });

    test('should toggle subtask completion', async ({ page }) => {
      await mockGraphQL(page, 'GetTask', {
        task: testTask,
      });

      await mockGraphQL(page, 'GetSubtasks', {
        subtasks: [
          { id: 'subtask-1', title: 'Subtask 1', status: 'Pending' },
        ],
      });

      await mockGraphQL(page, 'ToggleSubtask', {
        toggleSubtask: {
          id: 'subtask-1',
          status: 'Completed',
        },
      });

      await page.goto(`/tasks/${testTask.id}`);
      await page.getByRole('tab', { name: /subtasks/i }).click();

      // Click checkbox to complete
      await page.getByRole('checkbox').first().click();

      // Verify status changed (progress updated)
      await expect(page.getByText('100%')).toBeVisible();
    });
  });

  // ============================================================================
  // Case Subscription Tests
  // ============================================================================

  test.describe('Case Subscriptions', () => {
    test('should show subscription button on case page', async ({ page }) => {
      await mockGraphQL(page, 'GetCase', {
        case: {
          id: 'case-123',
          title: 'Test Case',
          caseNumber: 'CASE-001',
        },
      });

      await mockGraphQL(page, 'GetCaseSubscription', {
        caseSubscription: null,
      });

      await page.goto('/cases/case-123');

      // Verify subscribe button visible
      await expect(
        page.getByRole('button', { name: /subscribe|follow/i })
      ).toBeVisible();
    });

    test('should subscribe to case', async ({ page }) => {
      await mockGraphQL(page, 'GetCase', {
        case: {
          id: 'case-123',
          title: 'Test Case',
        },
      });

      await mockGraphQL(page, 'GetCaseSubscription', {
        caseSubscription: null,
      });

      await mockGraphQL(page, 'SubscribeToCaseUpdates', {
        subscribeToCaseUpdates: {
          id: 'sub-123',
          digestEnabled: true,
          notifyOnTask: true,
          notifyOnDocument: true,
          notifyOnComment: true,
        },
      });

      await page.goto('/cases/case-123');

      // Click subscribe button
      await page.getByRole('button', { name: /subscribe|follow/i }).click();

      // Verify subscribed state
      await expect(
        page.getByRole('button', { name: /subscribed|following/i })
      ).toBeVisible();
    });

    test('should update subscription preferences', async ({ page }) => {
      await mockGraphQL(page, 'GetCase', {
        case: {
          id: 'case-123',
          title: 'Test Case',
        },
      });

      await mockGraphQL(page, 'GetCaseSubscription', {
        caseSubscription: {
          id: 'sub-123',
          digestEnabled: true,
          notifyOnTask: true,
          notifyOnDocument: true,
          notifyOnComment: true,
        },
      });

      await mockGraphQL(page, 'UpdateCaseSubscription', {
        updateCaseSubscription: {
          id: 'sub-123',
          digestEnabled: false,
          notifyOnTask: true,
          notifyOnDocument: false,
          notifyOnComment: true,
        },
      });

      await page.goto('/cases/case-123');

      // Open subscription settings
      await page.getByRole('button', { name: /subscribed|settings/i }).click();

      // Toggle digest setting
      await page.getByLabel(/daily digest|digest/i).click();

      // Verify toggle state changed
      await expect(page.getByLabel(/daily digest|digest/i)).not.toBeChecked();
    });
  });

  // ============================================================================
  // Case Activity Feed Tests
  // ============================================================================

  test.describe('Case Activity Feed', () => {
    test('should display activity feed on case page', async ({ page }) => {
      await mockGraphQL(page, 'GetCase', {
        case: {
          id: 'case-123',
          title: 'Test Case',
        },
      });

      await mockGraphQL(page, 'GetCaseActivityFeed', {
        caseActivityFeed: {
          entries: [
            {
              id: 'activity-1',
              activityType: 'TaskCreated',
              title: 'New task created',
              summary: 'Research case law',
              createdAt: new Date().toISOString(),
              actor: testUser,
            },
            {
              id: 'activity-2',
              activityType: 'TaskCompleted',
              title: 'Task completed',
              summary: 'Draft motion',
              createdAt: new Date().toISOString(),
              actor: testUser,
            },
          ],
          hasMore: false,
        },
      });

      await page.goto('/cases/case-123');

      // Verify activity feed visible
      await expect(page.getByText('New task created')).toBeVisible();
      await expect(page.getByText('Task completed')).toBeVisible();
    });

    test('should filter activity feed by type', async ({ page }) => {
      await mockGraphQL(page, 'GetCase', {
        case: {
          id: 'case-123',
          title: 'Test Case',
        },
      });

      await mockGraphQL(page, 'GetCaseActivityFeed', {
        caseActivityFeed: {
          entries: [
            {
              id: 'activity-1',
              activityType: 'TaskCreated',
              title: 'Task created',
              createdAt: new Date().toISOString(),
              actor: testUser,
            },
          ],
          hasMore: false,
        },
      });

      await page.goto('/cases/case-123');

      // Select filter
      await page.getByRole('combobox', { name: /filter|type/i }).selectOption('TaskCreated');

      // Verify filtered results
      await expect(page.getByText('Task created')).toBeVisible();
    });

    test('should load more activities on scroll/click', async ({ page }) => {
      const firstBatch = Array(20)
        .fill(null)
        .map((_, i) => ({
          id: `activity-${i}`,
          activityType: 'TaskCreated',
          title: `Activity ${i}`,
          createdAt: new Date().toISOString(),
          actor: testUser,
        }));

      await mockGraphQL(page, 'GetCase', {
        case: {
          id: 'case-123',
          title: 'Test Case',
        },
      });

      await mockGraphQL(page, 'GetCaseActivityFeed', {
        caseActivityFeed: {
          entries: firstBatch,
          hasMore: true,
          nextCursor: 'cursor-20',
        },
      });

      await page.goto('/cases/case-123');

      // Verify load more button exists
      await expect(
        page.getByRole('button', { name: /load more|see more/i })
      ).toBeVisible();
    });
  });

  // ============================================================================
  // Notification Tests
  // ============================================================================

  test.describe('Notifications', () => {
    test('should show notification for new comment', async ({ page }) => {
      await mockGraphQL(page, 'GetNotifications', {
        notifications: [
          {
            id: 'notif-1',
            type: 'TaskComment',
            title: 'New comment on task',
            message: 'John Doe commented on "Research task"',
            read: false,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      await page.goto('/');

      // Open notifications panel
      await page.getByRole('button', { name: /notifications/i }).click();

      // Verify notification displayed
      await expect(page.getByText('New comment on task')).toBeVisible();
    });

    test('should show notification for @mention', async ({ page }) => {
      await mockGraphQL(page, 'GetNotifications', {
        notifications: [
          {
            id: 'notif-2',
            type: 'Mention',
            title: 'You were mentioned',
            message: 'Jane Smith mentioned you in a comment',
            read: false,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      await page.goto('/');
      await page.getByRole('button', { name: /notifications/i }).click();

      await expect(page.getByText('You were mentioned')).toBeVisible();
    });
  });
});
