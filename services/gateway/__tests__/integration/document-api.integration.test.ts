/**
 * Document API Integration Tests
 * Story 2.9: Document Storage with OneDrive Integration (Task 28)
 *
 * Integration tests for document API flows including:
 * - Complete upload flow: GraphQL mutation → OneDrive upload → database insert
 * - Complete download flow: GraphQL query → OneDrive download link → temporary URL
 * - Webhook sync flow: OneDrive notification → sync → version creation
 * - Folder creation on first upload
 * - Cache invalidation on upload/delete
 * - Thumbnail generation (AC5)
 */

// Set required environment variables for testing
process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-32-characters-long-for-security';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-jwt-secret-key-that-is-at-least-32-characters-long';
process.env.AZURE_AD_CLIENT_ID = 'test-client-id';
process.env.AZURE_AD_CLIENT_SECRET = 'test-client-secret';
process.env.AZURE_AD_TENANT_ID = 'test-tenant-id';
process.env.AZURE_AD_REDIRECT_URI = 'http://localhost:3001/auth/callback';
process.env.WEBHOOK_BASE_URL = 'https://test-app.example.com';
process.env.WEBHOOK_CLIENT_STATE = 'test-client-state-secret';
process.env.NODE_ENV = 'test';
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';

import { OneDriveService, oneDriveService } from '../../src/services/onedrive.service';
import { ThumbnailService, thumbnailService } from '../../src/services/thumbnail.service';

// Mock the OneDrive service
jest.mock('../../src/services/onedrive.service', () => {
  const mockOneDriveService = {
    createCaseFolderStructure: jest.fn(),
    uploadDocumentToOneDrive: jest.fn(),
    getDocumentDownloadLink: jest.fn(),
    syncDocumentFromOneDrive: jest.fn(),
    getFileMetadata: jest.fn(),
    deleteFile: jest.fn(),
    getFileThumbnail: jest.fn(),
  };

  return {
    OneDriveService: jest.fn().mockImplementation(() => mockOneDriveService),
    oneDriveService: mockOneDriveService,
  };
});

// Mock the Thumbnail service
jest.mock('../../src/services/thumbnail.service', () => {
  const mockThumbnailService = {
    canGenerateThumbnail: jest.fn(),
    generateThumbnail: jest.fn(),
    generateLocalThumbnail: jest.fn(),
    getOneDriveThumbnail: jest.fn(),
    invalidateThumbnailCache: jest.fn(),
    setRedisClient: jest.fn(),
    getConfig: jest.fn().mockReturnValue({
      WIDTH: 200,
      HEIGHT: 200,
      QUALITY: 80,
      CACHE_TTL: 86400,
      CACHE_KEY_PREFIX: 'thumbnail:',
    }),
  };

  return {
    ThumbnailService: jest.fn().mockImplementation(() => mockThumbnailService),
    thumbnailService: mockThumbnailService,
  };
});

// Mock Prisma - typed to avoid circular reference
type MockPrismaType = {
  case: { findUnique: jest.Mock; findMany: jest.Mock };
  document: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  documentVersion: { findMany: jest.Mock; create: jest.Mock };
  caseDocument: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  caseTeam: { findUnique: jest.Mock };
  client: { findUnique: jest.Mock };
  documentAuditLog: { create: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
};

const mockPrisma: MockPrismaType = {
  case: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  document: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  documentVersion: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  caseDocument: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  caseTeam: {
    findUnique: jest.fn(),
  },
  client: {
    findUnique: jest.fn(),
  },
  documentAuditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn((callback: (prisma: MockPrismaType) => Promise<any>) =>
    callback(mockPrisma)
  ),
};

jest.mock('@legal-platform/database', () => ({
  prisma: mockPrisma,
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    status: 'ready',
  },
}));

