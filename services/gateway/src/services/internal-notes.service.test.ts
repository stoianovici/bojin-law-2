/**
 * Internal Notes Service Unit Tests
 * Story 5.5: Multi-Channel Communication Hub - Task 37 (AC: 1)
 *
 * Tests for internal note CRUD operations
 */

import { InternalNotesService } from './internal-notes.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  prisma: {
    communicationEntry: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    communicationAttachment: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
  CommunicationChannel: {
    InternalNote: 'InternalNote',
  },
  CommunicationDirection: {
    Internal: 'Internal',
  },
  PrivacyLevel: {
    Normal: 'Normal',
    Confidential: 'Confidential',
    AttorneyOnly: 'AttorneyOnly',
    PartnerOnly: 'PartnerOnly',
  },
  UserRole: {
    Partner: 'Partner',
    Associate: 'Associate',
    Paralegal: 'Paralegal',
  },
}));

// Mock R2 storage service
jest.mock('./r2-storage.service', () => ({
  r2StorageService: {
    uploadDocument: jest.fn(),
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');
const { r2StorageService } = jest.requireMock('./r2-storage.service');

describe('InternalNotesService', () => {
  let service: InternalNotesService;

  const mockFirmId = 'firm-123';
  const mockCaseId = 'case-456';
  const mockUserId = 'user-789';

  const mockUserContext = {
    userId: mockUserId,
    role: 'Associate' as any,
    firmId: mockFirmId,
  };

  const mockUser = {
    id: mockUserId,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
  };

  const mockNote = {
    id: 'note-1',
    firmId: mockFirmId,
    caseId: mockCaseId,
    channelType: 'InternalNote',
    direction: 'Internal',
    body: 'This is a test note',
    senderId: mockUserId,
    senderName: 'John Doe',
    senderEmail: 'john@example.com',
    recipients: [],
    isPrivate: false,
    privacyLevel: 'Normal',
    allowedViewers: [],
    hasAttachments: false,
    sentAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    attachments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    r2StorageService.uploadDocument.mockResolvedValue({ storagePath: 'storage/path/file.pdf' });
    service = new InternalNotesService();
  });

  // ============================================================================
  // createInternalNote Tests
  // ============================================================================

  describe('createInternalNote', () => {
    it('should create a new internal note', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.communicationEntry.create.mockResolvedValue(mockNote);

      const result = await service.createInternalNote(
        {
          caseId: mockCaseId,
          body: 'Test note body',
          isPrivate: false,
          privacyLevel: 'Normal' as any,
        },
        mockUserContext
      );

      expect(result.id).toBe('note-1');
      expect(result.body).toBe('This is a test note');
      expect(prisma.communicationEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firmId: mockFirmId,
            caseId: mockCaseId,
            channelType: 'InternalNote',
            direction: 'Internal',
          }),
        })
      );
    });

    it('should throw error when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createInternalNote(
          {
            caseId: mockCaseId,
            body: 'Test note',
            isPrivate: false,
            privacyLevel: 'Normal' as any,
          },
          mockUserContext
        )
      ).rejects.toThrow('User not found');
    });

    it('should reject PartnerOnly privacy level from non-Partner', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.createInternalNote(
          {
            caseId: mockCaseId,
            body: 'Test note',
            isPrivate: true,
            privacyLevel: 'PartnerOnly' as any,
          },
          { ...mockUserContext, role: 'Associate' as any }
        )
      ).rejects.toThrow('Only partners can create partner-only notes');
    });

    it('should reject AttorneyOnly privacy level from Paralegal', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.createInternalNote(
          {
            caseId: mockCaseId,
            body: 'Test note',
            isPrivate: true,
            privacyLevel: 'AttorneyOnly' as any,
          },
          { ...mockUserContext, role: 'Paralegal' as any }
        )
      ).rejects.toThrow('Only attorneys can create attorney-only notes');
    });

    it('should allow Partner to create PartnerOnly note', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.communicationEntry.create.mockResolvedValue({
        ...mockNote,
        privacyLevel: 'PartnerOnly',
        isPrivate: true,
      });

      const result = await service.createInternalNote(
        {
          caseId: mockCaseId,
          body: 'Partner note',
          isPrivate: true,
          privacyLevel: 'PartnerOnly' as any,
        },
        { ...mockUserContext, role: 'Partner' as any }
      );

      expect(result.privacyLevel).toBe('PartnerOnly');
    });

    it('should handle attachments when provided', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.communicationEntry.create.mockResolvedValue(mockNote);
      prisma.communicationAttachment.create.mockResolvedValue({
        id: 'att-1',
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storageUrl: 'storage/path/test.pdf',
      });
      prisma.communicationEntry.update.mockResolvedValue({
        ...mockNote,
        hasAttachments: true,
      });

      const result = await service.createInternalNote(
        {
          caseId: mockCaseId,
          body: 'Note with attachment',
          isPrivate: false,
          privacyLevel: 'Normal' as any,
          attachments: [
            {
              fileName: 'test.pdf',
              fileSize: 1024,
              mimeType: 'application/pdf',
              buffer: Buffer.from('test'),
            },
          ],
        },
        mockUserContext
      );

      expect(result.attachments).toHaveLength(1);
      expect(prisma.communicationAttachment.create).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // updateInternalNote Tests
  // ============================================================================

  describe('updateInternalNote', () => {
    it('should update an existing note', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue(mockNote);
      prisma.communicationEntry.update.mockResolvedValue({
        ...mockNote,
        body: 'Updated body',
        attachments: [],
      });

      const result = await service.updateInternalNote(
        'note-1',
        { body: 'Updated body' },
        mockUserContext
      );

      expect(result.body).toBe('Updated body');
      expect(prisma.communicationEntry.update).toHaveBeenCalled();
    });

    it('should throw error when note not found', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue(null);

      await expect(
        service.updateInternalNote('nonexistent', { body: 'Updated' }, mockUserContext)
      ).rejects.toThrow('Note not found');
    });

    it('should throw error when non-author tries to edit', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockNote,
        senderId: 'other-user',
      });

      await expect(
        service.updateInternalNote('note-1', { body: 'Updated' }, mockUserContext)
      ).rejects.toThrow('Only the author can edit this note');
    });

    it('should validate privacy level on update', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue(mockNote);

      await expect(
        service.updateInternalNote(
          'note-1',
          { privacyLevel: 'PartnerOnly' as any },
          { ...mockUserContext, role: 'Associate' as any }
        )
      ).rejects.toThrow('Only partners can create partner-only notes');
    });
  });

  // ============================================================================
  // deleteInternalNote Tests
  // ============================================================================

  describe('deleteInternalNote', () => {
    it('should delete a note when called by author', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue(mockNote);
      prisma.communicationEntry.delete.mockResolvedValue(mockNote);

      const result = await service.deleteInternalNote('note-1', mockUserContext);

      expect(result).toBe(true);
      expect(prisma.communicationEntry.delete).toHaveBeenCalledWith({
        where: { id: 'note-1' },
      });
    });

    it('should allow Partner to delete any note', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockNote,
        senderId: 'other-user',
      });
      prisma.communicationEntry.delete.mockResolvedValue(mockNote);

      const result = await service.deleteInternalNote('note-1', {
        ...mockUserContext,
        role: 'Partner' as any,
      });

      expect(result).toBe(true);
    });

    it('should throw error when note not found', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteInternalNote('nonexistent', mockUserContext)
      ).rejects.toThrow('Note not found');
    });

    it('should throw error when non-author non-partner tries to delete', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockNote,
        senderId: 'other-user',
      });

      await expect(
        service.deleteInternalNote('note-1', mockUserContext)
      ).rejects.toThrow('Only the author or partners can delete this note');
    });
  });

  // ============================================================================
  // getNotesForCase Tests
  // ============================================================================

  describe('getNotesForCase', () => {
    it('should return notes for a case', async () => {
      prisma.communicationEntry.findMany.mockResolvedValue([mockNote]);

      const result = await service.getNotesForCase(mockCaseId, mockUserContext);

      expect(result.notes).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('should apply privacy filter for non-Partners', async () => {
      prisma.communicationEntry.findMany.mockResolvedValue([]);

      await service.getNotesForCase(mockCaseId, {
        ...mockUserContext,
        role: 'Paralegal' as any,
      });

      const findManyCall = prisma.communicationEntry.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
    });

    it('should not apply privacy filter for Partners', async () => {
      prisma.communicationEntry.findMany.mockResolvedValue([]);

      await service.getNotesForCase(mockCaseId, {
        ...mockUserContext,
        role: 'Partner' as any,
      });

      const findManyCall = prisma.communicationEntry.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeUndefined();
    });

    it('should indicate hasMore when more notes exist', async () => {
      const manyNotes = Array(21)
        .fill(mockNote)
        .map((n, i) => ({ ...n, id: `note-${i}` }));
      prisma.communicationEntry.findMany.mockResolvedValue(manyNotes);

      const result = await service.getNotesForCase(mockCaseId, mockUserContext, {
        limit: 20,
      });

      expect(result.hasMore).toBe(true);
      expect(result.notes).toHaveLength(20);
      expect(result.cursor).toBeDefined();
    });
  });

  // ============================================================================
  // addAttachment Tests
  // ============================================================================

  describe('addAttachment', () => {
    it('should add attachment to a note', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue(mockNote);
      prisma.communicationAttachment.create.mockResolvedValue({
        id: 'att-1',
        fileName: 'doc.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        storageUrl: 'storage/path/doc.pdf',
      });
      prisma.communicationEntry.update.mockResolvedValue({
        ...mockNote,
        hasAttachments: true,
      });

      const result = await service.addAttachment(
        'note-1',
        {
          fileName: 'doc.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          buffer: Buffer.from('test'),
        },
        mockUserContext
      );

      expect(result.fileName).toBe('doc.pdf');
      expect(prisma.communicationEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { hasAttachments: true },
        })
      );
    });

    it('should throw error when note not found', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue(null);

      await expect(
        service.addAttachment(
          'nonexistent',
          {
            fileName: 'doc.pdf',
            fileSize: 2048,
            mimeType: 'application/pdf',
            buffer: Buffer.from('test'),
          },
          mockUserContext
        )
      ).rejects.toThrow('Note not found');
    });

    it('should throw error when non-author tries to add attachment', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockNote,
        senderId: 'other-user',
      });

      await expect(
        service.addAttachment(
          'note-1',
          {
            fileName: 'doc.pdf',
            fileSize: 2048,
            mimeType: 'application/pdf',
            buffer: Buffer.from('test'),
          },
          mockUserContext
        )
      ).rejects.toThrow('Only the author can add attachments');
    });
  });

  // ============================================================================
  // removeAttachment Tests
  // ============================================================================

  describe('removeAttachment', () => {
    it('should remove attachment from a note', async () => {
      const noteWithAttachment = {
        ...mockNote,
        attachments: [
          {
            id: 'att-1',
            fileName: 'doc.pdf',
            fileSize: 2048,
            mimeType: 'application/pdf',
            storageUrl: 'storage/path/doc.pdf',
          },
        ],
      };
      prisma.communicationEntry.findUnique.mockResolvedValue(noteWithAttachment);
      prisma.communicationAttachment.delete.mockResolvedValue({});
      prisma.communicationEntry.update.mockResolvedValue({
        ...mockNote,
        hasAttachments: false,
      });

      const result = await service.removeAttachment('note-1', 'att-1', mockUserContext);

      expect(result).toBe(true);
      expect(prisma.communicationAttachment.delete).toHaveBeenCalledWith({
        where: { id: 'att-1' },
      });
    });

    it('should throw error when attachment not found', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockNote,
        attachments: [],
      });

      await expect(
        service.removeAttachment('note-1', 'nonexistent', mockUserContext)
      ).rejects.toThrow('Attachment not found');
    });

    it('should throw error when non-author tries to remove attachment', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockNote,
        senderId: 'other-user',
        attachments: [{ id: 'att-1' }],
      });

      await expect(
        service.removeAttachment('note-1', 'att-1', mockUserContext)
      ).rejects.toThrow('Only the author can remove attachments');
    });

    it('should update hasAttachments flag when last attachment removed', async () => {
      const noteWithAttachment = {
        ...mockNote,
        attachments: [{ id: 'att-1', fileName: 'doc.pdf' }],
      };
      prisma.communicationEntry.findUnique.mockResolvedValue(noteWithAttachment);
      prisma.communicationAttachment.delete.mockResolvedValue({});
      prisma.communicationEntry.update.mockResolvedValue({
        ...mockNote,
        hasAttachments: false,
      });

      await service.removeAttachment('note-1', 'att-1', mockUserContext);

      expect(prisma.communicationEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { hasAttachments: false },
        })
      );
    });
  });
});
