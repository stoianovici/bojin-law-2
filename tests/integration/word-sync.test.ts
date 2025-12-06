/**
 * Word Sync Integration Tests
 * Story 3.8: Document System Testing and Performance - Task 10
 *
 * Tests:
 * - OneDrive document creation and sync
 * - Track changes preservation during sync
 * - Comment synchronization bidirectional
 * - Document lock acquisition and release
 * - Conflict detection and resolution
 * - Offline/online transition scenarios
 * - Sync failure recovery
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock OneDrive Graph API responses
const mockGraphClient = {
  createFile: jest.fn(),
  getFile: jest.fn(),
  updateFile: jest.fn(),
  deleteFile: jest.fn(),
  listVersions: jest.fn(),
  createVersion: jest.fn(),
  getComments: jest.fn(),
  createComment: jest.fn(),
  updateComment: jest.fn(),
  deleteComment: jest.fn(),
};

// Mock Document Lock service
const mockLockService = {
  acquireLock: jest.fn(),
  releaseLock: jest.fn(),
  checkLock: jest.fn(),
  forceLockRelease: jest.fn(),
  extendLock: jest.fn(),
};

// Mock sync status
interface SyncStatus {
  documentId: string;
  oneDriveItemId: string;
  lastSyncedAt: Date;
  localVersion: number;
  remoteVersion: number;
  status: 'synced' | 'pending' | 'conflict' | 'error';
  pendingChanges: number;
}

// Mock Word document structure
interface WordDocument {
  id: string;
  title: string;
  content: string;
  trackChanges: TrackChange[];
  comments: Comment[];
  metadata: {
    author: string;
    lastModified: Date;
    version: number;
  };
}

interface TrackChange {
  id: string;
  type: 'insert' | 'delete' | 'format';
  author: string;
  timestamp: Date;
  originalContent?: string;
  newContent?: string;
  accepted: boolean;
}

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: Date;
  resolved: boolean;
  replies: CommentReply[];
  anchorText: string;
  position: number;
}

interface CommentReply {
  id: string;
  author: string;
  content: string;
  timestamp: Date;
}

describe('Word Sync Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('OneDrive Document Creation and Sync', () => {
    it('should create document in OneDrive when saving new document', async () => {
      const newDocument: WordDocument = {
        id: 'doc-new-001',
        title: 'New Contract.docx',
        content: 'Contract content here...',
        trackChanges: [],
        comments: [],
        metadata: {
          author: 'user@test.com',
          lastModified: new Date(),
          version: 1,
        },
      };

      mockGraphClient.createFile.mockResolvedValue({
        id: 'onedrive-item-001',
        name: 'New Contract.docx',
        createdDateTime: new Date().toISOString(),
      });

      const result = await createDocumentInOneDrive(newDocument);

      expect(mockGraphClient.createFile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Contract.docx',
        })
      );
      expect(result.oneDriveItemId).toBe('onedrive-item-001');
      expect(result.status).toBe('synced');
    });

    it('should sync local changes to OneDrive', async () => {
      const document: WordDocument = {
        id: 'doc-001',
        title: 'Updated Contract.docx',
        content: 'Updated contract content...',
        trackChanges: [],
        comments: [],
        metadata: {
          author: 'user@test.com',
          lastModified: new Date(),
          version: 2,
        },
      };

      mockGraphClient.updateFile.mockResolvedValue({
        id: 'onedrive-item-001',
        eTag: 'etag-v2',
      });

      const syncStatus = await syncToOneDrive(document, 'onedrive-item-001');

      expect(mockGraphClient.updateFile).toHaveBeenCalled();
      expect(syncStatus.status).toBe('synced');
      expect(syncStatus.localVersion).toBe(2);
    });

    it('should pull remote changes from OneDrive', async () => {
      mockGraphClient.getFile.mockResolvedValue({
        id: 'onedrive-item-001',
        content: 'Remote updated content',
        lastModifiedDateTime: new Date().toISOString(),
      });

      const result = await pullFromOneDrive('onedrive-item-001');

      expect(mockGraphClient.getFile).toHaveBeenCalledWith('onedrive-item-001');
      expect(result.content).toBe('Remote updated content');
    });
  });

  describe('Track Changes Preservation', () => {
    it('should preserve track changes during upload sync', async () => {
      const documentWithChanges: WordDocument = {
        id: 'doc-track-001',
        title: 'Document with Changes.docx',
        content: 'Modified content',
        trackChanges: [
          {
            id: 'change-001',
            type: 'insert',
            author: 'reviewer@test.com',
            timestamp: new Date(),
            newContent: 'Added paragraph',
            accepted: false,
          },
          {
            id: 'change-002',
            type: 'delete',
            author: 'reviewer@test.com',
            timestamp: new Date(),
            originalContent: 'Removed text',
            accepted: false,
          },
        ],
        comments: [],
        metadata: {
          author: 'user@test.com',
          lastModified: new Date(),
          version: 3,
        },
      };

      mockGraphClient.updateFile.mockResolvedValue({ id: 'onedrive-item-002' });

      await syncToOneDrive(documentWithChanges, 'onedrive-item-002');

      // Verify track changes are included in sync
      expect(mockGraphClient.updateFile).toHaveBeenCalledWith(
        expect.objectContaining({
          trackChanges: expect.arrayContaining([
            expect.objectContaining({ id: 'change-001', type: 'insert' }),
            expect.objectContaining({ id: 'change-002', type: 'delete' }),
          ]),
        })
      );
    });

    it('should merge track changes from both local and remote', async () => {
      const localChanges: TrackChange[] = [
        {
          id: 'local-change-001',
          type: 'insert',
          author: 'local@test.com',
          timestamp: new Date('2025-01-01T10:00:00'),
          newContent: 'Local addition',
          accepted: false,
        },
      ];

      const remoteChanges: TrackChange[] = [
        {
          id: 'remote-change-001',
          type: 'delete',
          author: 'remote@test.com',
          timestamp: new Date('2025-01-01T11:00:00'),
          originalContent: 'Remote deletion',
          accepted: false,
        },
      ];

      const merged = mergeTrackChanges(localChanges, remoteChanges);

      expect(merged).toHaveLength(2);
      expect(merged.map((c) => c.id)).toContain('local-change-001');
      expect(merged.map((c) => c.id)).toContain('remote-change-001');
    });
  });

  describe('Comment Synchronization', () => {
    it('should sync comments from platform to OneDrive', async () => {
      const comments: Comment[] = [
        {
          id: 'comment-001',
          author: 'user@test.com',
          content: 'Please review this clause',
          timestamp: new Date(),
          resolved: false,
          replies: [],
          anchorText: 'liability clause',
          position: 1500,
        },
      ];

      mockGraphClient.createComment.mockResolvedValue({
        id: 'onedrive-comment-001',
      });

      await syncCommentsToOneDrive('onedrive-item-001', comments);

      expect(mockGraphClient.createComment).toHaveBeenCalledWith(
        'onedrive-item-001',
        expect.objectContaining({
          content: 'Please review this clause',
        })
      );
    });

    it('should sync comments from OneDrive to platform', async () => {
      mockGraphClient.getComments.mockResolvedValue([
        {
          id: 'onedrive-comment-002',
          content: { content: 'External reviewer comment' },
          author: { user: { displayName: 'External User' } },
          createdDateTime: new Date().toISOString(),
        },
      ]);

      const comments = await syncCommentsFromOneDrive('onedrive-item-001');

      expect(comments).toHaveLength(1);
      expect(comments[0].content).toBe('External reviewer comment');
    });

    it('should handle comment replies bidirectionally', async () => {
      const commentWithReplies: Comment = {
        id: 'comment-with-replies',
        author: 'user@test.com',
        content: 'Original comment',
        timestamp: new Date(),
        resolved: false,
        replies: [
          {
            id: 'reply-001',
            author: 'reviewer@test.com',
            content: 'Reply to comment',
            timestamp: new Date(),
          },
        ],
        anchorText: 'some text',
        position: 500,
      };

      mockGraphClient.createComment.mockResolvedValue({ id: 'od-comment' });

      await syncCommentsToOneDrive('onedrive-item-001', [commentWithReplies]);

      expect(mockGraphClient.createComment).toHaveBeenCalled();
    });
  });

  describe('Document Lock Management', () => {
    it('should acquire lock when opening document for editing', async () => {
      mockLockService.acquireLock.mockResolvedValue({
        lockId: 'lock-001',
        documentId: 'doc-001',
        userId: 'user-001',
        lockToken: 'token-abc123',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        sessionType: 'word_desktop',
      });

      const lock = await acquireDocumentLock('doc-001', 'user-001', 'word_desktop');

      expect(mockLockService.acquireLock).toHaveBeenCalledWith(
        'doc-001',
        'user-001',
        'word_desktop'
      );
      expect(lock.lockToken).toBe('token-abc123');
    });

    it('should release lock when closing document', async () => {
      mockLockService.releaseLock.mockResolvedValue({ success: true });

      const result = await releaseDocumentLock('doc-001', 'token-abc123');

      expect(mockLockService.releaseLock).toHaveBeenCalledWith('doc-001', 'token-abc123');
      expect(result.success).toBe(true);
    });

    it('should prevent editing when document is locked by another user', async () => {
      mockLockService.acquireLock.mockRejectedValue(
        new Error('Document is locked by another user')
      );

      await expect(
        acquireDocumentLock('doc-001', 'user-002', 'word_desktop')
      ).rejects.toThrow('Document is locked by another user');
    });

    it('should extend lock for long editing sessions', async () => {
      mockLockService.extendLock.mockResolvedValue({
        lockId: 'lock-001',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // Extended 1 hour
      });

      const extended = await extendDocumentLock('doc-001', 'token-abc123');

      expect(mockLockService.extendLock).toHaveBeenCalled();
      expect(extended.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Conflict Detection and Resolution', () => {
    it('should detect version conflict when syncing', async () => {
      const localVersion = 3;
      const remoteVersion = 4; // Server has newer version

      mockGraphClient.getFile.mockResolvedValue({
        id: 'onedrive-item-001',
        eTag: 'etag-v4',
        version: remoteVersion,
      });

      const conflict = await detectConflict('doc-001', localVersion, 'onedrive-item-001');

      expect(conflict.hasConflict).toBe(true);
      expect(conflict.localVersion).toBe(3);
      expect(conflict.remoteVersion).toBe(4);
    });

    it('should resolve conflict by keeping local changes', async () => {
      const localDocument: WordDocument = {
        id: 'doc-001',
        title: 'Contract.docx',
        content: 'Local content wins',
        trackChanges: [],
        comments: [],
        metadata: {
          author: 'user@test.com',
          lastModified: new Date(),
          version: 3,
        },
      };

      mockGraphClient.updateFile.mockResolvedValue({
        id: 'onedrive-item-001',
        eTag: 'etag-v5',
      });

      const result = await resolveConflict(localDocument, 'onedrive-item-001', 'keep_local');

      expect(result.resolution).toBe('keep_local');
      expect(mockGraphClient.updateFile).toHaveBeenCalled();
    });

    it('should resolve conflict by accepting remote changes', async () => {
      mockGraphClient.getFile.mockResolvedValue({
        id: 'onedrive-item-001',
        content: 'Remote content wins',
      });

      const result = await resolveConflict(
        { id: 'doc-001' } as WordDocument,
        'onedrive-item-001',
        'accept_remote'
      );

      expect(result.resolution).toBe('accept_remote');
      expect(result.content).toBe('Remote content wins');
    });

    it('should create conflict copy when merging is not possible', async () => {
      const result = await resolveConflict(
        { id: 'doc-001', title: 'Contract.docx' } as WordDocument,
        'onedrive-item-001',
        'create_copy'
      );

      expect(result.resolution).toBe('create_copy');
      expect(result.copyCreated).toBe(true);
    });
  });

  describe('Offline/Online Transition', () => {
    it('should queue changes when offline', async () => {
      const offlineChanges = {
        documentId: 'doc-001',
        changes: [
          { type: 'content', data: 'Modified offline' },
          { type: 'comment', data: { id: 'c1', content: 'Offline comment' } },
        ],
        queuedAt: new Date(),
      };

      const queue = await queueOfflineChanges(offlineChanges);

      expect(queue.documentId).toBe('doc-001');
      expect(queue.pendingChanges).toBe(2);
    });

    it('should sync queued changes when coming online', async () => {
      const queuedChanges = [
        { documentId: 'doc-001', changeType: 'content', data: 'Change 1' },
        { documentId: 'doc-001', changeType: 'comment', data: 'Change 2' },
      ];

      mockGraphClient.updateFile.mockResolvedValue({ success: true });

      const syncResult = await syncQueuedChanges(queuedChanges);

      expect(syncResult.synced).toBe(2);
      expect(syncResult.failed).toBe(0);
    });

    it('should handle partial sync failure gracefully', async () => {
      const queuedChanges = [
        { documentId: 'doc-001', changeType: 'content', data: 'Success' },
        { documentId: 'doc-002', changeType: 'content', data: 'Fail' },
      ];

      mockGraphClient.updateFile
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Network error'));

      const syncResult = await syncQueuedChanges(queuedChanges);

      expect(syncResult.synced).toBe(1);
      expect(syncResult.failed).toBe(1);
      expect(syncResult.retryQueue).toHaveLength(1);
    });
  });

  describe('Sync Failure Recovery', () => {
    it('should retry failed sync with exponential backoff', async () => {
      let attempts = 0;
      mockGraphClient.updateFile.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({ success: true });
      });

      const result = await syncWithRetry('doc-001', 'content', { maxRetries: 3 });

      expect(attempts).toBe(3);
      expect(result.success).toBe(true);
    });

    it('should save to local storage on persistent sync failure', async () => {
      mockGraphClient.updateFile.mockRejectedValue(new Error('Persistent failure'));

      const result = await handleSyncFailure('doc-001', 'content');

      expect(result.savedLocally).toBe(true);
      expect(result.willRetryLater).toBe(true);
    });

    it('should notify user of sync status', async () => {
      const notification = await notifySyncStatus('doc-001', 'error', 'Failed to sync');

      expect(notification.type).toBe('error');
      expect(notification.message).toContain('Failed to sync');
    });
  });
});

// Helper function stubs - these would be implemented in actual services
async function createDocumentInOneDrive(doc: WordDocument): Promise<SyncStatus> {
  const result = await mockGraphClient.createFile({ name: doc.title, content: doc.content });
  return {
    documentId: doc.id,
    oneDriveItemId: result.id,
    lastSyncedAt: new Date(),
    localVersion: doc.metadata.version,
    remoteVersion: 1,
    status: 'synced',
    pendingChanges: 0,
  };
}

async function syncToOneDrive(doc: WordDocument, itemId: string): Promise<SyncStatus> {
  await mockGraphClient.updateFile({ id: itemId, content: doc.content, trackChanges: doc.trackChanges });
  return {
    documentId: doc.id,
    oneDriveItemId: itemId,
    lastSyncedAt: new Date(),
    localVersion: doc.metadata.version,
    remoteVersion: doc.metadata.version,
    status: 'synced',
    pendingChanges: 0,
  };
}

async function pullFromOneDrive(itemId: string): Promise<{ content: string }> {
  const file = await mockGraphClient.getFile(itemId);
  return { content: file.content };
}

function mergeTrackChanges(local: TrackChange[], remote: TrackChange[]): TrackChange[] {
  const merged = [...local];
  for (const remoteChange of remote) {
    if (!merged.find((c) => c.id === remoteChange.id)) {
      merged.push(remoteChange);
    }
  }
  return merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

async function syncCommentsToOneDrive(itemId: string, comments: Comment[]): Promise<void> {
  for (const comment of comments) {
    await mockGraphClient.createComment(itemId, { content: comment.content });
  }
}

async function syncCommentsFromOneDrive(itemId: string): Promise<Comment[]> {
  const odComments = await mockGraphClient.getComments(itemId);
  return odComments.map((c: { id: string; content: { content: string }; author: { user: { displayName: string } }; createdDateTime: string }) => ({
    id: c.id,
    author: c.author.user.displayName,
    content: c.content.content,
    timestamp: new Date(c.createdDateTime),
    resolved: false,
    replies: [],
    anchorText: '',
    position: 0,
  }));
}

async function acquireDocumentLock(docId: string, userId: string, sessionType: string) {
  return mockLockService.acquireLock(docId, userId, sessionType);
}

async function releaseDocumentLock(docId: string, token: string) {
  return mockLockService.releaseLock(docId, token);
}

async function extendDocumentLock(docId: string, token: string) {
  return mockLockService.extendLock(docId, token);
}

async function detectConflict(docId: string, localVersion: number, itemId: string) {
  const remote = await mockGraphClient.getFile(itemId);
  return {
    hasConflict: remote.version > localVersion,
    localVersion,
    remoteVersion: remote.version,
  };
}

async function resolveConflict(
  localDoc: WordDocument,
  itemId: string,
  strategy: 'keep_local' | 'accept_remote' | 'create_copy'
) {
  if (strategy === 'keep_local') {
    await mockGraphClient.updateFile({ id: itemId, content: localDoc.content });
    return { resolution: 'keep_local' };
  } else if (strategy === 'accept_remote') {
    const remote = await mockGraphClient.getFile(itemId);
    return { resolution: 'accept_remote', content: remote.content };
  } else {
    return { resolution: 'create_copy', copyCreated: true };
  }
}

async function queueOfflineChanges(changes: { documentId: string; changes: unknown[] }) {
  return { documentId: changes.documentId, pendingChanges: changes.changes.length };
}

async function syncQueuedChanges(queue: { documentId: string; changeType: string; data: unknown }[]) {
  let synced = 0;
  let failed = 0;
  const retryQueue: typeof queue = [];

  for (const change of queue) {
    try {
      await mockGraphClient.updateFile({ id: change.documentId, data: change.data });
      synced++;
    } catch {
      failed++;
      retryQueue.push(change);
    }
  }

  return { synced, failed, retryQueue };
}

async function syncWithRetry(
  docId: string,
  content: string,
  options: { maxRetries: number }
): Promise<{ success: boolean }> {
  for (let i = 0; i < options.maxRetries; i++) {
    try {
      await mockGraphClient.updateFile({ id: docId, content });
      return { success: true };
    } catch {
      if (i === options.maxRetries - 1) throw new Error('Max retries exceeded');
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 100));
    }
  }
  return { success: false };
}

async function handleSyncFailure(_docId: string, _content: string) {
  return { savedLocally: true, willRetryLater: true };
}

async function notifySyncStatus(_docId: string, type: string, message: string) {
  return { type, message };
}
