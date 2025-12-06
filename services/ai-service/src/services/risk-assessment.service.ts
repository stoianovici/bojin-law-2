/**
 * Risk Assessment Service
 * Story 3.5: Semantic Version Control System
 *
 * Assesses the risk level of document changes
 * Calculates aggregate risk for document versions
 */

import {
  RiskLevel,
  LegalChange,
  LegalChangeType,
  ChangeSignificance,
  DocumentContext,
  AggregateRiskResult,
  ClaudeModel,
  AIOperationType,
} from '@legal-platform/types';
import { providerManager } from './provider-manager.service';
import { tokenTracker } from './token-tracker.service';
import logger from '../lib/logger';

// Risk weights by change type
const CHANGE_TYPE_RISK_WEIGHTS: Record<LegalChangeType, number> = {
  [LegalChangeType.LIABILITY_CHANGE]: 0.95,
  [LegalChangeType.TERMINATION_CHANGE]: 0.85,
  [LegalChangeType.FORCE_MAJEURE_CHANGE]: 0.80,
  [LegalChangeType.AMOUNT_CHANGE]: 0.70,
  [LegalChangeType.PAYMENT_TERMS_CHANGE]: 0.65,
  [LegalChangeType.OBLIGATION_CHANGE]: 0.60,
  [LegalChangeType.SCOPE_CHANGE]: 0.55,
  [LegalChangeType.TERM_MODIFICATION]: 0.50,
  [LegalChangeType.DATE_CHANGE]: 0.40,
  [LegalChangeType.PARTY_CHANGE]: 0.35,
};

// Risk weights by significance
const SIGNIFICANCE_RISK_WEIGHTS: Record<ChangeSignificance, number> = {
  [ChangeSignificance.CRITICAL]: 1.0,
  [ChangeSignificance.SUBSTANTIVE]: 0.7,
  [ChangeSignificance.MINOR_WORDING]: 0.2,
  [ChangeSignificance.FORMATTING]: 0.0,
};

// Risk thresholds
const RISK_THRESHOLDS = {
  HIGH: 0.7,
  MEDIUM: 0.4,
};

export class RiskAssessmentService {
  /**
   * Assess risk for a single legal change
   */
  async assessChangeRisk(
    change: LegalChange,
    context: DocumentContext
  ): Promise<{
    riskLevel: RiskLevel;
    riskScore: number;
    explanation: string;
    factors: string[];
  }> {
    // Calculate base risk score from change type and significance
    const typeWeight = change.legalClassification
      ? CHANGE_TYPE_RISK_WEIGHTS[change.legalClassification] || 0.5
      : 0.5;
    const significanceWeight = SIGNIFICANCE_RISK_WEIGHTS[change.significance] || 0.5;

    const baseRiskScore = (typeWeight + significanceWeight) / 2;

    // For high-risk base scores, use AI for detailed analysis
    if (baseRiskScore >= 0.6) {
      return this.assessWithAI(change, context, baseRiskScore);
    }

    // For lower risk, use rule-based assessment
    return this.assessWithRules(change, baseRiskScore);
  }

  /**
   * Rule-based risk assessment for simpler changes
   */
  private assessWithRules(
    change: LegalChange,
    baseRiskScore: number
  ): {
    riskLevel: RiskLevel;
    riskScore: number;
    explanation: string;
    factors: string[];
  } {
    const factors: string[] = [];

    // Adjust score based on detected patterns
    let adjustedScore = baseRiskScore;

    // Check for monetary amount changes
    const amountPattern = /\b(\d+[.,]?\d*)\s*(lei|ron|euro|eur|usd|\$|€)\b/i;
    const beforeAmount = change.beforeText.match(amountPattern);
    const afterAmount = change.afterText.match(amountPattern);

    if (beforeAmount && afterAmount) {
      const beforeValue = parseFloat(beforeAmount[1].replace(',', '.'));
      const afterValue = parseFloat(afterAmount[1].replace(',', '.'));
      const percentChange = Math.abs((afterValue - beforeValue) / beforeValue) * 100;

      if (percentChange > 50) {
        adjustedScore += 0.2;
        factors.push(`Significant monetary change: ${percentChange.toFixed(0)}% difference`);
      } else if (percentChange > 20) {
        adjustedScore += 0.1;
        factors.push(`Moderate monetary change: ${percentChange.toFixed(0)}% difference`);
      }
    }

    // Check for timeline changes
    const timePattern = /\b(\d+)\s*(zile|luni|ani|days?|months?|years?)\b/i;
    const beforeTime = change.beforeText.match(timePattern);
    const afterTime = change.afterText.match(timePattern);

    if (beforeTime && afterTime) {
      const beforeDays = this.normalizeToDays(parseInt(beforeTime[1]), beforeTime[2]);
      const afterDays = this.normalizeToDays(parseInt(afterTime[1]), afterTime[2]);

      if (beforeDays !== afterDays) {
        const percentChange = Math.abs((afterDays - beforeDays) / beforeDays) * 100;
        if (percentChange > 50) {
          adjustedScore += 0.1;
          factors.push(`Timeline significantly modified: ${beforeDays} → ${afterDays} days`);
        }
      }
    }

    // Cap score at 1.0
    adjustedScore = Math.min(adjustedScore, 1.0);

    const riskLevel = this.scoreToRiskLevel(adjustedScore);
    const explanation = this.generateRuleBasedExplanation(change, riskLevel, factors);

    return {
      riskLevel,
      riskScore: adjustedScore,
      explanation,
      factors,
    };
  }

