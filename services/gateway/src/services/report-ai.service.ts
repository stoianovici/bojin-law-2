/**
 * Report AI Service
 * OPS-152: AI-generated narrative insights for reports
 *
 * Generates Romanian-language insights from report data using AI.
 * Caches results in Redis with 5-minute TTL.
 */

import { redis } from '@legal-platform/database';
import { aiService, GenerateRequest } from './ai.service';
import type {
  ReportAIInsight,
  PredefinedReportTemplate,
  DateRange,
  ReportData,
} from '@legal-platform/types';
import { AIOperationType, TaskComplexity, ClaudeModel } from '@legal-platform/types';
import { getModelForFeature } from './ai-client.service';
import logger from '../utils/logger';

// Map model ID to ClaudeModel enum
function modelIdToClaudeModel(modelId: string): ClaudeModel {
  const enumValues = Object.values(ClaudeModel) as string[];
  if (enumValues.includes(modelId)) return modelId as ClaudeModel;
  if (modelId.includes('haiku')) return ClaudeModel.Haiku;
  if (modelId.includes('opus')) return ClaudeModel.Opus;
  return ClaudeModel.Sonnet;
}

// ============================================================================
// Types
// ============================================================================

interface InsightCacheEntry {
  insight: ReportAIInsight;
  cachedAt: string;
}

export interface GenerateInsightParams {
  reportData: ReportData;
  template: PredefinedReportTemplate;
  dateRange: DateRange;
  firmId: string;
  userId?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL = 5 * 60; // 5 minutes in seconds
const CACHE_KEY_PREFIX = 'report-insight:';

const REPORT_INSIGHT_SYSTEM_PROMPT = `Ești un analist juridic AI pentru o firmă de avocatură din România.
Analizezi datele din rapoarte și oferi perspective strategice.

IMPORTANT: Răspunde DOAR în limba română. Toate rezumatele, concluziile și recomandările trebuie să fie în română.

Analizezi datele pentru a oferi:

1. REZUMAT: Un paragraf concis care descrie tendințele principale și situația actuală.

2. CONCLUZII CHEIE: 3-5 observații importante extrase din date.
   - Fii specific și citează numere când e relevant
   - Evidențiază tendințe pozitive și negative
   - Notează anomalii sau puncte de atenție

3. RECOMANDĂRI: 2-4 sugestii practice bazate pe analiză.
   - Fii concret și acționabil
   - Prioritizează după impact
   - Consideră contextul juridic românesc

Răspunde DOAR cu JSON valid în acest format exact:
{
  "summary": "Rezumatul analizei...",
  "keyFindings": [
    "Prima constatare importantă...",
    "A doua constatare..."
  ],
  "recommendations": [
    "Prima recomandare...",
    "A doua recomandare..."
  ],
  "confidence": 0.85
}

Notă: confidence este un număr între 0 și 1 care reflectă încrederea în analiză bazată pe calitatea și completitudinea datelor.`;

// ============================================================================
// Service
// ============================================================================

export class ReportAIService {
  /**
   * Generate AI insight for a report
   */
  async generateInsight(params: GenerateInsightParams): Promise<ReportAIInsight> {
    const { reportData, template, dateRange, firmId, userId } = params;

    // Build cache key from report ID and date range
    const cacheKey = this.buildCacheKey(
      reportData.reportId,
      dateRange.start,
      dateRange.end,
      firmId
    );

    // Try cache first
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      logger.debug('Report insight cache hit', { reportId: reportData.reportId });
      return cached;
    }

    // Generate fresh insight
    logger.debug('Report insight cache miss, generating', { reportId: reportData.reportId });
    const insight = await this.callAI(reportData, template, dateRange, firmId, userId);

    // Cache it
    await this.saveToCache(cacheKey, insight);

    return insight;
  }

