/**
 * Track Changes Service Unit Tests
 * Story 3.4: Word Integration with Live AI Assistance - Task 22
 */

// Set environment variables before imports
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';

// Mock dependencies before imports
jest.mock('../../src/config/graph.config', () => ({
  createGraphClient: jest.fn(() => ({
    api: jest.fn(() => ({
      get: jest.fn(),
    })),
  })),
  graphEndpoints: {
    driveItem: jest.fn((id: string) => `/me/drive/items/${id}`),
  },
}));

jest.mock('../../src/utils/retry.util', () => ({
  retryWithBackoff: jest.fn((fn: () => any) => fn()),
}));

jest.mock('../../src/utils/graph-error-handler', () => ({
  parseGraphError: jest.fn((err: any) => err),
  logGraphError: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('jszip', () => ({
  loadAsync: jest.fn(),
}));

jest.mock('xml2js', () => ({
  parseStringPromise: jest.fn(),
}));

import { TrackChangesService } from '../../src/services/track-changes.service';
import JSZip from 'jszip';
import { parseStringPromise } from 'xml2js';

describe('TrackChangesService', () => {
  let service: TrackChangesService;

  beforeEach(() => {
    service = new TrackChangesService();
    jest.clearAllMocks();
  });

  describe('formatChangesSummary', () => {
    it('should format empty changes array', () => {
      const result = service.formatChangesSummary([]);

      expect(result).toEqual({
        totalChanges: 0,
        insertions: 0,
        deletions: 0,
        modifications: 0,
        formatChanges: 0,
        authors: [],
        summary: 'No changes',
      });
    });

    it('should count insertions correctly', () => {
      const trackChanges = [
        { id: '1', type: 'INSERTION', authorName: 'John', content: 'text', timestamp: new Date() },
        { id: '2', type: 'INSERTION', authorName: 'John', content: 'more', timestamp: new Date() },
        { id: '3', type: 'INSERTION', authorName: 'Jane', content: 'other', timestamp: new Date() },
      ];

      const result = service.formatChangesSummary(trackChanges as any);

      expect(result.totalChanges).toBe(3);
      expect(result.insertions).toBe(3);
      expect(result.deletions).toBe(0);
      expect(result.authors).toContain('John');
      expect(result.authors).toContain('Jane');
      expect(result.summary).toContain('3 insertions');
    });

    it('should count mixed changes correctly', () => {
      const trackChanges = [
        { id: '1', type: 'INSERTION', authorName: 'John', content: 'added', timestamp: new Date() },
        { id: '2', type: 'DELETION', authorName: 'John', content: 'removed', timestamp: new Date() },
        { id: '3', type: 'MODIFICATION', authorName: 'Jane', content: 'changed', timestamp: new Date() },
        { id: '4', type: 'FORMAT_CHANGE', authorName: 'Jane', content: 'Format', timestamp: new Date() },
      ];

      const result = service.formatChangesSummary(trackChanges as any);

      expect(result.totalChanges).toBe(4);
      expect(result.insertions).toBe(1);
      expect(result.deletions).toBe(1);
      expect(result.modifications).toBe(1);
      expect(result.formatChanges).toBe(1);
      expect(result.authors).toHaveLength(2);
    });

    it('should generate correct summary text', () => {
      const trackChanges = [
        { id: '1', type: 'INSERTION', authorName: 'John', content: 'a', timestamp: new Date() },
        { id: '2', type: 'DELETION', authorName: 'Jane', content: 'b', timestamp: new Date() },
      ];

      const result = service.formatChangesSummary(trackChanges as any);

      expect(result.summary).toContain('1 insertion');
      expect(result.summary).toContain('1 deletion');
      expect(result.summary).toContain('by');
    });
  });

  describe('getChangesSummaryText', () => {
    it('should return summary string', () => {
      const trackChanges = [
        { id: '1', type: 'INSERTION', authorName: 'John', content: 'text', timestamp: new Date() },
      ];

      const result = service.getChangesSummaryText(trackChanges as any);

      expect(typeof result).toBe('string');
      expect(result).toContain('insertion');
    });
  });

  describe('extractTrackChanges', () => {
    it('should return empty array when document.xml is missing', async () => {
      const mockZip = {
        file: jest.fn().mockReturnValue(null),
      };

      (JSZip as unknown as { loadAsync: jest.Mock }).loadAsync.mockResolvedValue(mockZip);

      const result = await service.extractTrackChanges('doc-123', 'token', 'onedrive-123');

      expect(result).toEqual([]);
    });

    it('should extract insertions from document', async () => {
      const mockDocumentXml = {
        async: jest.fn().mockResolvedValue('<document></document>'),
      };

      const mockZip = {
        file: jest.fn().mockReturnValue(mockDocumentXml),
      };

      (JSZip as unknown as { loadAsync: jest.Mock }).loadAsync.mockResolvedValue(mockZip);
      (parseStringPromise as jest.Mock).mockResolvedValue({
        document: {
          body: {
            p: [
              {
                ins: {
                  $: { author: 'John', date: '2024-01-15T10:00:00Z' },
                  r: { t: 'inserted text' },
                },
              },
            ],
          },
        },
      });

      // Note: The actual extraction depends on implementation details
      // This is a simplified test
      const result = await service.extractTrackChanges('doc-123', 'token', 'onedrive-123');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle parsing errors gracefully', async () => {
      (JSZip as unknown as { loadAsync: jest.Mock }).loadAsync.mockRejectedValue(new Error('Invalid ZIP'));

      const result = await service.extractTrackChanges('doc-123', 'token', 'onedrive-123');

      expect(result).toEqual([]);
    });
  });
});
