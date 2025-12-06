/**
 * Response Suggestion Service Tests
 * Story 3.5: Semantic Version Control System - Task 15
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { responseSuggestionService } from './response-suggestion.service';
import {
  ChangeType,
  ChangeSignificance,
  RiskLevel,
  PartyRole,
  ResponseType,
  LegalChangeType,
  LegalChange,
  DocumentContext,
} from '@legal-platform/types';

// Mock provider manager
vi.mock('./provider-manager.service', () => ({
  providerManager: {
    execute: vi.fn().mockResolvedValue({
      content: 'We accept the proposed modification to this section.',
      model: 'claude-3-sonnet',
      inputTokens: 200,
      outputTokens: 100,
      latencyMs: 800,
    }),
  },
}));

// Mock token tracker
vi.mock('./token-tracker.service', () => ({
  tokenTracker: {
    recordUsage: vi.fn(),
  },
}));

// Mock risk assessment service
vi.mock('./risk-assessment.service', () => ({
  riskAssessmentService: {
    assessChangeRisk: vi.fn().mockResolvedValue({
      riskLevel: RiskLevel.MEDIUM,
      explanation: 'Moderate risk change',
      factors: ['Payment terms changed'],
    }),
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

describe('ResponseSuggestionService', () => {
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
    beforeText: 'Payment due within 30 days of invoice date.',
    afterText: 'Payment due within 60 days of invoice date.',
    plainSummary: 'Extended payment deadline from 30 to 60 days',
    legalClassification: LegalChangeType.PAYMENT_TERMS_CHANGE,
    impactDescription: 'Increases cash flow flexibility',
    affectedParties: ['Buyer'],
    relatedClauses: ['Payment Terms'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateResponseSuggestions', () => {
    it('should generate suggestions for a change', async () => {
      const result = await responseSuggestionService.generateResponseSuggestions(
        [mockChange],
        PartyRole.CLIENT,
        'ro',
        mockDocumentContext
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include changeId in suggestions', async () => {
      const result = await responseSuggestionService.generateResponseSuggestions(
        [mockChange],
        PartyRole.CLIENT,
        'ro',
        mockDocumentContext
      );

      result.forEach((suggestion) => {
        expect(suggestion.changeId).toBe(mockChange.id);
      });
    });

    it('should generate suggestions in correct language', async () => {
      const result = await responseSuggestionService.generateResponseSuggestions(
        [mockChange],
        PartyRole.CLIENT,
        'en',
        mockDocumentContext
      );

      result.forEach((suggestion) => {
        expect(suggestion.language).toBe('en');
      });
    });

    it('should generate multiple response types', async () => {
      const result = await responseSuggestionService.generateResponseSuggestions(
        [mockChange],
        PartyRole.CLIENT,
        'ro',
        mockDocumentContext
      );

      const types = new Set(result.map((s) => s.suggestionType));
      expect(types.size).toBeGreaterThan(1);
    });
  });

  describe('generateSuggestionsForChange', () => {
    it('should generate acceptance for low risk changes', async () => {
      const lowRiskChange: LegalChange = {
        ...mockChange,
        significance: ChangeSignificance.MINOR_WORDING,
      };

      // Mock low risk assessment
      vi.mocked(require('./risk-assessment.service').riskAssessmentService.assessChangeRisk)
        .mockResolvedValueOnce({
          riskLevel: RiskLevel.LOW,
          explanation: 'Minor change',
          factors: [],
        });

      const result = await responseSuggestionService.generateSuggestionsForChange(
        lowRiskChange,
        PartyRole.CLIENT,
        'ro',
        mockDocumentContext
      );

      const hasAcceptance = result.some((s) => s.suggestionType === ResponseType.ACCEPT);
      expect(hasAcceptance).toBe(true);
    });

    it('should generate counter-proposal for medium risk changes', async () => {
      const result = await responseSuggestionService.generateSuggestionsForChange(
        mockChange,
        PartyRole.CLIENT,
        'ro',
        mockDocumentContext
      );

      const hasCounterProposal = result.some(
        (s) => s.suggestionType === ResponseType.COUNTER_PROPOSAL
      );
      expect(hasCounterProposal).toBe(true);
    });

    it('should generate rejection for high risk changes', async () => {
      vi.mocked(require('./risk-assessment.service').riskAssessmentService.assessChangeRisk)
        .mockResolvedValueOnce({
          riskLevel: RiskLevel.HIGH,
          explanation: 'High risk liability change',
          factors: ['Removes liability cap'],
        });

      const highRiskChange: LegalChange = {
        ...mockChange,
        significance: ChangeSignificance.CRITICAL,
        legalClassification: LegalChangeType.LIABILITY_CHANGE,
      };

      const result = await responseSuggestionService.generateSuggestionsForChange(
        highRiskChange,
        PartyRole.CLIENT,
        'ro',
        mockDocumentContext
      );

      const hasRejection = result.some((s) => s.suggestionType === ResponseType.REJECT);
      expect(hasRejection).toBe(true);
    });

    it('should always include clarification option', async () => {
      const result = await responseSuggestionService.generateSuggestionsForChange(
        mockChange,
        PartyRole.CLIENT,
        'ro',
        mockDocumentContext
      );

      const hasClarification = result.some(
        (s) => s.suggestionType === ResponseType.CLARIFICATION
      );
      expect(hasClarification).toBe(true);
    });
  });

  describe('getResponseTypeLabel', () => {
    it('should return Romanian labels for ro language', () => {
      const acceptLabel = responseSuggestionService.getResponseTypeLabel(
        ResponseType.ACCEPT,
        'ro'
      );
      expect(acceptLabel).toBe('Acceptare');

      const rejectLabel = responseSuggestionService.getResponseTypeLabel(
        ResponseType.REJECT,
        'ro'
      );
      expect(rejectLabel).toBe('Respingere');
    });

    it('should return English labels for en language', () => {
      const acceptLabel = responseSuggestionService.getResponseTypeLabel(
        ResponseType.ACCEPT,
        'en'
      );
      expect(acceptLabel).toBe('Accept');

      const rejectLabel = responseSuggestionService.getResponseTypeLabel(
        ResponseType.REJECT,
        'en'
      );
      expect(rejectLabel).toBe('Reject');
    });

    it('should return counter-proposal label', () => {
      const labelRo = responseSuggestionService.getResponseTypeLabel(
        ResponseType.COUNTER_PROPOSAL,
        'ro'
      );
      expect(labelRo).toBe('Contra-propunere');

      const labelEn = responseSuggestionService.getResponseTypeLabel(
        ResponseType.COUNTER_PROPOSAL,
        'en'
      );
      expect(labelEn).toBe('Counter-Proposal');
    });
  });

  describe('getResponseTypeColor', () => {
    it('should return green for ACCEPT', () => {
      const color = responseSuggestionService.getResponseTypeColor(ResponseType.ACCEPT);
      expect(color).toBe('green');
    });

    it('should return red for REJECT', () => {
      const color = responseSuggestionService.getResponseTypeColor(ResponseType.REJECT);
      expect(color).toBe('red');
    });

    it('should return blue for COUNTER_PROPOSAL', () => {
      const color = responseSuggestionService.getResponseTypeColor(
        ResponseType.COUNTER_PROPOSAL
      );
      expect(color).toBe('blue');
    });

    it('should return yellow for CLARIFICATION', () => {
      const color = responseSuggestionService.getResponseTypeColor(
        ResponseType.CLARIFICATION
      );
      expect(color).toBe('yellow');
    });
  });

  describe('generateAcceptanceLanguage', () => {
    it('should generate acceptance text', async () => {
      const result = await responseSuggestionService.generateAcceptanceLanguage(
        mockChange,
        'ro',
        mockDocumentContext
      );

      expect(result.suggestionType).toBe(ResponseType.ACCEPT);
      expect(result.suggestedText).toBeDefined();
      expect(result.suggestedText.length).toBeGreaterThan(0);
    });
  });

  describe('generateRejectionLanguage', () => {
    it('should generate rejection text with reason', async () => {
      const reason = 'The change removes important protections.';
      const result = await responseSuggestionService.generateRejectionLanguage(
        mockChange,
        reason,
        'ro',
        mockDocumentContext
      );

      expect(result.suggestionType).toBe(ResponseType.REJECT);
      expect(result.suggestedText).toBeDefined();
      expect(result.reasoning).toBe(reason);
    });
  });

  describe('generateCounterProposal', () => {
    it('should generate counter-proposal as CLIENT', async () => {
      const result = await responseSuggestionService.generateCounterProposal(
        mockChange,
        PartyRole.CLIENT,
        'ro',
        mockDocumentContext
      );

      expect(result.suggestionType).toBe(ResponseType.COUNTER_PROPOSAL);
      expect(result.suggestedText).toBeDefined();
    });

    it('should generate counter-proposal as OPPOSING', async () => {
      const result = await responseSuggestionService.generateCounterProposal(
        mockChange,
        PartyRole.OPPOSING,
        'ro',
        mockDocumentContext
      );

      expect(result.suggestionType).toBe(ResponseType.COUNTER_PROPOSAL);
      expect(result.suggestedText).toBeDefined();
    });
  });
});
