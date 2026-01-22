/**
 * Activity Emitter Service
 *
 * Emits activity events to the team chat as system messages.
 * Used to populate the unified activity feed with automated notifications.
 */

import { teamChatService, ChatAttachment } from './team-chat.service';

// ============================================================================
// Activity Types
// ============================================================================

export type ActivityType =
  | 'doc_upload'
  | 'task_created'
  | 'task_completed'
  | 'calendar_event'
  | 'mapa_created'
  | 'mapa_completed';

// ============================================================================
// Message Templates (Romanian)
// ============================================================================

const ACTIVITY_TEMPLATES: Record<ActivityType, string> = {
  doc_upload: '{userName} a încărcat {docName}',
  task_created: '{userName} a creat taskul "{taskTitle}"',
  task_completed: '{userName} a finalizat taskul "{taskTitle}"',
  calendar_event: '{userName} a programat "{eventTitle}" pentru {date}',
  mapa_created: '{userName} a creat mapa "{mapaName}"',
  mapa_completed: 'Mapa "{mapaName}" a fost finalizată',
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatMessage(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(`{${key}}`, value);
  }
  return result;
}

// ============================================================================
// Service
// ============================================================================

class ActivityEmitterService {
  /**
   * Emit document uploaded activity
   */
  async emitDocumentUploaded(
    firmId: string,
    userName: string,
    doc: { id: string; name: string; url?: string }
  ) {
    const content = formatMessage(ACTIVITY_TEMPLATES.doc_upload, {
      userName,
      docName: doc.name,
    });

    const attachments: ChatAttachment[] = [
      {
        type: 'document',
        id: doc.id,
        name: doc.name,
        url: doc.url,
      },
    ];

    return teamChatService.sendSystemMessage(firmId, 'doc_upload', doc.id, content, attachments);
  }

  /**
   * Emit task created activity
   */
  async emitTaskCreated(firmId: string, userName: string, task: { id: string; title: string }) {
    const content = formatMessage(ACTIVITY_TEMPLATES.task_created, {
      userName,
      taskTitle: task.title,
    });

    return teamChatService.sendSystemMessage(firmId, 'task_created', task.id, content);
  }

  /**
   * Emit task completed activity
   */
  async emitTaskCompleted(firmId: string, userName: string, task: { id: string; title: string }) {
    const content = formatMessage(ACTIVITY_TEMPLATES.task_completed, {
      userName,
      taskTitle: task.title,
    });

    return teamChatService.sendSystemMessage(firmId, 'task_completed', task.id, content);
  }

  /**
   * Emit calendar event created activity
   */
  async emitCalendarEvent(
    firmId: string,
    userName: string,
    event: { id: string; title: string; date: string }
  ) {
    const content = formatMessage(ACTIVITY_TEMPLATES.calendar_event, {
      userName,
      eventTitle: event.title,
      date: event.date,
    });

    return teamChatService.sendSystemMessage(firmId, 'calendar_event', event.id, content);
  }

  /**
   * Emit mapa created activity
   */
  async emitMapaCreated(firmId: string, userName: string, mapa: { id: string; name: string }) {
    const content = formatMessage(ACTIVITY_TEMPLATES.mapa_created, {
      userName,
      mapaName: mapa.name,
    });

    return teamChatService.sendSystemMessage(firmId, 'mapa_created', mapa.id, content);
  }

  /**
   * Emit mapa completed activity
   */
  async emitMapaCompleted(firmId: string, mapa: { id: string; name: string }) {
    const content = formatMessage(ACTIVITY_TEMPLATES.mapa_completed, {
      mapaName: mapa.name,
    });

    return teamChatService.sendSystemMessage(firmId, 'mapa_completed', mapa.id, content);
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const activityEmitter = new ActivityEmitterService();
