/**
 * Email Classifier Pipeline
 *
 * Routes incoming emails to one of 5 destinations based on sender,
 * thread continuity, case signals, and contact association.
 *
 * Classification Flow:
 * 1. Check filter list (PersonalContact) -> Ignored
 * 2. Check thread continuity -> Follow existing classification
 * 3. Check case signals (ALL emails) -> Match by reference, keyword, subject pattern, domain
 * 4. Check court source (GlobalEmailSource) -> CourtUnassigned (if from court but no signal match)
 * 5. Check contact match -> Classified, ClientInbox, or Uncertain
 */

import { prisma } from '@legal-platform/database';
import { EmailClassificationState, CaseStatus, GlobalEmailSourceCategory } from '@prisma/client';
import logger from '../utils/logger';
import { threadTrackerService } from './thread-tracker';
import { contactMatcherService } from './contact-matcher';
import { extractReferences, matchesCase } from './reference-extractor';
import { personalContactService } from './personal-contact.service';
import { aiEmailClassifier, type AIClassificationResult } from './ai-email-classifier.service';

// ============================================================================
// Types
// ============================================================================

/**
 * Email data required for classification
 */
export interface EmailForClassification {
  /** Unique email identifier */
  id: string;
  /** Microsoft Graph conversation ID for thread tracking */
  conversationId: string;
  /** Email subject line */
  subject: string;
  /** Preview of email body */
  bodyPreview: string;
  /** Full email body content (HTML or text) */
  bodyContent?: string;
  /** Sender information */
  from: { name?: string; address: string };
  /** Primary recipients */
  toRecipients: Array<{ name?: string; address: string }>;
  /** CC recipients */
  ccRecipients?: Array<{ name?: string; address: string }>;
  /** When the email was received */
  receivedDateTime: Date;
  /** Folder the email is in (e.g., 'Inbox', 'Sent Items', 'Elemente trimise') */
  parentFolderName?: string;
}

/**
 * How the classification match was determined
 */
export type ClassificationMatchType =
  | 'THREAD'
  | 'REFERENCE'
  | 'KEYWORD'
  | 'SUBJECT_PATTERN'
  | 'COMPANY_DOMAIN'
  | 'CONTACT'
  | 'DOMAIN'
  | 'FILTERED'
  | 'UNKNOWN';

/**
 * Result of classifying an email
 */
export interface ClassificationResult {
  /** The classification state/destination */
  state: EmailClassificationState;
  /** Case ID if email was assigned to a case */
  caseId: string | null;
  /** Client ID if email was associated with a client */
  clientId: string | null;
  /** Confidence level (1.0 for thread/reference, 0.9 for HIGH contact, 0.5 for LOW) */
  confidence: number;
  /** Human-readable explanation of the classification */
  reason: string;
  /** How the match was determined */
  matchType: ClassificationMatchType;
}

// ============================================================================
// Constants
// ============================================================================

/** Sent folder names (English and Romanian) */
const SENT_FOLDER_NAMES = ['Sent Items', 'Elemente trimise', 'Sent'];

/**
 * Case profile for signal matching.
 * Contains the "hard truths" configured on a case that help classify emails.
 */
interface CaseSignalProfile {
  id: string;
  caseNumber: string;
  clientId: string;
  referenceNumbers: string[];
  keywords: string[];
  subjectPatterns: string[];
  companyDomain: string | null;
}

/** Confidence levels */
const CONFIDENCE = {
  ABSOLUTE: 1.0, // Thread continuity, reference number match
  SUBJECT_PATTERN: 0.95, // Subject matches configured pattern
  KEYWORD: 0.85, // Keyword found in body (unique to one case)
  COMPANY_DOMAIN: 0.8, // Sender domain matches case company domain
  HIGH: 0.9, // Single case contact match
  LOW: 0.5, // Multiple case contact match
  NONE: 0.0, // Unknown sender
} as const;

