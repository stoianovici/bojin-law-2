/**
 * Document Summary Aggregation Service Tests
 * OPS-258: Document Summary Aggregation Service
 */

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    caseDocument: {
      findMany: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('./ai-client.service', () => ({
  aiClient: {
    complete: jest.fn(),
  },
}));

import { DocumentSummaryService } from './document-summary.service';
import { prisma } from '@legal-platform/database';
import { aiClient } from './ai-client.service';

describe('DocumentSummaryService', () => {
  let service: DocumentSummaryService;
  const testCaseId = 'case-123';
  const testFirmId = 'firm-456';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentSummaryService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getForCase', () => {
    it('should return empty array when no documents are linked to case', async () => {
      (prisma.caseDocument.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.getForCase(testCaseId, testFirmId);

      expect(result).toEqual([]);
      expect(prisma.caseDocument.findMany).toHaveBeenCalledWith({
        where: { caseId: testCaseId, firmId: testFirmId },
        include: expect.any(Object),
      });
    });

    it('should rank documents and return top 10', async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Create 12 mock documents to test limiting to 10
      const mockDocuments = Array.from({ length: 12 }, (_, i) => ({
        id: `link-${i}`,
        caseId: testCaseId,
        documentId: `doc-${i}`,
        firmId: testFirmId,
        document: {
          id: `doc-${i}`,
          fileName: `document-${i}.pdf`,
          fileType: '.pdf',
          fileSize: 1000 + i * 100,
          status: i < 5 ? 'FINAL' : 'DRAFT',
          updatedAt: i < 3 ? now : thirtyDaysAgo,
          metadata: {},
        },
      }));

      (prisma.caseDocument.findMany as jest.Mock).mockResolvedValueOnce(mockDocuments);
      (prisma.document.findUnique as jest.Mock).mockImplementation((args) => {
        const id = args.where.id;
        const idx = parseInt(id.split('-')[1]);
        return Promise.resolve({
          id,
          fileName: `document-${idx}.pdf`,
          fileType: '.pdf',
          fileSize: 1000 + idx * 100,
          status: idx < 5 ? 'FINAL' : 'DRAFT',
          metadata: {},
        });
      });

      const result = await service.getForCase(testCaseId, testFirmId);

      expect(result).toHaveLength(10);
      // Recently updated + FINAL status documents should rank higher
      expect(result[0].id).toBe('doc-0'); // Recent + FINAL
      expect(result[1].id).toBe('doc-1'); // Recent + FINAL
      expect(result[2].id).toBe('doc-2'); // Recent + FINAL
    });

    it('should score FINAL/APPROVED documents higher than DRAFT', async () => {
      const now = new Date();
      const mockDocuments = [
        {
          id: 'link-1',
          caseId: testCaseId,
          documentId: 'doc-draft',
          firmId: testFirmId,
          document: {
            id: 'doc-draft',
            fileName: 'draft.pdf',
            fileType: '.pdf',
            fileSize: 1000,
            status: 'DRAFT',
            updatedAt: now,
            metadata: {},
          },
        },
        {
          id: 'link-2',
          caseId: testCaseId,
          documentId: 'doc-final',
          firmId: testFirmId,
          document: {
            id: 'doc-final',
            fileName: 'final.pdf',
            fileType: '.pdf',
            fileSize: 1000,
            status: 'FINAL',
            updatedAt: now,
            metadata: {},
          },
        },
      ];

      (prisma.caseDocument.findMany as jest.Mock).mockResolvedValueOnce(mockDocuments);
      (prisma.document.findUnique as jest.Mock).mockImplementation((args) =>
        Promise.resolve(mockDocuments.find((d) => d.document.id === args.where.id)?.document)
      );

      const result = await service.getForCase(testCaseId, testFirmId);

      expect(result).toHaveLength(2);
      // FINAL should rank first (higher status score)
      expect(result[0].id).toBe('doc-final');
      expect(result[1].id).toBe('doc-draft');
    });

    it('should score contract documents higher than generic files', async () => {
      const now = new Date();
      const mockDocuments = [
        {
          id: 'link-1',
          caseId: testCaseId,
          documentId: 'doc-generic',
          firmId: testFirmId,
          document: {
            id: 'doc-generic',
            fileName: 'notes.txt',
            fileType: '.txt',
            fileSize: 1000,
            status: 'FINAL',
            updatedAt: now,
            metadata: {},
          },
        },
        {
          id: 'link-2',
          caseId: testCaseId,
          documentId: 'doc-contract',
          firmId: testFirmId,
          document: {
            id: 'doc-contract',
            fileName: 'contract-servicii.pdf',
            fileType: '.pdf',
            fileSize: 1000,
            status: 'FINAL',
            updatedAt: now,
            metadata: {},
          },
        },
      ];

      (prisma.caseDocument.findMany as jest.Mock).mockResolvedValueOnce(mockDocuments);
      (prisma.document.findUnique as jest.Mock).mockImplementation((args) =>
        Promise.resolve(mockDocuments.find((d) => d.document.id === args.where.id)?.document)
      );

      const result = await service.getForCase(testCaseId, testFirmId);

      expect(result).toHaveLength(2);
      // Contract should rank first (contract pattern in name)
      expect(result[0].id).toBe('doc-contract');
      expect(result[1].id).toBe('doc-generic');
    });
  });

  describe('generateSummary', () => {
    it('should return "Document nu a fost găsit" when document not found', async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const result = await service.generateSummary('non-existent', testFirmId);

      expect(result).toBe('Document nu a fost găsit.');
    });

    it('should generate AI summary when metadata contains description', async () => {
      const mockDoc = {
        id: 'doc-123',
        fileName: 'contract.pdf',
        fileType: '.pdf',
        fileSize: 50000,
        status: 'FINAL',
        metadata: {
          description: 'Contract de prestări servicii juridice',
          tags: ['contract', 'servicii'],
        },
      };

      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDoc);
      (aiClient.complete as jest.Mock).mockResolvedValueOnce({
        content: 'Rezumat generat de AI pentru contract.',
        inputTokens: 100,
        outputTokens: 50,
        costEur: 0.001,
      });

      const result = await service.generateSummary('doc-123', testFirmId);

      expect(result).toBe('Rezumat generat de AI pentru contract.');
      expect(aiClient.complete).toHaveBeenCalledWith(
        expect.stringContaining('contract.pdf'),
        expect.objectContaining({
          feature: 'document_summary',
          firmId: testFirmId,
          entityType: 'document',
          entityId: 'doc-123',
        }),
        expect.objectContaining({
          model: 'claude-haiku-4-5-20250514',
          maxTokens: 150,
        })
      );
    });

    it('should return basic summary when no metadata available', async () => {
      const mockDoc = {
        id: 'doc-123',
        fileName: 'raport.docx',
        fileType: '.docx',
        fileSize: 25000,
        status: 'DRAFT',
        metadata: {},
      };

      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDoc);

      const result = await service.generateSummary('doc-123', testFirmId);

      expect(result).toContain('raport');
      expect(result).toContain('draft');
      expect(aiClient.complete).not.toHaveBeenCalled();
    });

    it('should fall back to basic summary when AI call fails', async () => {
      const mockDoc = {
        id: 'doc-123',
        fileName: 'contract.pdf',
        fileType: '.pdf',
        fileSize: 50000,
        status: 'FINAL',
        metadata: {
          description: 'Contract important',
        },
      };

      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDoc);
      (aiClient.complete as jest.Mock).mockRejectedValueOnce(new Error('API error'));

      const result = await service.generateSummary('doc-123', testFirmId);

      expect(result).toContain('contract');
      expect(result).toContain('Contract important');
    });
  });

  describe('formatForContext', () => {
    it('should return "no documents" message for empty array', () => {
      const result = service.formatForContext([]);

      expect(result).toBe('Nu există documente asociate acestui dosar.');
    });

    it('should format documents with priority indicators', () => {
      const summaries = [
        {
          id: 'doc-1',
          fileName: 'contract.pdf',
          fileType: '.pdf',
          status: 'FINAL',
          score: 70,
          summary: 'Contract de servicii juridice.',
          updatedAt: new Date(),
        },
        {
          id: 'doc-2',
          fileName: 'note.docx',
          fileType: '.docx',
          status: 'DRAFT',
          score: 30,
          summary: 'Note interne.',
          updatedAt: new Date(),
        },
      ];

      const result = service.formatForContext(summaries);

      expect(result).toContain('Documente cheie (2)');
      expect(result).toContain('★'); // High priority indicator
      expect(result).toContain('◇'); // Low priority indicator
      expect(result).toContain('contract.pdf');
      expect(result).toContain('note.docx');
    });

    it('should use medium priority indicator for mid-range scores', () => {
      const summaries = [
        {
          id: 'doc-1',
          fileName: 'memo.docx',
          fileType: '.docx',
          status: 'IN_REVIEW',
          score: 50,
          summary: 'Memo intern.',
          updatedAt: new Date(),
        },
      ];

      const result = service.formatForContext(summaries);

      expect(result).toContain('◆'); // Medium priority indicator
    });
  });

  describe('document type inference', () => {
    it('should infer CONTRACT type from metadata', async () => {
      const now = new Date();
      const mockDocuments = [
        {
          id: 'link-1',
          caseId: testCaseId,
          documentId: 'doc-1',
          firmId: testFirmId,
          document: {
            id: 'doc-1',
            fileName: 'generic-file.pdf',
            fileType: '.pdf',
            fileSize: 1000,
            status: 'DRAFT',
            updatedAt: now,
            metadata: { documentType: 'CONTRACT' },
          },
        },
      ];

      (prisma.caseDocument.findMany as jest.Mock).mockResolvedValueOnce(mockDocuments);
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDocuments[0].document);

      const result = await service.getForCase(testCaseId, testFirmId);

      // CONTRACT type adds 30 points, so score should be higher
      expect(result[0].score).toBeGreaterThan(35); // 40 (recency) + 30 (type) + 5 (draft)
    });

    it('should infer JUDGMENT type from Romanian filename patterns', async () => {
      const now = new Date();
      const mockDocuments = [
        {
          id: 'link-1',
          caseId: testCaseId,
          documentId: 'doc-1',
          firmId: testFirmId,
          document: {
            id: 'doc-1',
            fileName: 'sentinta-civila-2024.pdf',
            fileType: '.pdf',
            fileSize: 1000,
            status: 'DRAFT',
            updatedAt: now,
            metadata: {},
          },
        },
      ];

      (prisma.caseDocument.findMany as jest.Mock).mockResolvedValueOnce(mockDocuments);
      (prisma.document.findUnique as jest.Mock).mockResolvedValueOnce(mockDocuments[0].document);

      const result = await service.getForCase(testCaseId, testFirmId);

      // JUDGMENT type adds 25 points
      expect(result[0].score).toBeGreaterThan(65); // 40 (recency) + 25 (type) + 5 (draft)
    });
  });
});
