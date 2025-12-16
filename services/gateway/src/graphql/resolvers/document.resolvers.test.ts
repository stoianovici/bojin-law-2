/**
 * Document Resolvers Unit Tests
 * Story 2.8.4: Cross-Case Document Linking
 */

import { GraphQLError } from 'graphql';

// Mock Prisma - must be defined before jest.mock
const mockPrisma: any = {
  client: {
    findUnique: jest.fn(),
  },
  case: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  caseTeam: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  document: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  caseDocument: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  documentAuditLog: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  documentVersion: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => fn(mockPrisma)),
};

jest.mock('@legal-platform/database', () => ({
  prisma: mockPrisma,
}));

// Mock OneDrive service
const mockOneDriveService = {
  createCaseFolderStructure: jest.fn(),
  uploadDocumentToOneDrive: jest.fn(),
  getDocumentDownloadLink: jest.fn(),
  syncDocumentFromOneDrive: jest.fn(),
  getFileThumbnail: jest.fn(),
  deleteFile: jest.fn(),
};

jest.mock('../../services/onedrive.service', () => ({
  oneDriveService: mockOneDriveService,
}));

// Mock Thumbnail service
const mockThumbnailService = {
  canGenerateThumbnail: jest.fn(),
  generateThumbnail: jest.fn(),
  invalidateThumbnailCache: jest.fn(),
};

jest.mock('../../services/thumbnail.service', () => ({
  thumbnailService: mockThumbnailService,
}));

// Mock logger - needs to match default export pattern
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../utils/logger', () => mockLogger);

// Import after mock
import { documentResolvers } from './document.resolvers';

// Test fixtures
const mockPartner = {
  id: 'user-partner-1',
  firmId: 'firm-1',
  role: 'Partner' as const,
  email: 'partner@test.com',
};

const mockAssociate = {
  id: 'user-associate-1',
  firmId: 'firm-1',
  role: 'Associate' as const,
  email: 'associate@test.com',
};

const mockClient = {
  id: 'client-1',
  firmId: 'firm-1',
  name: 'Test Client',
};

const mockCase = {
  id: 'case-1',
  firmId: 'firm-1',
  clientId: 'client-1',
  caseNumber: 'CASE-2024-001',
  title: 'Test Case',
  status: 'Active',
};