// ============================================================================
// Email Classifier Service
// ============================================================================

/**
 * Service for classifying incoming emails into appropriate destinations
 */
export class EmailClassifierService {
  /**
   * Classify an email to determine its destination.
   *
   * @param email - The email to classify
   * @param firmId - The firm ID context
   * @param userId - The user ID who owns the mailbox
   * @returns Classification result with state, case/client IDs, and reasoning
   */
  async classifyEmail(
    email: EmailForClassification,
    firmId: string,
    userId: string
  ): Promise<ClassificationResult> {
    logger.debug('Starting email classification', {
      emailId: email.id,
      subject: email.subject.substring(0, 50),
      firmId,
    });

    // Determine if this is a sent email (classify by recipients instead of sender)
    const isSentEmail = this.isSentEmail(email.parentFolderName);

    // Get the relevant email addresses for classification
    const classificationAddresses = isSentEmail
      ? this.getRecipientAddresses(email)
      : [email.from.address];

    // ========================================================================
    // Step 1: Check filter list (PersonalContact)
    // ========================================================================
    const filterResult = await this.checkFilterList(classificationAddresses, userId, isSentEmail);
    if (filterResult) {
      logger.info('Email classified as Ignored (filtered contact)', {
        emailId: email.id,
      });
      return filterResult;
    }

    // ========================================================================
    // Step 2: Check thread continuity
    // ========================================================================
    const threadResult = await this.checkThreadContinuity(email.conversationId, firmId);
    if (threadResult) {
      logger.info('Email classified by thread continuity', {
        emailId: email.id,
        state: threadResult.state,
        caseId: threadResult.caseId,
      });
      return threadResult;
    }

    // ========================================================================
    // Step 3: Check case signals (references, keywords, patterns, domain)
    // This checks ALL emails against configured case signals - the "hard truths"
    // ========================================================================
    const signalResult = await this.checkCaseSignals(email, classificationAddresses, firmId);
    if (signalResult) {
      logger.info('Email classified by case signal', {
        emailId: email.id,
        state: signalResult.state,
        caseId: signalResult.caseId,
        matchType: signalResult.matchType,
      });
      return signalResult;
    }

    // ========================================================================
    // Step 4: Check if from court (GlobalEmailSource)
    // Only marks as CourtUnassigned if no signal match was found above
    // ========================================================================
    const courtResult = await this.checkCourtSource(classificationAddresses, firmId);
    if (courtResult) {
      logger.info('Email classified as court email (unassigned)', {
        emailId: email.id,
        state: courtResult.state,
      });
      return courtResult;
    }

    // ========================================================================
    // Step 5: Check contact match (fallback)
    // ========================================================================
    const contactResult = await this.checkContactMatch(classificationAddresses, firmId);

    logger.info('Email classification complete', {
      emailId: email.id,
      state: contactResult.state,
      caseId: contactResult.caseId,
      clientId: contactResult.clientId,
      matchType: contactResult.matchType,
    });

    return contactResult;
  }

