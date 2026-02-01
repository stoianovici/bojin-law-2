/**
 * Word AI Validation Middleware Tests
 * Phase 1.2: Input Validation with Zod Schemas
 */

import { Request, Response, NextFunction } from 'express';
import {
  validateBody,
  DraftRequestSchema,
  SuggestRequestSchema,
  ExplainRequestSchema,
  ImproveRequestSchema,
  OoxmlRequestSchema,
  CourtFilingGenerateRequestSchema,
  ContractAnalysisRequestSchema,
  isContentSafeForRegex,
  MAX_BODY_SIZE,
} from './word-ai-validation.middleware';

// ============================================================================
// Mock Setup
// ============================================================================

function createMockRequest(body: unknown, contentLength?: number): Partial<Request> {
  return {
    body,
    path: '/test',
    headers: {
      'content-length': contentLength?.toString() || JSON.stringify(body).length.toString(),
    },
  };
}

function createMockResponse(): Partial<Response> & { statusCode?: number; jsonData?: unknown } {
  const res: Partial<Response> & { statusCode?: number; jsonData?: unknown } = {
    statusCode: undefined,
    jsonData: undefined,
  };
  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((data: unknown) => {
    res.jsonData = data;
    return res;
  });
  return res;
}

// ============================================================================
// DraftRequestSchema Tests
// ============================================================================

describe('DraftRequestSchema', () => {
  it('should validate a valid draft request', () => {
    const result = DraftRequestSchema.safeParse({
      documentName: 'Test Document',
      prompt: 'Write a legal brief',
      contextType: 'case',
      caseId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.success).toBe(true);
  });

  it('should reject empty document name', () => {
    const result = DraftRequestSchema.safeParse({
      documentName: '',
      prompt: 'Test prompt',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.path.includes('documentName'))).toBe(true);
    }
  });

  it('should reject overly long prompt', () => {
    const result = DraftRequestSchema.safeParse({
      documentName: 'Test',
      prompt: 'x'.repeat(60 * 1024), // 60KB, exceeds 50KB limit
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.path.includes('prompt'))).toBe(true);
    }
  });

  it('should apply default values', () => {
    const result = DraftRequestSchema.safeParse({
      documentName: 'Test',
      prompt: 'Test prompt',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contextType).toBe('case');
      expect(result.data.enableWebSearch).toBe(false);
      expect(result.data.includeOoxml).toBe(true);
      expect(result.data.premiumMode).toBe(false);
    }
  });

  it('should validate sourceTypes enum values', () => {
    const validResult = DraftRequestSchema.safeParse({
      documentName: 'Test',
      prompt: 'Test',
      sourceTypes: ['legislation', 'jurisprudence'],
    });
    expect(validResult.success).toBe(true);

    const invalidResult = DraftRequestSchema.safeParse({
      documentName: 'Test',
      prompt: 'Test',
      sourceTypes: ['invalid_source'],
    });
    expect(invalidResult.success).toBe(false);
  });

  it('should validate research depth enum', () => {
    const validResult = DraftRequestSchema.safeParse({
      documentName: 'Test',
      prompt: 'Test',
      researchDepth: 'deep',
    });
    expect(validResult.success).toBe(true);

    const invalidResult = DraftRequestSchema.safeParse({
      documentName: 'Test',
      prompt: 'Test',
      researchDepth: 'super_deep',
    });
    expect(invalidResult.success).toBe(false);
  });
});

// ============================================================================
// SuggestRequestSchema Tests
// ============================================================================

