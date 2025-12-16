/**
 * Risk Assessment Service Tests
 * Story 3.5: Semantic Version Control System - Task 15
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { riskAssessmentService } from './risk-assessment.service';
import {
  ChangeType,
  ChangeSignificance,
  RiskLevel,
  LegalChangeType,
  LegalChange,
  DocumentContext,
} from '@legal-platform/types';

// Mock provider manager
vi.mock('./provider-manager.service', () => ({
  providerManager: {
    execute: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        riskLevel: 'MEDIUM',
        explanation: 'The change affects payment terms.',
        factors: ['Payment terms changed', 'Time extension requested'],
      }),
      model: 'claude-3-haiku',
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 500,
    }),
  },
}));

// Mock token tracker
vi.mock('./token-tracker.service', () => ({
  tokenTracker: {
    recordUsage: vi.fn(),
  },
}));

// Mock logger
vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('RiskAssessmentService', () => {
  const mockDocumentContext: DocumentContext = {
    documentId: 'doc-123',
    documentType: 'contract',
    language: 'ro',
    firmId: 'firm-123',
  };

  const mockChange: LegalChange = {
    id: 'change-123',
    changeType: ChangeType.MODIFIED,
    significance: ChangeSignificance.SUBSTANTIVE,
    beforeText: 'Payment due within 30 days.',
    afterText: 'Payment due within 60 days.',
    plainSummary: 'Extended payment deadline from 30 to 60 days',
    legalClassification: LegalChangeType.PAYMENT_TERMS_CHANGE,
    impactDescription: 'Increases cash flow flexibility for paying party',
    affectedParties: ['Buyer'],
    relatedClauses: ['Payment Terms', 'Financial Obligations'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assessChangeRisk', () => {
    it('should return risk assessment for a change', async () => {
      const result = await riskAssessmentService.assessChangeRisk(mockChange, mockDocumentContext);

      expect(result).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect([RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH]).toContain(result.riskLevel);
      expect(result.explanation).toBeDefined();
    });

    it('should assess low risk for formatting changes', async () => {
      const formattingChange: LegalChange = {
        ...mockChange,
        significance: ChangeSignificance.FORMATTING,
        beforeText: 'Simple text',
        afterText: 'Simple  text', // Extra space
        plainSummary: 'Whitespace adjustment',
        legalClassification: LegalChangeType.TERM_MODIFICATION,
      };

      const result = await riskAssessmentService.assessChangeRisk(
        formattingChange,
        mockDocumentContext
      );

      expect(result.riskLevel).toBe(RiskLevel.LOW);
    });

    it('should assess high risk for liability changes', async () => {
      const liabilityChange: LegalChange = {
        ...mockChange,
        significance: ChangeSignificance.CRITICAL,
        legalClassification: LegalChangeType.LIABILITY_CHANGE,
        beforeText: 'Liability limited to contract value.',
        afterText: 'Unlimited liability for all damages.',
        plainSummary: 'Removed liability cap',
      };

      const result = await riskAssessmentService.assessChangeRisk(
        liabilityChange,
        mockDocumentContext
      );

      expect(result.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('should assess high risk for termination clause changes', async () => {
      const terminationChange: LegalChange = {
        ...mockChange,
        significance: ChangeSignificance.CRITICAL,
        legalClassification: LegalChangeType.TERMINATION_CHANGE,
        beforeText: 'Either party may terminate with 30 days notice.',
        afterText: 'Only the Provider may terminate at any time without notice.',
        plainSummary: 'Unilateral termination rights',
      };

      const result = await riskAssessmentService.assessChangeRisk(
        terminationChange,
        mockDocumentContext
      );

      expect(result.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('should include contributing factors', async () => {
      const result = await riskAssessmentService.assessChangeRisk(mockChange, mockDocumentContext);

      expect(result.factors).toBeDefined();
      expect(Array.isArray(result.factors)).toBe(true);
    });
  });

  describe('calculateAggregateRisk', () => {
    it('should return HIGH if any change is critical', () => {
      const changes: LegalChange[] = [
        { ...mockChange, riskLevel: RiskLevel.LOW },
        { ...mockChange, riskLevel: RiskLevel.MEDIUM },
        { ...mockChange, riskLevel: RiskLevel.HIGH },
      ];

      const result = riskAssessmentService.calculateAggregateRisk(changes);

      expect(result.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('should return MEDIUM if no HIGH but has MEDIUM changes', () => {
      const changes: LegalChange[] = [
        { ...mockChange, riskLevel: RiskLevel.LOW },
        { ...mockChange, riskLevel: RiskLevel.MEDIUM },
        { ...mockChange, riskLevel: RiskLevel.LOW },
      ];

      const result = riskAssessmentService.calculateAggregateRisk(changes);

      expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('should return LOW if all changes are low risk', () => {
      const changes: LegalChange[] = [
        { ...mockChange, riskLevel: RiskLevel.LOW },
        { ...mockChange, riskLevel: RiskLevel.LOW },
      ];

      const result = riskAssessmentService.calculateAggregateRisk(changes);

      expect(result.riskLevel).toBe(RiskLevel.LOW);
    });

    it('should return LOW for empty changes array', () => {
      const result = riskAssessmentService.calculateAggregateRisk([]);

      expect(result.riskLevel).toBe(RiskLevel.LOW);
    });

    it('should identify high risk changes', () => {
      const highRiskChange = { ...mockChange, id: 'high-risk-1', riskLevel: RiskLevel.HIGH };
      const changes: LegalChange[] = [
        { ...mockChange, id: 'low-1', riskLevel: RiskLevel.LOW },
        highRiskChange,
      ];

      const result = riskAssessmentService.calculateAggregateRisk(changes);

      expect(result.highRiskChanges).toContain('high-risk-1');
    });
  });

  describe('getLegalChangeTypeRisk', () => {
    it('should return HIGH for LIABILITY_CHANGE', () => {
      const risk = riskAssessmentService.getLegalChangeTypeRisk(LegalChangeType.LIABILITY_CHANGE);
      expect(risk).toBe(RiskLevel.HIGH);
    });

    it('should return HIGH for TERMINATION_CHANGE', () => {
      const risk = riskAssessmentService.getLegalChangeTypeRisk(LegalChangeType.TERMINATION_CHANGE);
      expect(risk).toBe(RiskLevel.HIGH);
    });

    it('should return MEDIUM for PAYMENT_TERMS_CHANGE', () => {
      const risk = riskAssessmentService.getLegalChangeTypeRisk(
        LegalChangeType.PAYMENT_TERMS_CHANGE
      );
      expect(risk).toBe(RiskLevel.MEDIUM);
    });

    it('should return MEDIUM for SCOPE_CHANGE', () => {
      const risk = riskAssessmentService.getLegalChangeTypeRisk(LegalChangeType.SCOPE_CHANGE);
      expect(risk).toBe(RiskLevel.MEDIUM);
    });

    it('should return LOW for DATE_CHANGE', () => {
      const risk = riskAssessmentService.getLegalChangeTypeRisk(LegalChangeType.DATE_CHANGE);
      expect(risk).toBe(RiskLevel.LOW);
    });
  });
});
