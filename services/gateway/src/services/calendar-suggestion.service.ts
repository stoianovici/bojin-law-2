/**
 * Calendar Suggestion Service
 * Story 5.2: Communication Intelligence Engine
 *
 * Generates calendar event suggestions from extracted deadlines and commitments.
 * Integrates with Microsoft Graph Calendar API for event creation.
 */

import { PrismaClient } from '@legal-platform/database';

// ============================================================================
// Types
// ============================================================================

export interface ExtractedItem {
  id: string;
  description: string;
  dueDate: Date;
  confidence: number;
  caseId: string | null;
  emailId: string;
}

export interface CalendarSuggestion {
  id: string;
  title: string;
  startDateTime: Date;
  endDateTime?: Date;
  isAllDay: boolean;
  description: string;
  caseId: string | null;
  sourceExtractionId: string;
  sourceType: 'deadline' | 'commitment' | 'meeting';
  reminderMinutes: number[];
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
}

export interface CreateEventRequest {
  suggestion: CalendarSuggestion;
  userId: string;
  calendarId?: string; // Default: user's primary calendar
}

export interface CreateEventResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

// Default reminder times (in minutes before event)
const DEFAULT_REMINDERS = {
  Low: [1440], // 1 day
  Medium: [1440, 60], // 1 day, 1 hour
  High: [2880, 1440, 60], // 2 days, 1 day, 1 hour
  Urgent: [2880, 1440, 240, 60], // 2 days, 1 day, 4 hours, 1 hour
};

// ============================================================================
// Calendar Suggestion Service
// ============================================================================