  /**
   * Classify an email using the AI-powered pipeline.
   *
   * This method uses the new three-phase classification:
   * 1. Filter list check (same as before)
   * 2. Thread continuity check (same as before)
   * 3. AI classifier (replaces keyword/pattern matching with smarter classification)
   *
   * @param email - The email to classify
   * @param firmId - The firm ID context
   * @param userId - The user ID who owns the mailbox
   * @returns Classification result with AI-powered reasoning
   */
  async classifyEmailWithAI(
    email: EmailForClassification,
    firmId: string,
    userId: string
  ): Promise<ClassificationResult & { aiCost?: number | null; classifiedBy?: string }> {
    logger.debug('Starting AI email classification', {
      emailId: email.id,
      subject: email.subject.substring(0, 50),
      firmId,
    });

    // Determine if this is a sent email
    const isSentEmail = this.isSentEmail(email.parentFolderName);
    const classificationAddresses = isSentEmail
      ? this.getRecipientAddresses(email)
      : [email.from.address];

    // ========================================================================
    // Step 1: Check filter list (PersonalContact)
    // ========================================================================
    const filterResult = await this.checkFilterList(classificationAddresses, userId, isSentEmail);
    if (filterResult) {
      logger.info('Email classified as Ignored (filtered contact)', { emailId: email.id });
      return { ...filterResult, aiCost: null };
    }

    // ========================================================================
    // Step 2: Check thread continuity
    // ========================================================================
    const threadResult = await this.checkThreadContinuity(email.conversationId, firmId);
    if (threadResult) {
      logger.info('Email classified by thread continuity', {
        emailId: email.id,
        state: threadResult.state,
        caseId: threadResult.caseId,
      });
      return { ...threadResult, aiCost: null };
    }

    // ========================================================================
    // Step 3: AI Classification Pipeline
    // ========================================================================
    const aiResult = await aiEmailClassifier.classify(
      {
        id: email.id,
        subject: email.subject,
        bodyPreview: email.bodyPreview,
        bodyContent: email.bodyContent,
        from: email.from,
        toRecipients: email.toRecipients,
        ccRecipients: email.ccRecipients,
        receivedDateTime: email.receivedDateTime,
      },
      firmId,
      userId
    );

    logger.info('Email classified by AI pipeline', {
      emailId: email.id,
      state: aiResult.state,
      caseId: aiResult.caseId,
      confidence: aiResult.confidence,
      classifiedBy: aiResult.classifiedBy,
    });

    return {
      state: aiResult.state,
      caseId: aiResult.caseId,
      clientId: aiResult.clientId,
      confidence: aiResult.confidence,
      reason: aiResult.reason,
      matchType: this.mapClassifiedByToMatchType(aiResult.classifiedBy),
      aiCost: aiResult.aiCost,
      classifiedBy: aiResult.classifiedBy,
    };
  }

  /**
   * Map AI classifiedBy to ClassificationMatchType
   */
  private mapClassifiedByToMatchType(classifiedBy: string): ClassificationMatchType {
    if (classifiedBy === 'rule:reference') return 'REFERENCE';
    if (classifiedBy === 'rule:court') return 'REFERENCE';
    if (classifiedBy === 'rule:actor_email') return 'CONTACT';
    if (classifiedBy === 'rule:actor_domain') return 'DOMAIN';
    if (classifiedBy === 'ai:haiku') return 'UNKNOWN'; // AI classification
    return 'UNKNOWN';
  }

  // ============================================================================
  // Private Methods - Classification Steps
  // ============================================================================

  /**
   * Step 1: Check if sender is in the user's personal contact filter list.
   * Personal contacts are blocked from appearing in the firm's email workflow.
   */
  private async checkFilterList(
    addresses: string[],
    userId: string,
    isSentEmail: boolean
  ): Promise<ClassificationResult | null> {
    // For sent emails, we don't filter - user intentionally sent to these addresses
    if (isSentEmail) {
      return null;
    }

    // Check each address against the filter list
    for (const address of addresses) {
      const isFiltered = await personalContactService.isPersonalContact(userId, address);

      if (isFiltered) {
        return {
          state: EmailClassificationState.Ignored,
          caseId: null,
          clientId: null,
          confidence: CONFIDENCE.ABSOLUTE,
          reason: `Sender ${address} is in personal contacts filter list`,
          matchType: 'FILTERED',
        };
      }
    }

    return null;
  }