describe('SuggestRequestSchema', () => {
  it('should validate with selectedText', () => {
    const result = SuggestRequestSchema.safeParse({
      selectedText: 'Some legal text',
      suggestionType: 'completion',
    });

    expect(result.success).toBe(true);
  });

  it('should validate with cursorContext', () => {
    const result = SuggestRequestSchema.safeParse({
      cursorContext: 'Context around cursor',
      suggestionType: 'alternative',
    });

    expect(result.success).toBe(true);
  });

  it('should reject when neither selectedText nor cursorContext provided', () => {
    const result = SuggestRequestSchema.safeParse({
      suggestionType: 'completion',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.errors.some((e) => e.message.includes('Either selectedText or cursorContext'))
      ).toBe(true);
    }
  });

  it('should reject overly long selectedText', () => {
    const result = SuggestRequestSchema.safeParse({
      selectedText: 'x'.repeat(110 * 1024), // 110KB, exceeds 100KB limit
    });

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// ExplainRequestSchema Tests
// ============================================================================

describe('ExplainRequestSchema', () => {
  it('should validate a valid explain request', () => {
    const result = ExplainRequestSchema.safeParse({
      selectedText: 'Art. 194 C.proc.civ. stipulează că...',
    });

    expect(result.success).toBe(true);
  });

  it('should reject empty selectedText', () => {
    const result = ExplainRequestSchema.safeParse({
      selectedText: '',
    });

    expect(result.success).toBe(false);
  });

  it('should validate optional caseId as UUID', () => {
    const validResult = ExplainRequestSchema.safeParse({
      selectedText: 'Test',
      caseId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(validResult.success).toBe(true);

    const invalidResult = ExplainRequestSchema.safeParse({
      selectedText: 'Test',
      caseId: 'not-a-uuid',
    });
    expect(invalidResult.success).toBe(false);
  });
});

// ============================================================================
// ImproveRequestSchema Tests
// ============================================================================

describe('ImproveRequestSchema', () => {
  it('should validate with all improvement types', () => {
    const types = ['clarity', 'formality', 'brevity', 'legal_precision'] as const;

    for (const type of types) {
      const result = ImproveRequestSchema.safeParse({
        selectedText: 'Test text',
        improvementType: type,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid improvement type', () => {
    const result = ImproveRequestSchema.safeParse({
      selectedText: 'Test',
      improvementType: 'invalid_type',
    });

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// OoxmlRequestSchema Tests
// ============================================================================

describe('OoxmlRequestSchema', () => {
  it('should validate with html', () => {
    const result = OoxmlRequestSchema.safeParse({
      html: '<p>Test content</p>',
    });

    expect(result.success).toBe(true);
  });

  it('should validate with markdown', () => {
    const result = OoxmlRequestSchema.safeParse({
      markdown: '# Test\n\nSome content',
    });

    expect(result.success).toBe(true);
  });

  it('should reject when neither html nor markdown provided', () => {
    const result = OoxmlRequestSchema.safeParse({
      includeTableOfContents: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.message.includes('Either html or markdown'))).toBe(
        true
      );
    }
  });
});

// ============================================================================
// CourtFilingGenerateRequestSchema Tests
// ============================================================================

describe('CourtFilingGenerateRequestSchema', () => {
  it('should validate a valid court filing request', () => {
    const result = CourtFilingGenerateRequestSchema.safeParse({
      templateId: 'CF-01',
      caseId: '550e8400-e29b-41d4-a716-446655440000',
      templateMetadata: {
        name: 'Cerere de chemare în judecată',
        cpcArticles: ['Art. 194', 'Art. 195'],
        partyLabels: { party1: 'Reclamant', party2: 'Pârât' },
        requiredSections: ['Obiect', 'Situatia de fapt', 'Temeiul de drept'],
        formCategory: 'A',
      },
    });

    expect(result.success).toBe(true);
  });

  it('should reject invalid form category', () => {
    const result = CourtFilingGenerateRequestSchema.safeParse({
      templateId: 'CF-01',
      templateMetadata: {
        name: 'Test',
        cpcArticles: [],
        partyLabels: { party1: 'R', party2: 'P' },
        requiredSections: [],
        formCategory: 'D', // Invalid
      },
    });

    expect(result.success).toBe(false);
  });

  it('should enforce max required sections limit', () => {
    const result = CourtFilingGenerateRequestSchema.safeParse({
      templateId: 'CF-01',
      templateMetadata: {
        name: 'Test',
        cpcArticles: [],
        partyLabels: { party1: 'R', party2: 'P' },
        requiredSections: Array(60).fill('Section'), // Exceeds 50 limit
        formCategory: 'A',
      },
    });

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// ContractAnalysisRequestSchema Tests
// ============================================================================

describe('ContractAnalysisRequestSchema', () => {
  it('should validate with premiumMode true', () => {
    const result = ContractAnalysisRequestSchema.safeParse({
      documentContent: 'Contract content here...',
      premiumMode: true,
    });

    expect(result.success).toBe(true);
  });

  it('should reject without premiumMode true', () => {
    const result = ContractAnalysisRequestSchema.safeParse({
      documentContent: 'Contract content',
      premiumMode: false, // Must be true
    });

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// validateBody Middleware Tests
// ============================================================================

describe('validateBody middleware', () => {
  it('should pass valid request to next()', () => {
    const middleware = validateBody(DraftRequestSchema);
    const req = createMockRequest({
      documentName: 'Test',
      prompt: 'Test prompt',
    });
    const res = createMockResponse();
    const next = jest.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid request', () => {
    const middleware = validateBody(DraftRequestSchema);
    const req = createMockRequest({
      documentName: '', // Invalid - empty
      prompt: 'Test',
    });
    const res = createMockResponse();
    const next = jest.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.jsonData).toMatchObject({
      error: 'validation_error',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 413 for oversized request body', () => {
    const middleware = validateBody(DraftRequestSchema);
    const req = createMockRequest(
      { documentName: 'Test', prompt: 'Test' },
      MAX_BODY_SIZE + 1000 // Exceeds limit
    );
    const res = createMockResponse();
    const next = jest.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.jsonData).toMatchObject({
      error: 'payload_too_large',
    });
  });

  it('should replace req.body with validated/coerced data', () => {
    const middleware = validateBody(DraftRequestSchema);
    const req = createMockRequest({
      documentName: 'Test',
      prompt: 'Test prompt',
      // contextType not provided - should get default
    });
    const res = createMockResponse();
    const next = jest.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(req.body.contextType).toBe('case'); // Default applied
  });
});

// ============================================================================
// isContentSafeForRegex Tests
// ============================================================================

describe('isContentSafeForRegex', () => {
  it('should return true for empty content', () => {
    expect(isContentSafeForRegex('')).toBe(true);
    expect(isContentSafeForRegex(null as unknown as string)).toBe(true);
  });

  it('should return true for content under limit', () => {
    expect(isContentSafeForRegex('Short content')).toBe(true);
    expect(isContentSafeForRegex('x'.repeat(1000))).toBe(true);
  });

  it('should return false for content over default limit', () => {
    expect(isContentSafeForRegex('x'.repeat(110 * 1024))).toBe(false);
  });

  it('should respect custom maxLength parameter', () => {
    const content = 'x'.repeat(500);
    expect(isContentSafeForRegex(content, 400)).toBe(false);
    expect(isContentSafeForRegex(content, 600)).toBe(true);
  });
});
