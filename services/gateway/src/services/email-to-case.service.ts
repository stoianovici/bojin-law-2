/**
 * Email to Case Service
 * OPS-022: Email-to-Case Timeline Integration
 *
 * Orchestrates importing emails by contact addresses into a case:
 * - Query emails by participant email addresses
 * - Bulk-link emails to a case
 * - Extract unique contacts from email participants
 * - Import attachments as case documents
 */

import { prisma } from '@legal-platform/database';
import { CaseActorRole } from '@prisma/client';
import { getEmailAttachmentService } from './email-attachment.service';
import { caseActivityService } from './case-activity.service';
import { unifiedTimelineService } from './unified-timeline.service';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ContactCandidate {
  email: string;
  name: string | null;
  occurrences: number;
  suggestedRole: CaseActorRole | null;
  isExistingActor: boolean;
}

export interface EmailImportPreview {
  emailCount: number;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  contacts: ContactCandidate[];
  attachmentCount: number;
  threadCount: number;
}

export interface ContactRoleAssignment {
  email: string;
  name: string | null;
  role: CaseActorRole;
}

export interface EmailImportInput {
  caseId: string;
  emailAddresses: string[];
  contactAssignments: ContactRoleAssignment[];
  importAttachments: boolean;
}

export interface EmailImportResult {
  success: boolean;
  emailsLinked: number;
  contactsCreated: number;
  attachmentsImported: number;
  errors: string[];
  /** Diagnostic info for debugging attachment import issues */
  _debug?: {
    hadAccessToken: boolean;
    importAttachmentsRequested: boolean;
    emailsWithAttachmentsCount: number;
    /** Details from each email's attachment sync attempt */
    attachmentSyncDetails?: Array<{
      emailId: string;
      graphMessageId: string;
      attachmentsFromGraph: number;
      attachmentsSynced: number;
      attachmentsSkipped: number;
      attachmentsAlreadyExist: number;
      upgradedWithDocument: number;
      orphanedDocumentIds: number;
      emailCaseId: string | null;
      errors: string[];
    }>;
  };
}

export interface UserContext {
  userId: string;
  firmId: string;
  accessToken?: string;
}

// ============================================================================
// Service
// ============================================================================

export class EmailToCaseService {
  /**
   * Preview what will be imported before executing
   * Shows email count, date range, discovered contacts, attachment count
   */
  async previewEmailImport(
    emailAddresses: string[],
    userContext: UserContext
  ): Promise<EmailImportPreview> {
    const { userId, firmId } = userContext;
    const normalizedAddresses = emailAddresses.map((e) => e.toLowerCase().trim());

    logger.info('[EmailToCaseService.previewEmailImport] Starting preview', {
      emailAddresses: normalizedAddresses,
      userId,
    });

    // Find all emails where any of the provided addresses appear in from/to/cc
    const emails = await this.findEmailsByParticipants(normalizedAddresses, userId, firmId);

    if (emails.length === 0) {
      return {
        emailCount: 0,
        dateRange: { start: null, end: null },
        contacts: [],
        attachmentCount: 0,
        threadCount: 0,
      };
    }

    // Calculate date range
    const dates = emails.map((e) => e.receivedDateTime);
    const dateRange = {
      start: new Date(Math.min(...dates.map((d) => d.getTime()))),
      end: new Date(Math.max(...dates.map((d) => d.getTime()))),
    };

    // Extract unique contacts
    const contacts = await this.extractContactsFromEmails(emails, userContext);

    // Count attachments
    const attachmentCount = emails.reduce((sum, e) => sum + (e.hasAttachments ? 1 : 0), 0);

    // Count unique threads
    const threadIds = new Set(emails.map((e) => e.conversationId));

    logger.info('[EmailToCaseService.previewEmailImport] Preview complete', {
      emailCount: emails.length,
      contactCount: contacts.length,
      attachmentCount,
      threadCount: threadIds.size,
    });

    return {
      emailCount: emails.length,
      dateRange,
      contacts,
      attachmentCount,
      threadCount: threadIds.size,
    };
  }

