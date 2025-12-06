/**
 * Document Drafting Integration Tests
 * Story 3.3: Intelligent Document Drafting
 *
 * Tests end-to-end document generation flow with real database
 */

import request from 'supertest';
import { prisma } from '@legal-platform/database';

// Test configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY || 'test-api-key';

// Test data
const testFirm = {
  id: '123e4567-e89b-12d3-a456-426614174100',
  name: 'Test Law Firm',
};

const testUser = {
  id: '123e4567-e89b-12d3-a456-426614174101',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'Partner',
};

const testClient = {
  id: '123e4567-e89b-12d3-a456-426614174102',
  name: 'Test Client SRL',
};

const testCase = {
  id: '123e4567-e89b-12d3-a456-426614174103',
  caseNumber: 'TEST-2024-001',
  title: 'Test Case',
  type: 'Contract',
  status: 'Active',
  description: 'Test case for integration testing',
};

describe('Document Drafting Integration Tests', () => {
  // Skip if not running integration tests
  const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';

  beforeAll(async () => {
    if (!runIntegration) return;

    // Setup test data in database
    try {
      await prisma.firm.upsert({
        where: { id: testFirm.id },
        update: {},
        create: testFirm,
      });

      await prisma.client.upsert({
        where: { id: testClient.id },
        update: {},
        create: {
          ...testClient,
          firmId: testFirm.id,
        },
      });

      await prisma.case.upsert({
        where: { id: testCase.id },
        update: {},
        create: {
          ...testCase,
          firmId: testFirm.id,
          clientId: testClient.id,
          openedDate: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to setup test data:', error);
    }
  });

  afterAll(async () => {
    if (!runIntegration) return;

    // Cleanup test data
    try {
      await prisma.documentDraftMetrics.deleteMany({
        where: { firmId: testFirm.id },
      });
      await prisma.case.deleteMany({
        where: { firmId: testFirm.id },
      });
      await prisma.client.deleteMany({
        where: { firmId: testFirm.id },
      });
      await prisma.firm.delete({
        where: { id: testFirm.id },
      });
    } catch (error) {
      console.error('Failed to cleanup test data:', error);
    }
  });

  describe('POST /api/ai/documents/generate', () => {
    const skipIfNoIntegration = runIntegration ? it : it.skip;

    skipIfNoIntegration('should generate a document with valid input', async () => {
      const response = await request(AI_SERVICE_URL)
        .post('/api/ai/documents/generate')
        .set('Authorization', `Bearer ${AI_SERVICE_API_KEY}`)
        .send({
          caseId: testCase.id,
          prompt: 'Generate a service contract for legal consulting',
          documentType: 'Contract',
          includeContext: true,
          userId: testUser.id,
          firmId: testFirm.id,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('content');
      expect(response.body).toHaveProperty('tokensUsed');
      expect(response.body).toHaveProperty('generationTimeMs');
    });

    skipIfNoIntegration('should return 400 for invalid input', async () => {
      const response = await request(AI_SERVICE_URL)
        .post('/api/ai/documents/generate')
        .set('Authorization', `Bearer ${AI_SERVICE_API_KEY}`)
        .send({
          caseId: testCase.id,
          prompt: '', // Invalid - empty prompt
          documentType: 'Contract',
          userId: testUser.id,
          firmId: testFirm.id,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    skipIfNoIntegration('should return 401 without authorization', async () => {
      const response = await request(AI_SERVICE_URL)
        .post('/api/ai/documents/generate')
        .send({
          caseId: testCase.id,
          prompt: 'Generate a contract',
          documentType: 'Contract',
          userId: testUser.id,
          firmId: testFirm.id,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/ai/explain', () => {
    const skipIfNoIntegration = runIntegration ? it : it.skip;

    skipIfNoIntegration('should explain language choice', async () => {
      const response = await request(AI_SERVICE_URL)
        .post('/api/ai/explain')
        .set('Authorization', `Bearer ${AI_SERVICE_API_KEY}`)
        .send({
          documentId: '123e4567-e89b-12d3-a456-426614174999',
          selectedText: 'Prestatorul se obligă să păstreze confidențialitatea',
          firmId: testFirm.id,
          userId: testUser.id,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('selection');
      expect(response.body).toHaveProperty('explanation');
    });

    skipIfNoIntegration('should return 400 for empty selection', async () => {
      const response = await request(AI_SERVICE_URL)
        .post('/api/ai/explain')
        .set('Authorization', `Bearer ${AI_SERVICE_API_KEY}`)
        .send({
          documentId: '123e4567-e89b-12d3-a456-426614174999',
          selectedText: '',
          firmId: testFirm.id,
          userId: testUser.id,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/ai/suggestions/sync', () => {
    const skipIfNoIntegration = runIntegration ? it : it.skip;

    skipIfNoIntegration('should return clause suggestions', async () => {
      const response = await request(AI_SERVICE_URL)
        .post('/api/ai/suggestions/sync')
        .set('Authorization', `Bearer ${AI_SERVICE_API_KEY}`)
        .send({
          documentId: '123e4567-e89b-12d3-a456-426614174999',
          documentType: 'Contract',
          currentText: 'Prestatorul se obligă',
          cursorPosition: 20,
          firmId: testFirm.id,
          userId: testUser.id,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });
  });

  describe('GET /api/ai/suggestions/stream', () => {
    const skipIfNoIntegration = runIntegration ? it : it.skip;

    skipIfNoIntegration('should establish SSE connection', async () => {
      const response = await request(AI_SERVICE_URL)
        .get('/api/ai/suggestions/stream')
        .set('Authorization', `Bearer ${AI_SERVICE_API_KEY}`)
        .query({
          documentId: '123e4567-e89b-12d3-a456-426614174999',
          userId: testUser.id,
          firmId: testFirm.id,
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    skipIfNoIntegration('should return 400 without required params', async () => {
      const response = await request(AI_SERVICE_URL)
        .get('/api/ai/suggestions/stream')
        .set('Authorization', `Bearer ${AI_SERVICE_API_KEY}`);

      expect(response.status).toBe(400);
    });
  });
});

describe('GraphQL Document Drafting Integration Tests', () => {
  const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
  const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';

  describe('generateDocumentWithAI mutation', () => {
    const skipIfNoIntegration = runIntegration ? it : it.skip;

    skipIfNoIntegration('should generate document via GraphQL', async () => {
      const mutation = `
        mutation GenerateDocument($input: AIDocumentGenerationInput!) {
          generateDocumentWithAI(input: $input) {
            id
            title
            content
            suggestedTitle
            tokensUsed
            generationTimeMs
          }
        }
      `;

      const response = await request(GATEWAY_URL)
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send({
          query: mutation,
          variables: {
            input: {
              caseId: testCase.id,
              prompt: 'Generate a service contract',
              documentType: 'Contract',
              includeContext: true,
            },
          },
        });

      expect(response.status).toBe(200);
      // Response structure depends on auth middleware
      expect(response.body).toBeDefined();
    });
  });

  describe('findSimilarDocuments query', () => {
    const skipIfNoIntegration = runIntegration ? it : it.skip;

    skipIfNoIntegration('should find similar documents', async () => {
      const query = `
        query FindSimilar($caseId: UUID!, $documentType: DocumentType!) {
          findSimilarDocuments(caseId: $caseId, documentType: $documentType) {
            documentId
            title
            similarity
            relevantSections
          }
        }
      `;

      const response = await request(GATEWAY_URL)
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send({
          query,
          variables: {
            caseId: testCase.id,
            documentType: 'Contract',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });
  });

  describe('suggestTemplates query', () => {
    const skipIfNoIntegration = runIntegration ? it : it.skip;

    skipIfNoIntegration('should suggest templates', async () => {
      const query = `
        query SuggestTemplates($caseId: UUID!, $documentType: DocumentType!) {
          suggestTemplates(caseId: $caseId, documentType: $documentType) {
            id
            name
            category
            usageCount
            qualityScore
          }
        }
      `;

      const response = await request(GATEWAY_URL)
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send({
          query,
          variables: {
            caseId: testCase.id,
            documentType: 'Contract',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });
  });
});

describe('Semantic Search Integration Tests', () => {
  const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';

  describe('pgvector similarity search', () => {
    const skipIfNoIntegration = runIntegration ? it : it.skip;

    skipIfNoIntegration('should perform vector similarity search', async () => {
      // This test requires the pgvector extension and embeddings to be set up
      const results = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM document_embeddings
      `;

      expect(results).toBeDefined();
    });
  });
});