  /**
   * Step 2: Check if this email belongs to an existing classified thread.
   * Thread continuity has absolute certainty - follow the existing assignment.
   */
  private async checkThreadContinuity(
    conversationId: string,
    firmId: string
  ): Promise<ClassificationResult | null> {
    if (!conversationId) {
      return null;
    }

    const threadMatch = await threadTrackerService.findThreadClassification(conversationId, firmId);

    if (!threadMatch) {
      return null;
    }

    // Thread found - follow the same classification
    if (threadMatch.caseId) {
      return {
        state: EmailClassificationState.Classified,
        caseId: threadMatch.caseId,
        clientId: threadMatch.clientId || null,
        confidence: CONFIDENCE.ABSOLUTE,
        reason: `Thread previously assigned to case ${threadMatch.caseNumber || threadMatch.caseId}`,
        matchType: 'THREAD',
      };
    }

    // Thread exists but only has client association (ClientInbox scenario)
    if (threadMatch.clientId) {
      return {
        state: EmailClassificationState.ClientInbox,
        caseId: null,
        clientId: threadMatch.clientId,
        confidence: CONFIDENCE.ABSOLUTE,
        reason: `Thread previously assigned to client ${threadMatch.clientName || threadMatch.clientId}`,
        matchType: 'THREAD',
      };
    }

    return null;
  }

  /**
   * Step 3: Check case signals - the "hard truths" configured on cases.
   * Extracts signals from ALL emails and matches against active case profiles.
   *
   * Priority order (highest confidence first):
   * 1. Reference number match (e.g., "1234/56/2024") - ABSOLUTE confidence
   * 2. Subject pattern match - SUBJECT_PATTERN confidence
   * 3. Keyword match (unique to one case) - KEYWORD confidence
   * 4. Company domain match - COMPANY_DOMAIN confidence
   */
  private async checkCaseSignals(
    email: EmailForClassification,
    addresses: string[],
    firmId: string
  ): Promise<ClassificationResult | null> {
    // Load all active case profiles with their signals
    const caseProfiles = await this.loadCaseProfiles(firmId);

    if (caseProfiles.length === 0) {
      return null;
    }

    const emailBody = email.bodyContent || email.bodyPreview;
    const subjectLower = email.subject.toLowerCase();

    // Extract sender domain for company domain matching
    const senderDomain = addresses.length > 0 ? this.extractDomain(addresses[0]) : null;

    // ---- Check 1: Reference number match (highest priority) ----
    const extractedRefs = extractReferences(email.subject, emailBody);
    if (extractedRefs.length > 0) {
      const refValues = extractedRefs.map((r) => r.value);

      for (const profile of caseProfiles) {
        if (
          profile.referenceNumbers.length > 0 &&
          matchesCase(refValues, profile.referenceNumbers)
        ) {
          return {
            state: EmailClassificationState.Classified,
            caseId: profile.id,
            clientId: profile.clientId,
            confidence: CONFIDENCE.ABSOLUTE,
            reason: `Reference number matched case ${profile.caseNumber}`,
            matchType: 'REFERENCE',
          };
        }
      }
    }

    // ---- Check 2: Subject pattern match ----
    for (const profile of caseProfiles) {
      if (profile.subjectPatterns.length > 0) {
        for (const pattern of profile.subjectPatterns) {
          // Patterns are case-insensitive substring matches
          if (subjectLower.includes(pattern.toLowerCase())) {
            return {
              state: EmailClassificationState.Classified,
              caseId: profile.id,
              clientId: profile.clientId,
              confidence: CONFIDENCE.SUBJECT_PATTERN,
              reason: `Subject pattern "${pattern}" matched case ${profile.caseNumber}`,
              matchType: 'SUBJECT_PATTERN',
            };
          }
        }
      }
    }

    // ---- Check 3: Keyword match (must be unique to one case) ----
    const bodyLower = emailBody.toLowerCase();
    const keywordMatches: Array<{ profile: CaseSignalProfile; keyword: string }> = [];

    for (const profile of caseProfiles) {
      if (profile.keywords.length > 0) {
        for (const keyword of profile.keywords) {
          // Keywords are case-insensitive, match in subject or body
          const keywordLower = keyword.toLowerCase();
          if (subjectLower.includes(keywordLower) || bodyLower.includes(keywordLower)) {
            keywordMatches.push({ profile, keyword });
            break; // Only need one keyword per case
          }
        }
      }
    }

    // Only use keyword match if it's unique (matches exactly one case)
    if (keywordMatches.length === 1) {
      const match = keywordMatches[0];
      return {
        state: EmailClassificationState.Classified,
        caseId: match.profile.id,
        clientId: match.profile.clientId,
        confidence: CONFIDENCE.KEYWORD,
        reason: `Keyword "${match.keyword}" matched case ${match.profile.caseNumber}`,
        matchType: 'KEYWORD',
      };
    }

    // ---- Check 4: Company domain match ----
    if (senderDomain) {
      const domainMatches: CaseSignalProfile[] = [];

      for (const profile of caseProfiles) {
        if (profile.companyDomain && profile.companyDomain.toLowerCase() === senderDomain) {
          domainMatches.push(profile);
        }
      }

      // Only use domain match if it's unique (matches exactly one case)
      if (domainMatches.length === 1) {
        const match = domainMatches[0];
        return {
          state: EmailClassificationState.Classified,
          caseId: match.id,
          clientId: match.clientId,
          confidence: CONFIDENCE.COMPANY_DOMAIN,
          reason: `Company domain "${senderDomain}" matched case ${match.caseNumber}`,
          matchType: 'COMPANY_DOMAIN',
        };
      }
    }

    return null;
  }

