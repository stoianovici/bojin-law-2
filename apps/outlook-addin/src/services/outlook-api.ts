/**
 * Outlook API Service
 *
 * Wrapper around Office.context.mailbox for reading email data.
 * Provides typed access to the current mail item.
 */

// ============================================================================
// Types
// ============================================================================

export interface EmailRecipient {
  displayName: string;
  emailAddress: string;
}

export interface EmailInfo {
  /** The unique internet message ID (RFC 822) */
  internetMessageId: string | null;
  /** Graph API conversation ID for threading */
  conversationId: string | null;
  /** Email subject */
  subject: string;
  /** Sender information */
  from: EmailRecipient | null;
  /** To recipients */
  to: EmailRecipient[];
  /** CC recipients */
  cc: EmailRecipient[];
  /** Date when the email was sent */
  dateTimeSent: Date | null;
  /** Date when the email was received */
  dateTimeReceived: Date | null;
  /** Whether email has attachments */
  hasAttachments: boolean;
  /** Preview of the email body */
  bodyPreview: string;
  /** Item type (message, appointment, etc.) */
  itemType: string;
  /** Item ID in user's mailbox */
  itemId: string | null;
}

// ============================================================================
// Outlook API Service
// ============================================================================

class OutlookApiService {
  /**
   * Check if Office.context.mailbox is available
   */
  isAvailable(): boolean {
    return (
      typeof Office !== 'undefined' &&
      Office.context !== undefined &&
      Office.context.mailbox !== undefined
    );
  }

  /**
   * Get current mail item
   */
  getCurrentItem(): Office.MessageRead | null {
    if (!this.isAvailable()) {
      console.warn('[OutlookApi] Office.context.mailbox not available');
      return null;
    }

    const item = Office.context.mailbox.item;
    if (!item) {
      console.warn('[OutlookApi] No current item');
      return null;
    }

    return item as Office.MessageRead;
  }

  /**
   * Get email information from the current mail item
   */
  async getEmailInfo(): Promise<EmailInfo | null> {
    const item = this.getCurrentItem();
    if (!item) {
      return null;
    }

    try {
      // Get basic properties
      const subject = item.subject || '';
      const hasAttachments = item.attachments?.length > 0 || false;
      const itemType = item.itemType || 'message';

      // Get sender
      let from: EmailRecipient | null = null;
      if (item.from) {
        from = {
          displayName: item.from.displayName || '',
          emailAddress: item.from.emailAddress || '',
        };
      }

      // Get recipients
      const to: EmailRecipient[] = [];
      if (item.to) {
        for (const recipient of item.to) {
          to.push({
            displayName: recipient.displayName || '',
            emailAddress: recipient.emailAddress || '',
          });
        }
      }

      const cc: EmailRecipient[] = [];
      if (item.cc) {
        for (const recipient of item.cc) {
          cc.push({
            displayName: recipient.displayName || '',
            emailAddress: recipient.emailAddress || '',
          });
        }
      }

      // Get dates
      const dateTimeSent = item.dateTimeCreated || null;
      const dateTimeReceived = item.dateTimeModified || null;

      // Get internet message ID (async)
      const internetMessageId = await this.getInternetMessageId(item);

      // Get conversation ID (async)
      const conversationId = await this.getConversationId(item);

      // Get body preview
      const bodyPreview = await this.getBodyPreview(item);

      // Get item ID
      const itemId = item.itemId || null;

      return {
        internetMessageId,
        conversationId,
        subject,
        from,
        to,
        cc,
        dateTimeSent,
        dateTimeReceived,
        hasAttachments,
        bodyPreview,
        itemType,
        itemId,
      };
    } catch (error) {
      console.error('[OutlookApi] Failed to get email info:', error);
      return null;
    }
  }

  /**
   * Get the internet message ID (RFC 822 Message-ID header)
   */
  private async getInternetMessageId(item: Office.MessageRead): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        if (item.internetMessageId) {
          resolve(item.internetMessageId);
        } else {
          // Try getting from headers
          item.getAllInternetHeadersAsync((result) => {
            if (result.status === Office.AsyncResultStatus.Succeeded) {
              const headers = result.value;
              // Parse Message-ID from headers
              const messageIdMatch = headers.match(/^Message-ID:\s*<(.+)>/im);
              resolve(messageIdMatch ? messageIdMatch[1] : null);
            } else {
              resolve(null);
            }
          });
        }
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Get the conversation ID for threading
   */
  private async getConversationId(item: Office.MessageRead): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        if (item.conversationId) {
          resolve(item.conversationId);
        } else {
          // Conversation ID might not be immediately available
          // Try getting it from the item after a short delay
          setTimeout(() => {
            resolve(item.conversationId || null);
          }, 100);
        }
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Get body preview (first ~200 characters)
   */
  private async getBodyPreview(item: Office.MessageRead): Promise<string> {
    return new Promise((resolve) => {
      try {
        item.body.getAsync(Office.CoercionType.Text, { asyncContext: null }, (result) => {
          if (result.status === Office.AsyncResultStatus.Succeeded) {
            const text = result.value || '';
            // Return first 200 characters as preview
            const preview = text.substring(0, 200).trim();
            resolve(preview + (text.length > 200 ? '...' : ''));
          } else {
            resolve('');
          }
        });
      } catch {
        resolve('');
      }
    });
  }

  /**
   * Get the full email body as HTML
   */
  async getBodyHtml(): Promise<string | null> {
    const item = this.getCurrentItem();
    if (!item) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        item.body.getAsync(Office.CoercionType.Html, { asyncContext: null }, (result) => {
          if (result.status === Office.AsyncResultStatus.Succeeded) {
            resolve(result.value || null);
          } else {
            resolve(null);
          }
        });
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Get the full email body as text
   */
  async getBodyText(): Promise<string | null> {
    const item = this.getCurrentItem();
    if (!item) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        item.body.getAsync(Office.CoercionType.Text, { asyncContext: null }, (result) => {
          if (result.status === Office.AsyncResultStatus.Succeeded) {
            resolve(result.value || null);
          } else {
            resolve(null);
          }
        });
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Get user's email address
   */
  getUserEmailAddress(): string | null {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      return Office.context.mailbox.userProfile?.emailAddress || null;
    } catch {
      return null;
    }
  }

  /**
   * Get user's display name
   */
  getUserDisplayName(): string | null {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      return Office.context.mailbox.userProfile?.displayName || null;
    } catch {
      return null;
    }
  }

  /**
   * Get the EWS URL for the mailbox
   */
  getEwsUrl(): string | null {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      return Office.context.mailbox.ewsUrl || null;
    } catch {
      return null;
    }
  }

  /**
   * Get REST API URL for Graph API calls
   */
  getRestUrl(): string | null {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      return Office.context.mailbox.restUrl || null;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const outlookApi = new OutlookApiService();