export class CalendarSuggestionService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate calendar suggestion from extracted deadline (AC: 3)
   */
  async suggestFromDeadline(deadline: ExtractedItem): Promise<CalendarSuggestion> {
    const priority = this.determinePriority(deadline);

    return {
      id: `suggestion-deadline-${deadline.id}`,
      title: `Deadline: ${this.truncateTitle(deadline.description)}`,
      startDateTime: deadline.dueDate,
      isAllDay: true,
      description: this.buildDescription(deadline, 'deadline'),
      caseId: deadline.caseId,
      sourceExtractionId: deadline.id,
      sourceType: 'deadline',
      reminderMinutes: DEFAULT_REMINDERS[priority],
      priority,
    };
  }

  /**
   * Generate calendar suggestion from extracted commitment
   */
  async suggestFromCommitment(commitment: ExtractedItem & { party: string }): Promise<CalendarSuggestion> {
    const priority = this.determinePriority(commitment);

    return {
      id: `suggestion-commitment-${commitment.id}`,
      title: `Commitment: ${this.truncateTitle(commitment.description)}`,
      startDateTime: commitment.dueDate,
      isAllDay: true,
      description: this.buildDescription(commitment, 'commitment', commitment.party),
      caseId: commitment.caseId,
      sourceExtractionId: commitment.id,
      sourceType: 'commitment',
      reminderMinutes: DEFAULT_REMINDERS[priority],
      priority,
    };
  }

  /**
   * Generate calendar suggestions for all pending deadlines in a case
   */
  async suggestForCase(caseId: string): Promise<CalendarSuggestion[]> {
    const suggestions: CalendarSuggestion[] = [];

    // Get pending deadlines
    const deadlines = await this.prisma.extractedDeadline.findMany({
      where: {
        caseId,
        status: 'Pending',
        dueDate: { gte: new Date() },
      },
      orderBy: { dueDate: 'asc' },
    });

    for (const deadline of deadlines) {
      suggestions.push(await this.suggestFromDeadline({
        id: deadline.id,
        description: deadline.description,
        dueDate: deadline.dueDate,
        confidence: deadline.confidence,
        caseId: deadline.caseId,
        emailId: deadline.emailId,
      }));
    }

    // Get pending commitments with due dates
    const commitments = await this.prisma.extractedCommitment.findMany({
      where: {
        caseId,
        status: 'Pending',
        dueDate: { not: null, gte: new Date() },
      },
      orderBy: { dueDate: 'asc' },
    });

    for (const commitment of commitments) {
      if (commitment.dueDate) {
        suggestions.push(await this.suggestFromCommitment({
          id: commitment.id,
          description: commitment.commitmentText,
          dueDate: commitment.dueDate,
          confidence: commitment.confidence,
          caseId: commitment.caseId,
          emailId: commitment.emailId,
          party: commitment.party,
        }));
      }
    }

    return suggestions;
  }

  /**
   * Create calendar event via Microsoft Graph API (AC: 3)
   */
  async createCalendarEvent(request: CreateEventRequest): Promise<CreateEventResult> {
    // This would integrate with Microsoft Graph API
    // For now, return a placeholder implementation
    const graphApiUrl = process.env.GRAPH_API_URL || 'https://graph.microsoft.com/v1.0';

    try {
      // Get user's access token (would be stored from OAuth flow)
      const user = await this.prisma.user.findUnique({
        where: { id: request.userId },
        select: { azureAdId: true },
      });

      if (!user?.azureAdId) {
        return { success: false, error: 'User not connected to Microsoft account' };
      }

      // Build Graph API event payload
      const eventPayload = {
        subject: request.suggestion.title,
        body: {
          contentType: 'text',
          content: request.suggestion.description,
        },
        start: {
          dateTime: request.suggestion.startDateTime.toISOString(),
          timeZone: 'Europe/Bucharest',
        },
        end: {
          dateTime: request.suggestion.endDateTime?.toISOString() ||
            new Date(request.suggestion.startDateTime.getTime() + 3600000).toISOString(),
          timeZone: 'Europe/Bucharest',
        },
        isAllDay: request.suggestion.isAllDay,
        reminderMinutesBeforeStart: Math.min(...request.suggestion.reminderMinutes),
      };

      // In production, make actual Graph API call:
      // const response = await fetch(`${graphApiUrl}/me/calendar/events`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${accessToken}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(eventPayload),
      // });

      // For development, simulate success
      console.log('[Calendar Suggestion] Would create event:', eventPayload);

      return {
        success: true,
        eventId: `mock-event-${Date.now()}`,
      };
    } catch (error) {
      console.error('[Calendar Suggestion] Error creating event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Mark extraction as converted after calendar event creation
   */
  async markAsConverted(
    sourceType: 'deadline' | 'commitment',
    extractionId: string
  ): Promise<void> {
    if (sourceType === 'deadline') {
      await this.prisma.extractedDeadline.update({
        where: { id: extractionId },
        data: { status: 'Converted' },
      });
    } else {
      await this.prisma.extractedCommitment.update({
        where: { id: extractionId },
        data: { status: 'Converted' },
      });
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private determinePriority(item: ExtractedItem): 'Low' | 'Medium' | 'High' | 'Urgent' {
    const daysUntilDue = Math.ceil(
      (item.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDue <= 1) return 'Urgent';
    if (daysUntilDue <= 3) return 'High';
    if (daysUntilDue <= 7) return 'Medium';
    return 'Low';
  }

  private truncateTitle(text: string, maxLength: number = 100): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private buildDescription(
    item: ExtractedItem,
    type: 'deadline' | 'commitment',
    party?: string
  ): string {
    const parts: string[] = [];

    parts.push(`Source: Email intelligence extraction`);
    parts.push(`Type: ${type === 'deadline' ? 'Deadline' : 'Commitment'}`);
    if (party) parts.push(`Party: ${party}`);
    parts.push(`Confidence: ${Math.round(item.confidence * 100)}%`);
    parts.push('');
    parts.push('Description:');
    parts.push(item.description);

    return parts.join('\n');
  }
}

// Factory function for dependency injection
export function createCalendarSuggestionService(prisma: PrismaClient): CalendarSuggestionService {
  return new CalendarSuggestionService(prisma);
}