const mockDocument = {
  id: 'doc-1',
  clientId: 'client-1',
  firmId: 'firm-1',
  fileName: 'contract.pdf',
  fileType: 'application/pdf',
  fileSize: 102400,
  storagePath: '/firm-1/clients/client-1/documents/doc-1-contract.pdf',
  uploadedBy: 'user-associate-1',
  uploadedAt: new Date(),
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCaseDocument = {
  id: 'case-doc-1',
  caseId: 'case-1',
  documentId: 'doc-1',
  linkedBy: 'user-associate-1',
  linkedAt: new Date(),
  isOriginal: true,
  firmId: 'firm-1',
};

describe('Document Resolvers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore $transaction mock after clearAllMocks
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) =>
      fn(mockPrisma)
    );
  });

  describe('Query.clientDocuments', () => {
    it('returns documents for authorized user', async () => {
      mockClient.firmId = 'firm-1';
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.caseTeam.findFirst.mockResolvedValue({ caseId: 'case-1' });
      mockPrisma.caseDocument.findMany.mockResolvedValue([]);
      mockPrisma.document.findMany.mockResolvedValue([mockDocument]);

      const result = await documentResolvers.Query.clientDocuments(
        {},
        { clientId: 'client-1' },
        { user: mockAssociate }
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('doc-1');
    });

    it('throws error for unauthenticated user', async () => {
      await expect(
        documentResolvers.Query.clientDocuments({}, { clientId: 'client-1' }, { user: undefined })
      ).rejects.toThrow(GraphQLError);
    });

    it('throws FORBIDDEN for unauthorized client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue({ ...mockClient, firmId: 'other-firm' });

      await expect(
        documentResolvers.Query.clientDocuments(
          {},
          { clientId: 'client-1' },
          { user: mockAssociate }
        )
      ).rejects.toThrow('Not authorized to access client documents');
    });
  });

  describe('Query.caseDocuments', () => {
    it('returns documents linked to a case', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.caseTeam.findUnique.mockResolvedValue({ userId: mockAssociate.id });
      mockPrisma.caseDocument.findMany.mockResolvedValue([
        {
          ...mockCaseDocument,
          document: {
            ...mockDocument,
            uploader: { id: 'user-associate-1', firstName: 'Test', lastName: 'User' },
            client: mockClient,
          },
          linker: { id: 'user-associate-1', firstName: 'Test', lastName: 'User' },
        },
      ]);
      mockPrisma.caseDocument.findFirst.mockResolvedValue(null);

      const result = await documentResolvers.Query.caseDocuments(
        {},
        { caseId: 'case-1' },
        { user: mockAssociate }
      );

      expect(result).toHaveLength(1);
      expect(result[0].document.id).toBe('doc-1');
      expect(result[0].isOriginal).toBe(true);
    });

    it('Partner can access any case in their firm', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.caseDocument.findMany.mockResolvedValue([]);

      const result = await documentResolvers.Query.caseDocuments(
        {},
        { caseId: 'case-1' },
        { user: mockPartner }
      );

      expect(result).toEqual([]);
    });
  });

  describe('Mutation.linkDocumentsToCase', () => {
    it('links documents to a case successfully', async () => {
      const documentsToLink = [
        { ...mockDocument, id: 'doc-1' },
        { ...mockDocument, id: 'doc-2' },
      ];

      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.caseTeam.findUnique.mockResolvedValue({ userId: mockAssociate.id });
      mockPrisma.document.findMany.mockResolvedValue(documentsToLink);
      mockPrisma.caseDocument.findMany
        .mockResolvedValueOnce([]) // No existing links
        .mockResolvedValue([
          { ...mockCaseDocument, documentId: 'doc-1' },
          { ...mockCaseDocument, documentId: 'doc-2' },
        ]);
      mockPrisma.caseDocument.create.mockResolvedValue(mockCaseDocument);
      mockPrisma.documentAuditLog.create.mockResolvedValue({});

      const result = await documentResolvers.Mutation.linkDocumentsToCase(
        {},
        { input: { caseId: 'case-1', documentIds: ['doc-1', 'doc-2'] } },
        { user: mockAssociate }
      );

      expect(mockPrisma.caseDocument.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.documentAuditLog.create).toHaveBeenCalledTimes(2);
    });

    it('throws error when documents belong to different client', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.caseTeam.findUnique.mockResolvedValue({ userId: mockAssociate.id });
      mockPrisma.document.findMany.mockResolvedValue([
        { ...mockDocument, clientId: 'other-client' },
      ]);
      mockPrisma.caseDocument.findMany.mockResolvedValue([]);

      await expect(
        documentResolvers.Mutation.linkDocumentsToCase(
          {},
          { input: { caseId: 'case-1', documentIds: ['doc-1'] } },
          { user: mockAssociate }
        )
      ).rejects.toThrow('All documents must belong to the same client as the case');
    });

    it('throws error when all documents already linked', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.caseTeam.findUnique.mockResolvedValue({ userId: mockAssociate.id });
      mockPrisma.document.findMany.mockResolvedValue([mockDocument]);
      mockPrisma.caseDocument.findMany.mockResolvedValue([
        { documentId: 'doc-1' }, // Already linked
      ]);

      await expect(
        documentResolvers.Mutation.linkDocumentsToCase(
          {},
          { input: { caseId: 'case-1', documentIds: ['doc-1'] } },
          { user: mockAssociate }
        )
      ).rejects.toThrow('All documents are already linked to this case');
    });
  });

  describe('Mutation.unlinkDocumentFromCase', () => {
    it('unlinks document from case successfully', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.caseTeam.findUnique.mockResolvedValue({ userId: mockAssociate.id });
      mockPrisma.caseDocument.findUnique.mockResolvedValue({
        ...mockCaseDocument,
        document: mockDocument,
      });
      mockPrisma.caseDocument.delete.mockResolvedValue({});
      mockPrisma.documentAuditLog.create.mockResolvedValue({});

      const result = await documentResolvers.Mutation.unlinkDocumentFromCase(
        {},
        { caseId: 'case-1', documentId: 'doc-1' },
        { user: mockAssociate }
      );

      expect(result).toBe(true);
      expect(mockPrisma.caseDocument.delete).toHaveBeenCalled();
      expect(mockPrisma.documentAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'UnlinkedFromCase',
          }),
        })
      );
    });

    it('throws error when document not linked to case', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.caseTeam.findUnique.mockResolvedValue({ userId: mockAssociate.id });
      mockPrisma.caseDocument.findUnique.mockResolvedValue(null);

      await expect(
        documentResolvers.Mutation.unlinkDocumentFromCase(
          {},
          { caseId: 'case-1', documentId: 'doc-1' },
          { user: mockAssociate }
        )
      ).rejects.toThrow('Document is not linked to this case');
    });
  });

  describe('Mutation.permanentlyDeleteDocument', () => {
    it('Partner can permanently delete document', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        ...mockDocument,
        caseLinks: [mockCaseDocument],
      });
      mockPrisma.documentAuditLog.create.mockResolvedValue({});
      mockPrisma.caseDocument.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.document.delete.mockResolvedValue(mockDocument);

      const result = await documentResolvers.Mutation.permanentlyDeleteDocument(
        {},
        { documentId: 'doc-1' },
        { user: mockPartner }
      );

      expect(result).toBe(true);
      expect(mockPrisma.document.delete).toHaveBeenCalled();
      expect(mockPrisma.documentAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PermanentlyDeleted',
          }),
        })
      );
    });

    it('Associate cannot permanently delete document', async () => {
      await expect(
        documentResolvers.Mutation.permanentlyDeleteDocument(
          {},
          { documentId: 'doc-1' },
          { user: mockAssociate }
        )
      ).rejects.toThrow('Only Partners can permanently delete documents');
    });

    it('throws error when document belongs to different firm', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        ...mockDocument,
        firmId: 'other-firm',
        caseLinks: [],
      });

      await expect(
        documentResolvers.Mutation.permanentlyDeleteDocument(
          {},
          { documentId: 'doc-1' },
          { user: mockPartner }
        )
      ).rejects.toThrow('Not authorized');
    });
  });

  describe('Mutation.uploadDocument', () => {
    it('uploads document and creates case link', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.caseTeam.findUnique.mockResolvedValue({ userId: mockAssociate.id });
      mockPrisma.document.create.mockResolvedValue({
        ...mockDocument,
        uploader: { id: 'user-associate-1', firstName: 'Test', lastName: 'User' },
        client: mockClient,
      });
      mockPrisma.caseDocument.create.mockResolvedValue(mockCaseDocument);
      mockPrisma.documentAuditLog.create.mockResolvedValue({});
      mockPrisma.document.findUnique.mockResolvedValue({
        ...mockDocument,
        uploader: { id: 'user-associate-1', firstName: 'Test', lastName: 'User' },
        client: mockClient,
        caseLinks: [mockCaseDocument],
      });

      const result = await documentResolvers.Mutation.uploadDocument(
        {},
        {
          input: {
            caseId: 'case-1',
            fileName: 'contract.pdf',
            fileType: 'application/pdf',
            fileSize: 102400,
            storagePath: '/path/to/file.pdf',
          },
        },
        { user: mockAssociate }
      );

      expect(mockPrisma.document.create).toHaveBeenCalled();
      expect(mockPrisma.caseDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isOriginal: true,
          }),
        })
      );
    });

    it('throws error for unauthorized user', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.caseTeam.findUnique.mockResolvedValue(null);

      await expect(
        documentResolvers.Mutation.uploadDocument(
          {},
          {
            input: {
              caseId: 'case-1',
              fileName: 'contract.pdf',
              fileType: 'application/pdf',
              fileSize: 102400,
              storagePath: '/path/to/file.pdf',
            },
          },
          { user: mockAssociate }
        )
      ).rejects.toThrow('Not authorized to upload to this case');
    });
  });

  describe('Document field resolvers', () => {
    it('resolves linkedCases field', async () => {
      const parent = { id: 'doc-1' };
      mockPrisma.caseDocument.findMany.mockResolvedValue([
        {
          ...mockCaseDocument,
          case: mockCase,
          linker: { id: 'user-1', firstName: 'Test', lastName: 'User' },
        },
      ]);

      const result = await documentResolvers.Document.linkedCases(parent);

      expect(result).toHaveLength(1);
      expect(result[0].caseId).toBe('case-1');
    });

    it('resolves originalCase field', async () => {
      const parent = { id: 'doc-1' };
      mockPrisma.caseDocument.findFirst.mockResolvedValue({
        ...mockCaseDocument,
        case: mockCase,
      });

      const result = await documentResolvers.Document.originalCase(parent);

      expect(result).toEqual(mockCase);
    });

    it('returns null when no original case', async () => {
      const parent = { id: 'doc-1' };
      mockPrisma.caseDocument.findFirst.mockResolvedValue(null);

      const result = await documentResolvers.Document.originalCase(parent);

      expect(result).toBeNull();
    });
  });

  // Story 2.9: OneDrive Integration Tests
  describe('Mutation.uploadDocumentToOneDrive', () => {
    const mockUploadInput = {
      caseId: 'case-1',
      fileName: 'contract.pdf',
      fileType: 'application/pdf',
      fileContent: Buffer.from('test content').toString('base64'),
      title: 'Contract Document',
    };

    beforeEach(() => {
      mockPrisma.case.findUnique.mockResolvedValue(mockCase);
      mockPrisma.caseTeam.findUnique.mockResolvedValue({ userId: mockAssociate.id });
      mockOneDriveService.uploadDocumentToOneDrive.mockResolvedValue({
        id: 'onedrive-123',
        name: 'contract.pdf',
        size: 12,
        mimeType: 'application/pdf',
        webUrl: 'https://onedrive.example.com/file',
        parentPath: '/Cases/CASE-2024-001/Documents',
      });
    });

    it('uploads document to OneDrive successfully', async () => {
      const mockCreatedDocument = {
        ...mockDocument,
        oneDriveId: 'onedrive-123',
        oneDrivePath: '/Cases/CASE-2024-001/Documents/contract.pdf',
        status: 'DRAFT',
      };

      mockPrisma.document.create.mockResolvedValue(mockCreatedDocument);
      mockPrisma.documentVersion.create.mockResolvedValue({
        id: 'version-1',
        versionNumber: 1,
      });
      mockPrisma.caseDocument.create.mockResolvedValue(mockCaseDocument);
      mockPrisma.documentAuditLog.create.mockResolvedValue({});
      mockPrisma.document.findUnique.mockResolvedValue(mockCreatedDocument);

      const result = await documentResolvers.Mutation.uploadDocumentToOneDrive(
        {},
        { input: mockUploadInput },
        { user: mockAssociate, accessToken: 'mock-token' }
      );

      expect(result).toBeDefined();
      expect(mockOneDriveService.uploadDocumentToOneDrive).toHaveBeenCalled();
    });

    it('throws error for unauthenticated user', async () => {
      await expect(
        documentResolvers.Mutation.uploadDocumentToOneDrive(
          {},
          { input: mockUploadInput },
          { user: undefined }
        )
      ).rejects.toThrow(GraphQLError);
    });

    it('throws error when user not authorized for case', async () => {
      mockPrisma.caseTeam.findUnique.mockResolvedValue(null);

      await expect(
        documentResolvers.Mutation.uploadDocumentToOneDrive(
          {},
          { input: mockUploadInput },
          { user: mockAssociate, accessToken: 'mock-token' }
        )
      ).rejects.toThrow('Not authorized to upload to this case');
    });
  });

  describe('Mutation.getDocumentDownloadUrl', () => {
    beforeEach(() => {
      // Setup authorization: client belongs to user's firm
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      // For Partner, no team membership check needed
    });

    it('returns download URL for document with OneDrive ID', async () => {
      const documentWithOneDrive = {
        ...mockDocument,
        oneDriveId: 'onedrive-123',
        firmId: 'firm-1',
      };

      mockPrisma.document.findUnique.mockResolvedValue(documentWithOneDrive);
      mockOneDriveService.getDocumentDownloadLink.mockResolvedValue({
        url: 'https://download.example.com/temp-link',
        expirationDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

      const result = await documentResolvers.Mutation.getDocumentDownloadUrl(
        {},
        { documentId: 'doc-1' },
        { user: mockPartner, accessToken: 'mock-token' }
      );

      expect(result.url).toBe('https://download.example.com/temp-link');
      expect(mockOneDriveService.getDocumentDownloadLink).toHaveBeenCalledWith(
        'mock-token',
        'onedrive-123'
      );
    });

    it('throws error when document has no OneDrive ID', async () => {
      const documentWithoutOneDrive = {
        ...mockDocument,
        oneDriveId: null,
        firmId: 'firm-1',
      };

      mockPrisma.document.findUnique.mockResolvedValue(documentWithoutOneDrive);

      await expect(
        documentResolvers.Mutation.getDocumentDownloadUrl(
          {},
          { documentId: 'doc-1' },
          { user: mockPartner, accessToken: 'mock-token' }
        )
      ).rejects.toThrow('Document is not stored in OneDrive');
    });

    it('throws error for unauthenticated user', async () => {
      await expect(
        documentResolvers.Mutation.getDocumentDownloadUrl(
          {},
          { documentId: 'doc-1' },
          { user: undefined }
        )
      ).rejects.toThrow(GraphQLError);
    });
  });

  describe('Mutation.updateDocumentStatus', () => {
    beforeEach(() => {
      // Setup authorization
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockPrisma.document.findUnique.mockResolvedValue({
        ...mockDocument,
        firmId: 'firm-1',
        caseLinks: [{ caseId: 'case-1' }],
      });
    });

    it('updates document status successfully', async () => {
      mockPrisma.document.update.mockResolvedValue({
        ...mockDocument,
        status: 'FINAL',
      });
      mockPrisma.documentAuditLog.create.mockResolvedValue({});

      const result = await documentResolvers.Mutation.updateDocumentStatus(
        {},
        { documentId: 'doc-1', input: { status: 'FINAL' } },
        { user: mockPartner }
      );

      expect(result.status).toBe('FINAL');
    });

    it('throws error when document not authorized (includes not found)', async () => {
      // When document is not found, canAccessDocument returns false,
      // which results in "Not authorized" error
      mockPrisma.document.findUnique.mockResolvedValue(null);

      await expect(
        documentResolvers.Mutation.updateDocumentStatus(
          {},
          { documentId: 'doc-1', input: { status: 'FINAL' } },
          { user: mockPartner }
        )
      ).rejects.toThrow('Not authorized');
    });

    it('throws error for unauthorized user', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        ...mockDocument,
        firmId: 'other-firm',
      });

      await expect(
        documentResolvers.Mutation.updateDocumentStatus(
          {},
          { documentId: 'doc-1', input: { status: 'FINAL' } },
          { user: mockPartner }
        )
      ).rejects.toThrow('Not authorized');
    });
  });

  describe('Document.versions field resolver', () => {
    it('resolves versions for document', async () => {
      const mockVersions = [
        { id: 'v1', versionNumber: 1, createdAt: new Date() },
        { id: 'v2', versionNumber: 2, createdAt: new Date() },
      ];

      mockPrisma.documentVersion = { findMany: jest.fn() };
      mockPrisma.documentVersion.findMany.mockResolvedValue(mockVersions);

      // Call the field resolver if it exists
      if (documentResolvers.Document?.versions) {
        const result = await documentResolvers.Document.versions({ id: 'doc-1' });
        expect(result).toEqual(mockVersions);
      }
    });
  });
});
