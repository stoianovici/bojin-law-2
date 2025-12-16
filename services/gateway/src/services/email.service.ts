// Story 4.4: Email Service
// Sends task reminder emails via Microsoft Graph API

import { EmailReminderPayload } from '@legal-platform/types';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

// Note: Requires Mail.Send permission in Azure AD app registration (Story 2.5)

// ============================================================================
// Email Configuration
// ============================================================================

interface EmailConfig {
  from?: string;
  maxRetries: number;
  retryDelayMs: number;
}

const defaultConfig: EmailConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
};

// ============================================================================
// Email Sending (AC: 6)
// ============================================================================

/**
 * Sends a task reminder email via Microsoft Graph API
 */
export async function sendTaskReminderEmail(
  payload: EmailReminderPayload,
  accessToken: string,
  config: Partial<EmailConfig> = {}
): Promise<boolean> {
  const finalConfig = { ...defaultConfig, ...config };

  const emailContent = generateReminderEmailHTML(payload);

  const message = {
    message: {
      subject: payload.isOverdue
        ? `OVERDUE: ${payload.taskTitle}`
        : `Reminder: ${payload.taskTitle} due ${payload.daysUntilDue === 0 ? 'today' : `in ${payload.daysUntilDue} day(s)`}`,
      body: {
        contentType: 'HTML',
        content: emailContent,
      },
      toRecipients: [
        {
          emailAddress: {
            address: payload.to,
            name: payload.toName,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  return sendEmailWithRetry(message, accessToken, finalConfig);
}

/**
 * Sends an overdue notification email
 */
export async function sendOverdueNotification(
  payload: EmailReminderPayload,
  accessToken: string,
  config: Partial<EmailConfig> = {}
): Promise<boolean> {
  const finalConfig = { ...defaultConfig, ...config };

  const emailContent = generateOverdueEmailHTML(payload);

  const message = {
    message: {
      subject: `OVERDUE: ${payload.taskTitle}`,
      body: {
        contentType: 'HTML',
        content: emailContent,
      },
      toRecipients: [
        {
          emailAddress: {
            address: payload.to,
            name: payload.toName,
          },
        },
      ],
      importance: 'high',
    },
    saveToSentItems: true,
  };

  return sendEmailWithRetry(message, accessToken, finalConfig);
}

/**
 * Sends a dependency unblocked email
 */
export async function sendDependencyUnblockedEmail(
  userId: string,
  taskTitle: string,
  caseTitle: string,
  taskUrl: string,
  userEmail: string,
  userName: string,
  unblockedByTaskTitle: string,
  accessToken: string,
  config: Partial<EmailConfig> = {}
): Promise<boolean> {
  const finalConfig = { ...defaultConfig, ...config };

  const emailContent = `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #22c55e;">Task Unblocked</h2>
        <p>Hello ${userName},</p>
        <p>Your task is now ready to start:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Task:</strong> ${taskTitle}</p>
          <p><strong>Case:</strong> ${caseTitle}</p>
          <p><strong>Unblocked by:</strong> ${unblockedByTaskTitle}</p>
        </div>
        <p>
          <a href="${taskUrl}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Task
          </a>
        </p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated notification from your Legal Platform.
        </p>
      </body>
    </html>
  `;

  const message = {
    message: {
      subject: `Task Unblocked: ${taskTitle}`,
      body: {
        contentType: 'HTML',
        content: emailContent,
      },
      toRecipients: [
        {
          emailAddress: {
            address: userEmail,
            name: userName,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  return sendEmailWithRetry(message, accessToken, finalConfig);
}

// ============================================================================
// Helper Functions
// ============================================================================

async function sendEmailWithRetry(
  message: any,
  accessToken: string,
  config: EmailConfig
): Promise<boolean> {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      await client.api('/me/sendMail').post(message);
      return true;
    } catch (error) {
      lastError = error as Error;
      console.error(`Email send attempt ${attempt + 1} failed:`, error);

      if (attempt < config.maxRetries - 1) {
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, config.retryDelayMs * (attempt + 1)));
      }
    }
  }

  console.error('All email send attempts failed:', lastError);
  return false;
}

function generateReminderEmailHTML(payload: EmailReminderPayload): string {
  const urgencyColor =
    payload.daysUntilDue === 0 ? '#ef4444' : payload.daysUntilDue === 1 ? '#f59e0b' : '#3b82f6';
  const urgencyText =
    payload.daysUntilDue === 0
      ? 'DUE TODAY'
      : payload.daysUntilDue === 1
        ? 'DUE TOMORROW'
        : `DUE IN ${payload.daysUntilDue} DAYS`;

  return `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${urgencyColor};">Task Reminder: ${urgencyText}</h2>
        <p>Hello ${payload.toName},</p>
        <p>This is a reminder about an upcoming task deadline:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Task:</strong> ${payload.taskTitle}</p>
          <p><strong>Case:</strong> ${payload.caseTitle}</p>
          <p><strong>Due Date:</strong> ${payload.dueDate.toLocaleDateString()}</p>
        </div>
        <p>
          <a href="${payload.taskUrl}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Task
          </a>
        </p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated reminder from your Legal Platform.
        </p>
      </body>
    </html>
  `;
}

function generateOverdueEmailHTML(payload: EmailReminderPayload): string {
  const daysPast = Math.abs(payload.daysUntilDue);

  return `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">⚠️ Task Overdue</h2>
        <p>Hello ${payload.toName},</p>
        <p><strong>This task is now ${daysPast} day(s) overdue:</strong></p>
        <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <p><strong>Task:</strong> ${payload.taskTitle}</p>
          <p><strong>Case:</strong> ${payload.caseTitle}</p>
          <p><strong>Was Due:</strong> ${payload.dueDate.toLocaleDateString()}</p>
        </div>
        <p>Please review and update the status of this task as soon as possible.</p>
        <p>
          <a href="${payload.taskUrl}" style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Task Now
          </a>
        </p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px;">
          This is an automated notification from your Legal Platform.
        </p>
      </body>
    </html>
  `;
}

// ============================================================================
// Daily Digest Email (Story 4.6: AC 6)
// ============================================================================

interface DigestCaseSummary {
  caseId: string;
  caseTitle: string;
  caseNumber: string;
  taskUpdates: DigestTaskUpdate[];
  newComments: number;
  newAttachments: number;
}

interface DigestTaskUpdate {
  taskId: string;
  taskTitle: string;
  updateType: 'created' | 'completed' | 'statusChanged' | 'assigned' | 'commented';
  summary: string;
  actor: string;
  timestamp: Date;
}

interface DailyDigest {
  userId: string;
  date: Date;
  cases: DigestCaseSummary[];
}

/**
 * Sends a daily digest email via Microsoft Graph API
 * Story 4.6: Task Collaboration and Updates (AC: 6)
 */
export async function sendDailyDigestEmail(
  userEmail: string,
  userName: string,
  digest: DailyDigest,
  accessToken: string,
  config: Partial<EmailConfig> = {}
): Promise<boolean> {
  const finalConfig = { ...defaultConfig, ...config };

  // Skip if no updates
  if (digest.cases.length === 0) {
    return true;
  }

  const emailContent = generateDigestEmailHTML(digest, userName);
  const dateStr = digest.date.toLocaleDateString('ro-RO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const message = {
    message: {
      subject: `Daily Digest - ${dateStr}`,
      body: {
        contentType: 'HTML',
        content: emailContent,
      },
      toRecipients: [
        {
          emailAddress: {
            address: userEmail,
            name: userName,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  return sendEmailWithRetry(message, accessToken, finalConfig);
}

/**
 * Generate HTML for daily digest email
 * Supports bilingual format (Romanian/English)
 */
export function generateDigestEmailHTML(digest: DailyDigest, userName: string): string {
  const dateStr = digest.date.toLocaleDateString('ro-RO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Count totals
  let totalTaskUpdates = 0;
  let totalComments = 0;
  let totalAttachments = 0;

  for (const caseSummary of digest.cases) {
    totalTaskUpdates += caseSummary.taskUpdates.length;
    totalComments += caseSummary.newComments;
    totalAttachments += caseSummary.newAttachments;
  }

  // Generate case sections
  const caseSections = digest.cases
    .map((caseSummary) => generateCaseSectionHTML(caseSummary))
    .join('');

  return `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background-color: #f9fafb; padding: 20px;">
        <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h1 style="color: #1f2937; margin-top: 0; font-size: 24px;">
            📋 Daily Digest / Rezumat Zilnic
          </h1>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
            ${dateStr}
          </p>

          <p>Hello ${userName} / Bună ${userName},</p>

          <p style="color: #374151;">
            Here's your daily summary of case activity. / Iată rezumatul activității zilnice.
          </p>

          <!-- Summary Stats -->
          <div style="display: flex; gap: 15px; margin: 20px 0; flex-wrap: wrap;">
            <div style="background-color: #eff6ff; padding: 15px 20px; border-radius: 8px; flex: 1; min-width: 150px;">
              <div style="font-size: 24px; font-weight: bold; color: #1d4ed8;">${totalTaskUpdates}</div>
              <div style="color: #3b82f6; font-size: 12px;">Task Updates</div>
            </div>
            <div style="background-color: #f0fdf4; padding: 15px 20px; border-radius: 8px; flex: 1; min-width: 150px;">
              <div style="font-size: 24px; font-weight: bold; color: #15803d;">${totalComments}</div>
              <div style="color: #22c55e; font-size: 12px;">New Comments</div>
            </div>
            <div style="background-color: #fefce8; padding: 15px 20px; border-radius: 8px; flex: 1; min-width: 150px;">
              <div style="font-size: 24px; font-weight: bold; color: #a16207;">${totalAttachments}</div>
              <div style="color: #eab308; font-size: 12px;">New Attachments</div>
            </div>
          </div>

          <!-- Case Sections -->
          ${caseSections}

          <!-- Footer -->
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            This is an automated daily digest from your Legal Platform.<br/>
            Aceasta este un rezumat zilnic automat de la Platforma Juridică.
          </p>
          <p style="text-align: center;">
            <a href="${process.env.APP_URL || ''}/settings/notifications" style="color: #6b7280; font-size: 12px;">
              Manage notification settings / Gestionați setările notificărilor
            </a>
          </p>
        </div>
      </body>
    </html>
  `;
}

function generateCaseSectionHTML(caseSummary: DigestCaseSummary): string {
  const appUrl = process.env.APP_URL || '';

  // Generate task update items
  const taskItems = caseSummary.taskUpdates
    .map((update) => {
      const icon = getTaskUpdateIcon(update.updateType);
      const time = new Date(update.timestamp).toLocaleTimeString('ro-RO', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="margin-right: 8px;">${icon}</span>
            <a href="${appUrl}/cases/${caseSummary.caseId}?task=${update.taskId}" style="color: #2563eb; text-decoration: none;">
              ${update.taskTitle}
            </a>
            <span style="color: #9ca3af; font-size: 12px; margin-left: 8px;">${time}</span>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 13px;">
            ${update.summary}
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; color: #9ca3af; font-size: 12px;">
            ${update.actor}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="margin: 25px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #f9fafb; padding: 15px 20px; border-bottom: 1px solid #e5e7eb;">
        <a href="${appUrl}/cases/${caseSummary.caseId}" style="color: #1f2937; text-decoration: none; font-weight: 600; font-size: 16px;">
          📁 ${caseSummary.caseTitle}
        </a>
        <span style="color: #9ca3af; font-size: 13px; margin-left: 10px;">#${caseSummary.caseNumber}</span>
      </div>
      <div style="padding: 15px 20px;">
        ${
          caseSummary.taskUpdates.length > 0
            ? `
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="color: #6b7280; font-size: 12px; text-transform: uppercase;">
                <th style="text-align: left; padding: 8px 0;">Task</th>
                <th style="text-align: left; padding: 8px 0;">Update</th>
                <th style="text-align: left; padding: 8px 0;">By</th>
              </tr>
            </thead>
            <tbody>
              ${taskItems}
            </tbody>
          </table>
        `
            : ''
        }
        ${
          caseSummary.newComments > 0 || caseSummary.newAttachments > 0
            ? `
          <div style="margin-top: 15px; display: flex; gap: 20px; color: #6b7280; font-size: 13px;">
            ${caseSummary.newComments > 0 ? `<span>💬 ${caseSummary.newComments} new comment(s)</span>` : ''}
            ${caseSummary.newAttachments > 0 ? `<span>📎 ${caseSummary.newAttachments} new attachment(s)</span>` : ''}
          </div>
        `
            : ''
        }
      </div>
    </div>
  `;
}

function getTaskUpdateIcon(updateType: string): string {
  switch (updateType) {
    case 'created':
      return '➕';
    case 'completed':
      return '✅';
    case 'statusChanged':
      return '🔄';
    case 'assigned':
      return '👤';
    case 'commented':
      return '💬';
    default:
      return '📝';
  }
}