  /**
   * Load active case profiles with their classification signals.
   * This is the "context" for signal-first classification.
   */
  private async loadCaseProfiles(firmId: string): Promise<CaseSignalProfile[]> {
    const cases = await prisma.case.findMany({
      where: {
        firmId,
        status: CaseStatus.Active,
      },
      select: {
        id: true,
        caseNumber: true,
        clientId: true,
        referenceNumbers: true,
        keywords: true,
        subjectPatterns: true,
        companyDomain: true,
      },
    });

    return cases;
  }

  /**
   * Step 4: Check if email is from a court or other global source.
   * Only returns CourtUnassigned - reference matching is now done in step 3.
   * If we reach this point, it means the court email had no matching reference.
   */
  private async checkCourtSource(
    addresses: string[],
    firmId: string
  ): Promise<ClassificationResult | null> {
    // Check each address against GlobalEmailSource
    for (const address of addresses) {
      const senderDomain = this.extractDomain(address);
      const normalizedEmail = address.toLowerCase().trim();

      const courtSource = await prisma.globalEmailSource.findFirst({
        where: {
          firmId,
          category: GlobalEmailSourceCategory.Court,
          OR: [
            { emails: { has: normalizedEmail } },
            ...(senderDomain ? [{ domains: { has: senderDomain } }] : []),
          ],
        },
      });

      if (courtSource) {
        // Court email but no reference match in step 3 - goes to CourtUnassigned
        return {
          state: EmailClassificationState.CourtUnassigned,
          caseId: null,
          clientId: null,
          confidence: CONFIDENCE.ABSOLUTE,
          reason: `Court email from ${courtSource.name}, no matching reference number found`,
          matchType: 'REFERENCE',
        };
      }
    }

    return null;
  }

