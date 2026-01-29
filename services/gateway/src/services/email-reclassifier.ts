/**
 * Email Reclassifier Service
 *
 * Handles reclassification triggers when data changes. When client/case/contact
 * data changes, we need to reclassify affected emails.
 *
 * Reclassification Triggers:
 * - Contact added to case (via CaseActor)
 * - Contact email changed
 * - Case reference number added
 * - Manual email assignment (pattern learning)
 * - Contact marked as private/filtered
 */

import { prisma } from '@legal-platform/database';
import { EmailClassificationState, CaseStatus } from '@prisma/client';
import logger from '../utils/logger';
import { emailClassifierService } from './email-classifier';
import type { EmailForClassification } from './email-classifier';
import { extractReferences, matchesCase } from './reference-extractor';

// ============================================================================
// Types
// ============================================================================

/**
 * Email from field structure (stored as JSON)
 */
interface EmailFrom {
  name?: string;
  address: string;
}

/**
 * Recipient structure for toRecipients/ccRecipients (stored as JSON)
 */
interface EmailRecipient {
  name?: string;
  address: string;
}

/**
 * Email record with fields needed for reclassification
 */
interface EmailRecord {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  bodyContent: string;
  from: EmailFrom;
  toRecipients: EmailRecipient[];
  ccRecipients: EmailRecipient[];
  receivedDateTime: Date;
  parentFolderName: string | null;
  userId: string;
  classificationState: EmailClassificationState;
}

/**
 * Result of a reclassification operation
 */
interface ReclassificationResult {
  emailId: string;
  previousState: EmailClassificationState;
  newState: EmailClassificationState;
  caseId: string | null;
  clientId: string | null;
}

// ============================================================================
// Email Reclassifier Service
// ============================================================================

/**
 * Service for reclassifying emails when data changes
 */
export class EmailReclassifierService {
  // ==========================================================================
  // Trigger: Contact Added to Case
  // ==========================================================================

