/**
 * Token Tracker Service Unit Tests
 * Story 3.1: AI Service Infrastructure
 */

import { TokenTrackerService } from './token-tracker.service';
import { ClaudeModel } from '@legal-platform/types';

describe('TokenTrackerService', () => {
  let tracker: TokenTrackerService;

  beforeEach(() => {
    tracker = new TokenTrackerService();
  });

  describe('calculateCost', () => {
    it('should calculate cost for Haiku model', () => {
      // Haiku: $0.25/$1.25 per 1M input/output tokens = 25/125 cents per 1M
      // 1000 input + 500 output
      // Input: (1000 / 1_000_000) * 25 = 0.025 cents
      // Output: (500 / 1_000_000) * 125 = 0.0625 cents
      // Total: ~0 cents (rounds down)
      const cost = tracker.calculateCost(ClaudeModel.Haiku, 1000, 500);
      expect(cost).toBe(0);
    });

    it('should calculate cost for Haiku with larger token counts', () => {
      // 100,000 input + 50,000 output
      // Input: (100_000 / 1_000_000) * 25 = 2.5 cents
      // Output: (50_000 / 1_000_000) * 125 = 6.25 cents
      // Total: 8.75 cents = 9 cents (rounded)
      const cost = tracker.calculateCost(ClaudeModel.Haiku, 100000, 50000);
      expect(cost).toBe(9);
    });

    it('should calculate cost for Sonnet model', () => {
      // Sonnet: $3/$15 per 1M input/output tokens = 300/1500 cents per 1M
      // 10,000 input + 5,000 output
      // Input: (10_000 / 1_000_000) * 300 = 3 cents
      // Output: (5_000 / 1_000_000) * 1500 = 7.5 cents
      // Total: 10.5 cents = 11 cents (rounded)
      const cost = tracker.calculateCost(ClaudeModel.Sonnet, 10000, 5000);
      expect(cost).toBe(11);
    });

    it('should calculate cost for Opus model', () => {
      // Opus: $15/$75 per 1M input/output tokens = 1500/7500 cents per 1M
      // 10,000 input + 5,000 output
      // Input: (10_000 / 1_000_000) * 1500 = 15 cents
      // Output: (5_000 / 1_000_000) * 7500 = 37.5 cents
      // Total: 52.5 cents = 53 cents (rounded)
      const cost = tracker.calculateCost(ClaudeModel.Opus, 10000, 5000);
      expect(cost).toBe(53);
    });

    it('should handle model variants containing haiku', () => {
      const cost = tracker.calculateCost('claude-3-haiku-20240307', 100000, 50000);
      expect(cost).toBe(9);
    });

    it('should handle model variants containing sonnet', () => {
      const cost = tracker.calculateCost('claude-3-5-sonnet-20241022', 10000, 5000);
      expect(cost).toBe(11);
    });

    it('should handle model variants containing opus', () => {
      const cost = tracker.calculateCost('claude-3-opus-20240229', 10000, 5000);
      expect(cost).toBe(53);
    });

    it('should default to Sonnet pricing for unknown models', () => {
      const cost = tracker.calculateCost('unknown-model', 10000, 5000);
      expect(cost).toBe(11); // Same as Sonnet
    });

    it('should return 0 for zero tokens', () => {
      const cost = tracker.calculateCost(ClaudeModel.Sonnet, 0, 0);
      expect(cost).toBe(0);
    });
  });
});