  /**
   * Step 5: Check contact match to determine client/case association.
   */
  private async checkContactMatch(
    addresses: string[],
    firmId: string
  ): Promise<ClassificationResult> {
    // Try each address for a contact match
    for (const address of addresses) {
      const contactMatch = await contactMatcherService.findContactMatch(address, firmId);

      if (contactMatch.certainty === 'HIGH' && contactMatch.caseId) {
        // HIGH certainty - single case match
        return {
          state: EmailClassificationState.Classified,
          caseId: contactMatch.caseId,
          clientId: contactMatch.clientId,
          confidence: CONFIDENCE.HIGH,
          reason: `Contact ${address} matched to single active case ${contactMatch.caseNumber}`,
          matchType: this.mapContactMatchType(contactMatch.matchType),
        };
      }

      if (contactMatch.certainty === 'LOW' && contactMatch.clientId) {
        // LOW certainty - known client, multiple cases
        return {
          state: EmailClassificationState.ClientInbox,
          caseId: null,
          clientId: contactMatch.clientId,
          confidence: CONFIDENCE.LOW,
          reason: `Contact ${address} matched to client ${contactMatch.clientName} with multiple active cases`,
          matchType: this.mapContactMatchType(contactMatch.matchType),
        };
      }
    }

    // No match found - unknown sender
    return {
      state: EmailClassificationState.Uncertain,
      caseId: null,
      clientId: null,
      confidence: CONFIDENCE.NONE,
      reason: 'Unknown sender - no matching contacts found',
      matchType: 'UNKNOWN',
    };
  }

  // ============================================================================
  // Private Methods - Helpers
  // ============================================================================

  /**
   * Check if the email is from a sent folder
   */
  private isSentEmail(parentFolderName?: string): boolean {
    if (!parentFolderName) return false;
    return SENT_FOLDER_NAMES.some((name) => name.toLowerCase() === parentFolderName.toLowerCase());
  }

  /**
   * Get all recipient addresses from an email (TO + CC)
   */
  private getRecipientAddresses(email: EmailForClassification): string[] {
    const addresses: string[] = [];

    for (const recipient of email.toRecipients) {
      if (recipient.address) {
        addresses.push(recipient.address);
      }
    }

    if (email.ccRecipients) {
      for (const recipient of email.ccRecipients) {
        if (recipient.address) {
          addresses.push(recipient.address);
        }
      }
    }

    return addresses;
  }

  /**
   * Extract domain from email address
   */
  private extractDomain(email: string): string | null {
    const atIndex = email.indexOf('@');
    if (atIndex === -1) return null;
    return email.substring(atIndex + 1).toLowerCase();
  }

  /**
   * Map contact matcher's match type to our classification match type
   */
  private mapContactMatchType(
    matchType: 'EXACT_EMAIL' | 'DOMAIN' | 'ACTOR' | 'CLIENT_CONTACT'
  ): ClassificationMatchType {
    switch (matchType) {
      case 'DOMAIN':
        return 'DOMAIN';
      case 'EXACT_EMAIL':
      case 'ACTOR':
      case 'CLIENT_CONTACT':
        return 'CONTACT';
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let emailClassifierServiceInstance: EmailClassifierService | null = null;

/**
 * Get the singleton EmailClassifierService instance
 */
export function getEmailClassifierService(): EmailClassifierService {
  if (!emailClassifierServiceInstance) {
    emailClassifierServiceInstance = new EmailClassifierService();
  }
  return emailClassifierServiceInstance;
}

/**
 * Main classification function - convenience export
 *
 * @param email - The email to classify
 * @param firmId - The firm ID context
 * @param userId - The user ID who owns the mailbox
 * @returns Classification result
 */
export async function classifyEmail(
  email: EmailForClassification,
  firmId: string,
  userId: string
): Promise<ClassificationResult> {
  return getEmailClassifierService().classifyEmail(email, firmId, userId);
}

/**
 * AI-powered classification function - uses the new three-phase pipeline.
 *
 * @param email - The email to classify
 * @param firmId - The firm ID context
 * @param userId - The user ID who owns the mailbox
 * @returns Classification result with AI reasoning and cost
 */
export async function classifyEmailWithAI(
  email: EmailForClassification,
  firmId: string,
  userId: string
): Promise<ClassificationResult & { aiCost?: number | null; classifiedBy?: string }> {
  return getEmailClassifierService().classifyEmailWithAI(email, firmId, userId);
}

/** Export singleton instance */
export const emailClassifierService = getEmailClassifierService();
