/**
 * Document Intent Handler Tests
 * OPS-075: Document Intent Handler
 */

import { DocumentIntentHandler, DocumentHandlerParams } from './document.handler';
import type { AssistantContext, UserContext } from './types';

// ============================================================================
// Mocks
// ============================================================================

// Mock Prisma
jest.mock('@legal-platform/database', () => ({
  prisma: {
    document: {
      findUnique: jest.fn(),
    },
    caseDocument: {
      findMany: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock search service
jest.mock('../search.service', () => ({
  searchService: {
    search: jest.fn(),
  },
  SearchMode: {
    HYBRID: 'HYBRID',
    FULL_TEXT: 'FULL_TEXT',
    SEMANTIC: 'SEMANTIC',
  },
}));

// Mock document generation service
jest.mock('../document-generation.service', () => ({
  documentGenerationService: {
    generateDocument: jest.fn(),
  },
}));

// Mock AI service
jest.mock('../ai.service', () => ({
  aiService: {
    generate: jest.fn(),
  },
}));

// Mock @legal-platform/types
jest.mock('@legal-platform/types', () => ({
  AIOperationType: {
    TextGeneration: 'TextGeneration',
  },
}));

import { prisma } from '@legal-platform/database';
import { searchService } from '../search.service';
import { aiService } from '../ai.service';

// ============================================================================
// Test Data
// ============================================================================

const mockUserContext: UserContext = {
  userId: 'user-123',
  firmId: 'firm-456',
  role: 'Lawyer',
  email: 'test@example.com',
};

const mockAssistantContext: AssistantContext = {
  currentScreen: '/cases/case-789/documents',
  currentCaseId: 'case-789',
};

const mockDocument = {
  id: 'doc-001',
  fileName: 'contract.pdf',
  metadata: { extractedText: 'Acest contract de prestări servicii este încheiat între...' },
  firmId: 'firm-456',
  storagePath: '/firm-456/clients/client-1/documents/doc-001-contract.pdf',
};

const mockDocumentNoText = {
  id: 'doc-002',
  fileName: 'image.png',
  metadata: {},
  firmId: 'firm-456',
  storagePath: '/firm-456/clients/client-1/documents/doc-002-image.png',
};

const mockSearchResults = {
  results: [
    {
      type: 'document' as const,
      id: 'doc-001',
      fileName: 'contract-reprezentare.pdf',
      fileType: 'application/pdf',
      clientName: 'SC Exemplu SRL',
      uploadedAt: new Date('2024-01-15'),
      score: 0.95,
      highlight: 'contract de reprezentare',
    },
    {
      type: 'document' as const,
      id: 'doc-002',
      fileName: 'contract-servicii.pdf',
      fileType: 'application/pdf',
      clientName: 'SC Exemplu SRL',
      uploadedAt: new Date('2024-02-20'),
      score: 0.82,
      highlight: 'contract servicii',
    },
  ],
  totalCount: 2,
  searchTime: 45,
  query: 'contract',
};

const mockCaseDocuments = [
  {
    id: 'cd-001',
    caseId: 'case-789',
    documentId: 'doc-001',
    linkedAt: new Date('2024-12-01'),
    firmId: 'firm-456',
    linkedBy: 'user-123',
    isOriginal: true,
    document: {
      id: 'doc-001',
      fileName: 'contract.pdf',
      fileType: 'application/pdf',
      fileSize: 102400,
      status: 'PROCESSED',
    },
  },
  {
    id: 'cd-002',
    caseId: 'case-789',
    documentId: 'doc-002',
    linkedAt: new Date('2024-12-15'),
    firmId: 'firm-456',
    linkedBy: 'user-123',
    isOriginal: false,
    document: {
      id: 'doc-002',
      fileName: 'cerere.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 51200,
      status: 'PROCESSED',
    },
  },
];

const mockCase = {
  id: 'case-789',
  title: 'Dosar Ionescu vs. Popescu',
  caseNumber: 'D-2024-001',
  client: { name: 'Ion Ionescu' },
  actors: [{ name: 'Gheorghe Popescu', role: 'Pârât' }],
};

// ============================================================================
// Tests
// ============================================================================

describe('DocumentIntentHandler', () => {
  let handler: DocumentIntentHandler;

  beforeEach(() => {
    handler = new DocumentIntentHandler();
    jest.clearAllMocks();
  });

  describe('handleFindDocument', () => {
    it('should return error when no query provided', async () => {
      const params: DocumentHandlerParams = {};

      const result = await handler.handleFindDocument(
        params,
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('specifică ce document');
    });

    it('should search documents with query', async () => {
      const params: DocumentHandlerParams = { query: 'contract reprezentare' };
      (searchService.search as jest.Mock).mockResolvedValue(mockSearchResults);

      const result = await handler.handleFindDocument(
        params,
        mockAssistantContext,
        mockUserContext
      );

      expect(searchService.search).toHaveBeenCalledWith(
        'contract reprezentare',
        'firm-456',
        'HYBRID',
        expect.objectContaining({ caseIds: ['case-789'] }),
        5,
        0
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.message).toContain('Am găsit 2 documente');
    });

    it('should handle no results found', async () => {
      const params: DocumentHandlerParams = { query: 'document inexistent' };
      (searchService.search as jest.Mock).mockResolvedValue({
        ...mockSearchResults,
        results: [],
        totalCount: 0,
      });

      const result = await handler.handleFindDocument(
        params,
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Nu am găsit');
    });

    it('should filter by document type', async () => {
      const params: DocumentHandlerParams = { documentType: 'contract' };
      (searchService.search as jest.Mock).mockResolvedValue(mockSearchResults);

      await handler.handleFindDocument(params, mockAssistantContext, mockUserContext);

      expect(searchService.search).toHaveBeenCalledWith(
        'contract',
        'firm-456',
        'HYBRID',
        expect.objectContaining({
          documentTypes: expect.arrayContaining(['contract']),
        }),
        5,
        0
      );
    });
  });

  describe('handleSummarizeDocument', () => {
    it('should return error when no document ID provided', async () => {
      const params: DocumentHandlerParams = {};
      const contextNoDoc: AssistantContext = { currentScreen: '/cases' };

      const result = await handler.handleSummarizeDocument(params, contextNoDoc, mockUserContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Selectați documentul');
    });

    it('should return error when document not found', async () => {
      const params: DocumentHandlerParams = { documentId: 'nonexistent' };
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await handler.handleSummarizeDocument(
        params,
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('nu a fost găsit');
    });

    it('should deny access to documents from other firms', async () => {
      const params: DocumentHandlerParams = { documentId: 'doc-001' };
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        ...mockDocument,
        firmId: 'other-firm',
      });

      const result = await handler.handleSummarizeDocument(
        params,
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Nu aveți acces');
    });

    it('should return error for documents without text content', async () => {
      const params: DocumentHandlerParams = { documentId: 'doc-002' };
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocumentNoText);

      const result = await handler.handleSummarizeDocument(
        params,
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('nu are conținut text');
    });

    it('should generate summary using AI service', async () => {
      const params: DocumentHandlerParams = { documentId: 'doc-001' };
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (aiService.generate as jest.Mock).mockResolvedValue({
        content: 'Aceasta este un rezumat al contractului...',
        totalTokens: 150,
      });

      const result = await handler.handleSummarizeDocument(
        params,
        mockAssistantContext,
        mockUserContext
      );

      expect(aiService.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          firmId: 'firm-456',
          userId: 'user-123',
        })
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('Rezumat: contract.pdf');
      expect(result.data).toHaveProperty('summary');
    });

    it('should use context document ID when param not provided', async () => {
      const params: DocumentHandlerParams = {};
      const contextWithDoc: AssistantContext = {
        ...mockAssistantContext,
        currentDocumentId: 'doc-context',
      };
      (prisma.document.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (aiService.generate as jest.Mock).mockResolvedValue({
        content: 'Rezumat...',
        totalTokens: 100,
      });

      await handler.handleSummarizeDocument(params, contextWithDoc, mockUserContext);

      expect(prisma.document.findUnique).toHaveBeenCalledWith({
        where: { id: 'doc-context' },
        select: expect.any(Object),
      });
    });
  });

  describe('handleGenerateDocument', () => {
    it('should return error when no template type provided', async () => {
      const params: DocumentHandlerParams = {};

      const result = await handler.handleGenerateDocument(
        params,
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Specificați tipul');
    });

    it('should return error for invalid template type', async () => {
      const params: DocumentHandlerParams = { templateType: 'Invalid' as any };

      const result = await handler.handleGenerateDocument(
        params,
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Tip de document nerecunoscut');
    });

    it('should return proposed action for valid template', async () => {
      const params: DocumentHandlerParams = {
        templateType: 'Contract',
        instructions: 'Contract de reprezentare',
      };
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);

      const result = await handler.handleGenerateDocument(
        params,
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.proposedAction).toBeDefined();
      expect(result.proposedAction?.type).toBe('GenerateDocument');
      expect(result.proposedAction?.displayText).toContain('Contract');
      expect(result.proposedAction?.requiresConfirmation).toBe(true);
    });

    it('should include case context in payload when available', async () => {
      const params: DocumentHandlerParams = { templateType: 'Motion' };
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);

      const result = await handler.handleGenerateDocument(
        params,
        mockAssistantContext,
        mockUserContext
      );

      expect(result.proposedAction?.payload).toHaveProperty('caseContext');
      const caseContext = result.proposedAction?.payload.caseContext as any;
      expect(caseContext.title).toBe('Dosar Ionescu vs. Popescu');
      expect(caseContext.clientName).toBe('Ion Ionescu');
    });

    it('should handle missing case context', async () => {
      const params: DocumentHandlerParams = { templateType: 'Letter' };
      const contextNoCase: AssistantContext = { currentScreen: '/dashboard' };

      const result = await handler.handleGenerateDocument(params, contextNoCase, mockUserContext);

      expect(result.success).toBe(true);
      expect(result.proposedAction?.entityPreview).toMatchObject({
        tip: 'Scrisoare',
        dosar: 'Fără dosar',
        client: 'Nespecificat',
      });
    });
  });

  describe('handleListDocuments', () => {
    it('should return error when no case is selected', async () => {
      const contextNoCase: AssistantContext = { currentScreen: '/dashboard' };

      const result = await handler.handleListDocuments(contextNoCase, mockUserContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Deschideți un dosar');
    });

    it('should handle empty document list', async () => {
      (prisma.caseDocument.findMany as jest.Mock).mockResolvedValue([]);

      const result = await handler.handleListDocuments(mockAssistantContext, mockUserContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Nu există documente');
    });

    it('should list documents for current case', async () => {
      (prisma.caseDocument.findMany as jest.Mock).mockResolvedValue(mockCaseDocuments);

      const result = await handler.handleListDocuments(mockAssistantContext, mockUserContext);

      expect(prisma.caseDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { caseId: 'case-789' },
          orderBy: { linkedAt: 'desc' },
          take: 10,
        })
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('Documente în dosar (2)');
      expect(result.data).toHaveLength(2);
    });

    it('should format file sizes correctly', async () => {
      (prisma.caseDocument.findMany as jest.Mock).mockResolvedValue(mockCaseDocuments);

      const result = await handler.handleListDocuments(mockAssistantContext, mockUserContext);

      // 102400 bytes = 100 KB
      expect(result.message).toContain('100 KB');
    });
  });

  describe('helper methods', () => {
    it('should translate document types to Romanian', async () => {
      const params: DocumentHandlerParams = { templateType: 'Pleading' };
      const contextNoCase: AssistantContext = { currentScreen: '/dashboard' };

      const result = await handler.handleGenerateDocument(params, contextNoCase, mockUserContext);

      expect(result.proposedAction?.displayText).toContain('Întâmpinare');
    });
  });
});
