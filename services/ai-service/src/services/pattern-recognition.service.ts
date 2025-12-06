/**
 * Pattern Recognition Service
 * Story 5.4: Proactive AI Suggestions System
 *
 * Analyzes user behavior patterns to provide pattern-based suggestions.
 * Detects recurring action sequences that can be automated or suggested.
 */

import { prisma } from '@legal-platform/database';
import {
  PatternAnalysisResult,
  DetectedPattern,
  ActionStep,
} from '@legal-platform/types';
import { ClaudeModel } from '@legal-platform/types';
import logger from '../lib/logger';
import { config } from '../config';
import { providerManager, ProviderRequest } from './provider-manager.service';

// Minimum occurrences before suggesting a pattern
const MIN_PATTERN_OCCURRENCES = 3;

// Default lookback period in days
const DEFAULT_LOOKBACK_DAYS = 90;

// Minimum confidence threshold for active patterns
const MIN_CONFIDENCE_THRESHOLD = 0.6;

// Pattern types we detect
export const PATTERN_TYPES = {
  POST_FILING_CLIENT_UPDATE: 'post_filing_client_update',
  MORNING_EMAIL_CHECK: 'morning_email_check',
  POST_MEETING_NOTES: 'post_meeting_notes',
  WEEKLY_STATUS_UPDATE: 'weekly_status_update',
  DOCUMENT_REVIEW_FOLLOWUP: 'document_review_followup',
  CASE_PHASE_TRANSITION: 'case_phase_transition',
  CLIENT_COMMUNICATION_PATTERN: 'client_communication_pattern',
  DEADLINE_PREPARATION: 'deadline_preparation',
} as const;

