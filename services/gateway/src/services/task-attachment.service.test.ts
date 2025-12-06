/**
 * Task Attachment Service Unit Tests
 * Story 4.6: Task Collaboration and Updates - Task 36
 *
 * Tests for file attachments, version tracking, and R2 storage operations
 */

import { taskAttachmentService } from './task-attachment.service';

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    task: {
      findFirst: jest.fn(),
    },
    taskAttachment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
  NotificationType: {
    TaskAttachmentAdded: 'TaskAttachmentAdded',
  },
}));

jest.mock('./task-history.service', () => ({
  taskHistoryService: {
    recordHistory: jest.fn(),
  },
}));

jest.mock('./case-activity.service', () => ({
  caseActivityService: {
    recordDocumentUploaded: jest.fn(),
  },
}));

jest.mock('./r2-storage.service', () => ({
  r2StorageService: {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
    getSignedUrl: jest.fn(),
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');
const { r2StorageService } = jest.requireMock('./r2-storage.service');
const { taskHistoryService } = jest.requireMock('./task-history.service');
const { caseActivityService } = jest.requireMock('./case-activity.service');

describe('TaskAttachmentService', () => {
  const mockTask = {
    id: 'task-123',
    firmId: 'firm-123',
    caseId: 'case-123',
    title: 'Test Task',
    assignedTo: 'user-456',
    case: { id: 'case-123', title: 'Test Case' },
    assignee: { id: 'user-456', firstName: 'John', lastName: 'Doe' },
  };

  const mockUploader = {
    id: 'user-789',
    email: 'uploader@test.com',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'Lawyer',
    status: 'Active',
    firmId: 'firm-123',
    azureAdId: 'azure-789',
    preferences: {},
    createdAt: new Date(),
    lastActive: new Date(),
  };

  const mockAttachment = {
    id: 'attachment-123',
    taskId: 'task-123',
    documentId: null,
    fileName: 'test-file.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    storageUrl: 'https://storage.example.com/file.pdf',
    uploadedBy: 'user-789',
    version: 1,
    previousVersionId: null,
    createdAt: new Date(),
    uploader: mockUploader,
    document: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Upload Attachment Tests
  // ============================================================================

  describe('uploadAttachment', () => {
    const uploadInput = {
      taskId: 'task-123',
      filename: 'test-file.pdf',
      buffer: Buffer.from('test content'),
      mimeType: 'application/pdf',
      fileSize: 1024,
    };

    it('should upload attachment successfully', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.user.findUnique.mockResolvedValue(mockUploader);
      r2StorageService.uploadFile.mockResolvedValue('https://storage.example.com/file.pdf');
      prisma.taskAttachment.create.mockResolvedValue(mockAttachment);
      prisma.notification.create.mockResolvedValue({});

      const result = await taskAttachmentService.uploadAttachment(
        uploadInput,
        'user-789',
        'firm-123'
      );

      expect(result.id).toBe('attachment-123');
      expect(result.fileName).toBe('test-file.pdf');
      expect(r2StorageService.uploadFile).toHaveBeenCalled();
      expect(taskHistoryService.recordHistory).toHaveBeenCalled();
      expect(caseActivityService.recordDocumentUploaded).toHaveBeenCalled();
    });

    it('should throw error if task not found', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        taskAttachmentService.uploadAttachment(uploadInput, 'user-789', 'firm-123')
      ).rejects.toThrow('Task not found or access denied');
    });

    it('should throw error if file too large', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);

      const largeInput = {
        ...uploadInput,
        fileSize: 100 * 1024 * 1024, // 100MB
      };

      await expect(
        taskAttachmentService.uploadAttachment(largeInput, 'user-789', 'firm-123')
      ).rejects.toThrow('File size exceeds maximum allowed');
    });

    it('should throw error for disallowed mime type', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);

      const invalidInput = {
        ...uploadInput,
        mimeType: 'application/x-executable',
      };

      await expect(
        taskAttachmentService.uploadAttachment(invalidInput, 'user-789', 'firm-123')
      ).rejects.toThrow('File type application/x-executable is not allowed');
    });

    it('should notify task assignee when uploader is different', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.user.findUnique.mockResolvedValue(mockUploader);
      r2StorageService.uploadFile.mockResolvedValue('https://storage.example.com/file.pdf');
      prisma.taskAttachment.create.mockResolvedValue(mockAttachment);
      prisma.notification.create.mockResolvedValue({});

      await taskAttachmentService.uploadAttachment(uploadInput, 'user-789', 'firm-123');

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-456', // Task assignee
            type: 'TaskAttachmentAdded',
          }),
        })
      );
    });

    it('should not notify when uploader is the assignee', async () => {
      const taskWithSameAssignee = { ...mockTask, assignedTo: 'user-789' };
      prisma.task.findFirst.mockResolvedValue(taskWithSameAssignee);
      prisma.user.findUnique.mockResolvedValue(mockUploader);
      r2StorageService.uploadFile.mockResolvedValue('https://storage.example.com/file.pdf');
      prisma.taskAttachment.create.mockResolvedValue(mockAttachment);

      await taskAttachmentService.uploadAttachment(uploadInput, 'user-789', 'firm-123');

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Upload New Version Tests
  // ============================================================================

  describe('uploadNewVersion', () => {
    it('should upload new version successfully', async () => {
      const previousAttachment = {
        ...mockAttachment,
        id: 'previous-123',
        version: 1,
        task: mockTask,
      };
      prisma.taskAttachment.findFirst.mockResolvedValue(previousAttachment);
      r2StorageService.uploadFile.mockResolvedValue('https://storage.example.com/file-v2.pdf');
      prisma.taskAttachment.create.mockResolvedValue({
        ...mockAttachment,
        id: 'attachment-v2',
        version: 2,
        previousVersionId: 'previous-123',
      });

      const result = await taskAttachmentService.uploadNewVersion(
        'previous-123',
        {
          filename: 'test-file.pdf',
          buffer: Buffer.from('updated content'),
          mimeType: 'application/pdf',
          fileSize: 2048,
        },
        'user-789',
        'firm-123'
      );

      expect(result.version).toBe(2);
      expect(result.previousVersionId).toBe('previous-123');
    });

    it('should throw error if previous attachment not found', async () => {
      prisma.taskAttachment.findFirst.mockResolvedValue(null);

      await expect(
        taskAttachmentService.uploadNewVersion(
          'nonexistent',
          {
            filename: 'test-file.pdf',
            buffer: Buffer.from('content'),
            mimeType: 'application/pdf',
            fileSize: 1024,
          },
          'user-789',
          'firm-123'
        )
      ).rejects.toThrow('Previous attachment not found');
    });

    it('should throw error for access denied', async () => {
      const attachmentFromOtherFirm = {
        ...mockAttachment,
        task: { ...mockTask, firmId: 'other-firm' },
      };
      prisma.taskAttachment.findFirst.mockResolvedValue(attachmentFromOtherFirm);

      await expect(
        taskAttachmentService.uploadNewVersion(
          'attachment-123',
          {
            filename: 'test-file.pdf',
            buffer: Buffer.from('content'),
            mimeType: 'application/pdf',
            fileSize: 1024,
          },
          'user-789',
          'firm-123'
        )
      ).rejects.toThrow('Access denied');
    });
  });

  // ============================================================================
  // Delete Attachment Tests
  // ============================================================================

  describe('deleteAttachment', () => {
    it('should delete attachment successfully (uploader)', async () => {
      const attachmentWithTask = {
        ...mockAttachment,
        task: mockTask,
      };
      prisma.taskAttachment.findFirst.mockResolvedValue(attachmentWithTask);
      prisma.taskAttachment.delete.mockResolvedValue(attachmentWithTask);
      r2StorageService.deleteFile.mockResolvedValue(undefined);

      await taskAttachmentService.deleteAttachment('attachment-123', 'user-789', 'firm-123');

      expect(r2StorageService.deleteFile).toHaveBeenCalledWith(mockAttachment.storageUrl);
      expect(prisma.taskAttachment.delete).toHaveBeenCalledWith({
        where: { id: 'attachment-123' },
      });
      expect(taskHistoryService.recordHistory).toHaveBeenCalled();
    });

    it('should delete attachment successfully (task assignee)', async () => {
      const attachmentWithTask = {
        ...mockAttachment,
        uploadedBy: 'other-user',
        task: mockTask,
      };
      prisma.taskAttachment.findFirst.mockResolvedValue(attachmentWithTask);
      prisma.taskAttachment.delete.mockResolvedValue(attachmentWithTask);

      await taskAttachmentService.deleteAttachment('attachment-123', 'user-456', 'firm-123');

      expect(prisma.taskAttachment.delete).toHaveBeenCalled();
    });

    it('should throw error if attachment not found', async () => {
      prisma.taskAttachment.findFirst.mockResolvedValue(null);

      await expect(
        taskAttachmentService.deleteAttachment('nonexistent', 'user-789', 'firm-123')
      ).rejects.toThrow('Attachment not found');
    });

    it('should throw error for access denied (wrong firm)', async () => {
      const attachmentFromOtherFirm = {
        ...mockAttachment,
        task: { ...mockTask, firmId: 'other-firm' },
      };
      prisma.taskAttachment.findFirst.mockResolvedValue(attachmentFromOtherFirm);

      await expect(
        taskAttachmentService.deleteAttachment('attachment-123', 'user-789', 'firm-123')
      ).rejects.toThrow('Access denied');
    });

    it('should throw error if user not authorized', async () => {
      const attachmentWithTask = {
        ...mockAttachment,
        uploadedBy: 'other-user',
        task: { ...mockTask, assignedTo: 'another-user' },
      };
      prisma.taskAttachment.findFirst.mockResolvedValue(attachmentWithTask);

      await expect(
        taskAttachmentService.deleteAttachment('attachment-123', 'user-789', 'firm-123')
      ).rejects.toThrow('Only the uploader or task assignee can delete attachments');
    });
  });

  // ============================================================================
  // Get Attachments Tests
  // ============================================================================

  describe('getAttachments', () => {
    it('should retrieve all attachments for a task', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.taskAttachment.findMany.mockResolvedValue([mockAttachment]);

      const result = await taskAttachmentService.getAttachments('task-123', 'firm-123');

      expect(result).toHaveLength(1);
      expect(prisma.taskAttachment.findMany).toHaveBeenCalledWith({
        where: {
          taskId: 'task-123',
          previousVersionId: null,
        },
        include: { uploader: true, document: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw error if task not found', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        taskAttachmentService.getAttachments('task-123', 'firm-123')
      ).rejects.toThrow('Task not found or access denied');
    });
  });

  // ============================================================================
  // Get Attachment Tests
  // ============================================================================

  describe('getAttachment', () => {
    it('should retrieve a single attachment by ID', async () => {
      prisma.taskAttachment.findUnique.mockResolvedValue(mockAttachment);

      const result = await taskAttachmentService.getAttachment('attachment-123');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('attachment-123');
    });

    it('should return null if attachment not found', async () => {
      prisma.taskAttachment.findUnique.mockResolvedValue(null);

      const result = await taskAttachmentService.getAttachment('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Get Version History Tests
  // ============================================================================

  describe('getVersionHistory', () => {
    it('should retrieve version history for an attachment', async () => {
      const v1 = { ...mockAttachment, id: 'v1', version: 1, previousVersionId: null, uploader: mockUploader };
      const v2 = { ...mockAttachment, id: 'v2', version: 2, previousVersionId: 'v1', uploader: mockUploader };

      // First loop: trace back to root
      prisma.taskAttachment.findUnique
        .mockResolvedValueOnce({ ...v2, previousVersion: v1 })
        .mockResolvedValueOnce({ ...v1, previousVersion: null });

      // Second loop: find subsequent versions
      prisma.taskAttachment.findFirst
        .mockResolvedValueOnce(null); // No more versions after v2

      const result = await taskAttachmentService.getVersionHistory('v2');

      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(1);
      expect(result[1].version).toBe(2);
    });
  });

  // ============================================================================
  // Get Download URL Tests
  // ============================================================================

  describe('getDownloadUrl', () => {
    it('should return signed URL for attachment', async () => {
      const attachmentWithTask = {
        ...mockAttachment,
        task: mockTask,
      };
      prisma.taskAttachment.findFirst.mockResolvedValue(attachmentWithTask);
      r2StorageService.getSignedUrl.mockResolvedValue('https://signed-url.example.com');

      const result = await taskAttachmentService.getDownloadUrl('attachment-123', 'firm-123');

      expect(result).toBe('https://signed-url.example.com');
      expect(r2StorageService.getSignedUrl).toHaveBeenCalledWith(
        mockAttachment.storageUrl,
        3600
      );
    });

    it('should throw error if attachment not found', async () => {
      prisma.taskAttachment.findFirst.mockResolvedValue(null);

      await expect(
        taskAttachmentService.getDownloadUrl('nonexistent', 'firm-123')
      ).rejects.toThrow('Attachment not found');
    });

    it('should throw error for access denied', async () => {
      const attachmentFromOtherFirm = {
        ...mockAttachment,
        task: { ...mockTask, firmId: 'other-firm' },
      };
      prisma.taskAttachment.findFirst.mockResolvedValue(attachmentFromOtherFirm);

      await expect(
        taskAttachmentService.getDownloadUrl('attachment-123', 'firm-123')
      ).rejects.toThrow('Access denied');
    });
  });
});