  /**
   * Invalidate cached insight for a report
   */
  async invalidate(reportId: string, firmId: string): Promise<void> {
    const pattern = `${CACHE_KEY_PREFIX}${firmId}:${reportId}:*`;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug('Report insight cache invalidated', { reportId, count: keys.length });
      }
    } catch (error) {
      logger.warn('Failed to invalidate report insight cache', { reportId, error });
    }
  }

  /**
   * Invalidate all cached insights for a firm
   */
  async invalidateAllForFirm(firmId: string): Promise<void> {
    const pattern = `${CACHE_KEY_PREFIX}${firmId}:*`;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug('Report insight cache invalidated for firm', { firmId, count: keys.length });
      }
    } catch (error) {
      logger.warn('Failed to invalidate firm report insight cache', { firmId, error });
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build cache key from report parameters
   */
  private buildCacheKey(reportId: string, startDate: Date, endDate: Date, firmId: string): string {
    const start = startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate;
    const end = endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate;
    return `${CACHE_KEY_PREFIX}${firmId}:${reportId}:${start}:${end}`;
  }

  /**
   * Get cached insight from Redis
   */
  private async getFromCache(cacheKey: string): Promise<ReportAIInsight | null> {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const entry: InsightCacheEntry = JSON.parse(cached);
        return entry.insight;
      }
    } catch (error) {
      logger.warn('Failed to read report insight from cache', { cacheKey, error });
    }
    return null;
  }

  /**
   * Save insight to Redis cache
   */
  private async saveToCache(cacheKey: string, insight: ReportAIInsight): Promise<void> {
    const entry: InsightCacheEntry = {
      insight,
      cachedAt: new Date().toISOString(),
    };

    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(entry));
    } catch (error) {
      logger.warn('Failed to cache report insight', { cacheKey, error });
    }
  }

  /**
   * Call AI service to generate insight
   */
  private async callAI(
    reportData: ReportData,
    template: PredefinedReportTemplate,
    dateRange: DateRange,
    firmId: string,
    userId?: string
  ): Promise<ReportAIInsight> {
    const startTime = Date.now();

    // Format date range for prompt
    const startStr = this.formatDate(dateRange.start);
    const endStr = this.formatDate(dateRange.end);

    // Build the prompt with template and data
    const prompt = this.buildPrompt(reportData, template, startStr, endStr);

    // Get configured model for document_extraction feature (used for reports)
    const modelId = await getModelForFeature(firmId, 'document_extraction');
    const modelOverride = modelIdToClaudeModel(modelId);

    try {
      const request: GenerateRequest = {
        prompt,
        systemPrompt: REPORT_INSIGHT_SYSTEM_PROMPT,
        operationType: AIOperationType.LegalAnalysis,
        complexity: TaskComplexity.Standard,
        modelOverride,
        maxTokens: 1500,
        temperature: 0.4,
        firmId,
        userId,
        useCache: false, // We handle caching ourselves
      };

      const response = await aiService.generate(request);
      const parsed = this.parseAIResponse(response.content);

      logger.info('Report insight generated', {
        reportId: reportData.reportId,
        durationMs: Date.now() - startTime,
        tokensUsed: response.totalTokens,
      });

      return parsed;
    } catch (error) {
      logger.error('Failed to generate report insight', {
        reportId: reportData.reportId,
        error,
      });

      // Return fallback insight on error
      return this.createFallbackInsight();
    }
  }

  /**
   * Build prompt for AI
   */
  private buildPrompt(
    reportData: ReportData,
    template: PredefinedReportTemplate,
    startDate: string,
    endDate: string
  ): string {
    // Format data points for prompt
    const dataPoints = reportData.data
      .map((point) => `- ${point.label}: ${point.value}`)
      .join('\n');

    // Include summary if available
    const summarySection = reportData.summary
      ? `
Rezumat date:
- Total: ${reportData.summary.totalValue}
- Medie: ${reportData.summary.averageValue}
${reportData.summary.changeFromPrevious !== undefined ? `- Variație față de perioada anterioară: ${reportData.summary.changeFromPrevious > 0 ? '+' : ''}${reportData.summary.changeFromPrevious}%` : ''}
${reportData.summary.trendDirection ? `- Tendință: ${this.translateTrend(reportData.summary.trendDirection)}` : ''}`
      : '';

    // Use template prompt if available, otherwise generate standard prompt
    const basePrompt =
      template.aiPromptTemplate || `Analizează datele pentru raportul "${template.nameRo}".`;

    return `${basePrompt}

Perioada: ${startDate} - ${endDate}
Categorie: ${template.categoryId}

Date raport:
${dataPoints}
${summarySection}

Analizează aceste date și oferă perspective strategice pentru firma de avocatură.`;
  }

  /**
   * Parse AI response JSON
   */
  private parseAIResponse(content: string): ReportAIInsight {
    try {
      // Extract JSON from response (may be wrapped in markdown)
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonContent);

      return {
        summary:
          typeof parsed.summary === 'string' ? parsed.summary : 'Nu s-a putut genera rezumatul.',
        keyFindings: Array.isArray(parsed.keyFindings)
          ? parsed.keyFindings.filter((f: unknown) => typeof f === 'string')
          : [],
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations.filter((r: unknown) => typeof r === 'string')
          : [],
        generatedAt: new Date(),
        confidence:
          typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      };
    } catch (error) {
      logger.warn('Failed to parse AI response for report insight', { error });
      return this.createFallbackInsight();
    }
  }

  /**
   * Create fallback insight when AI fails
   */
  private createFallbackInsight(): ReportAIInsight {
    return {
      summary: 'Nu s-a putut genera analiza automată. Vă rugăm să încercați din nou.',
      keyFindings: [],
      recommendations: [],
      generatedAt: new Date(),
      confidence: 0,
    };
  }

  /**
   * Format date to Romanian locale string
   */
  private formatDate(date: Date): string {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return String(date);
    }
    return date.toLocaleDateString('ro-RO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Translate trend direction to Romanian
   */
  private translateTrend(trend: 'up' | 'down' | 'stable'): string {
    const translations: Record<string, string> = {
      up: 'în creștere',
      down: 'în scădere',
      stable: 'stabil',
    };
    return translations[trend] || trend;
  }
}

// Export singleton instance
export const reportAIService = new ReportAIService();
