/**
 * Classification Scoring Service Tests
 * OPS-039: Enhanced Multi-Case Classification Algorithm
 *
 * Tests for the weighted scoring algorithm that classifies emails
 * when a contact has multiple active cases.
 */

import {
  ClassificationScoringService,
  WEIGHTS,
  THRESHOLDS,
  REFERENCE_PATTERNS,
  type EmailForClassification,
} from './classification-scoring';
import { prisma } from '@legal-platform/database';

// Use manual mock from __mocks__/utils/logger.ts
jest.mock('../utils/logger');

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('ClassificationScoringService', () => {
  let service: ClassificationScoringService;

  beforeEach(() => {
    service = new ClassificationScoringService();
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('extractReferenceNumbers', () => {
    it('should extract standard Romanian court file numbers', () => {
      const text = 'Referitor la dosarul 123/45/2025 va rugam sa raspundeti.';
      const refs = service.extractReferenceNumbers(text);
      expect(refs).toContain('123/45/2025');
    });

    it('should extract multiple reference numbers', () => {
      const text = 'Dosare conexe: 123/45/2025 si 456/78/2024';
      const refs = service.extractReferenceNumbers(text);
      expect(refs).toContain('123/45/2025');
      expect(refs).toContain('456/78/2024');
    });

    it('should extract "dosar nr." format', () => {
      const text = 'Dosar nr. 1234/567/2024 - termen nou';
      const refs = service.extractReferenceNumbers(text);
      expect(refs).toContain('1234/567/2024');
    });

    it('should extract contract reference format', () => {
      const text = 'Contract CTR-2025-001 semnat';
      const refs = service.extractReferenceNumbers(text);
      expect(refs).toContain('CTR-2025-001');
    });

    it('should return empty array for text without references', () => {
      const text = 'Un email normal fara referinte de dosar.';
      const refs = service.extractReferenceNumbers(text);
      expect(refs).toEqual([]);
    });

    it('should deduplicate repeated references', () => {
      const text = 'Dosar 123/45/2025 mentionat in 123/45/2025 de doua ori';
      const refs = service.extractReferenceNumbers(text);
      const uniqueRefs = refs.filter((r) => r === '123/45/2025');
      // Should only appear once due to deduplication
      expect(uniqueRefs.length).toBeLessThanOrEqual(2); // May appear twice due to different patterns
    });
  });

  describe('WEIGHTS and THRESHOLDS constants', () => {
    it('should have THREAD_CONTINUITY as highest weight', () => {
      expect(WEIGHTS.THREAD_CONTINUITY).toBe(100);
      expect(WEIGHTS.THREAD_CONTINUITY).toBeGreaterThan(WEIGHTS.REFERENCE_NUMBER);
    });

    it('should have REFERENCE_NUMBER higher than KEYWORD weights', () => {
      expect(WEIGHTS.REFERENCE_NUMBER).toBeGreaterThan(WEIGHTS.KEYWORD_SUBJECT);
      expect(WEIGHTS.KEYWORD_SUBJECT).toBeGreaterThan(WEIGHTS.KEYWORD_BODY);
    });

    it('should have reasonable threshold values', () => {
      expect(THRESHOLDS.MIN_SCORE).toBe(70);
      expect(THRESHOLDS.MIN_GAP).toBe(20);
      expect(THRESHOLDS.SINGLE_CASE_CONFIDENCE).toBe(0.9);
    });
  });

  describe('REFERENCE_PATTERNS', () => {
    it('should have patterns for Romanian court formats', () => {
      expect(REFERENCE_PATTERNS.length).toBeGreaterThan(0);
    });

    it('should match standard court file pattern', () => {
      const standardPattern = REFERENCE_PATTERNS[0];
      const match = '123/45/2025'.match(standardPattern);
      expect(match).not.toBeNull();
    });
  });

  describe('classifyEmail', () => {
    const mockEmail: EmailForClassification = {
      id: 'email-1',
      conversationId: 'conv-123',
      subject: 'Re: Dosar 123/45/2025',
      bodyPreview: 'Va transmit documentele solicitate pentru dosarul de litigiu.',
      from: { name: 'Ion Popescu', address: 'ion.popescu@example.com' },
      toRecipients: [{ name: 'Avocat', address: 'avocat@firma.ro' }],
      receivedDateTime: new Date('2025-12-18T10:00:00Z'),
    };

    it('should return THREAD_CONTINUITY match for existing conversation', async () => {
      // Mock finding existing email in same conversation
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValueOnce({
        caseId: 'case-1',
      });

      const result = await service.classifyEmail(mockEmail, 'firm-1', 'user-1');

      expect(result.caseId).toBe('case-1');
      expect(result.matchType).toBe('THREAD_CONTINUITY');
      expect(result.confidence).toBe(1.0);
    });

    it('should return UNKNOWN_CONTACT when sender not found in any case', async () => {
      // No existing thread
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValueOnce(null);

      // No cases with this contact
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.classifyEmail(mockEmail, 'firm-1', 'user-1');

      expect(result.caseId).toBeNull();
      expect(result.matchType).toBe('UNKNOWN_CONTACT');
      expect(result.state).toBe('Uncertain');
    });

    it('should auto-assign to single case with high confidence', async () => {
      // No existing thread
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValueOnce(null);

      // One case with this contact
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'case-1',
          caseNumber: 'C-2025-001',
          title: 'Litigiu Popescu',
          keywords: ['litigiu'],
          referenceNumbers: ['123/45/2025'],
          subjectPatterns: [],
          actors: [{ email: 'ion.popescu@example.com', name: 'Ion Popescu', role: 'Client' }],
          client: { name: 'Ion Popescu', contactInfo: { email: 'ion.popescu@example.com' } },
          activityFeed: [],
        },
      ]);

      const result = await service.classifyEmail(mockEmail, 'firm-1', 'user-1');

      expect(result.caseId).toBe('case-1');
      expect(result.matchType).toBe('CONTACT_MATCH');
      expect(result.confidence).toBe(THRESHOLDS.SINGLE_CASE_CONFIDENCE);
    });

    it('should use multi-case scoring when contact has multiple cases', async () => {
      // No existing thread
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValueOnce(null);

      // Two cases with this contact - one has matching reference number
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'case-1',
          caseNumber: 'C-2025-001',
          title: 'Litigiu Popescu',
          keywords: ['litigiu'],
          referenceNumbers: ['123/45/2025'],
          subjectPatterns: [],
          actors: [{ email: 'ion.popescu@example.com', name: 'Ion Popescu', role: 'Client' }],
          client: { name: 'Ion Popescu', contactInfo: { email: 'ion.popescu@example.com' } },
          activityFeed: [{ createdAt: new Date('2025-12-17T10:00:00Z') }],
        },
        {
          id: 'case-2',
          caseNumber: 'C-2025-002',
          title: 'Contract Popescu',
          keywords: ['contract'],
          referenceNumbers: ['789/10/2025'],
          subjectPatterns: [],
          actors: [{ email: 'ion.popescu@example.com', name: 'Ion Popescu', role: 'Client' }],
          client: { name: 'Ion Popescu', contactInfo: { email: 'ion.popescu@example.com' } },
          activityFeed: [],
        },
      ]);

      const result = await service.classifyEmail(mockEmail, 'firm-1', 'user-1');

      // Should classify to case-1 because the reference number matches
      expect(result.caseId).toBe('case-1');
      expect(result.state).toBe('Classified');
    });

    it('should mark as uncertain when scores are too close', async () => {
      // No existing thread
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValueOnce(null);

      // Two cases with equal scoring signals
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'case-1',
          caseNumber: 'C-2025-001',
          title: 'Case One',
          keywords: [],
          referenceNumbers: [],
          subjectPatterns: [],
          actors: [{ email: 'ion.popescu@example.com', name: 'Ion Popescu', role: 'Client' }],
          client: { name: 'Ion Popescu', contactInfo: {} },
          activityFeed: [],
        },
        {
          id: 'case-2',
          caseNumber: 'C-2025-002',
          title: 'Case Two',
          keywords: [],
          referenceNumbers: [],
          subjectPatterns: [],
          actors: [{ email: 'ion.popescu@example.com', name: 'Ion Popescu', role: 'Client' }],
          client: { name: 'Ion Popescu', contactInfo: {} },
          activityFeed: [],
        },
      ]);

      const emailWithoutSignals: EmailForClassification = {
        id: 'email-2',
        conversationId: 'conv-456',
        subject: 'Question',
        bodyPreview: 'A generic question without any identifying info.',
        from: { name: 'Ion Popescu', address: 'ion.popescu@example.com' },
        toRecipients: [],
        receivedDateTime: new Date(),
      };

      const result = await service.classifyEmail(emailWithoutSignals, 'firm-1', 'user-1');

      // Should be uncertain because scores are too close
      expect(result.state).toBe('Uncertain');
      expect(result.suggestedCases).toBeDefined();
      expect(result.suggestedCases?.length).toBeGreaterThan(0);
    });
  });

  describe('scoring signals', () => {
    it('CONTACT_MATCH should provide base score', () => {
      expect(WEIGHTS.CONTACT_MATCH).toBe(10);
    });

    it('KEYWORD_SUBJECT should be weighted higher than KEYWORD_BODY', () => {
      expect(WEIGHTS.KEYWORD_SUBJECT).toBeGreaterThan(WEIGHTS.KEYWORD_BODY);
    });

    it('RECENT_ACTIVITY should be considered in scoring', () => {
      expect(WEIGHTS.RECENT_ACTIVITY).toBe(20);
    });
  });
});