export class PatternRecognitionService {
  /**
   * Analyze user patterns over a time period
   */
  async analyzeUserPatterns(
    userId: string,
    lookbackDays: number = DEFAULT_LOOKBACK_DAYS
  ): Promise<PatternAnalysisResult> {
    logger.info('Analyzing user patterns', { userId, lookbackDays });
    const startTime = Date.now();

    try {
      // Get user's action history
      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

      // Gather historical data in parallel
      const [
        taskHistory,
        emailHistory,
        documentHistory,
        existingPatterns,
      ] = await Promise.all([
        this.getTaskHistory(userId, lookbackDate),
        this.getEmailHistory(userId, lookbackDate),
        this.getDocumentHistory(userId, lookbackDate),
        this.getExistingPatterns(userId),
      ]);

      // Analyze patterns using AI
      const detectedPatterns = await this.detectPatternsWithAI(
        userId,
        taskHistory,
        emailHistory,
        documentHistory
      );

      // Compare with existing patterns
      const { newPatterns, updatedPatterns } = this.categorizePatterns(
        detectedPatterns,
        existingPatterns
      );

      // Store new and updated patterns
      await this.storePatterns(userId, newPatterns, updatedPatterns);

      const duration = Date.now() - startTime;
      logger.info('Pattern analysis completed', {
        userId,
        durationMs: duration,
        totalPatterns: detectedPatterns.length,
        newPatterns: newPatterns.length,
        updatedPatterns: updatedPatterns.length,
      });

      return {
        patterns: detectedPatterns,
        newPatterns,
        updatedPatterns,
      };
    } catch (error) {
      logger.error('Pattern analysis failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get pattern-based suggestions for current context
   */
  async getPatternBasedSuggestions(
    userId: string,
    currentContext: {
      currentScreen: string;
      currentCaseId?: string;
      recentAction?: string;
    }
  ): Promise<DetectedPattern[]> {
    // Get active patterns for user
    const patterns = await prisma.userActionPattern.findMany({
      where: {
        userId,
        isActive: true,
        confidence: { gte: MIN_CONFIDENCE_THRESHOLD },
      },
      orderBy: { confidence: 'desc' },
    });

    // Filter patterns that match current context
    const matchingPatterns: DetectedPattern[] = [];

    for (const pattern of patterns) {
      const triggerContext = pattern.triggerContext as Record<string, unknown>;

      // Check if trigger matches current context
      const matches = this.matchesTriggerContext(triggerContext, currentContext);

      if (matches) {
        matchingPatterns.push({
          patternType: pattern.patternType,
          description: this.getPatternDescription(pattern.patternType),
          triggerContext: triggerContext,
          actionSequence: pattern.actionSequence as ActionStep[],
          occurrenceCount: pattern.occurrenceCount,
          confidence: pattern.confidence,
          suggestable: true,
        });
      }
    }

    return matchingPatterns;
  }

  /**
   * Record a user action for pattern learning
   */
  async recordUserAction(
    userId: string,
    firmId: string,
    action: {
      type: string;
      context: Record<string, unknown>;
      timestamp?: Date;
    }
  ): Promise<void> {
    // Store action in a temporary actions log for pattern analysis
    // This would typically go to a separate table or time-series database
    // For now, we'll update pattern occurrences directly when we detect matches

    const patterns = await prisma.userActionPattern.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    for (const pattern of patterns) {
      const actionSequence = pattern.actionSequence as ActionStep[];
      const triggerContext = pattern.triggerContext as Record<string, unknown>;

      // Check if this action is part of an existing pattern
      if (this.actionMatchesPattern(action, triggerContext, actionSequence)) {
        // Update occurrence count and confidence
        await prisma.userActionPattern.update({
          where: { id: pattern.id },
          data: {
            occurrenceCount: { increment: 1 },
            lastOccurrence: new Date(),
            confidence: this.calculateNewConfidence(pattern.confidence, pattern.occurrenceCount + 1),
          },
        });

        logger.debug('Pattern occurrence recorded', {
          userId,
          patternType: pattern.patternType,
          newCount: pattern.occurrenceCount + 1,
        });
      }
    }
  }

  /**
   * Get task history for pattern analysis
   */
  private async getTaskHistory(userId: string, since: Date) {
    return prisma.taskHistory.findMany({
      where: {
        actorId: userId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        task: {
          select: {
            id: true,
            type: true,
            title: true,
            caseId: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Get email history for pattern analysis
   */
  private async getEmailHistory(userId: string, since: Date) {
    return prisma.email.findMany({
      where: {
        userId,
        sentAt: { gte: since },
        direction: 'Outbound',
      },
      orderBy: { sentAt: 'asc' },
      select: {
        id: true,
        subject: true,
        caseId: true,
        sentAt: true,
        recipientType: true,
      },
    });
  }

  /**
   * Get document history for pattern analysis
   */
  private async getDocumentHistory(userId: string, since: Date) {
    return prisma.documentAuditLog.findMany({
      where: {
        userId,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        action: true,
        documentId: true,
        caseId: true,
        timestamp: true,
      },
    });
  }

  /**
   * Get existing patterns for user
   */
  private async getExistingPatterns(userId: string) {
    return prisma.userActionPattern.findMany({
      where: { userId },
    });
  }

  /**
   * Use AI to detect patterns in user behavior
   */
  private async detectPatternsWithAI(
    userId: string,
    taskHistory: Array<{ task: { type: string; caseId: string | null } | null; createdAt: Date }>,
    emailHistory: Array<{ subject: string | null; caseId: string | null; sentAt: Date | null }>,
    documentHistory: Array<{ action: string; caseId: string | null; timestamp: Date }>
  ): Promise<DetectedPattern[]> {
    // Build a summary of user actions for AI analysis
    const actionSummary = this.buildActionSummary(taskHistory, emailHistory, documentHistory);

    const prompt = `
Analyze the following user action history from a legal professional and identify recurring behavior patterns.

ACTION HISTORY:
${actionSummary}

Identify patterns such as:
1. Actions that consistently follow other actions (e.g., "After filing, always sends client update")
2. Time-based routines (e.g., "Checks emails every morning at 9 AM")
3. Case phase transitions (e.g., "After discovery phase, schedules depositions")
4. Document workflows (e.g., "After contract review, sends summary to client")

For each pattern detected, provide:
- patternType: A unique identifier (snake_case)
- description: Human-readable description
- triggerContext: What triggers this pattern (action type, case type, time of day, etc.)
- actionSequence: The sequence of actions that typically follows
- occurrenceCount: How many times this pattern was observed
- confidence: 0.0-1.0 confidence score based on consistency
- suggestable: Whether this can be proactively suggested

Return as JSON array. Only include patterns with at least ${MIN_PATTERN_OCCURRENCES} occurrences:
[{
  "patternType": string,
  "description": string,
  "triggerContext": {},
  "actionSequence": [{ "action": string, "context": {} }],
  "occurrenceCount": number,
  "confidence": number,
  "suggestable": boolean
}]

Respond ONLY with the JSON array.
`.trim();

    try {
      const request: ProviderRequest = {
        systemPrompt: 'You are an AI assistant analyzing user behavior patterns in a legal platform. Identify meaningful, actionable patterns that can help improve the user\'s workflow.',
        prompt,
        model: ClaudeModel.Sonnet, // Use Sonnet for comprehensive analysis
        maxTokens: 2000,
        temperature: 0.3,
      };

      const response = await providerManager.execute(request);
      return this.parsePatternResponse(response.content);
    } catch (error) {
      logger.error('AI pattern detection failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Return empty array on failure - pattern detection is non-critical
      return [];
    }
  }

  /**
   * Build action summary for AI prompt
   */
  private buildActionSummary(
    taskHistory: Array<{ task: { type: string; caseId: string | null } | null; createdAt: Date }>,
    emailHistory: Array<{ subject: string | null; caseId: string | null; sentAt: Date | null }>,
    documentHistory: Array<{ action: string; caseId: string | null; timestamp: Date }>
  ): string {
    const actions: string[] = [];

    // Combine all actions chronologically
    const allActions: Array<{ type: string; timestamp: Date; details: string }> = [
      ...taskHistory.map(t => ({
        type: 'task',
        timestamp: new Date(t.createdAt),
        details: `Task ${t.task?.type || 'unknown'} on case ${t.task?.caseId || 'none'}`,
      })),
      ...emailHistory.map(e => ({
        type: 'email',
        timestamp: e.sentAt ? new Date(e.sentAt) : new Date(),
        details: `Email "${e.subject?.substring(0, 50) || 'no subject'}" on case ${e.caseId || 'none'}`,
      })),
      ...documentHistory.map(d => ({
        type: 'document',
        timestamp: new Date(d.timestamp),
        details: `Document ${d.action} on case ${d.caseId || 'none'}`,
      })),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Limit to last 200 actions for prompt size
    const recentActions = allActions.slice(-200);

    for (const action of recentActions) {
      const day = action.timestamp.toISOString().split('T')[0];
      const time = action.timestamp.toTimeString().substring(0, 5);
      actions.push(`${day} ${time} - [${action.type}] ${action.details}`);
    }

    return actions.join('\n') || 'No action history available';
  }

  /**
   * Parse AI pattern response
   */
  private parsePatternResponse(response: string): DetectedPattern[] {
    try {
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }

      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(p => p.occurrenceCount >= MIN_PATTERN_OCCURRENCES)
        .map(p => ({
          patternType: String(p.patternType || ''),
          description: String(p.description || ''),
          triggerContext: p.triggerContext || {},
          actionSequence: (p.actionSequence || []).map((a: { action?: string; context?: Record<string, unknown> }) => ({
            action: String(a.action || ''),
            context: a.context || {},
          })),
          occurrenceCount: Number(p.occurrenceCount) || MIN_PATTERN_OCCURRENCES,
          confidence: Math.min(1, Math.max(0, Number(p.confidence) || 0.5)),
          suggestable: Boolean(p.suggestable),
        }));
    } catch (error) {
      logger.error('Failed to parse pattern response', {
        error: error instanceof Error ? error.message : String(error),
        response: response.substring(0, 500),
      });
      return [];
    }
  }

  /**
   * Categorize patterns as new or updated
   */
  private categorizePatterns(
    detected: DetectedPattern[],
    existing: Array<{ patternType: string; confidence: number; occurrenceCount: number }>
  ): { newPatterns: DetectedPattern[]; updatedPatterns: DetectedPattern[] } {
    const existingTypes = new Set(existing.map(p => p.patternType));

    const newPatterns = detected.filter(p => !existingTypes.has(p.patternType));
    const updatedPatterns = detected.filter(p => existingTypes.has(p.patternType));

    return { newPatterns, updatedPatterns };
  }

  /**
   * Store patterns in database
   */
  private async storePatterns(
    userId: string,
    newPatterns: DetectedPattern[],
    updatedPatterns: DetectedPattern[]
  ): Promise<void> {
    // Get user's firmId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true },
    });

    if (!user?.firmId) {
      throw new Error('User firm not found');
    }

    // Create new patterns
    for (const pattern of newPatterns) {
      await prisma.userActionPattern.create({
        data: {
          firmId: user.firmId,
          userId,
          patternType: pattern.patternType,
          triggerContext: pattern.triggerContext,
          actionSequence: pattern.actionSequence,
          occurrenceCount: pattern.occurrenceCount,
          lastOccurrence: new Date(),
          confidence: pattern.confidence,
          isActive: pattern.suggestable,
        },
      });
    }

    // Update existing patterns
    for (const pattern of updatedPatterns) {
      await prisma.userActionPattern.updateMany({
        where: {
          userId,
          patternType: pattern.patternType,
        },
        data: {
          triggerContext: pattern.triggerContext,
          actionSequence: pattern.actionSequence,
          occurrenceCount: pattern.occurrenceCount,
          lastOccurrence: new Date(),
          confidence: pattern.confidence,
          isActive: pattern.suggestable,
        },
      });
    }

    logger.debug('Patterns stored', {
      userId,
      newCount: newPatterns.length,
      updatedCount: updatedPatterns.length,
    });
  }

  /**
   * Check if trigger context matches current context
   */
  private matchesTriggerContext(
    trigger: Record<string, unknown>,
    current: { currentScreen: string; currentCaseId?: string; recentAction?: string }
  ): boolean {
    // Match on screen
    if (trigger.screen && trigger.screen !== current.currentScreen) {
      return false;
    }

    // Match on recent action
    if (trigger.afterAction && trigger.afterAction !== current.recentAction) {
      return false;
    }

    // Match on case context
    if (trigger.requiresCase && !current.currentCaseId) {
      return false;
    }

    return true;
  }

  /**
   * Check if action matches a pattern
   */
  private actionMatchesPattern(
    action: { type: string; context: Record<string, unknown> },
    triggerContext: Record<string, unknown>,
    actionSequence: ActionStep[]
  ): boolean {
    // Check if the action type matches the first action in the sequence
    if (actionSequence.length > 0 && actionSequence[0].action === action.type) {
      return true;
    }

    // Check if action matches the trigger
    if (triggerContext.actionType === action.type) {
      return true;
    }

    return false;
  }

  /**
   * Calculate new confidence based on occurrence count
   */
  private calculateNewConfidence(currentConfidence: number, newCount: number): number {
    // Confidence increases logarithmically with occurrences
    // Starts at ~0.5 for 3 occurrences, approaches 0.95 asymptotically
    const baseConfidence = 0.5;
    const maxConfidence = 0.95;
    const growthRate = 0.1;

    const newConfidence = maxConfidence - (maxConfidence - baseConfidence) * Math.exp(-growthRate * (newCount - MIN_PATTERN_OCCURRENCES));
    return Math.min(maxConfidence, Math.max(currentConfidence, newConfidence));
  }

  /**
   * Get human-readable pattern description
   */
  private getPatternDescription(patternType: string): string {
    const descriptions: Record<string, string> = {
      [PATTERN_TYPES.POST_FILING_CLIENT_UPDATE]: 'You usually send a client update after filing documents',
      [PATTERN_TYPES.MORNING_EMAIL_CHECK]: 'You typically check and respond to emails in the morning',
      [PATTERN_TYPES.POST_MEETING_NOTES]: 'You usually create meeting notes after client meetings',
      [PATTERN_TYPES.WEEKLY_STATUS_UPDATE]: 'You send weekly status updates to clients',
      [PATTERN_TYPES.DOCUMENT_REVIEW_FOLLOWUP]: 'You follow up after document reviews',
      [PATTERN_TYPES.CASE_PHASE_TRANSITION]: 'You perform specific tasks when cases change phases',
      [PATTERN_TYPES.CLIENT_COMMUNICATION_PATTERN]: 'Your communication pattern with this client',
      [PATTERN_TYPES.DEADLINE_PREPARATION]: 'You prepare for deadlines in a specific way',
    };

    return descriptions[patternType] || `Detected pattern: ${patternType}`;
  }

  /**
   * Deactivate a pattern (user feedback)
   */
  async deactivatePattern(userId: string, patternType: string): Promise<void> {
    await prisma.userActionPattern.updateMany({
      where: {
        userId,
        patternType,
      },
      data: {
        isActive: false,
      },
    });

    logger.info('Pattern deactivated', { userId, patternType });
  }
}

// Singleton instance
export const patternRecognitionService = new PatternRecognitionService();