  /**
   * AI-powered risk assessment for complex changes
   */
  private async assessWithAI(
    change: LegalChange,
    context: DocumentContext,
    baseRiskScore: number
  ): Promise<{
    riskLevel: RiskLevel;
    riskScore: number;
    explanation: string;
    factors: string[];
  }> {
    const languagePrompt = context.language === 'ro'
      ? 'Analizează riscul acestei modificări contractuale în limba română.'
      : 'Analyze the risk of this contract change.';

    const prompt = `${languagePrompt}

Change type: ${change.legalClassification || 'Unknown'}
Significance: ${change.significance}

Original text:
"""
${change.beforeText.substring(0, 600)}
"""

Modified text:
"""
${change.afterText.substring(0, 600)}
"""

Consider these risk factors:
- Financial impact (monetary changes, payment terms)
- Liability exposure (indemnification, limitations)
- Timeline changes (deadlines, durations)
- Obligation modifications
- Termination conditions

Respond in JSON format:
{
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "riskScore": 0.X (0.0 to 1.0),
  "explanation": "Brief explanation of the risk assessment",
  "factors": ["Factor 1", "Factor 2"]
}`;

    try {
      const startTime = Date.now();
      const response = await providerManager.execute({
        prompt,
        model: ClaudeModel.Sonnet,
        maxTokens: 400,
        temperature: 0.2,
      });

      // Track token usage
      await tokenTracker.recordUsage({
        firmId: context.firmId,
        operationType: AIOperationType.LegalAnalysis,
        modelUsed: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
      });

      const result = JSON.parse(response.content);
      return {
        riskLevel: this.parseRiskLevel(result.riskLevel),
        riskScore: result.riskScore || baseRiskScore,
        explanation: result.explanation || '',
        factors: result.factors || [],
      };
    } catch (error) {
      logger.error('AI risk assessment failed', { error });
      // Fallback to rule-based
      return this.assessWithRules(change, baseRiskScore);
    }
  }

  /**
   * Calculate aggregate risk for all changes
   */
  async calculateAggregateRisk(
    changes: LegalChange[],
    context: DocumentContext
  ): Promise<AggregateRiskResult> {
    if (changes.length === 0) {
      return {
        riskLevel: RiskLevel.LOW,
        explanation: context.language === 'ro'
          ? 'Nu au fost identificate modificări cu risc.'
          : 'No risk-bearing changes identified.',
        contributingFactors: [],
        highRiskChanges: [],
      };
    }

    // Assess each change
    const assessments = await Promise.all(
      changes.map(change => this.assessChangeRisk(change, context))
    );

    // Calculate weighted aggregate score
    const highRiskChanges: string[] = [];
    const allFactors: string[] = [];
    let weightedSum = 0;
    let totalWeight = 0;

    changes.forEach((change, index) => {
      const assessment = assessments[index];
      const weight = SIGNIFICANCE_RISK_WEIGHTS[change.significance] || 0.5;

      weightedSum += assessment.riskScore * weight;
      totalWeight += weight;

      if (assessment.riskLevel === RiskLevel.HIGH) {
        highRiskChanges.push(change.id);
      }

      allFactors.push(...assessment.factors);
    });

    const aggregateScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Apply multiplier for multiple high-risk changes
    const highRiskMultiplier = 1 + (highRiskChanges.length * 0.1);
    const finalScore = Math.min(aggregateScore * highRiskMultiplier, 1.0);

    const riskLevel = this.scoreToRiskLevel(finalScore);

    // Deduplicate factors and get top ones
    const uniqueFactors = [...new Set(allFactors)].slice(0, 5);

    const explanation = this.generateAggregateExplanation(
      riskLevel,
      changes.length,
      highRiskChanges.length,
      context.language
    );

    return {
      riskLevel,
      explanation,
      contributingFactors: uniqueFactors,
      highRiskChanges,
    };
  }

