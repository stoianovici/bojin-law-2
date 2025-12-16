/**
 * Personalization Dashboard Service
 * Story 5.6: AI Learning and Personalization (Task 16)
 *
 * Provides aggregated personalization data for the user dashboard.
 */

import { prisma } from '@legal-platform/database';
import type { SnippetCategory } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface LearningStatus {
  userId: string;
  writingStyleSamples: number;
  snippetsCount: number;
  taskPatternsCount: number;
  documentPreferencesCount: number;
  responseTimePatternCount: number;
  lastAnalysisAt: Date | null;
  nextScheduledAnalysis: Date | null;
}

interface PersonalizationSettings {
  userId: string;
  styleAdaptationEnabled: boolean;
  snippetSuggestionsEnabled: boolean;
  taskPatternSuggestionsEnabled: boolean;
  responseTimePredictionsEnabled: boolean;
  documentPreferencesEnabled: boolean;
  learningFromEditsEnabled: boolean;
  privacyLevel: 'standard' | 'minimal' | 'full';
}

interface ProductivityInsights {
  mostProductiveDay: string | null;
  mostProductiveTime: string | null;
  fastestTaskType: string | null;
  slowestTaskType: string | null;
  averageResponseTime: number;
}

// ============================================================================
// Service
// ============================================================================

export class PersonalizationDashboardService {
  /**
   * Get overall learning status for a user
   */
  async getLearningStatus(userId: string): Promise<LearningStatus> {
    const [
      writingProfile,
      snippetsCount,
      taskPatternsCount,
      documentPreferencesCount,
      responsePatternCount,
    ] = await Promise.all([
      prisma.writingStyleProfile.findUnique({
        where: { userId },
        select: { sampleCount: true, lastAnalyzedAt: true },
      }),
      prisma.personalSnippet.count({ where: { userId } }),
      prisma.taskCreationPattern.count({ where: { userId } }),
      prisma.documentStructurePreference.count({ where: { userId } }),
      prisma.responseTimePattern.count({ where: { userId } }),
    ]);

    // Calculate next scheduled analysis (next Sunday at 2 AM)
    const now = new Date();
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + (7 - now.getDay()));
    nextSunday.setHours(2, 0, 0, 0);

