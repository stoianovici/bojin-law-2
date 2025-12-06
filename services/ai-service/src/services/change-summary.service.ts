/**
 * Change Summary Service
 * Story 3.5: Semantic Version Control System
 *
 * Generates plain language summaries of document changes
 * Supports Romanian and English output
 */

import {
  SemanticChange,
  SemanticDiffResult,
  ChangeSignificance,
  LegalChange,
  ClaudeModel,
  AIOperationType,
} from '@legal-platform/types';
import { providerManager } from './provider-manager.service';
import { tokenTracker } from './token-tracker.service';
import logger from '../lib/logger';

export interface ChangeSummary {
  changeId: string;
  plainSummary: string;
  category: string;
}

export interface ExecutiveSummary {
  overview: string;
  keyChanges: string[];
  totalChanges: number;
  criticalCount: number;
  substantiveCount: number;
  minorCount: number;
}

export class ChangeSummaryService {
  /**
   * Generate a plain language summary for a single change
   */
  async generateChangeSummary(
    change: SemanticChange,
    documentType: string,
    language: 'ro' | 'en'
  ): Promise<string> {
    // For simple changes, use template-based summaries
    if (change.significance === ChangeSignificance.MINOR_WORDING) {
      return this.generateTemplateSummary(change, language);
    }

    // For substantive/critical changes, use AI
    return this.generateAISummary(change, documentType, language);
  }

  /**
   * Generate template-based summary for minor changes
   */
  private generateTemplateSummary(
    change: SemanticChange,
    language: 'ro' | 'en'
  ): string {
    const templates = {
      ro: {
        added: 'Text adăugat în secțiunea {{section}}',
        removed: 'Text eliminat din secțiunea {{section}}',
        modified: 'Modificare minoră de formulare în secțiunea {{section}}',
      },
      en: {
        added: 'Text added in section {{section}}',
        removed: 'Text removed from section {{section}}',
        modified: 'Minor wording change in section {{section}}',
      },
    };

    const changeTemplates = templates[language];
    const section = change.sectionPath || 'document';

    switch (change.changeType) {
      case 'ADDED':
        return changeTemplates.added.replace('{{section}}', section);
      case 'REMOVED':
        return changeTemplates.removed.replace('{{section}}', section);
      default:
        return changeTemplates.modified.replace('{{section}}', section);
    }
  }

  /**
   * Generate AI-powered summary for complex changes
   */
  private async generateAISummary(
    change: SemanticChange,
    documentType: string,
    language: 'ro' | 'en'
  ): Promise<string> {
    const languageInstructions = language === 'ro'
      ? 'Răspunde în limba română, într-o propoziție clară și concisă.'
      : 'Respond in English, in a clear and concise sentence.';

    const prompt = `${languageInstructions}

Summarize this contract change in plain language (like "Payment terms extended from 30 to 60 days"):

Document type: ${documentType}

Original text:
"""
${change.beforeText.substring(0, 500)}
"""

Changed to:
"""
${change.afterText.substring(0, 500)}
"""

Provide ONLY the summary, no explanations or preamble.`;

    try {
      const response = await providerManager.execute({
        prompt,
        model: ClaudeModel.Sonnet,
        maxTokens: 150,
        temperature: 0.3,
      });

      return response.content.trim();
    } catch (error) {
      logger.error('AI summary generation failed', { error });
      return language === 'ro'
        ? 'Modificare detectată în document'
        : 'Change detected in document';
    }
  }