  /**
   * Convert risk score to RiskLevel
   */
  private scoreToRiskLevel(score: number): RiskLevel {
    if (score >= RISK_THRESHOLDS.HIGH) {
      return RiskLevel.HIGH;
    }
    if (score >= RISK_THRESHOLDS.MEDIUM) {
      return RiskLevel.MEDIUM;
    }
    return RiskLevel.LOW;
  }

  /**
   * Parse string risk level to enum
   */
  private parseRiskLevel(level: string): RiskLevel {
    const upperLevel = level?.toUpperCase();
    if (upperLevel === 'HIGH') return RiskLevel.HIGH;
    if (upperLevel === 'MEDIUM') return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  /**
   * Normalize time periods to days
   */
  private normalizeToDays(value: number, unit: string): number {
    const unitLower = unit.toLowerCase();
    if (unitLower.includes('an') || unitLower.includes('year')) {
      return value * 365;
    }
    if (unitLower.includes('lun') || unitLower.includes('month')) {
      return value * 30;
    }
    return value; // Days
  }

  /**
   * Generate rule-based explanation
   */
  private generateRuleBasedExplanation(
    change: LegalChange,
    riskLevel: RiskLevel,
    factors: string[]
  ): string {
    if (factors.length === 0) {
      switch (riskLevel) {
        case RiskLevel.HIGH:
          return 'This change affects critical contract terms and warrants careful review.';
        case RiskLevel.MEDIUM:
          return 'This change modifies substantive contract provisions.';
        default:
          return 'This change has minimal risk impact.';
      }
    }

    return factors.join('. ') + '.';
  }

  /**
   * Generate aggregate risk explanation
   */
  private generateAggregateExplanation(
    riskLevel: RiskLevel,
    totalChanges: number,
    highRiskCount: number,
    language: 'ro' | 'en'
  ): string {
    if (language === 'ro') {
      switch (riskLevel) {
        case RiskLevel.HIGH:
          return `Nivel ridicat de risc: ${highRiskCount} din ${totalChanges} modificări sunt critice și necesită revizuire atentă.`;
        case RiskLevel.MEDIUM:
          return `Nivel mediu de risc: Modificările includ schimbări substanțiale care trebuie evaluate.`;
        default:
          return `Nivel scăzut de risc: Modificările sunt în principal de natură minoră.`;
      }
    }

    switch (riskLevel) {
      case RiskLevel.HIGH:
        return `High risk level: ${highRiskCount} of ${totalChanges} changes are critical and require careful review.`;
      case RiskLevel.MEDIUM:
        return `Medium risk level: Changes include substantive modifications that should be evaluated.`;
      default:
        return `Low risk level: Changes are primarily minor in nature.`;
    }
  }

  /**
   * Get risk level color for UI
   */
  getRiskLevelColor(level: RiskLevel): string {
    switch (level) {
      case RiskLevel.HIGH:
        return 'red';
      case RiskLevel.MEDIUM:
        return 'yellow';
      default:
        return 'green';
    }
  }

  /**
   * Get risk level label
   */
  getRiskLevelLabel(level: RiskLevel, language: 'ro' | 'en'): string {
    const labels = {
      ro: {
        [RiskLevel.HIGH]: 'Risc Ridicat',
        [RiskLevel.MEDIUM]: 'Risc Mediu',
        [RiskLevel.LOW]: 'Risc Scăzut',
      },
      en: {
        [RiskLevel.HIGH]: 'High Risk',
        [RiskLevel.MEDIUM]: 'Medium Risk',
        [RiskLevel.LOW]: 'Low Risk',
      },
    };

    return labels[language][level];
  }
}

// Singleton instance
export const riskAssessmentService = new RiskAssessmentService();