    return {
      userId,
      writingStyleSamples: writingProfile?.sampleCount || 0,
      snippetsCount,
      taskPatternsCount,
      documentPreferencesCount,
      responseTimePatternCount: responsePatternCount,
      lastAnalysisAt: writingProfile?.lastAnalyzedAt || null,
      nextScheduledAnalysis: nextSunday,
    };
  }

  /**
   * Get personalization settings for a user
   * Default settings are returned if no custom settings exist
   */
  async getPersonalizationSettings(userId: string): Promise<PersonalizationSettings> {
    // Get user preferences from the User model
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const prefs = (user?.preferences || {}) as Record<string, unknown>;
    const personalization = (prefs.personalization || {}) as Record<string, unknown>;

    return {
      userId,
      styleAdaptationEnabled: personalization.styleAdaptationEnabled !== false,
      snippetSuggestionsEnabled: personalization.snippetSuggestionsEnabled !== false,
      taskPatternSuggestionsEnabled: personalization.taskPatternSuggestionsEnabled !== false,
      responseTimePredictionsEnabled: personalization.responseTimePredictionsEnabled !== false,
      documentPreferencesEnabled: personalization.documentPreferencesEnabled !== false,
      learningFromEditsEnabled: personalization.learningFromEditsEnabled !== false,
      privacyLevel: (personalization.privacyLevel as 'standard' | 'minimal' | 'full') || 'standard',
    };
  }

  /**
   * Update personalization settings for a user
   */
  async updatePersonalizationSettings(
    userId: string,
    settings: Partial<Omit<PersonalizationSettings, 'userId'>>
  ): Promise<PersonalizationSettings> {
    // Get current user preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const currentPrefs = (user?.preferences || {}) as Record<string, unknown>;
    const currentPersonalization = (currentPrefs.personalization || {}) as Record<string, unknown>;

    // Merge with new settings
    const newPersonalization = {
      ...currentPersonalization,
      ...settings,
    };

    // Update user preferences
    await prisma.user.update({
      where: { id: userId },
      data: {
        preferences: {
          ...currentPrefs,
          personalization: newPersonalization,
        },
      },
    });

    return this.getPersonalizationSettings(userId);
  }

  /**
   * Get snippet suggestions for a user
   * This aggregates detected patterns from email drafts and documents
   */
  async getSnippetSuggestions(
    userId: string,
    limit: number = 5
  ): Promise<
    {
      content: string;
      suggestedTitle: string;
      suggestedShortcut: string;
      category: SnippetCategory;
      occurrenceCount: number;
      confidence: number;
    }[]
  > {
    // Get existing snippets to filter out already-saved phrases
    const existingSnippets = await prisma.personalSnippet.findMany({
      where: { userId },
      select: { content: true },
    });

    const existingContents = new Set(existingSnippets.map((s) => s.content.toLowerCase().trim()));

    // Analyze recent draft edits for common phrases
    const recentEdits = await prisma.draftEditHistory.findMany({
      where: {
        userId,
        isStyleAnalyzed: true,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      select: {
        editedText: true,
        editLocation: true,
      },
      take: 100,
    });

    // Count phrase occurrences
    const phraseCounts = new Map<string, { count: number; location: string }>();

    for (const edit of recentEdits) {
      const phrases = this.extractPhrases(edit.editedText);
      for (const phrase of phrases) {
        const key = phrase.toLowerCase().trim();
        if (!existingContents.has(key) && phrase.length >= 10 && phrase.length <= 200) {
          const current = phraseCounts.get(key) || { count: 0, location: edit.editLocation };
          current.count++;
          phraseCounts.set(key, current);
        }
      }
    }

    // Convert to suggestions (minimum 3 occurrences)
    const suggestions = Array.from(phraseCounts.entries())
      .filter(([_, data]) => data.count >= 3)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([content, data]) => ({
        content,
        suggestedTitle: this.generateTitle(content),
        suggestedShortcut: this.generateShortcut(content),
        category: this.categorizePhrase(content, data.location) as SnippetCategory,
        occurrenceCount: data.count,
        confidence: Math.min(0.9, 0.5 + data.count * 0.1),
      }));

    return suggestions;
  }

  /**
   * Get productivity insights from response time patterns
   */
  async getProductivityInsights(userId: string): Promise<ProductivityInsights> {
    const patterns = await prisma.responseTimePattern.findMany({
      where: {
        userId,
        sampleCount: { gte: 5 },
      },
      orderBy: { sampleCount: 'desc' },
    });

    if (patterns.length === 0) {
      return {
        mostProductiveDay: null,
        mostProductiveTime: null,
        fastestTaskType: null,
        slowestTaskType: null,
        averageResponseTime: 0,
      };
    }

    // Aggregate day of week patterns
    const dayTotals: Record<string, { sum: number; count: number }> = {};
    const timeTotals: Record<string, { sum: number; count: number }> = {};

    for (const pattern of patterns) {
      const dayPattern = pattern.dayOfWeekPattern as Record<string, number> | null;
      const timePattern = pattern.timeOfDayPattern as Record<string, number> | null;

      if (dayPattern) {
        for (const [day, value] of Object.entries(dayPattern)) {
          if (typeof value === 'number' && value > 0) {
            if (!dayTotals[day]) dayTotals[day] = { sum: 0, count: 0 };
            dayTotals[day].sum += value;
            dayTotals[day].count += 1;
          }
        }
      }

      if (timePattern) {
        for (const [time, value] of Object.entries(timePattern)) {
          if (typeof value === 'number' && value > 0) {
            if (!timeTotals[time]) timeTotals[time] = { sum: 0, count: 0 };
            timeTotals[time].sum += value;
            timeTotals[time].count += 1;
          }
        }
      }
    }

    // Find most productive day (lowest average response time)
    let mostProductiveDay: string | null = null;
    let lowestDayAvg = Infinity;
    for (const [day, data] of Object.entries(dayTotals)) {
      const avg = data.sum / data.count;
      if (avg < lowestDayAvg) {
        lowestDayAvg = avg;
        mostProductiveDay = this.formatDayName(day);
      }
    }

    // Find most productive time
    let mostProductiveTime: string | null = null;
    let lowestTimeAvg = Infinity;
    for (const [time, data] of Object.entries(timeTotals)) {
      const avg = data.sum / data.count;
      if (avg < lowestTimeAvg) {
        lowestTimeAvg = avg;
        mostProductiveTime = this.formatTimeName(time);
      }
    }

    // Sort by speed
    const sortedBySpeed = [...patterns].sort(
      (a, b) => a.averageResponseHours - b.averageResponseHours
    );

    // Calculate overall average
    const totalHours = patterns.reduce((sum, p) => sum + p.averageResponseHours * p.sampleCount, 0);
    const totalSamples = patterns.reduce((sum, p) => sum + p.sampleCount, 0);

    return {
      mostProductiveDay,
      mostProductiveTime,
      fastestTaskType: sortedBySpeed[0]?.taskType || null,
      slowestTaskType: sortedBySpeed[sortedBySpeed.length - 1]?.taskType || null,
      averageResponseTime: totalSamples > 0 ? Math.round((totalHours / totalSamples) * 10) / 10 : 0,
    };
  }

  /**
   * Clear all learning data for a user
   */
  async clearAllLearningData(userId: string): Promise<boolean> {
    await prisma.$transaction([
      prisma.writingStyleProfile.deleteMany({ where: { userId } }),
      prisma.personalSnippet.deleteMany({ where: { userId } }),
      prisma.taskCreationPattern.deleteMany({ where: { userId } }),
      prisma.documentStructurePreference.deleteMany({ where: { userId } }),
      prisma.responseTimePattern.deleteMany({ where: { userId } }),
      prisma.draftEditHistory.deleteMany({ where: { userId } }),
    ]);

    return true;
  }

  /**
   * Reset writing style profile for a user
   */
  async resetWritingStyleProfile(userId: string): Promise<boolean> {
    await prisma.$transaction([
      prisma.writingStyleProfile.deleteMany({ where: { userId } }),
      prisma.draftEditHistory.deleteMany({ where: { userId } }),
    ]);

    return true;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private extractPhrases(text: string): string[] {
    // Extract sentences and short phrases
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    return sentences.map((s) => s.trim());
  }

  private generateTitle(content: string): string {
    // Take first 5 words or 30 characters
    const words = content.split(/\s+/).slice(0, 5);
    const title = words.join(' ');
    return title.length > 30 ? title.substring(0, 30) + '...' : title;
  }

  private generateShortcut(content: string): string {
    // Generate shortcut from first letters of words
    const words = content.split(/\s+/).slice(0, 4);
    const shortcut = words
      .map((w) => w.charAt(0).toLowerCase())
      .join('')
      .replace(/[^a-z0-9]/g, '');
    return shortcut || 'snip';
  }

  private categorizePhrase(content: string, location: string): string {
    const lowerContent = content.toLowerCase();

    if (location === 'greeting' || /^(dear|hello|hi|stimate|bună)/i.test(lowerContent)) {
      return 'Greeting';
    }
    if (location === 'closing' || /(sincerely|regards|cu stimă|respectuos)/i.test(lowerContent)) {
      return 'Closing';
    }
    if (/(în conformitate|potrivit|conform legii|articol)/i.test(lowerContent)) {
      return 'LegalPhrase';
    }
    if (/(vă mulțumim|thank you|vă informăm)/i.test(lowerContent)) {
      return 'ClientResponse';
    }

    return 'Custom';
  }

  private formatDayName(day: string): string {
    const names: Record<string, string> = {
      monday: 'Luni',
      tuesday: 'Marți',
      wednesday: 'Miercuri',
      thursday: 'Joi',
      friday: 'Vineri',
      saturday: 'Sâmbătă',
      sunday: 'Duminică',
    };
    return names[day] || day;
  }

  private formatTimeName(time: string): string {
    const names: Record<string, string> = {
      earlyMorning: 'Dimineața devreme (6-9)',
      morning: 'Dimineața (9-12)',
      afternoon: 'După-amiază (12-17)',
      evening: 'Seara (17-21)',
      night: 'Noaptea (21-6)',
    };
    return names[time] || time;
  }
}

// Export singleton instance
export const personalizationDashboardService = new PersonalizationDashboardService();
