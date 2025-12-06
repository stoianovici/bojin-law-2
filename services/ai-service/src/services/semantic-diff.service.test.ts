/**
 * Semantic Diff Service Tests
 * Story 3.5: Semantic Version Control System - Task 15
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { semanticDiffService } from './semantic-diff.service';
import { ChangeType, ChangeSignificance, RiskLevel } from '@legal-platform/types';

// Mock provider manager
vi.mock('./provider-manager.service', () => ({
  providerManager: {
    execute: vi.fn(),
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

describe('SemanticDiffService', () => {
  const mockDocumentContext = {
    documentId: 'doc-123',
    documentType: 'contract',
    language: 'ro' as const,
    firmId: 'firm-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeSemanticDiff', () => {
    it('should detect added text', async () => {
      const beforeText = 'Original contract text.';
      const afterText = 'Original contract text. New clause added here.';

      const result = await semanticDiffService.computeSemanticDiff(
        beforeText,
        afterText,
        'doc-123',
        'version-1',
        'version-2',
        mockDocumentContext
      );

      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.documentId).toBe('doc-123');
      expect(result.fromVersionId).toBe('version-1');
      expect(result.toVersionId).toBe('version-2');
    });

    it('should detect removed text', async () => {
      const beforeText = 'Original contract text with important clause.';
      const afterText = 'Original contract text.';

      const result = await semanticDiffService.computeSemanticDiff(
        beforeText,
        afterText,
        'doc-123',
        'version-1',
        'version-2',
        mockDocumentContext
      );

      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.changes.some((c) => c.changeType === ChangeType.REMOVED)).toBe(true);
    });

    it('should detect modified text', async () => {
      const beforeText = 'Payment due within 30 days.';
      const afterText = 'Payment due within 60 days.';

      const result = await semanticDiffService.computeSemanticDiff(
        beforeText,
        afterText,
        'doc-123',
        'version-1',
        'version-2',
        mockDocumentContext
      );

      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.changes.some((c) => c.changeType === ChangeType.MODIFIED)).toBe(true);
    });

    it('should return empty changes for identical text', async () => {
      const text = 'Identical contract text.';

      const result = await semanticDiffService.computeSemanticDiff(
        text,
        text,
        'doc-123',
        'version-1',
        'version-2',
        mockDocumentContext
      );

      expect(result.changes.length).toBe(0);
      expect(result.totalChanges).toBe(0);
    });

    it('should compute change breakdown correctly', async () => {
      const beforeText = 'Simple text.';
      const afterText = 'Simple modified text with additions.';

      const result = await semanticDiffService.computeSemanticDiff(
        beforeText,
        afterText,
        'doc-123',
        'version-1',
        'version-2',
        mockDocumentContext
      );

      expect(result.changeBreakdown).toBeDefined();
      expect(typeof result.changeBreakdown.formatting).toBe('number');
      expect(typeof result.changeBreakdown.minorWording).toBe('number');
      expect(typeof result.changeBreakdown.substantive).toBe('number');
      expect(typeof result.changeBreakdown.critical).toBe('number');
    });

    it('should handle empty before text', async () => {
      const beforeText = '';
      const afterText = 'New document content.';

      const result = await semanticDiffService.computeSemanticDiff(
        beforeText,
        afterText,
        'doc-123',
        'version-1',
        'version-2',
        mockDocumentContext
      );

      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.changes.every((c) => c.changeType === ChangeType.ADDED)).toBe(true);
    });

    it('should handle empty after text', async () => {
      const beforeText = 'Existing document content.';
      const afterText = '';

      const result = await semanticDiffService.computeSemanticDiff(
        beforeText,
        afterText,
        'doc-123',
        'version-1',
        'version-2',
        mockDocumentContext
      );

      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.changes.every((c) => c.changeType === ChangeType.REMOVED)).toBe(true);
    });
  });

  describe('classifyChangeSignificance', () => {
    it('should classify formatting changes as FORMATTING', () => {
      const beforeText = 'Text without formatting';
      const afterText = 'Text  without   formatting'; // Extra spaces

      const significance = semanticDiffService.classifyChangeSignificance(
        beforeText,
        afterText,
        ChangeType.MODIFIED
      );

      expect(significance).toBe(ChangeSignificance.FORMATTING);
    });

    it('should classify minor word changes as MINOR_WORDING', () => {
      const beforeText = 'The quick brown fox';
      const afterText = 'A quick brown fox';

      const significance = semanticDiffService.classifyChangeSignificance(
        beforeText,
        afterText,
        ChangeType.MODIFIED
      );

      expect(significance).toBe(ChangeSignificance.MINOR_WORDING);
    });

    it('should classify substantive changes correctly', () => {
      const beforeText = 'Payment within 30 days';
      const afterText = 'Payment within 90 days';

      const significance = semanticDiffService.classifyChangeSignificance(
        beforeText,
        afterText,
        ChangeType.MODIFIED
      );

      expect([ChangeSignificance.SUBSTANTIVE, ChangeSignificance.CRITICAL]).toContain(
        significance
      );
    });

    it('should classify large removals as CRITICAL', () => {
      const beforeText = 'This is a very important liability limitation clause that protects the party from damages exceeding the contract value.';
      const afterText = '';

      const significance = semanticDiffService.classifyChangeSignificance(
        beforeText,
        afterText,
        ChangeType.REMOVED
      );

      expect(significance).toBe(ChangeSignificance.CRITICAL);
    });
  });

  describe('normalizeText', () => {
    it('should normalize whitespace', () => {
      const input = 'Text  with   multiple    spaces';
      const normalized = semanticDiffService.normalizeText(input);
      expect(normalized).toBe('text with multiple spaces');
    });

    it('should convert to lowercase', () => {
      const input = 'UPPERCASE TEXT';
      const normalized = semanticDiffService.normalizeText(input);
      expect(normalized).toBe('uppercase text');
    });

    it('should trim whitespace', () => {
      const input = '  text with spaces around  ';
      const normalized = semanticDiffService.normalizeText(input);
      expect(normalized).toBe('text with spaces around');
    });

    it('should handle empty string', () => {
      const normalized = semanticDiffService.normalizeText('');
      expect(normalized).toBe('');
    });
  });

  describe('parseSections', () => {
    it('should parse numbered sections', () => {
      const text = `1. First Section
This is the first section content.

2. Second Section
This is the second section content.`;

      const sections = semanticDiffService.parseSections(text);

      expect(sections.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle articles', () => {
      const text = `Article I: Introduction
Introduction content here.

Article II: Obligations
Obligations content here.`;

      const sections = semanticDiffService.parseSections(text);

      expect(sections.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle text without sections', () => {
      const text = 'Simple paragraph without any section markers.';

      const sections = semanticDiffService.parseSections(text);

      expect(sections.length).toBeGreaterThanOrEqual(1);
    });
  });
});
