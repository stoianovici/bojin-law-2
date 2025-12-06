/**
 * Word Integration Service Unit Tests
 * Story 3.4: Word Integration with Live AI Assistance - Task 22
 *
 * Tests for document locking using dual-storage pattern (Redis + PostgreSQL)
 */

// Set environment variables before imports
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';
process.env.DOCUMENT_LOCK_TTL_SECONDS = '1800';

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
};

// Mock Prisma
const mockPrisma = {
  document: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  documentLock: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  caseDocument: {
    findFirst: jest.fn(),
  },
};

// Mock dependencies before imports
jest.mock('@legal-platform/database', () => ({
  prisma: mockPrisma,
  redis: mockRedis,
}));

// Mock types with proper function
jest.mock('@legal-platform/types', () => ({
  DOCUMENT_LOCK_REDIS_KEY: (documentId: string) => `doc:lock:${documentId}`,
  DEFAULT_LOCK_TTL_SECONDS: 1800,
}));

jest.mock('../../src/services/onedrive.service', () => ({
  oneDriveService: {
    uploadDocumentToOneDrive: jest.fn(),
    downloadDocument: jest.fn(),
    getItemMetadata: jest.fn(),
    createCaseFolderStructure: jest.fn(),
    getFileMetadata: jest.fn(),
  },
  OneDriveService: jest.fn(),
}));

jest.mock('../../src/services/r2-storage.service', () => ({
  r2StorageService: {
    isConfigured: jest.fn().mockReturnValue(true),
    downloadDocument: jest.fn(),
    uploadDocument: jest.fn(),
    documentExists: jest.fn(),
    getContentTypeForExtension: jest.fn().mockReturnValue('application/octet-stream'),
  },
  R2StorageService: jest.fn(),
}));

jest.mock('../../src/config/graph.config', () => ({
  createGraphClient: jest.fn(() => ({
    api: jest.fn(() => ({
      get: jest.fn(),
      put: jest.fn(),
    })),
  })),
  graphEndpoints: {
    driveItem: jest.fn((id: string) => `/me/drive/items/${id}`),
    driveItemContent: jest.fn((id: string) => `/me/drive/items/${id}/content`),
  },
}));

jest.mock('../../src/utils/retry.util', () => ({
  retryWithBackoff: jest.fn((fn: () => any) => fn()),
}));