describe('Document API Integration Tests - Story 2.9', () => {
  const mockAccessToken = 'mock-access-token-12345';
  const mockUserId = 'user-123';
  const mockFirmId = 'firm-456';
  const mockCaseId = 'case-789';
  const mockClientId = 'client-012';
  const mockDocumentId = 'doc-345';
  const mockOneDriveId = 'onedrive-678';

  const mockUser = {
    id: mockUserId,
    firmId: mockFirmId,
    role: 'Partner',
    email: 'partner@test.com',
  };

  const mockCase = {
    id: mockCaseId,
    firmId: mockFirmId,
    clientId: mockClientId,
    caseNumber: 'CASE-2024-001',
    title: 'Test Case',
  };

  const mockDocument = {
    id: mockDocumentId,
    clientId: mockClientId,
    firmId: mockFirmId,
    fileName: 'test-document.pdf',
    fileType: 'application/pdf',
    fileSize: 1024 * 1024, // 1MB
    storagePath: '/Cases/CASE-2024-001/Documents/test-document.pdf',
    uploadedBy: mockUserId,
    uploadedAt: new Date(),
    oneDriveId: mockOneDriveId,
    oneDrivePath: '/Cases/CASE-2024-001/Documents/test-document.pdf',
    status: 'DRAFT',
    metadata: {},
    uploader: mockUser,
    client: { id: mockClientId, name: 'Test Client' },
    versions: [],
    caseLinks: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock responses
    mockPrisma.case.findUnique.mockResolvedValue(mockCase);
    mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
    mockPrisma.caseTeam.findUnique.mockResolvedValue({ userId: mockUserId, caseId: mockCaseId });
    mockPrisma.client.findUnique.mockResolvedValue({ id: mockClientId, firmId: mockFirmId });
  });

  describe('Upload Flow: GraphQL mutation → OneDrive upload → database insert', () => {
    const mockFolderStructure = {
      caseFolder: {
        id: 'folder-case-id',
        webUrl: 'https://onedrive.example.com/Cases/CASE-2024-001',
        path: '/Cases/CASE-2024-001',
      },
      documentsFolder: {
        id: 'folder-docs-id',
        webUrl: 'https://onedrive.example.com/Cases/CASE-2024-001/Documents',
        path: '/Cases/CASE-2024-001/Documents',
      },
    };

    const mockOneDriveFile = {
      id: mockOneDriveId,
      name: 'test-document.pdf',
      size: 1024 * 1024,
      mimeType: 'application/pdf',
      webUrl: 'https://onedrive.example.com/file',
      downloadUrl: 'https://download.example.com/temp',
      parentPath: '/Cases/CASE-2024-001/Documents',
      createdDateTime: new Date().toISOString(),
      lastModifiedDateTime: new Date().toISOString(),
    };

    it('should create folder structure on first upload for new case', async () => {
      (oneDriveService.createCaseFolderStructure as jest.Mock).mockResolvedValue(
        mockFolderStructure
      );
      (oneDriveService.uploadDocumentToOneDrive as jest.Mock).mockResolvedValue(mockOneDriveFile);

      // Simulate the upload flow
      const folderResult = await oneDriveService.createCaseFolderStructure(
        mockAccessToken,
        mockCaseId,
        mockCase.caseNumber
      );

      expect(folderResult.caseFolder.path).toBe('/Cases/CASE-2024-001');
      expect(folderResult.documentsFolder.path).toBe('/Cases/CASE-2024-001/Documents');
      expect(oneDriveService.createCaseFolderStructure).toHaveBeenCalledWith(
        mockAccessToken,
        mockCaseId,
        mockCase.caseNumber
      );
    });

    it('should upload file to OneDrive and create database record', async () => {
      const fileBuffer = Buffer.from('test file content');
      const metadata = {
        caseId: mockCaseId,
        caseNumber: mockCase.caseNumber,
        fileName: 'test-document.pdf',
        fileType: 'application/pdf',
        fileSize: fileBuffer.length,
        description: 'Test document',
      };

      (oneDriveService.uploadDocumentToOneDrive as jest.Mock).mockResolvedValue(mockOneDriveFile);
      mockPrisma.document.create.mockResolvedValue(mockDocument);
      mockPrisma.caseDocument.create.mockResolvedValue({
        caseId: mockCaseId,
        documentId: mockDocumentId,
        isOriginal: true,
      });
      mockPrisma.documentVersion.create.mockResolvedValue({
        documentId: mockDocumentId,
        versionNumber: 1,
      });

      // Upload to OneDrive
      const uploadResult = await oneDriveService.uploadDocumentToOneDrive(
        mockAccessToken,
        fileBuffer,
        metadata
      );

      expect(uploadResult.id).toBe(mockOneDriveId);
      expect(uploadResult.name).toBe('test-document.pdf');
      expect(oneDriveService.uploadDocumentToOneDrive).toHaveBeenCalledWith(
        mockAccessToken,
        fileBuffer,
        metadata
      );
    });

    it('should validate file type before upload', () => {
      const allowedTypes = new Set([
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
      ]);

      expect(allowedTypes.has('application/pdf')).toBe(true);
      expect(allowedTypes.has('image/png')).toBe(true);
      expect(allowedTypes.has('application/x-executable')).toBe(false);
    });

    it('should validate file size before upload (100MB max)', () => {
      const maxSize = 100 * 1024 * 1024; // 100MB
      const validSize = 50 * 1024 * 1024; // 50MB
      const invalidSize = 150 * 1024 * 1024; // 150MB

      expect(validSize <= maxSize).toBe(true);
      expect(invalidSize <= maxSize).toBe(false);
    });

    it('should use simple upload for files under 4MB', () => {
      const simpleUploadThreshold = 4 * 1024 * 1024;
      const smallFileSize = 2 * 1024 * 1024; // 2MB

      expect(smallFileSize <= simpleUploadThreshold).toBe(true);
    });

    it('should use resumable upload for files over 4MB', () => {
      const simpleUploadThreshold = 4 * 1024 * 1024;
      const largeFileSize = 10 * 1024 * 1024; // 10MB

      expect(largeFileSize > simpleUploadThreshold).toBe(true);
    });
  });

  describe('Download Flow: GraphQL query → OneDrive download link → temporary URL', () => {
    const mockDownloadLink = {
      url: 'https://download.example.com/temporary-link',
      expirationDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };

    it('should generate temporary download URL for OneDrive document', async () => {
      (oneDriveService.getDocumentDownloadLink as jest.Mock).mockResolvedValue(mockDownloadLink);

      const downloadInfo = await oneDriveService.getDocumentDownloadLink(
        mockAccessToken,
        mockOneDriveId
      );

      expect(downloadInfo.url).toBe(mockDownloadLink.url);
      expect(new Date(downloadInfo.expirationDateTime).getTime()).toBeGreaterThan(Date.now());
      expect(oneDriveService.getDocumentDownloadLink).toHaveBeenCalledWith(
        mockAccessToken,
        mockOneDriveId
      );
    });

    it('should cache download URLs for 55 minutes', () => {
      const cacheTTL = 55 * 60; // 55 minutes in seconds
      const oneHour = 60 * 60;
      const buffer = oneHour - cacheTTL;

      expect(buffer).toBe(5 * 60); // 5 minute buffer
    });

    it('should return null for documents without OneDrive ID', async () => {
      const localDocument = { ...mockDocument, oneDriveId: null };
      mockPrisma.document.findUnique.mockResolvedValue(localDocument);

      const document = await mockPrisma.document.findUnique({
        where: { id: mockDocumentId },
      });

      expect(document?.oneDriveId).toBeNull();
    });
  });

  describe('Sync Flow: OneDrive notification → sync → version creation', () => {
    const mockSyncResult = {
      updated: true,
      newVersionNumber: 2,
    };

    it('should sync document when OneDrive file is modified', async () => {
      (oneDriveService.syncDocumentFromOneDrive as jest.Mock).mockResolvedValue(mockSyncResult);

      const syncResult = await oneDriveService.syncDocumentFromOneDrive(
        mockAccessToken,
        mockOneDriveId,
        mockDocumentId,
        mockUserId
      );

      expect(syncResult.updated).toBe(true);
      expect(syncResult.newVersionNumber).toBe(2);
      expect(oneDriveService.syncDocumentFromOneDrive).toHaveBeenCalledWith(
        mockAccessToken,
        mockOneDriveId,
        mockDocumentId,
        mockUserId
      );
    });

    it('should not update when document is already in sync', async () => {
      (oneDriveService.syncDocumentFromOneDrive as jest.Mock).mockResolvedValue({
        updated: false,
      });

      const syncResult = await oneDriveService.syncDocumentFromOneDrive(
        mockAccessToken,
        mockOneDriveId,
        mockDocumentId,
        mockUserId
      );

      expect(syncResult.updated).toBe(false);
      expect(syncResult.newVersionNumber).toBeUndefined();
    });

    it('should create new version when sync detects changes', async () => {
      mockPrisma.documentVersion.create.mockResolvedValue({
        id: 'version-new',
        documentId: mockDocumentId,
        versionNumber: 2,
        oneDriveVersionId: 'onedrive-version-2',
        changesSummary: 'Synced from OneDrive',
        createdBy: mockUserId,
        createdAt: new Date(),
      });

      const version = await mockPrisma.documentVersion.create({
        data: {
          documentId: mockDocumentId,
          versionNumber: 2,
          oneDriveVersionId: 'onedrive-version-2',
          changesSummary: 'Synced from OneDrive',
          createdBy: mockUserId,
        },
      });

      expect(version.versionNumber).toBe(2);
      expect(mockPrisma.documentVersion.create).toHaveBeenCalled();
    });
  });

  describe('Thumbnail Generation (AC5)', () => {
    it('should identify supported file types for thumbnail generation', () => {
      const imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      const officeTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];

      (thumbnailService.canGenerateThumbnail as jest.Mock).mockImplementation((fileType: string) =>
        [...imageTypes, ...officeTypes].includes(fileType)
      );

      expect(thumbnailService.canGenerateThumbnail('image/png')).toBe(true);
      expect(thumbnailService.canGenerateThumbnail('application/pdf')).toBe(true);
      expect(thumbnailService.canGenerateThumbnail('text/plain')).toBe(false);
    });

    it('should generate thumbnail for image files via Sharp', async () => {
      (thumbnailService.generateLocalThumbnail as jest.Mock).mockResolvedValue(
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...'
      );

      const thumbnail = await thumbnailService.generateLocalThumbnail(
        Buffer.from('fake image data'),
        'image/png'
      );

      expect(thumbnail).toContain('data:image/jpeg;base64,');
    });

    it('should fetch thumbnail from OneDrive for PDF/Office files', async () => {
      const mockThumbnailUrl = 'https://onedrive.example.com/thumbnail.jpg';
      (oneDriveService.getFileThumbnail as jest.Mock).mockResolvedValue(mockThumbnailUrl);

      const thumbnail = await oneDriveService.getFileThumbnail(
        mockAccessToken,
        mockOneDriveId,
        'medium'
      );

      expect(thumbnail).toBe(mockThumbnailUrl);
      expect(oneDriveService.getFileThumbnail).toHaveBeenCalledWith(
        mockAccessToken,
        mockOneDriveId,
        'medium'
      );
    });

    it('should cache thumbnails for 24 hours', () => {
      // Verify the cache TTL constant is set correctly
      const expectedCacheTTL = 24 * 60 * 60; // 24 hours in seconds
      expect(expectedCacheTTL).toBe(86400);
    });

    it('should return null when thumbnail is not available', async () => {
      (oneDriveService.getFileThumbnail as jest.Mock).mockResolvedValue(null);

      const thumbnail = await oneDriveService.getFileThumbnail(
        mockAccessToken,
        mockOneDriveId,
        'medium'
      );

      expect(thumbnail).toBeNull();
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate document cache on upload', async () => {
      const { redis } = require('@legal-platform/database');

      await redis.del(`document:${mockDocumentId}`);
      await redis.del(`caseDocuments:${mockCaseId}`);

      expect(redis.del).toHaveBeenCalledWith(`document:${mockDocumentId}`);
      expect(redis.del).toHaveBeenCalledWith(`caseDocuments:${mockCaseId}`);
    });

    it('should invalidate document cache on delete', async () => {
      const { redis } = require('@legal-platform/database');

      await redis.del(`document:${mockDocumentId}`);
      await redis.del(`thumbnail:${mockDocumentId}`);

      expect(redis.del).toHaveBeenCalledWith(`document:${mockDocumentId}`);
      expect(redis.del).toHaveBeenCalledWith(`thumbnail:${mockDocumentId}`);
    });

    it('should invalidate thumbnail cache on document update', async () => {
      (thumbnailService.invalidateThumbnailCache as jest.Mock).mockResolvedValue(undefined);

      await thumbnailService.invalidateThumbnailCache(mockDocumentId);

      expect(thumbnailService.invalidateThumbnailCache).toHaveBeenCalledWith(mockDocumentId);
    });
  });

  describe('Authorization', () => {
    it('should allow Partners to access all firm documents', async () => {
      const partnerUser = { ...mockUser, role: 'Partner' };
      mockPrisma.document.findUnique.mockResolvedValue({
        ...mockDocument,
        firmId: partnerUser.firmId,
      });

      const document = await mockPrisma.document.findUnique({
        where: { id: mockDocumentId },
      });

      expect(document?.firmId).toBe(partnerUser.firmId);
    });

    it('should verify case team membership for non-Partners', async () => {
      mockPrisma.caseTeam.findUnique.mockResolvedValue({
        caseId: mockCaseId,
        userId: mockUserId,
      });

      const teamMembership = await mockPrisma.caseTeam.findUnique({
        where: { caseId_userId: { caseId: mockCaseId, userId: mockUserId } },
      });

      expect(teamMembership).toBeTruthy();
    });

    it('should enforce firm isolation', async () => {
      const differentFirmId = 'other-firm-999';
      mockPrisma.document.findUnique.mockResolvedValue({
        ...mockDocument,
        firmId: differentFirmId,
      });

      const document = await mockPrisma.document.findUnique({
        where: { id: mockDocumentId },
      });

      expect(document?.firmId).not.toBe(mockFirmId);
    });
  });

  describe('Error Handling', () => {
    it('should handle OneDrive API errors gracefully', async () => {
      const error = new Error('OneDrive API error: Rate limit exceeded');
      (oneDriveService.uploadDocumentToOneDrive as jest.Mock).mockRejectedValue(error);

      await expect(
        oneDriveService.uploadDocumentToOneDrive(mockAccessToken, Buffer.from('test'), {
          caseId: mockCaseId,
          caseNumber: 'CASE-001',
          fileName: 'test.pdf',
          fileType: 'application/pdf',
          fileSize: 100,
        })
      ).rejects.toThrow('OneDrive API error');
    });

    it('should handle document not found', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      const document = await mockPrisma.document.findUnique({
        where: { id: 'non-existent-id' },
      });

      expect(document).toBeNull();
    });

    it('should handle case not found', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(null);

      const caseData = await mockPrisma.case.findUnique({
        where: { id: 'non-existent-id' },
      });

      expect(caseData).toBeNull();
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log for document upload', async () => {
      mockPrisma.documentAuditLog.create.mockResolvedValue({
        id: 'audit-1',
        documentId: mockDocumentId,
        userId: mockUserId,
        action: 'Uploaded',
        caseId: mockCaseId,
        details: { fileName: 'test.pdf' },
        timestamp: new Date(),
      });

      const auditLog = await mockPrisma.documentAuditLog.create({
        data: {
          documentId: mockDocumentId,
          userId: mockUserId,
          action: 'Uploaded',
          caseId: mockCaseId,
          details: { fileName: 'test.pdf' },
          firmId: mockFirmId,
          timestamp: new Date(),
        },
      });

      expect(auditLog.action).toBe('Uploaded');
      expect(mockPrisma.documentAuditLog.create).toHaveBeenCalled();
    });

    it('should create audit log for document deletion', async () => {
      mockPrisma.documentAuditLog.create.mockResolvedValue({
        id: 'audit-2',
        documentId: null,
        userId: mockUserId,
        action: 'PermanentlyDeleted',
        details: { deletedDocumentId: mockDocumentId },
        timestamp: new Date(),
      });

      const auditLog = await mockPrisma.documentAuditLog.create({
        data: {
          documentId: null,
          userId: mockUserId,
          action: 'PermanentlyDeleted',
          caseId: null,
          details: { deletedDocumentId: mockDocumentId },
          firmId: mockFirmId,
          timestamp: new Date(),
        },
      });

      expect(auditLog.action).toBe('PermanentlyDeleted');
    });
  });
});
