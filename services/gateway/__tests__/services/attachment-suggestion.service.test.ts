/**
 * Unit Tests for Attachment Suggestion Service
 * Story 5.3: AI-Powered Email Drafting - Task 27
 *
 * Tests attachment suggestion generation and relevance scoring
 */

import { AttachmentSuggestionService, type Email } from '../../src/services/attachment-suggestion.service';

// Mock Prisma
jest.mock('@legal-platform/database', () => ({
  prisma: {
    caseDocument: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

// Mock Embedding Service
jest.mock('../../src/services/embedding.service', () => ({
  EmbeddingService: jest.fn().mockImplementation(() => ({
    generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  })),
}));

describe('AttachmentSuggestionService', () => {
  let service: AttachmentSuggestionService;

  const mockEmail: Email = {
    id: 'email-123',
    subject: 'Contract review needed',
    bodyContent: 'Please review the attached contract and provide your feedback.',
  };

  const mockDocuments = [
    {
      id: 'doc-1',
      fileName: 'Contract_Agreement.pdf',
      fileType: 'Contract',
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      metadataEmbedding: new Array(1536).fill(0.1),
    },
    {
      id: 'doc-2',
      fileName: 'Settlement_Proposal.pdf',
      fileType: 'Settlement',
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      metadataEmbedding: new Array(1536).fill(0.2),
    },
    {
      id: 'doc-3',
      fileName: 'Client_Report.docx',
      fileType: 'Report',
      updatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      metadataEmbedding: new Array(1536).fill(0.3),
    },
  ];

  beforeEach(() => {
    service = new AttachmentSuggestionService();
    jest.clearAllMocks();
  });

  describe('suggestAttachments', () => {
    it('should return empty array when no case documents exist', async () => {
      const { prisma } = require('@legal-platform/database');
      prisma.caseDocument.findMany.mockResolvedValue([]);

      const result = await service.suggestAttachments(
        mockEmail,
        'case-123',
        'Draft content',
        'firm-123',
        'user-123'
      );

      expect(result).toEqual([]);
    });

    it('should return suggestions for matching documents', async () => {
      const { prisma } = require('@legal-platform/database');
      prisma.caseDocument.findMany.mockResolvedValue(
        mockDocuments.map((doc) => ({ document: doc }))
      );

      prisma.$queryRaw.mockResolvedValue([
        { id: 'doc-1', similarity: 0.9 },
        { id: 'doc-2', similarity: 0.7 },
        { id: 'doc-3', similarity: 0.5 },
      ]);

      const result = await service.suggestAttachments(
        mockEmail,
        'case-123',
        'Draft content about the contract',
        'firm-123',
        'user-123'
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('documentId');
      expect(result[0]).toHaveProperty('title');
      expect(result[0]).toHaveProperty('reason');
      expect(result[0]).toHaveProperty('relevanceScore');
    });

    it('should filter suggestions below minimum relevance score', async () => {
      const { prisma } = require('@legal-platform/database');
      prisma.caseDocument.findMany.mockResolvedValue(
        mockDocuments.map((doc) => ({ document: doc }))
      );

      // All documents have low similarity
      prisma.$queryRaw.mockResolvedValue([
        { id: 'doc-1', similarity: 0.2 },
        { id: 'doc-2', similarity: 0.1 },
        { id: 'doc-3', similarity: 0.1 },
      ]);

      const result = await service.suggestAttachments(
        mockEmail,
        'case-123',
        'Unrelated content',
        'firm-123',
        'user-123'
      );

      // Low similarity + low type match = below threshold
      expect(result.every((r) => r.relevanceScore > 0.6)).toBe(true);
    });

    it('should limit to maximum 5 suggestions', async () => {
      const { prisma } = require('@legal-platform/database');
      const manyDocuments = Array.from({ length: 10 }, (_, i) => ({
        document: {
          id: `doc-${i}`,
          fileName: `Document_${i}.pdf`,
          fileType: 'Contract',
          updatedAt: new Date(),
          metadataEmbedding: new Array(1536).fill(0.1),
        },
      }));

      prisma.caseDocument.findMany.mockResolvedValue(manyDocuments);
      prisma.$queryRaw.mockResolvedValue(
        manyDocuments.map((d, i) => ({
          id: d.document.id,
          similarity: 0.9 - i * 0.05,
        }))
      );

      const result = await service.suggestAttachments(
        mockEmail,
        'case-123',
        'Contract review',
        'firm-123',
        'user-123'
      );

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should handle errors gracefully', async () => {
      const { prisma } = require('@legal-platform/database');
      prisma.caseDocument.findMany.mockRejectedValue(new Error('Database error'));

      const result = await service.suggestAttachments(
        mockEmail,
        'case-123',
        'Draft content',
        'firm-123',
        'user-123'
      );

      expect(result).toEqual([]);
    });
  });

  describe('classifyEmailIntent', () => {
    it('should classify contract-related emails', () => {
      const classifyEmailIntent = (service as any).classifyEmailIntent.bind(service);

      const contractContent = 'Please review the contract terms and conditions for the agreement.';
      const result = classifyEmailIntent(contractContent);

      expect(result).toBe('contract_discussion');
    });

    it('should classify court-related emails', () => {
      const classifyEmailIntent = (service as any).classifyEmailIntent.bind(service);

      const courtContent = 'The court hearing is scheduled for next week. Please prepare the motion.';
      const result = classifyEmailIntent(courtContent);

      expect(result).toBe('court_filing');
    });

    it('should classify evidence-related emails', () => {
      const classifyEmailIntent = (service as any).classifyEmailIntent.bind(service);

      const evidenceContent = 'Please provide the evidence documents and proof of payment.';
      const result = classifyEmailIntent(evidenceContent);

      expect(result).toBe('evidence_request');
    });

    it('should classify settlement-related emails', () => {
      const classifyEmailIntent = (service as any).classifyEmailIntent.bind(service);

      const settlementContent = 'We would like to negotiate a settlement proposal for the case.';
      const result = classifyEmailIntent(settlementContent);

      expect(result).toBe('settlement_discussion');
    });

    it('should classify Romanian court-related emails', () => {
      const classifyEmailIntent = (service as any).classifyEmailIntent.bind(service);

      const romanianContent = 'Instanța a stabilit termen pentru ședința de judecată în dosar.';
      const result = classifyEmailIntent(romanianContent);

      expect(result).toBe('court_filing');
    });

    it('should return general for unclassified content', () => {
      const classifyEmailIntent = (service as any).classifyEmailIntent.bind(service);

      const genericContent = 'Hello, how are you today?';
      const result = classifyEmailIntent(genericContent);

      expect(result).toBe('general');
    });
  });

  describe('getRecencyScore', () => {
    it('should return 1.0 for documents less than 7 days old', () => {
      const getRecencyScore = (service as any).getRecencyScore.bind(service);

      const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(getRecencyScore(recentDate)).toBe(1.0);
    });

    it('should return 0.8 for documents 7-30 days old', () => {
      const getRecencyScore = (service as any).getRecencyScore.bind(service);

      const date = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      expect(getRecencyScore(date)).toBe(0.8);
    });

    it('should return 0.6 for documents 30-90 days old', () => {
      const getRecencyScore = (service as any).getRecencyScore.bind(service);

      const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      expect(getRecencyScore(date)).toBe(0.6);
    });

    it('should return 0.4 for documents 90-180 days old', () => {
      const getRecencyScore = (service as any).getRecencyScore.bind(service);

      const date = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
      expect(getRecencyScore(date)).toBe(0.4);
    });

    it('should return 0.2 for documents 180-365 days old', () => {
      const getRecencyScore = (service as any).getRecencyScore.bind(service);

      const date = new Date(Date.now() - 250 * 24 * 60 * 60 * 1000);
      expect(getRecencyScore(date)).toBe(0.2);
    });

    it('should return 0.1 for documents over 365 days old', () => {
      const getRecencyScore = (service as any).getRecencyScore.bind(service);

      const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
      expect(getRecencyScore(date)).toBe(0.1);
    });
  });

  describe('getTypeMatchScore', () => {
    it('should return 1.0 for exact type match', () => {
      const getTypeMatchScore = (service as any).getTypeMatchScore.bind(service);

      expect(getTypeMatchScore('Contract', ['Contract', 'Agreement'])).toBe(1.0);
      expect(getTypeMatchScore('contract', ['Contract', 'Agreement'])).toBe(1.0);
    });

    it('should return 0.5 for common document types', () => {
      const getTypeMatchScore = (service as any).getTypeMatchScore.bind(service);

      expect(getTypeMatchScore('application/pdf', ['Contract'])).toBe(0.5);
      expect(getTypeMatchScore('document.docx', ['Motion'])).toBe(0.5);
    });

    it('should return 0.2 for no match', () => {
      const getTypeMatchScore = (service as any).getTypeMatchScore.bind(service);

      expect(getTypeMatchScore('image/png', ['Contract'])).toBe(0.2);
    });
  });

  describe('extractKeyTerms', () => {
    it('should extract meaningful terms from content', () => {
      const extractKeyTerms = (service as any).extractKeyTerms.bind(service);

      const content = 'The contract agreement includes important terms and conditions.';
      const terms = extractKeyTerms(content);

      expect(terms).toContain('contract');
      expect(terms).toContain('agreement');
      expect(terms).toContain('terms');
      expect(terms).toContain('conditions');
      expect(terms).not.toContain('the');
      expect(terms).not.toContain('and');
    });

    it('should filter Romanian stop words', () => {
      const extractKeyTerms = (service as any).extractKeyTerms.bind(service);

      const content = 'Contractul și acordul de la București pentru client.';
      const terms = extractKeyTerms(content);

      expect(terms).toContain('contractul');
      expect(terms).toContain('acordul');
      expect(terms).toContain('bucurești');
      expect(terms).toContain('client');
      expect(terms).not.toContain('și');
      expect(terms).not.toContain('pentru');
    });

    it('should return unique terms', () => {
      const extractKeyTerms = (service as any).extractKeyTerms.bind(service);

      const content = 'contract contract agreement contract';
      const terms = extractKeyTerms(content);

      const uniqueTerms = [...new Set(terms)];
      expect(terms.length).toBe(uniqueTerms.length);
    });

    it('should limit to 50 terms', () => {
      const extractKeyTerms = (service as any).extractKeyTerms.bind(service);

      // Generate content with many unique words
      const content = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');
      const terms = extractKeyTerms(content);

      expect(terms.length).toBeLessThanOrEqual(50);
    });
  });

  describe('generateReason', () => {
    it('should generate high relevance reason for score > 0.8', () => {
      const generateReason = (service as any).generateReason.bind(service);

      const scoredDoc = {
        document: { fileName: 'Contract.pdf', fileType: 'Contract' },
        score: 0.9,
      };

      const reason = generateReason(scoredDoc, 'contract_discussion');

      expect(reason).toContain('Highly relevant');
    });

    it('should generate contract-specific reason', () => {
      const generateReason = (service as any).generateReason.bind(service);

      const scoredDoc = {
        document: { fileName: 'Agreement.pdf', fileType: 'Contract' },
        score: 0.7,
      };

      const reason = generateReason(scoredDoc, 'contract_discussion');

      expect(reason).toContain('Contract document');
    });

    it('should generate court-specific reason', () => {
      const generateReason = (service as any).generateReason.bind(service);

      const scoredDoc = {
        document: { fileName: 'Motion.pdf', fileType: 'Motion' },
        score: 0.7,
      };

      const reason = generateReason(scoredDoc, 'court_filing');

      expect(reason).toContain('Court-related');
    });

    it('should generate default reason for unknown intent', () => {
      const generateReason = (service as any).generateReason.bind(service);

      const scoredDoc = {
        document: { fileName: 'Document.pdf', fileType: 'Document' },
        score: 0.7,
      };

      const reason = generateReason(scoredDoc, 'unknown');

      expect(reason).toContain('Document.pdf');
      expect(reason).toContain('relevant');
    });
  });
});