  /**
   * Execute the email import
   * Links emails to case, creates contacts, imports attachments
   */
  async executeEmailImport(
    input: EmailImportInput,
    userContext: UserContext
  ): Promise<EmailImportResult> {
    const { caseId, emailAddresses, contactAssignments, importAttachments } = input;
    const { userId, firmId, accessToken } = userContext;
    const normalizedAddresses = emailAddresses.map((e) => e.toLowerCase().trim());

    const result: EmailImportResult = {
      success: true,
      emailsLinked: 0,
      contactsCreated: 0,
      attachmentsImported: 0,
      errors: [],
    };

    logger.info('[EmailToCaseService.executeEmailImport] Starting import', {
      caseId,
      emailAddresses: normalizedAddresses,
      contactCount: contactAssignments.length,
      importAttachments,
    });

    try {
      // 1. Verify case exists and user has access
      const caseRecord = await prisma.case.findFirst({
        where: {
          id: caseId,
          firmId,
          teamMembers: {
            some: { userId },
          },
        },
      });

      if (!caseRecord) {
        throw new Error('Case not found or access denied');
      }

      // 2. Find and link emails
      const emails = await this.findEmailsByParticipants(normalizedAddresses, userId, firmId);

      if (emails.length > 0) {
        // Link all found emails to the case
        const linkedResult = await prisma.email.updateMany({
          where: {
            id: { in: emails.map((e) => e.id) },
            userId,
            firmId,
          },
          data: {
            caseId,
          },
        });

        result.emailsLinked = linkedResult.count;

        // Sync emails to CommunicationEntry for unified timeline display
        // This is critical - without this, emails won't appear in the Communications tab
        logger.info('[EmailToCaseService.executeEmailImport] Syncing emails to timeline', {
          emailCount: emails.length,
          emailIds: emails.map((e) => e.id),
        });

        let syncedCount = 0;
        let syncErrors: string[] = [];

        for (const email of emails) {
          try {
            logger.info('[EmailToCaseService.executeEmailImport] Syncing email', {
              emailId: email.id,
              subject: email.subject?.substring(0, 50),
            });
            const syncResult = await unifiedTimelineService.syncEmailToCommunicationEntry(email.id);
            if (syncResult) {
              syncedCount++;
              logger.info('[EmailToCaseService.executeEmailImport] Email synced successfully', {
                emailId: email.id,
                communicationEntryId: syncResult.id,
              });
            } else {
              logger.warn('[EmailToCaseService.executeEmailImport] Sync returned null', {
                emailId: email.id,
              });
            }
          } catch (syncError: any) {
            const errorMsg = `Email ${email.id}: ${syncError.message}`;
            syncErrors.push(errorMsg);
            logger.error(
              '[EmailToCaseService.executeEmailImport] Failed to sync email to timeline',
              {
                emailId: email.id,
                error: syncError.message,
                stack: syncError.stack,
              }
            );
          }
        }

        logger.info('[EmailToCaseService.executeEmailImport] Timeline sync complete', {
          syncedCount,
          errorCount: syncErrors.length,
          errors: syncErrors,
        });

        // Add sync errors to result
        if (syncErrors.length > 0) {
          result.errors.push(...syncErrors.map((e) => `Timeline sync: ${e}`));
        }

        // Record activity for the import
        await caseActivityService.recordActivity(
          caseId,
          userId,
          'CommunicationReceived',
          'Communication',
          caseId,
          `${result.emailsLinked} emailuri importate`,
          `Emailuri importate de la: ${normalizedAddresses.join(', ')}`,
          { emailAddresses: normalizedAddresses, emailCount: result.emailsLinked }
        );
      }

      // 3. Create case actors for assigned contacts
      for (const assignment of contactAssignments) {
        try {
          // Check if actor already exists
          const existingActor = await prisma.caseActor.findFirst({
            where: {
              caseId,
              email: assignment.email.toLowerCase(),
            },
          });

          if (!existingActor) {
            await prisma.caseActor.create({
              data: {
                caseId,
                email: assignment.email.toLowerCase(),
                name: assignment.name || assignment.email,
                role: assignment.role,
                createdBy: userId,
              },
            });
            result.contactsCreated++;
          }
        } catch (error: any) {
          result.errors.push(`Failed to create contact ${assignment.email}: ${error.message}`);
        }
      }

      // 4. Import attachments if requested and access token available
      const emailsWithAttachments = emails.filter((e) => e.hasAttachments);

      // Add debug info to result
      result._debug = {
        hadAccessToken: !!accessToken,
        importAttachmentsRequested: importAttachments,
        emailsWithAttachmentsCount: emailsWithAttachments.length,
        attachmentSyncDetails: [],
      };

      logger.info('[EmailToCaseService.executeEmailImport] Attachment import check', {
        importAttachments,
        hasAccessToken: !!accessToken,
        willImportAttachments: !!(importAttachments && accessToken),
        emailsWithAttachments: emailsWithAttachments.length,
      });

      if (importAttachments && accessToken) {
        logger.info('[EmailToCaseService.executeEmailImport] Starting attachment import', {
          emailsWithAttachments: emailsWithAttachments.length,
          emailIds: emailsWithAttachments.map((e) => e.id),
        });
        const attachmentService = getEmailAttachmentService(prisma);

        for (const email of emailsWithAttachments) {
          try {
            logger.info('[EmailToCaseService.executeEmailImport] Syncing attachments for email', {
              emailId: email.id,
              graphMessageId: email.graphMessageId,
              subject: email.subject?.substring(0, 50),
            });
            const syncResult = await attachmentService.syncAllAttachments(email.id, accessToken);
            logger.info('[EmailToCaseService.executeEmailImport] Attachment sync result', {
              emailId: email.id,
              success: syncResult.success,
              attachmentsSynced: syncResult.attachmentsSynced,
              totalAttachments: syncResult.attachments.length,
              diagnostics: syncResult._diagnostics,
              errors: syncResult.errors,
              attachmentDetails: syncResult.attachments.map((a) => ({
                name: a.name,
                documentId: a.documentId,
                storageUrl: a.storageUrl ? 'set' : 'null',
              })),
            });
            result.attachmentsImported += syncResult.attachmentsSynced;

            // Add diagnostic details for this email
            result._debug!.attachmentSyncDetails!.push({
              emailId: email.id,
              graphMessageId: syncResult._diagnostics?.graphMessageId || email.graphMessageId,
              attachmentsFromGraph: syncResult._diagnostics?.attachmentsFromGraph || 0,
              attachmentsSynced: syncResult.attachmentsSynced,
              attachmentsSkipped: syncResult._diagnostics?.skippedNonFile || 0,
              attachmentsAlreadyExist: syncResult._diagnostics?.skippedAlreadyExist || 0,
              upgradedWithDocument: syncResult._diagnostics?.upgradedWithDocument || 0,
              orphanedDocumentIds: syncResult._diagnostics?.orphanedDocumentIds || 0,
              emailCaseId: syncResult._diagnostics?.emailCaseId || null,
              errors: syncResult.errors,
            });

            if (syncResult.errors.length > 0) {
              result.errors.push(...syncResult.errors);
            }
          } catch (error: any) {
            logger.error('[EmailToCaseService.executeEmailImport] Attachment sync failed', {
              emailId: email.id,
              error: error.message,
              stack: error.stack,
            });
            result.errors.push(
              `Failed to sync attachments for email ${email.id}: ${error.message}`
            );
            // Add error to diagnostic details
            result._debug!.attachmentSyncDetails!.push({
              emailId: email.id,
              graphMessageId: email.graphMessageId,
              attachmentsFromGraph: 0,
              attachmentsSynced: 0,
              attachmentsSkipped: 0,
              attachmentsAlreadyExist: 0,
              upgradedWithDocument: 0,
              orphanedDocumentIds: 0,
              emailCaseId: null,
              errors: [error.message],
            });
          }
        }
      } else {
        logger.warn('[EmailToCaseService.executeEmailImport] Skipping attachment import', {
          reason: !importAttachments ? 'importAttachments=false' : 'no accessToken',
        });
      }

      // Set success based on whether critical operations succeeded
      result.success = result.errors.length === 0 || result.emailsLinked > 0;

      logger.info('[EmailToCaseService.executeEmailImport] Import complete', result);

      return result;
    } catch (error: any) {
      logger.error('[EmailToCaseService.executeEmailImport] Import failed', {
        error: error.message,
      });
      result.success = false;
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Find emails where any of the given addresses appear as sender or recipient
   * Uses raw SQL with PostgreSQL JSONB operators for reliable array element matching
   */
  private async findEmailsByParticipants(
    emailAddresses: string[],
    userId: string,
    firmId: string
  ): Promise<any[]> {
    if (emailAddresses.length === 0) {
      return [];
    }

    // Build dynamic OR conditions for each email address
    // Uses PostgreSQL JSONB operators to search within JSON arrays:
    // - "from"->>'address' for the from field (JSON object)
    // - jsonb_array_elements for toRecipients/ccRecipients (JSON arrays)
    const addressConditions = emailAddresses
      .map(
        (_, idx) => `(
          LOWER("from"->>'address') LIKE LOWER($${idx + 4})
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements("to_recipients") AS r
            WHERE LOWER(r->>'address') LIKE LOWER($${idx + 4})
          )
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements("cc_recipients") AS r
            WHERE LOWER(r->>'address') LIKE LOWER($${idx + 4})
          )
        )`
      )
      .join(' OR ');

    // Build parameter array: [userId, firmId, false, ...addresses]
    const params = [userId, firmId, false, ...emailAddresses.map((addr) => `%${addr}%`)];

    const emails = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT *
      FROM "emails"
      WHERE "user_id" = $1
        AND "firm_id" = $2
        AND "is_ignored" = $3
        AND (${addressConditions})
      ORDER BY "received_date_time" DESC
      `,
      ...params
    );

    // Map snake_case columns to camelCase for consistency with Prisma
    return emails.map((email) => ({
      id: email.id,
      graphMessageId: email.graph_message_id,
      conversationId: email.conversation_id,
      internetMessageId: email.internet_message_id,
      subject: email.subject,
      bodyPreview: email.body_preview,
      bodyContent: email.body_content,
      bodyContentType: email.body_content_type,
      from: email.from,
      toRecipients: email.to_recipients,
      ccRecipients: email.cc_recipients,
      bccRecipients: email.bcc_recipients,
      receivedDateTime: email.received_date_time,
      sentDateTime: email.sent_date_time,
      hasAttachments: email.has_attachments,
      importance: email.importance,
      isRead: email.is_read,
      isIgnored: email.is_ignored,
      ignoredAt: email.ignored_at,
      userId: email.user_id,
      caseId: email.case_id,
      firmId: email.firm_id,
      syncedAt: email.synced_at,
      createdAt: email.created_at,
      updatedAt: email.updated_at,
    }));
  }

  /**
   * Extract unique contacts from email participants
   * Returns candidates with occurrence count and suggested roles
   */
  private async extractContactsFromEmails(
    emails: any[],
    userContext: UserContext
  ): Promise<ContactCandidate[]> {
    const contactMap = new Map<string, { name: string | null; count: number }>();

    for (const email of emails) {
      // Process 'from' field
      const from = email.from as { name?: string; address: string };
      if (from?.address) {
        const addr = from.address.toLowerCase();
        const existing = contactMap.get(addr);
        contactMap.set(addr, {
          name: existing?.name || from.name || null,
          count: (existing?.count || 0) + 1,
        });
      }

      // Process toRecipients
      const toRecipients = (email.toRecipients || []) as Array<{ name?: string; address: string }>;
      for (const recipient of toRecipients) {
        if (recipient?.address) {
          const addr = recipient.address.toLowerCase();
          const existing = contactMap.get(addr);
          contactMap.set(addr, {
            name: existing?.name || recipient.name || null,
            count: (existing?.count || 0) + 1,
          });
        }
      }

      // Process ccRecipients
      const ccRecipients = (email.ccRecipients || []) as Array<{ name?: string; address: string }>;
      for (const recipient of ccRecipients) {
        if (recipient?.address) {
          const addr = recipient.address.toLowerCase();
          const existing = contactMap.get(addr);
          contactMap.set(addr, {
            name: existing?.name || recipient.name || null,
            count: (existing?.count || 0) + 1,
          });
        }
      }
    }

    // Get user's email to exclude from contacts
    const user = await prisma.user.findUnique({
      where: { id: userContext.userId },
      select: { email: true },
    });
    const userEmail = user?.email?.toLowerCase();

    // Convert to ContactCandidate array, excluding the user's own email
    const contacts: ContactCandidate[] = [];
    for (const [email, data] of contactMap.entries()) {
      if (email === userEmail) continue;

      contacts.push({
        email,
        name: data.name,
        occurrences: data.count,
        suggestedRole: this.suggestRole(email, data.name),
        isExistingActor: false, // Will be updated below
      });
    }

    // Sort by occurrence count descending
    contacts.sort((a, b) => b.occurrences - a.occurrences);

    return contacts;
  }

  /**
   * Suggest a role based on email domain or name patterns
   */
  private suggestRole(email: string, name: string | null): CaseActorRole | null {
    const lowerEmail = email.toLowerCase();
    const lowerName = (name || '').toLowerCase();

    // Check for common patterns
    if (
      lowerEmail.includes('avocat') ||
      lowerEmail.includes('lawyer') ||
      lowerEmail.includes('law') ||
      lowerName.includes('avocat') ||
      lowerName.includes('cabinet')
    ) {
      return CaseActorRole.OpposingCounsel;
    }

    if (
      lowerEmail.includes('expert') ||
      lowerName.includes('expert') ||
      lowerName.includes('evaluator')
    ) {
      return CaseActorRole.Expert;
    }

    if (
      lowerEmail.includes('tribunal') ||
      lowerEmail.includes('judecatorie') ||
      lowerEmail.includes('curte') ||
      lowerEmail.includes('court')
    ) {
      return CaseActorRole.Witness; // Default for official institutions
    }

    // Default: no suggestion
    return null;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let emailToCaseServiceInstance: EmailToCaseService | null = null;

export function getEmailToCaseService(): EmailToCaseService {
  if (!emailToCaseServiceInstance) {
    emailToCaseServiceInstance = new EmailToCaseService();
  }
  return emailToCaseServiceInstance;
}

export const emailToCaseService = new EmailToCaseService();