  /**
   * Generate summaries for all changes in a diff
   */
  async generateAllSummaries(
    diff: SemanticDiffResult,
    documentType: string,
    language: 'ro' | 'en',
    firmId: string
  ): Promise<ChangeSummary[]> {
    const summaries: ChangeSummary[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const startTime = Date.now();

    // Process changes in batches for efficiency
    for (const change of diff.changes) {
      const summary = await this.generateChangeSummary(change, documentType, language);
      summaries.push({
        changeId: change.id,
        plainSummary: summary,
        category: this.categorizeChange(change),
      });
    }

    // Track aggregate token usage
    if (totalInputTokens > 0) {
      await tokenTracker.recordUsage({
        firmId,
        operationType: AIOperationType.DocumentSummary,
        modelUsed: ClaudeModel.Sonnet,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        latencyMs: Date.now() - startTime,
      });
    }

    return summaries;
  }

  /**
   * Generate an executive summary of all changes
   */
  async generateExecutiveSummary(
    changes: SemanticChange[],
    documentType: string,
    language: 'ro' | 'en',
    firmId: string
  ): Promise<ExecutiveSummary> {
    const criticalChanges = changes.filter(c => c.significance === ChangeSignificance.CRITICAL);
    const substantiveChanges = changes.filter(c => c.significance === ChangeSignificance.SUBSTANTIVE);
    const minorChanges = changes.filter(c => c.significance === ChangeSignificance.MINOR_WORDING);

    // If no critical or substantive changes, use template
    if (criticalChanges.length === 0 && substantiveChanges.length === 0) {
      return this.generateTemplateExecutiveSummary(changes, language);
    }

    // Use AI for complex summaries
    return this.generateAIExecutiveSummary(
      changes,
      criticalChanges,
      substantiveChanges,
      documentType,
      language,
      firmId
    );
  }

  /**
   * Template-based executive summary for simple cases
   */
  private generateTemplateExecutiveSummary(
    changes: SemanticChange[],
    language: 'ro' | 'en'
  ): ExecutiveSummary {
    const total = changes.length;

    if (language === 'ro') {
      return {
        overview: total === 0
          ? 'Nu au fost detectate modificări semnificative între versiuni.'
          : `Au fost detectate ${total} modificări minore de formulare. Nicio modificare substanțială nu a fost identificată.`,
        keyChanges: [],
        totalChanges: total,
        criticalCount: 0,
        substantiveCount: 0,
        minorCount: total,
      };
    }

    return {
      overview: total === 0
        ? 'No significant changes detected between versions.'
        : `${total} minor wording changes detected. No substantive modifications identified.`,
      keyChanges: [],
      totalChanges: total,
      criticalCount: 0,
      substantiveCount: 0,
      minorCount: total,
    };
  }

  /**
   * AI-powered executive summary
   */
  private async generateAIExecutiveSummary(
    allChanges: SemanticChange[],
    criticalChanges: SemanticChange[],
    substantiveChanges: SemanticChange[],
    documentType: string,
    language: 'ro' | 'en',
    firmId: string
  ): Promise<ExecutiveSummary> {
    const languageInstructions = language === 'ro'
      ? 'Răspunde în limba română.'
      : 'Respond in English.';

    // Prepare change excerpts for AI
    const criticalExcerpts = criticalChanges.slice(0, 3).map(c => ({
      before: c.beforeText.substring(0, 200),
      after: c.afterText.substring(0, 200),
    }));

    const substantiveExcerpts = substantiveChanges.slice(0, 3).map(c => ({
      before: c.beforeText.substring(0, 200),
      after: c.afterText.substring(0, 200),
    }));

    const prompt = `${languageInstructions}

Generate an executive summary of document changes for a ${documentType}.

Statistics:
- Total changes: ${allChanges.length}
- Critical changes: ${criticalChanges.length}
- Substantive changes: ${substantiveChanges.length}
- Minor changes: ${allChanges.length - criticalChanges.length - substantiveChanges.length}

Critical changes (most important):
${JSON.stringify(criticalExcerpts, null, 2)}

Substantive changes:
${JSON.stringify(substantiveExcerpts, null, 2)}

Respond in JSON format:
{
  "overview": "One paragraph overview of all changes (2-3 sentences)",
  "keyChanges": ["Most important change 1", "Most important change 2", "Most important change 3"]
}`;

    try {
      const startTime = Date.now();
      const response = await providerManager.execute({
        prompt,
        model: ClaudeModel.Sonnet,
        maxTokens: 500,
        temperature: 0.3,
      });

      // Track token usage
      await tokenTracker.recordUsage({
        firmId,
        operationType: AIOperationType.DocumentSummary,
        modelUsed: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
      });

      const result = JSON.parse(response.content);
      return {
        overview: result.overview || '',
        keyChanges: result.keyChanges || [],
        totalChanges: allChanges.length,
        criticalCount: criticalChanges.length,
        substantiveCount: substantiveChanges.length,
        minorCount: allChanges.length - criticalChanges.length - substantiveChanges.length,
      };
    } catch (error) {
      logger.error('AI executive summary generation failed', { error });
      return this.generateTemplateExecutiveSummary(allChanges, language);
    }
  }

  /**
   * Categorize a change for grouping
   */
  private categorizeChange(change: SemanticChange): string {
    if (change.legalClassification) {
      return change.legalClassification;
    }

    switch (change.significance) {
      case ChangeSignificance.CRITICAL:
        return 'critical';
      case ChangeSignificance.SUBSTANTIVE:
        return 'substantive';
      case ChangeSignificance.MINOR_WORDING:
        return 'minor';
      default:
        return 'formatting';
    }
  }

  /**
   * Group changes by category
   */
  groupChangesByCategory(
    changes: SemanticChange[]
  ): Record<string, SemanticChange[]> {
    const grouped: Record<string, SemanticChange[]> = {};

    for (const change of changes) {
      const category = this.categorizeChange(change);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(change);
    }

    return grouped;
  }

  /**
   * Generate a version comparison summary string
   */
  async generateVersionComparisonSummary(
    fromVersionNumber: number,
    toVersionNumber: number,
    changes: SemanticChange[],
    language: 'ro' | 'en'
  ): Promise<string> {
    const criticalCount = changes.filter(c => c.significance === ChangeSignificance.CRITICAL).length;
    const substantiveCount = changes.filter(c => c.significance === ChangeSignificance.SUBSTANTIVE).length;
    const total = changes.length;

    if (language === 'ro') {
      if (total === 0) {
        return `Versiunea ${toVersionNumber} nu conține modificări față de versiunea ${fromVersionNumber}.`;
      }
      if (criticalCount > 0) {
        return `Versiunea ${toVersionNumber}: ${criticalCount} modificări critice, ${substantiveCount} substantive, ${total} total.`;
      }
      return `Versiunea ${toVersionNumber}: ${substantiveCount} modificări substantive, ${total - substantiveCount} minore.`;
    }

    if (total === 0) {
      return `Version ${toVersionNumber} has no changes from version ${fromVersionNumber}.`;
    }
    if (criticalCount > 0) {
      return `Version ${toVersionNumber}: ${criticalCount} critical changes, ${substantiveCount} substantive, ${total} total.`;
    }
    return `Version ${toVersionNumber}: ${substantiveCount} substantive changes, ${total - substantiveCount} minor.`;
  }
}

// Singleton instance
export const changeSummaryService = new ChangeSummaryService();