  /**
   * Reclassify emails when a contact is added to a case (via CaseActor).
   * Finds Uncertain and ClientInbox emails from that contact and reclassifies them.
   *
   * @param contactEmail - The email address of the contact added to the case
   * @param caseId - The case ID the contact was added to
   * @param firmId - The firm ID context
   * @returns Number of emails reclassified
   */
  async onContactAddedToCase(
    contactEmail: string,
    caseId: string,
    firmId: string
  ): Promise<number> {
    const normalizedEmail = contactEmail.toLowerCase().trim();

    logger.info('Reclassifying emails after contact added to case', {
      contactEmail: normalizedEmail,
      caseId,
      firmId,
    });

    // Find affected emails - Uncertain or ClientInbox from this sender
    const affectedEmails = await this.findEmailsBySenderAddress(normalizedEmail, firmId, [
      EmailClassificationState.Uncertain,
      EmailClassificationState.ClientInbox,
    ]);

    if (affectedEmails.length === 0) {
      logger.info('No emails found to reclassify for contact added to case', {
        contactEmail: normalizedEmail,
        caseId,
      });
      return 0;
    }

    // Reclassify each email
    let reclassifiedCount = 0;
    for (const email of affectedEmails) {
      try {
        const result = await this.reclassifyEmail(email, firmId);
        if (result && result.newState !== email.classificationState) {
          reclassifiedCount++;
        }
      } catch (error) {
        logger.error('Failed to reclassify email after contact added to case', {
          emailId: email.id,
          contactEmail: normalizedEmail,
          caseId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Completed reclassification after contact added to case', {
      contactEmail: normalizedEmail,
      caseId,
      totalAffected: affectedEmails.length,
      reclassifiedCount,
    });

    return reclassifiedCount;
  }

  // ==========================================================================
  // Trigger: Contact Email Changed
  // ==========================================================================

  /**
   * Reclassify emails when a contact's email address changes.
   * Reclassifies all emails from both the old and new addresses.
   *
   * @param oldEmail - The previous email address
   * @param newEmail - The new email address
   * @param firmId - The firm ID context
   * @returns Number of emails reclassified
   */
  async onContactEmailChanged(oldEmail: string, newEmail: string, firmId: string): Promise<number> {
    const normalizedOldEmail = oldEmail.toLowerCase().trim();
    const normalizedNewEmail = newEmail.toLowerCase().trim();

    logger.info('Reclassifying emails after contact email changed', {
      oldEmail: normalizedOldEmail,
      newEmail: normalizedNewEmail,
      firmId,
    });

    // Find emails from both addresses - all non-classified states
    const statesToReclassify = [
      EmailClassificationState.Uncertain,
      EmailClassificationState.ClientInbox,
      EmailClassificationState.CourtUnassigned,
      EmailClassificationState.Pending,
    ];

    const oldEmailRecords = await this.findEmailsBySenderAddress(
      normalizedOldEmail,
      firmId,
      statesToReclassify
    );

    const newEmailRecords = await this.findEmailsBySenderAddress(
      normalizedNewEmail,
      firmId,
      statesToReclassify
    );

    // Combine and deduplicate by email ID
    const emailMap = new Map<string, EmailRecord>();
    for (const email of [...oldEmailRecords, ...newEmailRecords]) {
      emailMap.set(email.id, email);
    }
    const affectedEmails = Array.from(emailMap.values());

    if (affectedEmails.length === 0) {
      logger.info('No emails found to reclassify after email change', {
        oldEmail: normalizedOldEmail,
        newEmail: normalizedNewEmail,
      });
      return 0;
    }

    // Reclassify each email
    let reclassifiedCount = 0;
    for (const email of affectedEmails) {
      try {
        const result = await this.reclassifyEmail(email, firmId);
        if (result && result.newState !== email.classificationState) {
          reclassifiedCount++;
        }
      } catch (error) {
        logger.error('Failed to reclassify email after contact email change', {
          emailId: email.id,
          oldEmail: normalizedOldEmail,
          newEmail: normalizedNewEmail,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Completed reclassification after contact email changed', {
      oldEmail: normalizedOldEmail,
      newEmail: normalizedNewEmail,
      totalAffected: affectedEmails.length,
      reclassifiedCount,
    });

    return reclassifiedCount;
  }

  // ==========================================================================
  // Trigger: Case Reference Added
  // ==========================================================================

  /**
   * Reclassify emails when a case gets a new reference number.
   * Finds CourtUnassigned emails containing that reference and assigns them.
   *
   * @param caseId - The case ID that received the reference
   * @param referenceNumber - The new reference number
   * @param firmId - The firm ID context
   * @returns Number of emails reclassified
   */
  async onCaseReferenceAdded(
    caseId: string,
    referenceNumber: string,
    firmId: string
  ): Promise<number> {
    logger.info('Reclassifying emails after case reference added', {
      caseId,
      referenceNumber,
      firmId,
    });

    // Get the case details for assignment
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        caseNumber: true,
        clientId: true,
        status: true,
      },
    });

    if (!caseRecord || caseRecord.status !== CaseStatus.Active) {
      logger.warn('Case not found or not active for reference reclassification', {
        caseId,
        referenceNumber,
      });
      return 0;
    }

    // Find CourtUnassigned emails
    const courtEmails = await prisma.email.findMany({
      where: {
        firmId,
        classificationState: EmailClassificationState.CourtUnassigned,
      },
      select: {
        id: true,
        conversationId: true,
        subject: true,
        bodyPreview: true,
        bodyContent: true,
        from: true,
        toRecipients: true,
        ccRecipients: true,
        receivedDateTime: true,
        parentFolderName: true,
        userId: true,
        classificationState: true,
      },
    });

    if (courtEmails.length === 0) {
      logger.info('No CourtUnassigned emails found to check for reference', {
        caseId,
        referenceNumber,
      });
      return 0;
    }

    // Check each email for the reference number
    let reclassifiedCount = 0;
    for (const emailRecord of courtEmails) {
      try {
        // Extract references from the email
        const references = extractReferences(emailRecord.subject, emailRecord.bodyContent);

        // Check if any reference matches
        if (
          matchesCase(
            references.map((r) => r.value),
            [referenceNumber]
          )
        ) {
          // Assign to the case
          await prisma.email.update({
            where: { id: emailRecord.id },
            data: {
              classificationState: EmailClassificationState.Classified,
              caseId: caseRecord.id,
              clientId: caseRecord.clientId,
              classificationConfidence: 1.0,
              classifiedAt: new Date(),
              classifiedBy: 'system:reference-match',
            },
          });

          reclassifiedCount++;

          logger.info('Reclassified CourtUnassigned email by reference match', {
            emailId: emailRecord.id,
            caseId,
            referenceNumber,
          });
        }
      } catch (error) {
        logger.error('Failed to check/reclassify email for reference match', {
          emailId: emailRecord.id,
          caseId,
          referenceNumber,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Completed reclassification after case reference added', {
      caseId,
      referenceNumber,
      totalChecked: courtEmails.length,
      reclassifiedCount,
    });

    return reclassifiedCount;
  }

  // ==========================================================================
  // Trigger: Manual Assignment
  // ==========================================================================

  /**
   * Learn pattern from manual assignment and reclassify historical emails.
   * When a user manually assigns an email to a case, we:
   * 1. Learn the pattern (sender -> case association)
   * 2. Reclassify historical Uncertain/ClientInbox emails from the same sender
   *
   * @param emailId - The email that was manually assigned
   * @param caseId - The case it was assigned to
   * @param userId - The user who made the assignment
   * @param firmId - The firm ID context
   * @returns Number of historical emails reclassified
   */
  async onManualAssignment(
    emailId: string,
    caseId: string,
    userId: string,
    firmId: string
  ): Promise<number> {
    logger.info('Learning pattern from manual assignment', {
      emailId,
      caseId,
      userId,
      firmId,
    });

    // Get the assigned email to learn the sender
    const assignedEmail = await prisma.email.findUnique({
      where: { id: emailId },
      select: {
        id: true,
        from: true,
        conversationId: true,
      },
    });

    if (!assignedEmail) {
      logger.warn('Email not found for manual assignment pattern learning', {
        emailId,
      });
      return 0;
    }

    const senderAddress = (assignedEmail.from as unknown as EmailFrom)?.address;
    if (!senderAddress) {
      logger.warn('Email has no sender address for pattern learning', {
        emailId,
      });
      return 0;
    }

    const normalizedSender = senderAddress.toLowerCase().trim();

    // Get the case details
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        clientId: true,
        status: true,
      },
    });

    if (!caseRecord || caseRecord.status !== CaseStatus.Active) {
      logger.warn('Case not found or not active for manual assignment', {
        caseId,
      });
      return 0;
    }

    // Find historical emails from the same sender that are Uncertain or ClientInbox
    const historicalEmails = await this.findEmailsBySenderAddress(normalizedSender, firmId, [
      EmailClassificationState.Uncertain,
      EmailClassificationState.ClientInbox,
    ]);

    // Exclude the manually assigned email and emails in the same thread
    const emailsToReclassify = historicalEmails.filter(
      (email) => email.id !== emailId && email.conversationId !== assignedEmail.conversationId
    );

    if (emailsToReclassify.length === 0) {
      logger.info('No historical emails found to reclassify after manual assignment', {
        emailId,
        senderAddress: normalizedSender,
      });
      return 0;
    }

    // Reclassify historical emails to the same case
    let reclassifiedCount = 0;
    for (const email of emailsToReclassify) {
      try {
        await prisma.email.update({
          where: { id: email.id },
          data: {
            classificationState: EmailClassificationState.Classified,
            caseId: caseRecord.id,
            clientId: caseRecord.clientId,
            classificationConfidence: 0.9, // Slightly lower confidence for pattern-based
            classifiedAt: new Date(),
            classifiedBy: `system:pattern-from-${userId}`,
          },
        });

        reclassifiedCount++;

        logger.debug('Reclassified historical email from pattern learning', {
          emailId: email.id,
          caseId,
          patternSource: emailId,
        });
      } catch (error) {
        logger.error('Failed to reclassify historical email from pattern', {
          emailId: email.id,
          caseId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Completed pattern learning and historical reclassification', {
      manualEmailId: emailId,
      senderAddress: normalizedSender,
      caseId,
      totalHistorical: emailsToReclassify.length,
      reclassifiedCount,
    });

    return reclassifiedCount;
  }

  // ==========================================================================
  // Trigger: Contact Marked Private
  // ==========================================================================

  /**
   * Mark all emails from a contact as Ignored when the contact is marked private.
   * This is a soft-delete - emails are not removed, just set to Ignored state.
   *
   * @param contactEmail - The email address of the contact marked private
   * @param userId - The user who marked the contact as private
   * @param firmId - The firm ID context
   * @returns Number of emails marked as Ignored
   */
  async onContactMarkedPrivate(
    contactEmail: string,
    userId: string,
    firmId: string
  ): Promise<number> {
    const normalizedEmail = contactEmail.toLowerCase().trim();

    logger.info('Marking emails as Ignored for private contact', {
      contactEmail: normalizedEmail,
      userId,
      firmId,
    });

    // Find all non-Ignored emails from this sender
    const statesToIgnore = [
      EmailClassificationState.Pending,
      EmailClassificationState.Classified,
      EmailClassificationState.Uncertain,
      EmailClassificationState.CourtUnassigned,
      EmailClassificationState.ClientInbox,
    ];

    const emailsToIgnore = await this.findEmailsBySenderAddress(
      normalizedEmail,
      firmId,
      statesToIgnore
    );

    if (emailsToIgnore.length === 0) {
      logger.info('No emails found to ignore for private contact', {
        contactEmail: normalizedEmail,
      });
      return 0;
    }

    // Batch update all emails to Ignored
    const emailIds = emailsToIgnore.map((e) => e.id);

    try {
      const updateResult = await prisma.email.updateMany({
        where: {
          id: { in: emailIds },
          firmId,
        },
        data: {
          classificationState: EmailClassificationState.Ignored,
          isIgnored: true,
          ignoredAt: new Date(),
          classifiedBy: `user:${userId}:private-contact`,
        },
      });

      logger.info('Marked emails as Ignored for private contact', {
        contactEmail: normalizedEmail,
        userId,
        totalIgnored: updateResult.count,
      });

      return updateResult.count;
    } catch (error) {
      logger.error('Failed to mark emails as Ignored for private contact', {
        contactEmail: normalizedEmail,
        userId,
        emailCount: emailIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Find emails by sender address with specific classification states.
   * Handles the JSON from field querying.
   */
  private async findEmailsBySenderAddress(
    senderEmail: string,
    firmId: string,
    states: EmailClassificationState[]
  ): Promise<EmailRecord[]> {
    // Prisma's JSON filtering can be tricky - fetch and filter in JS for reliability
    const emails = await prisma.email.findMany({
      where: {
        firmId,
        classificationState: { in: states },
      },
      select: {
        id: true,
        conversationId: true,
        subject: true,
        bodyPreview: true,
        bodyContent: true,
        from: true,
        toRecipients: true,
        ccRecipients: true,
        receivedDateTime: true,
        parentFolderName: true,
        userId: true,
        classificationState: true,
      },
    });

    // Filter by sender email address and cast to correct types
    return emails
      .filter((email) => {
        const from = email.from as unknown as EmailFrom | null;
        return from?.address?.toLowerCase().trim() === senderEmail;
      })
      .map((email) => ({
        id: email.id,
        conversationId: email.conversationId,
        subject: email.subject,
        bodyPreview: email.bodyPreview,
        bodyContent: email.bodyContent,
        from: email.from as unknown as EmailFrom,
        toRecipients: email.toRecipients as unknown as EmailRecipient[],
        ccRecipients: email.ccRecipients as unknown as EmailRecipient[],
        receivedDateTime: email.receivedDateTime,
        parentFolderName: email.parentFolderName,
        userId: email.userId,
        classificationState: email.classificationState,
      }));
  }

  /**
   * Reclassify a single email using the email classifier service.
   */
  private async reclassifyEmail(
    email: EmailRecord,
    firmId: string
  ): Promise<ReclassificationResult | null> {
    // Convert to EmailForClassification format
    const emailForClassification: EmailForClassification = {
      id: email.id,
      conversationId: email.conversationId,
      subject: email.subject,
      bodyPreview: email.bodyPreview,
      bodyContent: email.bodyContent,
      from: email.from,
      toRecipients: email.toRecipients,
      ccRecipients: email.ccRecipients,
      receivedDateTime: email.receivedDateTime,
      parentFolderName: email.parentFolderName || undefined,
    };

    // Classify the email
    const classificationResult = await emailClassifierService.classifyEmail(
      emailForClassification,
      firmId,
      email.userId
    );

    // If classification result is different, update the email
    if (classificationResult.state !== email.classificationState) {
      await prisma.email.update({
        where: { id: email.id },
        data: {
          classificationState: classificationResult.state,
          caseId: classificationResult.caseId,
          clientId: classificationResult.clientId,
          classificationConfidence: classificationResult.confidence,
          classifiedAt: new Date(),
          classifiedBy: 'system:reclassification',
        },
      });

      logger.debug('Email reclassified', {
        emailId: email.id,
        previousState: email.classificationState,
        newState: classificationResult.state,
        caseId: classificationResult.caseId,
      });

      return {
        emailId: email.id,
        previousState: email.classificationState,
        newState: classificationResult.state,
        caseId: classificationResult.caseId,
        clientId: classificationResult.clientId,
      };
    }

    return null;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let emailReclassifierServiceInstance: EmailReclassifierService | null = null;

/**
 * Get the singleton EmailReclassifierService instance
 */
export function getEmailReclassifierService(): EmailReclassifierService {
  if (!emailReclassifierServiceInstance) {
    emailReclassifierServiceInstance = new EmailReclassifierService();
  }
  return emailReclassifierServiceInstance;
}

/** Export singleton instance */
export const emailReclassifierService = getEmailReclassifierService();
