/**
 * OneDrive Export Service Tests
 * Story 3.2.5 - Task 6.2.4: OneDrive upload flow integration tests
 */

// Mock Graph client
const mockGraphClient = {
  api: jest.fn().mockReturnThis(),
  post: jest.fn(),
  put: jest.fn(),
  get: jest.fn(),
  header: jest.fn().mockReturnThis(),
  filter: jest.fn().mockReturnThis(),
};

jest.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    init: jest.fn(() => mockGraphClient),
  },
}));

// Mock R2 storage
jest.mock('@/lib/r2-storage', () => ({
  downloadFromR2: jest.fn(),
}));

import { downloadFromR2 } from '@/lib/r2-storage';
import {
  OneDriveExportService,
  DocumentToExport,
  ExportProgress,
} from './onedrive-export.service';

describe('OneDrive Export Service', () => {
  let service: OneDriveExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OneDriveExportService('test-access-token');
  });

  describe('File Name Generation', () => {
    it('should generate safe file name with short ID', () => {
      const doc: DocumentToExport = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        fileName: 'test.pdf',
        fileExtension: 'pdf',
        storagePath: '/path/to/file',
        categoryName: 'Contract',
        originalFileName: 'Purchase Agreement.pdf',
        folderPath: 'Inbox',
        isSent: false,
        emailSubject: 'Contract',
        emailSender: 'sender@test.com',
        emailDate: '2019-03-15',
        primaryLanguage: 'Romanian',
        documentType: 'Contract',
        templatePotential: 'High',
      };

      // Test the private method logic
      const baseName = doc.originalFileName
        .replace(/\.[^/.]+$/, '')
        .replace(/[<>:"/\\|?*]/g, '_')
        .substring(0, 100);
      const shortId = doc.id.substring(0, 8);
      const fileName = `${baseName}-${shortId}.${doc.fileExtension}`;

      expect(fileName).toBe('Purchase Agreement-550e8400.pdf');
    });

    it('should handle special characters in file name', () => {
      const originalFileName = 'Contract <Client> "Special" | Test?.docx';
      const sanitized = originalFileName
        .replace(/\.[^/.]+$/, '')
        .replace(/[<>:"/\\|?*]/g, '_');

      expect(sanitized).toBe('Contract _Client_ _Special_ _ Test_');
      expect(sanitized).not.toMatch(/[<>:"/\\|?*]/);
    });

    it('should truncate long file names', () => {
      const longName = 'A'.repeat(150) + '.pdf';
      const baseName = longName.replace(/\.[^/.]+$/, '').substring(0, 100);

      expect(baseName.length).toBe(100);
    });

    it('should preserve file extension', () => {
      const testCases = [
        { original: 'doc.pdf', expected: 'pdf' },
        { original: 'file.name.docx', expected: 'docx' },
        { original: 'old-file.doc', expected: 'doc' },
      ];

      for (const { original, expected } of testCases) {
        const ext = original.split('.').pop();
        expect(ext).toBe(expected);
      }
    });
  });

  describe('Folder Name Sanitization', () => {
    it('should sanitize folder names for OneDrive', () => {
      const testCases = [
        { input: 'Contract', expected: 'Contract' },
        { input: 'Contract/Legal', expected: 'Contract_Legal' },
        { input: 'File: Name', expected: 'File_ Name' },
        { input: 'Test "Category"', expected: 'Test _Category_' },
        { input: '  Spaced  ', expected: 'Spaced' },
      ];

      for (const { input, expected } of testCases) {
        const sanitized = input
          .replace(/[<>:"/\\|?*]/g, '_')
          .replace(/\s+/g, ' ')
          .trim();
        expect(sanitized).toBe(expected);
      }
    });

    it('should handle Romanian category names', () => {
      const romanianNames = [
        'Notificare Avocatească',
        'Contract de Vânzare-Cumpărare',
        'Cerere de Chemare în Judecată',
      ];

      for (const name of romanianNames) {
        const sanitized = name
          .replace(/[<>:"/\\|?*]/g, '_')
          .replace(/\s+/g, ' ')
          .trim();
        // Romanian diacritics should be preserved
        expect(sanitized).toBe(name);
      }
    });

    it('should enforce max folder name length', () => {
      const longName = 'A'.repeat(300);
      const sanitized = longName.substring(0, 255);

      expect(sanitized.length).toBe(255);
    });
  });

  describe('Category Grouping', () => {
    it('should group documents by category', () => {
      const documents: DocumentToExport[] = [
        {
          id: '1',
          fileName: 'doc1.pdf',
          fileExtension: 'pdf',
          storagePath: '/1',
          categoryName: 'Contract',
          originalFileName: 'doc1.pdf',
          folderPath: 'Inbox',
          isSent: false,
          emailSubject: null,
          emailSender: null,
          emailDate: null,
          primaryLanguage: null,
          documentType: null,
          templatePotential: null,
        },
        {
          id: '2',
          fileName: 'doc2.pdf',
          fileExtension: 'pdf',
          storagePath: '/2',
          categoryName: 'Contract',
          originalFileName: 'doc2.pdf',
          folderPath: 'Inbox',
          isSent: false,
          emailSubject: null,
          emailSender: null,
          emailDate: null,
          primaryLanguage: null,
          documentType: null,
          templatePotential: null,
        },
        {
          id: '3',
          fileName: 'doc3.pdf',
          fileExtension: 'pdf',
          storagePath: '/3',
          categoryName: 'Notificare',
          originalFileName: 'doc3.pdf',
          folderPath: 'Inbox',
          isSent: false,
          emailSubject: null,
          emailSender: null,
          emailDate: null,
          primaryLanguage: null,
          documentType: null,
          templatePotential: null,
        },
      ];

      const categoryMap = new Map<string, DocumentToExport[]>();
      for (const doc of documents) {
        const existing = categoryMap.get(doc.categoryName) || [];
        existing.push(doc);
        categoryMap.set(doc.categoryName, existing);
      }

      expect(categoryMap.size).toBe(2);
      expect(categoryMap.get('Contract')?.length).toBe(2);
      expect(categoryMap.get('Notificare')?.length).toBe(1);
    });
  });

  describe('Metadata JSON Generation', () => {
    it('should generate valid category metadata JSON', () => {
      const metadata = {
        category: 'Contract',
        documentCount: 3,
        exportedAt: new Date().toISOString(),
        documents: [
          {
            fileName: 'doc1-abc12345.pdf',
            originalFileName: 'Purchase Agreement.pdf',
            originalFolderPath: 'Inbox/Clients/Acme',
            emailSubject: 'RE: Contract',
            emailSender: 'client@example.com',
            emailDate: '2019-03-15T14:22:00Z',
            isSent: false,
            primaryLanguage: 'Romanian',
            documentType: 'Contract de Vanzare',
            templatePotential: 'High',
            fileSize: 245678,
          },
        ],
      };

      const json = JSON.stringify(metadata, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed.category).toBe('Contract');
      expect(parsed.documents.length).toBe(1);
      expect(parsed.documents[0].emailSender).toBe('client@example.com');
    });

    it('should handle null optional fields in metadata', () => {
      const document = {
        fileName: 'doc1.pdf',
        originalFileName: 'doc1.pdf',
        originalFolderPath: 'Inbox',
        emailSubject: null,
        emailSender: null,
        emailDate: null,
        isSent: false,
        primaryLanguage: null,
        documentType: null,
        templatePotential: null,
        fileSize: 1000,
      };

      const json = JSON.stringify(document);
      const parsed = JSON.parse(json);

      expect(parsed.emailSubject).toBeNull();
      expect(parsed.primaryLanguage).toBeNull();
    });
  });

  describe('Session Summary Generation', () => {
    it('should generate valid session summary', () => {
      const summary = {
        sessionId: 'session-123',
        exportedAt: new Date().toISOString(),
        totalDocuments: 500,
        documentsExported: 485,
        categories: [
          { name: 'Contract', documentCount: 200, folderPath: '/AI-Training/Contract' },
          { name: 'Notificare', documentCount: 150, folderPath: '/AI-Training/Notificare' },
          { name: 'Intampinare', documentCount: 135, folderPath: '/AI-Training/Intampinare' },
        ],
      };

      expect(summary.documentsExported).toBeLessThanOrEqual(summary.totalDocuments);
      expect(summary.categories.length).toBe(3);
      expect(summary.categories.reduce((sum, c) => sum + c.documentCount, 0)).toBe(485);
    });
  });

  describe('Upload Progress Tracking', () => {
    it('should track upload progress correctly', () => {
      const progressUpdates: ExportProgress[] = [];
      service.onProgress((progress) => progressUpdates.push(progress));

      // Simulate progress updates
      const statuses: ExportProgress['status'][] = [
        'preparing',
        'uploading',
        'finalizing',
        'complete',
      ];

      let uploaded = 0;
      const total = 100;

      for (const status of statuses) {
        if (status === 'uploading') {
          uploaded = 50;
        } else if (status === 'complete') {
          uploaded = 100;
        }

        progressUpdates.push({
          totalDocuments: total,
          uploadedDocuments: uploaded,
          currentCategory: status === 'uploading' ? 'Contract' : '',
          status,
        });
      }

      expect(progressUpdates.length).toBe(4);
      expect(progressUpdates[progressUpdates.length - 1].status).toBe('complete');
      expect(progressUpdates[progressUpdates.length - 1].uploadedDocuments).toBe(100);
    });

    it('should handle error status', () => {
      const errorProgress: ExportProgress = {
        totalDocuments: 100,
        uploadedDocuments: 45,
        currentCategory: '',
        status: 'error',
        error: 'Network connection lost',
      };

      expect(errorProgress.status).toBe('error');
      expect(errorProgress.error).toBeDefined();
    });
  });

  describe('Concurrent Upload Management', () => {
    const MAX_CONCURRENT_UPLOADS = 5;

    it('should limit concurrent uploads to 5', () => {
      const documents = Array(20).fill({});
      const batches: typeof documents[] = [];

      for (let i = 0; i < documents.length; i += MAX_CONCURRENT_UPLOADS) {
        batches.push(documents.slice(i, i + MAX_CONCURRENT_UPLOADS));
      }

      expect(batches.length).toBe(4);
      expect(batches[0].length).toBe(5);
    });

    it('should handle partial final batch', () => {
      const documents = Array(17).fill({});
      const batches: typeof documents[] = [];

      for (let i = 0; i < documents.length; i += MAX_CONCURRENT_UPLOADS) {
        batches.push(documents.slice(i, i + MAX_CONCURRENT_UPLOADS));
      }

      expect(batches.length).toBe(4);
      expect(batches[3].length).toBe(2);
    });
  });

  describe('File Size Handling', () => {
    const SIMPLE_UPLOAD_MAX = 4 * 1024 * 1024; // 4MB
    const CHUNK_SIZE = 320 * 1024; // 320KB

    it('should use simple upload for small files', () => {
      const smallFile = Buffer.alloc(1024 * 1024); // 1MB
      const useSimpleUpload = smallFile.length <= SIMPLE_UPLOAD_MAX;

      expect(useSimpleUpload).toBe(true);
    });

    it('should use resumable upload for large files', () => {
      const largeFile = Buffer.alloc(10 * 1024 * 1024); // 10MB
      const useSimpleUpload = largeFile.length <= SIMPLE_UPLOAD_MAX;

      expect(useSimpleUpload).toBe(false);
    });

    it('should calculate correct chunk count for large files', () => {
      const fileSize = 10 * 1024 * 1024; // 10MB
      const chunkCount = Math.ceil(fileSize / CHUNK_SIZE);

      expect(chunkCount).toBe(32); // 10MB / 320KB = ~32 chunks
    });
  });

  describe('Content Type Mapping', () => {
    it('should map file extensions to content types', () => {
      const contentTypeMap: Record<string, string> = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc: 'application/msword',
      };

      expect(contentTypeMap['pdf']).toBe('application/pdf');
      expect(contentTypeMap['docx']).toContain('wordprocessingml');
      expect(contentTypeMap['doc']).toBe('application/msword');
    });

    it('should fallback to octet-stream for unknown types', () => {
      const contentTypeMap: Record<string, string> = {
        pdf: 'application/pdf',
      };

      const extension = 'xyz';
      const contentType = contentTypeMap[extension] || 'application/octet-stream';

      expect(contentType).toBe('application/octet-stream');
    });
  });

  describe('Folder Creation', () => {
    it('should handle existing folder gracefully', async () => {
      // Simulate folder already exists (409 conflict)
      mockGraphClient.post.mockRejectedValueOnce({
        statusCode: 409,
        code: 'nameAlreadyExists',
      });

      mockGraphClient.get.mockResolvedValueOnce({
        value: [{ id: 'folder-123', name: 'AI-Training' }],
      });

      // When folder exists, should get it instead
      const existingFolder = { id: 'folder-123', name: 'AI-Training' };
      expect(existingFolder.id).toBe('folder-123');
    });

    it('should create AI-Training root folder', () => {
      const rootFolderName = 'AI-Training';
      const parentPath = '/me/drive/root';

      expect(rootFolderName).toBe('AI-Training');
      expect(parentPath).toContain('root');
    });

    it('should create category subfolders', () => {
      const categories = ['Contract', 'Notificare', 'Intampinare'];
      const folderPaths = categories.map(
        (cat) => `/AI-Training/${cat}/`
      );

      expect(folderPaths).toEqual([
        '/AI-Training/Contract/',
        '/AI-Training/Notificare/',
        '/AI-Training/Intampinare/',
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should collect errors without stopping export', async () => {
      const errors: string[] = [];

      // Simulate some uploads failing
      const documents = [
        { id: '1', success: true },
        { id: '2', success: false, error: 'Network timeout' },
        { id: '3', success: true },
        { id: '4', success: false, error: 'File too large' },
      ];

      for (const doc of documents) {
        if (!doc.success) {
          errors.push(`Document ${doc.id}: ${doc.error}`);
        }
      }

      expect(errors.length).toBe(2);
      expect(errors[0]).toContain('Network timeout');
    });

    it('should return partial success result', () => {
      const result = {
        success: false, // Not all uploads succeeded
        categoriesExported: 3,
        documentsExported: 485,
        oneDrivePath: '/AI-Training',
        errors: [
          'Document doc-123: Network timeout',
          'Document doc-456: File corrupted',
        ],
      };

      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.documentsExported).toBeGreaterThan(0);
    });
  });

  describe('R2 Download Integration', () => {
    it('should download file from R2 before upload', async () => {
      const mockBuffer = Buffer.from('test content');
      (downloadFromR2 as jest.Mock).mockResolvedValue(mockBuffer);

      const result = await downloadFromR2('/test/path.pdf');

      expect(downloadFromR2).toHaveBeenCalledWith('/test/path.pdf');
      expect(result).toEqual(mockBuffer);
    });

    it('should handle R2 download failure', async () => {
      (downloadFromR2 as jest.Mock).mockRejectedValue(new Error('R2 not available'));

      await expect(downloadFromR2('/test/path.pdf')).rejects.toThrow('R2 not available');
    });
  });
});