jest.mock('../../src/utils/logger', () => ({
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { WordIntegrationService } from '../../src/services/word-integration.service';

describe('WordIntegrationService', () => {
  let service: WordIntegrationService;

  beforeEach(() => {
    service = new WordIntegrationService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getDocumentLock', () => {
    it('should return null when no lock exists in Redis', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getDocumentLock('doc-123');

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('doc:lock:doc-123');
    });

    it('should return lock with user details when lock exists', async () => {
      const lockData = {
        userId: 'user-123',
        lockToken: 'token-abc123',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        sessionType: 'word_desktop',
        lockedAt: new Date().toISOString(),
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      const mockDbLock = {
        id: 'db-lock-123',
        documentId: 'doc-123',
        userId: 'user-123',
        lockToken: 'token-abc123',
        expiresAt: new Date(lockData.expiresAt),
        sessionType: 'word_desktop',
        lockedAt: new Date(lockData.lockedAt),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(lockData));
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.documentLock.findFirst.mockResolvedValue(mockDbLock);

      const result = await service.getDocumentLock('doc-123');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-123');
      expect(result?.user.email).toBe('test@example.com');
      expect(mockRedis.get).toHaveBeenCalledWith('doc:lock:doc-123');
    });

    it('should clean up Redis lock if user not found', async () => {
      const lockData = {
        userId: 'deleted-user',
        lockToken: 'token-abc123',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        sessionType: 'word_desktop',
        lockedAt: new Date().toISOString(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(lockData));
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getDocumentLock('doc-123');

      expect(result).toBeNull();
      expect(mockRedis.del).toHaveBeenCalledWith('doc:lock:doc-123');
    });
  });

  describe('acquireDocumentLock', () => {
    it('should acquire lock when document is not locked', async () => {
      const mockDbLock = {
        id: 'new-lock-123',
        documentId: 'doc-123',
        userId: 'user-123',
        lockToken: expect.any(String),
        expiresAt: expect.any(Date),
        sessionType: 'word_desktop',
        lockedAt: expect.any(Date),
      };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.documentLock.create.mockResolvedValue(mockDbLock);

      const result = await service.acquireDocumentLock('doc-123', 'user-123', 'word_desktop');

      expect(result).toMatchObject({
        documentId: 'doc-123',
        userId: 'user-123',
        sessionType: 'word_desktop',
      });
      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockPrisma.documentLock.create).toHaveBeenCalled();
    });

    it('should throw error when document is locked by another user', async () => {
      const existingLock = {
        userId: 'other-user',
        lockToken: 'other-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        sessionType: 'word_desktop',
        lockedAt: new Date().toISOString(),
      };

      const mockLockHolder = {
        email: 'other@example.com',
        firstName: 'Other',
        lastName: 'User',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingLock));
      mockPrisma.user.findUnique.mockResolvedValue(mockLockHolder);

      await expect(
        service.acquireDocumentLock('doc-123', 'user-123', 'word_desktop')
      ).rejects.toThrow(/Document is locked by/);
    });

    it('should refresh lock when same user already holds lock', async () => {
      const existingLock = {
        userId: 'user-123',
        lockToken: 'existing-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        sessionType: 'word_desktop',
        lockedAt: new Date().toISOString(),
      };

      const mockDbLock = {
        id: 'lock-123',
        documentId: 'doc-123',
        userId: 'user-123',
        lockToken: 'existing-token',
        expiresAt: new Date(Date.now() + 7200000),
        sessionType: 'word_desktop',
        lockedAt: new Date(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingLock));
      mockPrisma.documentLock.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.documentLock.findFirst.mockResolvedValue(mockDbLock);

      const result = await service.acquireDocumentLock('doc-123', 'user-123', 'word_desktop');

      expect(result.userId).toBe('user-123');
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('releaseDocumentLock', () => {
    it('should release lock owned by user', async () => {
      const existingLock = {
        userId: 'user-123',
        lockToken: 'token-abc',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        sessionType: 'word_desktop',
        lockedAt: new Date().toISOString(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingLock));

      await service.releaseDocumentLock('doc-123', 'user-123');

      expect(mockRedis.del).toHaveBeenCalledWith('doc:lock:doc-123');
      expect(mockPrisma.documentLock.deleteMany).toHaveBeenCalledWith({
        where: {
          documentId: 'doc-123',
          userId: 'user-123',
        },
      });
    });

    it('should throw error when trying to release another user\'s lock', async () => {
      const existingLock = {
        userId: 'other-user',
        lockToken: 'other-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        sessionType: 'word_desktop',
        lockedAt: new Date().toISOString(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingLock));

      await expect(
        service.releaseDocumentLock('doc-123', 'user-123')
      ).rejects.toThrow('Cannot release lock owned by another user');
    });

    it('should succeed when no lock exists (idempotent)', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.releaseDocumentLock('doc-123', 'user-123');

      expect(mockRedis.del).toHaveBeenCalledWith('doc:lock:doc-123');
      expect(mockPrisma.documentLock.deleteMany).toHaveBeenCalled();
    });
  });

  describe('renewDocumentLock', () => {
    it('should renew lock with valid token', async () => {
      const existingLock = {
        userId: 'user-123',
        lockToken: 'valid-token',
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
        sessionType: 'word_desktop',
        lockedAt: new Date().toISOString(),
      };

      const mockDbLock = {
        id: 'lock-123',
        documentId: 'doc-123',
        userId: 'user-123',
        lockToken: 'valid-token',
        expiresAt: new Date(Date.now() + 3600000),
        sessionType: 'word_desktop',
        lockedAt: new Date(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingLock));
      mockPrisma.documentLock.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.documentLock.findFirst.mockResolvedValue(mockDbLock);

      const result = await service.renewDocumentLock('doc-123', 'valid-token');

      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should throw error when lock not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.renewDocumentLock('doc-123', 'any-token')
      ).rejects.toThrow('Lock not found or expired');
    });

    it('should throw error with invalid token', async () => {
      const existingLock = {
        userId: 'user-123',
        lockToken: 'correct-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        sessionType: 'word_desktop',
        lockedAt: new Date().toISOString(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingLock));

      await expect(
        service.renewDocumentLock('doc-123', 'wrong-token')
      ).rejects.toThrow('Invalid lock token');
    });
  });

  describe('isDocumentLocked', () => {
    it('should return true when document is locked', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await service.isDocumentLocked('doc-123');

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('doc:lock:doc-123');
    });

    it('should return false when document is not locked', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await service.isDocumentLocked('doc-123');

      expect(result).toBe(false);
    });
  });

  describe('userHoldsLock', () => {
    it('should return true when user holds lock', async () => {
      const lockData = {
        userId: 'user-123',
        lockToken: 'token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        sessionType: 'word_desktop',
        lockedAt: new Date().toISOString(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(lockData));

      const result = await service.userHoldsLock('doc-123', 'user-123');

      expect(result).toBe(true);
    });

    it('should return false when different user holds lock', async () => {
      const lockData = {
        userId: 'other-user',
        lockToken: 'token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        sessionType: 'word_desktop',
        lockedAt: new Date().toISOString(),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(lockData));

      const result = await service.userHoldsLock('doc-123', 'user-123');

      expect(result).toBe(false);
    });

    it('should return false when no lock exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.userHoldsLock('doc-123', 'user-123');

      expect(result).toBe(false);
    });
  });
});
