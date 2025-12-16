/**
 * Document Discovery Service Tests
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 */

import { DocumentDiscoveryService } from './document-discovery.service';
import { prisma } from '@legal-platform/database';
import { Client } from '@microsoft/microsoft-graph-client';

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    trainingDocument: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    init: jest.fn(),
  },
}));

jest.mock('../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('DocumentDiscoveryService', () => {
  let service: DocumentDiscoveryService;
  let mockGraphClient: any;

  beforeEach(() => {
    service = new DocumentDiscoveryService();

    mockGraphClient = {
      api: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      get: jest.fn(),
      post: jest.fn(),
      getStream: jest.fn(),
    };

    (Client.init as jest.Mock).mockReturnValue(mockGraphClient);
    jest.clearAllMocks();
  });

  describe('discoverDocuments', () => {
    const mockAccessToken = 'test-access-token';

    it('should discover new documents from OneDrive folders', async () => {
      // Mock folder discovery
      mockGraphClient.get
        .mockResolvedValueOnce({ value: [{ id: 'ai-training-folder', name: 'AI-Training' }] }) // Root folder
        .mockResolvedValueOnce({ value: [{ id: 'contract-folder', name: 'Contract' }] }) // Category folder
        .mockResolvedValueOnce({ value: [] }) // No metadata file
        .mockResolvedValueOnce({
          value: [
            {
              id: 'file-1',
              name: 'contract.pdf',
              size: 1024,
              parentReference: { path: '/AI-Training/Contract' },
            },
            {
              id: 'file-2',
              name: 'agreement.docx',
              size: 2048,
              parentReference: { path: '/AI-Training/Contract' },
            },
          ],
        });

      // Mock no existing documents
      (prisma.trainingDocument.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.discoverDocuments(mockAccessToken, {
        categoryFolders: ['Contract'],
      });

      expect(result.totalFound).toBe(2);
      expect(result.newDocuments).toHaveLength(2);
      expect(result.newDocuments[0].fileName).toBe('contract.pdf');
      expect(result.newDocuments[1].fileName).toBe('agreement.docx');
    });

    it('should skip already processed documents', async () => {
      mockGraphClient.get
        .mockResolvedValueOnce({ value: [{ id: 'ai-training-folder' }] })
        .mockResolvedValueOnce({ value: [{ id: 'contract-folder' }] })
        .mockResolvedValueOnce({ value: [] })
        .mockResolvedValueOnce({
          value: [{ id: 'file-1', name: 'contract.pdf', size: 1024 }],
        });

      // Mock existing document
      (prisma.trainingDocument.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      const result = await service.discoverDocuments(mockAccessToken, {
        categoryFolders: ['Contract'],
      });

      expect(result.totalFound).toBe(0);
      expect(result.newDocuments).toHaveLength(0);
    });

    it('should filter out unsupported file types', async () => {
      mockGraphClient.get
        .mockResolvedValueOnce({ value: [{ id: 'ai-training-folder' }] })
        .mockResolvedValueOnce({ value: [{ id: 'contract-folder' }] })
        .mockResolvedValueOnce({ value: [] })
        .mockResolvedValueOnce({
          value: [
            { id: 'file-1', name: 'contract.pdf', size: 1024 },
            { id: 'file-2', name: 'image.png', size: 1024 },
            { id: 'file-3', name: 'spreadsheet.xlsx', size: 1024 },
          ],
        });

      (prisma.trainingDocument.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.discoverDocuments(mockAccessToken, {
        categoryFolders: ['Contract'],
      });

      expect(result.totalFound).toBe(1);
      expect(result.newDocuments[0].fileName).toBe('contract.pdf');
    });

    it('should handle multiple category folders', async () => {
      mockGraphClient.get
        .mockResolvedValueOnce({ value: [{ id: 'ai-training-folder' }] })
        .mockResolvedValueOnce({ value: [{ id: 'contract-folder' }] })
        .mockResolvedValueOnce({ value: [] })
        .mockResolvedValueOnce({
          value: [{ id: 'file-1', name: 'doc1.pdf', size: 1024 }],
        })
        .mockResolvedValueOnce({ value: [{ id: 'notice-folder' }] })
        .mockResolvedValueOnce({ value: [] })
        .mockResolvedValueOnce({
          value: [{ id: 'file-2', name: 'doc2.docx', size: 1024 }],
        });

      (prisma.trainingDocument.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.discoverDocuments(mockAccessToken, {
        categoryFolders: ['Contract', 'Notice'],
      });

      expect(result.totalFound).toBe(2);
    });

    it('should include metadata from _metadata.json file', async () => {
      mockGraphClient.get
        .mockResolvedValueOnce({ value: [{ id: 'ai-training-folder' }] })
        .mockResolvedValueOnce({ value: [{ id: 'contract-folder' }] })
        .mockResolvedValueOnce({ value: [{ id: 'metadata-file' }] }) // Metadata file exists
        .mockResolvedValueOnce(
          JSON.stringify({
            description: 'Contract documents',
            tags: ['legal', 'contract'],
            files: {
              'doc.pdf': { author: 'John' },
            },
          })
        )
        .mockResolvedValueOnce({
          value: [{ id: 'file-1', name: 'doc.pdf', size: 1024 }],
        });

      (prisma.trainingDocument.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.discoverDocuments(mockAccessToken, {
        categoryFolders: ['Contract'],
      });

      expect(result.newDocuments[0].metadata).toEqual(
        expect.objectContaining({
          categoryDescription: 'Contract documents',
          categoryTags: ['legal', 'contract'],
          author: 'John',
        })
      );
    });

    it('should handle folder creation if not exists', async () => {
      mockGraphClient.get.mockResolvedValueOnce({ value: [] }); // No AI-Training folder
      mockGraphClient.post.mockResolvedValue({ id: 'new-folder' }); // Create folder

      mockGraphClient.get
        .mockResolvedValueOnce({ value: [] }) // No category folder
        .mockResolvedValueOnce({ value: [] }) // No metadata
        .mockResolvedValueOnce({ value: [] }); // No files

      await service.discoverDocuments(mockAccessToken, {
        categoryFolders: ['Contract'],
      });

      expect(mockGraphClient.post).toHaveBeenCalled();
    });

    it('should handle errors gracefully for individual categories', async () => {
      mockGraphClient.get
        .mockResolvedValueOnce({ value: [{ id: 'ai-training-folder' }] })
        .mockRejectedValueOnce(new Error('Folder not found'));

      const result = await service.discoverDocuments(mockAccessToken, {
        categoryFolders: ['Contract'],
      });

      // Should complete without throwing
      expect(result.totalFound).toBe(0);
    });
  });

  describe('downloadFile', () => {
    it('should download file content from OneDrive', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('chunk1');
          yield Buffer.from('chunk2');
        },
      };

      mockGraphClient.getStream.mockResolvedValue(mockStream);

      const result = await service.downloadFile('token', 'file-id');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('chunk1chunk2');
    });

    it('should throw error on download failure', async () => {
      mockGraphClient.getStream.mockRejectedValue(new Error('Download failed'));

      await expect(service.downloadFile('token', 'file-id')).rejects.toThrow('Download failed');
    });
  });
});
