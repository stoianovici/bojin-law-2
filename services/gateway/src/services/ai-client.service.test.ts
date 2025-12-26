/**
 * AI Client Service Tests
 * OPS-233: AI Call Wrapper with Usage Logging
 */

import { calculateCostEur } from './ai-client.service';

describe('AIClientService', () => {
  describe('calculateCostEur', () => {
    it('calculates cost for Haiku model correctly', () => {
      // Haiku: input $0.25/1M -> €0.23/1M, output $1.25/1M -> €1.15/1M
      const cost = calculateCostEur('claude-3-haiku-20240307', 1000, 500);
      // (1000 * 0.23 + 500 * 1.15) / 1_000_000 = 0.000805
      expect(cost).toBeCloseTo(0.000805, 6);
    });

    it('calculates cost for Sonnet model correctly', () => {
      // Sonnet: input $3/1M -> €2.76/1M, output $15/1M -> €13.8/1M
      const cost = calculateCostEur('claude-sonnet-4-20250514', 10000, 2000);
      // (10000 * 2.76 + 2000 * 13.8) / 1_000_000 = 0.05520
      expect(cost).toBeCloseTo(0.0552, 6);
    });

    it('calculates cost for Opus model correctly', () => {
      // Opus: input $15/1M -> €13.8/1M, output $75/1M -> €69/1M
      const cost = calculateCostEur('claude-3-opus-20240229', 5000, 1000);
      // (5000 * 13.8 + 1000 * 69) / 1_000_000 = 0.138
      expect(cost).toBeCloseTo(0.138, 6);
    });

    it('calculates cost for Haiku 3.5 correctly', () => {
      // Haiku 3.5: input $0.80/1M -> €0.74/1M, output $4/1M -> €3.68/1M
      const cost = calculateCostEur('claude-3-5-haiku-20241022', 2000, 1000);
      // (2000 * 0.74 + 1000 * 3.68) / 1_000_000 = 0.00516
      expect(cost).toBeCloseTo(0.00516, 6);
    });

    it('uses default costs for unknown models', () => {
      // Unknown model should use Sonnet pricing as fallback
      const cost = calculateCostEur('unknown-model-xyz', 1000, 500);
      // (1000 * 2.76 + 500 * 13.8) / 1_000_000 = 0.00966
      expect(cost).toBeCloseTo(0.00966, 6);
    });

    it('returns zero for zero tokens', () => {
      const cost = calculateCostEur('claude-sonnet-4-20250514', 0, 0);
      expect(cost).toBe(0);
    });

    it('handles large token counts correctly', () => {
      // 1 million input tokens + 500k output tokens with Sonnet
      const cost = calculateCostEur('claude-sonnet-4-20250514', 1_000_000, 500_000);
      // (1_000_000 * 2.76 + 500_000 * 13.8) / 1_000_000 = 2.76 + 6.9 = 9.66
      expect(cost).toBeCloseTo(9.66, 2);
    });
  });
});
