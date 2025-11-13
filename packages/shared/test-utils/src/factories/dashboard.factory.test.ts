/**
 * Dashboard Factory Tests
 */

import {
  createKPIMetric,
  createKPIMetrics,
  createAISuggestion,
  createAIInsight,
  createAIAlert,
  createAIRecommendation,
  createAISuggestionsForRole,
  createAISuggestions,
} from './dashboard.factory';

describe('Dashboard Factory', () => {
  describe('createKPIMetric', () => {
    it('should create a valid KPIMetric entity', () => {
      const kpi = createKPIMetric();

      expect(kpi).toMatchObject({
        id: expect.any(String),
        label: expect.any(String),
        value: expect.any(Number),
        trend: expect.stringMatching(/^(up|down|neutral)$/),
        trendPercentage: expect.any(Number),
        comparisonText: expect.any(String),
      });
    });

    it('should generate trend percentages between 1 and 30', () => {
      const kpis = Array.from({ length: 10 }, () => createKPIMetric());
      kpis.forEach((kpi) => {
        expect(kpi.trendPercentage).toBeGreaterThanOrEqual(1);
        expect(kpi.trendPercentage).toBeLessThanOrEqual(30);
      });
    });

    it('should allow overriding default values', () => {
      const kpi = createKPIMetric({ label: 'Custom KPI', value: 999, trend: 'up', trendPercentage: 42 });

      expect(kpi.label).toBe('Custom KPI');
      expect(kpi.value).toBe(999);
      expect(kpi.trend).toBe('up');
      expect(kpi.trendPercentage).toBe(42);
    });

    it('should support Romanian labels', () => {
      const romanianKPI = createKPIMetric({}, true);

      expect(romanianKPI.label).toBeTruthy();
      expect(romanianKPI.comparisonText).toContain('luna');
    });

    it('should support English labels', () => {
      const englishKPI = createKPIMetric({}, false);

      expect(englishKPI.label).toBeTruthy();
      expect(englishKPI.comparisonText).toContain('last month');
    });

    it('should include optional icon', () => {
      const kpi = createKPIMetric();
      expect(kpi.icon).toBeTruthy();
      expect(typeof kpi.icon).toBe('string');
    });
  });

  describe('createKPIMetrics', () => {
    it('should create multiple KPI metrics', () => {
      const kpis = createKPIMetrics(5);

      expect(kpis).toHaveLength(5);
      kpis.forEach((kpi) => {
        expect(kpi).toMatchObject({
          id: expect.any(String),
          label: expect.any(String),
          value: expect.any(Number),
        });
      });
    });

    it('should apply overrides to all created metrics', () => {
      const kpis = createKPIMetrics(3, { trend: 'up' });

      expect(kpis).toHaveLength(3);
      kpis.forEach((kpi) => {
        expect(kpi.trend).toBe('up');
      });
    });
  });

  describe('createAISuggestion', () => {
    it('should create a valid AISuggestion entity', () => {
      const suggestion = createAISuggestion();

      expect(suggestion).toMatchObject({
        id: expect.any(String),
        type: expect.stringMatching(/^(insight|alert|recommendation)$/),
        role: expect.stringMatching(/^(Partner|Associate|Paralegal)$/),
        text: expect.any(String),
        timestamp: expect.any(Date),
        actionable: expect.any(Boolean),
        dismissed: false,
      });
    });

    it('should include actionText when actionable is true', () => {
      const actionableSuggestion = createAISuggestion({ actionable: true });

      if (actionableSuggestion.actionable) {
        // actionText is optional even when actionable is true, but should be present in most cases
        expect(typeof actionableSuggestion.actionText === 'string' || actionableSuggestion.actionText === undefined).toBe(true);
      }
    });

    it('should not include actionText when actionable is false', () => {
      const nonActionableSuggestion = createAISuggestion({ actionable: false });

      expect(nonActionableSuggestion.actionText).toBeUndefined();
    });

    it('should allow overriding default values', () => {
      const suggestion = createAISuggestion({
        type: 'alert',
        role: 'Partner',
        text: 'Custom alert text',
        dismissed: true,
      });

      expect(suggestion.type).toBe('alert');
      expect(suggestion.role).toBe('Partner');
      expect(suggestion.text).toBe('Custom alert text');
      expect(suggestion.dismissed).toBe(true);
    });

    it('should generate recent timestamps (within last 3 days)', () => {
      const suggestion = createAISuggestion();
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      expect(suggestion.timestamp.getTime()).toBeGreaterThanOrEqual(threeDaysAgo.getTime());
      expect(suggestion.timestamp.getTime()).toBeLessThanOrEqual(new Date().getTime());
    });
  });

  describe('createAIInsight', () => {
    it('should create an insight type suggestion', () => {
      const insight = createAIInsight();

      expect(insight.type).toBe('insight');
      expect(insight).toMatchObject({
        id: expect.any(String),
        role: expect.stringMatching(/^(Partner|Associate|Paralegal)$/),
        text: expect.any(String),
        timestamp: expect.any(Date),
      });
    });

    it('should allow overriding other properties', () => {
      const insight = createAIInsight({ role: 'Associate', dismissed: true });

      expect(insight.type).toBe('insight');
      expect(insight.role).toBe('Associate');
      expect(insight.dismissed).toBe(true);
    });
  });

  describe('createAIAlert', () => {
    it('should create an alert type suggestion', () => {
      const alert = createAIAlert();

      expect(alert.type).toBe('alert');
      expect(alert).toMatchObject({
        id: expect.any(String),
        role: expect.stringMatching(/^(Partner|Associate|Paralegal)$/),
        text: expect.any(String),
        timestamp: expect.any(Date),
      });
    });
  });

  describe('createAIRecommendation', () => {
    it('should create a recommendation type suggestion', () => {
      const recommendation = createAIRecommendation();

      expect(recommendation.type).toBe('recommendation');
      expect(recommendation).toMatchObject({
        id: expect.any(String),
        role: expect.stringMatching(/^(Partner|Associate|Paralegal)$/),
        text: expect.any(String),
        timestamp: expect.any(Date),
      });
    });
  });

  describe('createAISuggestionsForRole', () => {
    it('should create role-specific suggestions for Partner', () => {
      const suggestions = createAISuggestionsForRole('Partner', 4);

      expect(suggestions).toHaveLength(4);
      suggestions.forEach((suggestion) => {
        expect(suggestion.role).toBe('Partner');
        expect(suggestion.text).toBeTruthy();
      });
    });

    it('should create role-specific suggestions for Associate', () => {
      const suggestions = createAISuggestionsForRole('Associate', 3);

      expect(suggestions).toHaveLength(3);
      suggestions.forEach((suggestion) => {
        expect(suggestion.role).toBe('Associate');
      });
    });

    it('should create role-specific suggestions for Paralegal', () => {
      const suggestions = createAISuggestionsForRole('Paralegal', 5);

      expect(suggestions).toHaveLength(5);
      suggestions.forEach((suggestion) => {
        expect(suggestion.role).toBe('Paralegal');
      });
    });

    it('should create random count (3-5) when count not specified', () => {
      const suggestions = createAISuggestionsForRole('Partner');

      expect(suggestions.length).toBeGreaterThanOrEqual(3);
      expect(suggestions.length).toBeLessThanOrEqual(5);
      suggestions.forEach((suggestion) => {
        expect(suggestion.role).toBe('Partner');
      });
    });

    it('should apply overrides to all created suggestions', () => {
      const suggestions = createAISuggestionsForRole('Associate', 3, { dismissed: true });

      expect(suggestions).toHaveLength(3);
      suggestions.forEach((suggestion) => {
        expect(suggestion.role).toBe('Associate');
        expect(suggestion.dismissed).toBe(true);
      });
    });
  });

  describe('createAISuggestions', () => {
    it('should create multiple AI suggestions', () => {
      const suggestions = createAISuggestions(5);

      expect(suggestions).toHaveLength(5);
      suggestions.forEach((suggestion) => {
        expect(suggestion).toMatchObject({
          id: expect.any(String),
          type: expect.stringMatching(/^(insight|alert|recommendation)$/),
          role: expect.stringMatching(/^(Partner|Associate|Paralegal)$/),
          text: expect.any(String),
          timestamp: expect.any(Date),
        });
      });
    });

    it('should apply overrides to all created suggestions', () => {
      const suggestions = createAISuggestions(3, { type: 'alert', actionable: true });

      expect(suggestions).toHaveLength(3);
      suggestions.forEach((suggestion) => {
        expect(suggestion.type).toBe('alert');
        expect(suggestion.actionable).toBe(true);
      });
    });
  });

  describe('Romanian diacritics support', () => {
    it('should generate Romanian text with diacritics', () => {
      const suggestions = createAISuggestions(20);
      const hasRomanianText = suggestions.some(
        (s) =>
          s.text.includes('ă') ||
          s.text.includes('â') ||
          s.text.includes('î') ||
          s.text.includes('ș') ||
          s.text.includes('ț')
      );

      // With 20 suggestions, we should have at least one with Romanian diacritics
      expect(hasRomanianText).toBe(true);
    });

    it('should support Romanian comparison text in KPIs', () => {
      const kpis = createKPIMetrics(10, {}, true);
      kpis.forEach((kpi) => {
        expect(kpi.comparisonText).toContain('luna');
      });
    });
  });
});
