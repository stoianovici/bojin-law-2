/**
 * Outlook Integration Utilities
 * OPS-192: Helper functions for opening Outlook desktop/web for email composition
 *
 * Uses ms-outlook:// protocol for desktop app, with fallback to Outlook Web.
 */

// ============================================================================
// Types
// ============================================================================

interface OutlookComposeOptions {
  to?: string;
  subject?: string;
  body?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract email address from a "Name <email>" format or plain email
 */
export function extractEmail(from: string): string {
  // Match email in angle brackets: "John Doe <john@example.com>"
  const match = from.match(/<([^>]+)>/);
  if (match) {
    return match[1];
  }
  // If no angle brackets, assume it's just the email
  return from.trim();
}

/**
 * Build Outlook desktop URL (ms-outlook:// protocol)
 */
function buildDesktopUrl(options: OutlookComposeOptions): string {
  const params = new URLSearchParams();

  if (options.to) {
    params.set('to', options.to);
  }
  if (options.subject) {
    params.set('subject', options.subject);
  }
  if (options.body) {
    params.set('body', options.body);
  }

  const queryString = params.toString();
  return queryString ? `ms-outlook://compose?${queryString}` : 'ms-outlook://compose';
}

/**
 * Build Outlook Web URL (deeplink)
 */
function buildWebUrl(options: OutlookComposeOptions): string {
  const baseUrl = 'https://outlook.office.com/mail/deeplink/compose';
  const params = new URLSearchParams();

  if (options.to) {
    params.set('to', options.to);
  }
  if (options.subject) {
    params.set('subject', options.subject);
  }
  if (options.body) {
    params.set('body', options.body);
  }

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Open Outlook to compose a new email (no reply context)
 * Tries desktop first, falls back to web after timeout
 */
export function openOutlookCompose(): void {
  const desktopUrl = buildDesktopUrl({});
  const webUrl = buildWebUrl({});

  // Attempt desktop app first
  window.location.href = desktopUrl;

  // Fallback to web after short delay if desktop doesn't open
  setTimeout(() => {
    window.open(webUrl, '_blank');
  }, 500);
}

/**
 * Open Outlook to reply to an email
 * Prefills the to address and subject with Re: prefix
 *
 * @param senderEmail - The sender's email address (from field)
 * @param subject - Original email subject
 */
export function openOutlookReply(senderEmail: string, subject: string): void {
  const to = extractEmail(senderEmail);
  const replySubject =
    subject.startsWith('Re:') || subject.startsWith('RE:') ? subject : `Re: ${subject}`;

  const desktopUrl = buildDesktopUrl({ to, subject: replySubject });
  const webUrl = buildWebUrl({ to, subject: replySubject });

  // Attempt desktop app first
  window.location.href = desktopUrl;

  // Fallback to web after short delay if desktop doesn't open
  setTimeout(() => {
    window.open(webUrl, '_blank');
  }, 500);
}
