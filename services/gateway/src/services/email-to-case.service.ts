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
      if (importAttachments && accessToken) {
        const emailsWithAttachments = emails.filter((e) => e.hasAttachments);
        const attachmentService = getEmailAttachmentService(prisma);

        for (const email of emailsWithAttachments) {
          try {
            const syncResult = await attachmentService.syncAllAttachments(email.id, accessToken);
            result.attachmentsImported += syncResult.attachmentsSynced;

            if (syncResult.errors.length > 0) {
              result.errors.push(...syncResult.errors);
            }
          } catch (error: any) {
            result.errors.push(
              `Failed to sync attachments for email ${email.id}: ${error.message}`
            );
          }
        }
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
   */
  private async findEmailsByParticipants(
    emailAddresses: string[],
    userId: string,
    firmId: string
  ): Promise<any[]> {
    // Build a query that checks from, toRecipients, and ccRecipients JSON fields
    // PostgreSQL JSON containment query
    const emails = await prisma.email.findMany({
      where: {
        userId,
        firmId,
        isIgnored: false,
        OR: emailAddresses.flatMap((address) => [
          // Check 'from' field - it's a JSON object with 'address' property
          {
            from: {
              path: ['address'],
              string_contains: address,
            },
          },
          // Check toRecipients array - each element has 'address' property
          {
            toRecipients: {
              array_contains: [{ address }],
            },
          },
          // Check ccRecipients array
          {
            ccRecipients: {
              array_contains: [{ address }],
            },
          },
        ]),
      },
      orderBy: {
        receivedDateTime: 'desc',
      },
    });

    return emails;
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
