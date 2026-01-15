/**
 * Contact Matcher Service
 *
 * Identifies a sender email address and determines which client/case they belong to,
 * with a certainty level based on the number of matching active cases.
 *
 * Matches against:
 * - Client contacts (from Client.contacts JSON array)
 * - Client administrators (from Client.administrators JSON array)
 * - Case actors (from CaseActor model)
 * - Client contactInfo email
 * - Actor emailDomains (domain-based matching)
 */

import { prisma } from '@legal-platform/database';
import { CaseStatus } from '@prisma/client';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/** Certainty level for contact matching */
export type MatchCertainty = 'HIGH' | 'LOW' | 'NONE';

/** Type of match that was found */
export type MatchType = 'EXACT_EMAIL' | 'DOMAIN' | 'ACTOR' | 'CLIENT_CONTACT';

/**
 * Result of a contact match operation
 */
export interface ContactMatch {
  /** ID of the matched client */
  clientId: string;
  /** Name of the matched client */
  clientName: string;
  /** ID of the case (only if HIGH certainty - single case) */
  caseId?: string;
  /** Case number (only if HIGH certainty) */
  caseNumber?: string;
  /** Certainty level of the match */
  certainty: MatchCertainty;
  /** How the match was found */
  matchType: MatchType;
}

/** Contact info structure from Client.contactInfo JSON */
interface ClientContactInfo {
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

/** Contact/Administrator structure from Client.contacts/administrators JSON */
interface ClientContact {
  id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
}

/** Internal structure for tracking matches during processing */
interface InternalMatch {
  clientId: string;
  clientName: string;
  caseId: string;
  caseNumber: string;
  matchType: MatchType;
}

// ============================================================================
// Contact Matcher Service
// ============================================================================

/**
 * Service for matching email addresses to clients and cases
 */
export class ContactMatcherService {
  /**
   * Find a contact match for the given email address
   *
   * @param email - The email address to match
   * @param firmId - The firm ID to scope the search to
   * @returns ContactMatch if found, or a NONE certainty result if not found
   */
  async findContactMatch(email: string, firmId: string): Promise<ContactMatch> {
    const normalizedEmail = email.toLowerCase().trim();
    const domain = this.extractDomain(normalizedEmail);

    logger.debug('Starting contact match', { email: normalizedEmail, firmId });

    // Collect all matches from different sources
    const matches: InternalMatch[] = [];

    // 1. Check case actors by exact email
    const actorMatches = await this.findActorMatches(normalizedEmail, firmId);
    matches.push(...actorMatches);

    // 2. Check case actors by domain
    if (domain) {
      const domainMatches = await this.findDomainMatches(domain, firmId);
      matches.push(...domainMatches);
    }

    // 3. Check client contacts and administrators
    const clientContactMatches = await this.findClientContactMatches(normalizedEmail, firmId);
    matches.push(...clientContactMatches);

    // 4. Check client contactInfo email
    const clientInfoMatches = await this.findClientInfoMatches(normalizedEmail, firmId);
    matches.push(...clientInfoMatches);

    // If no matches found, return NONE
    if (matches.length === 0) {
      logger.debug('No contact match found', { email: normalizedEmail });
      return {
        clientId: '',
        clientName: '',
        certainty: 'NONE',
        matchType: 'EXACT_EMAIL',
      };
    }

    // Determine certainty based on unique cases
    return this.determineMatchResult(matches);
  }

  // ============================================================================
  // Private Methods - Match Finders
  // ============================================================================

  /**
   * Find matches from CaseActor records by exact email
   */
  private async findActorMatches(email: string, firmId: string): Promise<InternalMatch[]> {
    const actors = await prisma.caseActor.findMany({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
        case: {
          firmId,
          status: CaseStatus.Active,
        },
      },
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            clientId: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return actors.map((actor) => ({
      clientId: actor.case.clientId,
      clientName: actor.case.client.name,
      caseId: actor.case.id,
      caseNumber: actor.case.caseNumber,
      matchType: 'ACTOR' as MatchType,
    }));
  }

  /**
   * Find matches from CaseActor records by email domain
   */
  private async findDomainMatches(domain: string, firmId: string): Promise<InternalMatch[]> {
    const actors = await prisma.caseActor.findMany({
      where: {
        emailDomains: {
          has: domain,
        },
        case: {
          firmId,
          status: CaseStatus.Active,
        },
      },
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            clientId: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return actors.map((actor) => ({
      clientId: actor.case.clientId,
      clientName: actor.case.client.name,
      caseId: actor.case.id,
      caseNumber: actor.case.caseNumber,
      matchType: 'DOMAIN' as MatchType,
    }));
  }

  /**
   * Find matches from Client.contacts and Client.administrators JSON arrays
   */
  private async findClientContactMatches(email: string, firmId: string): Promise<InternalMatch[]> {
    // Get all clients with their contacts and active cases
    const clients = await prisma.client.findMany({
      where: {
        firmId,
        cases: {
          some: {
            status: CaseStatus.Active,
          },
        },
      },
      select: {
        id: true,
        name: true,
        contacts: true,
        administrators: true,
        cases: {
          where: {
            status: CaseStatus.Active,
          },
          select: {
            id: true,
            caseNumber: true,
          },
        },
      },
    });

    const matches: InternalMatch[] = [];

    for (const client of clients) {
      const contacts = (client.contacts as unknown as ClientContact[]) || [];
      const administrators = (client.administrators as unknown as ClientContact[]) || [];

      // Check contacts
      const hasContactMatch = contacts.some(
        (contact) => contact.email?.toLowerCase().trim() === email
      );

      // Check administrators
      const hasAdminMatch = administrators.some(
        (admin) => admin.email?.toLowerCase().trim() === email
      );

      if (hasContactMatch || hasAdminMatch) {
        // Add a match for each active case of this client
        for (const clientCase of client.cases) {
          matches.push({
            clientId: client.id,
            clientName: client.name,
            caseId: clientCase.id,
            caseNumber: clientCase.caseNumber,
            matchType: 'CLIENT_CONTACT',
          });
        }
      }
    }

    return matches;
  }

  /**
   * Find matches from Client.contactInfo.email
   */
  private async findClientInfoMatches(email: string, firmId: string): Promise<InternalMatch[]> {
    // Get all clients with their contactInfo and active cases
    const clients = await prisma.client.findMany({
      where: {
        firmId,
        cases: {
          some: {
            status: CaseStatus.Active,
          },
        },
      },
      select: {
        id: true,
        name: true,
        contactInfo: true,
        cases: {
          where: {
            status: CaseStatus.Active,
          },
          select: {
            id: true,
            caseNumber: true,
          },
        },
      },
    });

    const matches: InternalMatch[] = [];

    for (const client of clients) {
      const contactInfo = client.contactInfo as ClientContactInfo;

      if (contactInfo?.email?.toLowerCase().trim() === email) {
        // Add a match for each active case of this client
        for (const clientCase of client.cases) {
          matches.push({
            clientId: client.id,
            clientName: client.name,
            caseId: clientCase.id,
            caseNumber: clientCase.caseNumber,
            matchType: 'CLIENT_CONTACT',
          });
        }
      }
    }

    return matches;
  }

  // ============================================================================
  // Private Methods - Utilities
  // ============================================================================

  /**
   * Extract domain from email address
   */
  private extractDomain(email: string): string | null {
    const atIndex = email.indexOf('@');
    if (atIndex === -1) {
      return null;
    }
    return email.substring(atIndex + 1).toLowerCase();
  }

  /**
   * Determine the final match result based on all found matches
   *
   * - HIGH: Contact appears on exactly 1 active case
   * - LOW: Contact appears on multiple active cases (same client)
   * - NONE: Unknown sender (should not reach here as we return early)
   */
  private determineMatchResult(matches: InternalMatch[]): ContactMatch {
    // Deduplicate by caseId to get unique cases
    const uniqueCases = new Map<string, InternalMatch>();
    for (const match of matches) {
      if (!uniqueCases.has(match.caseId)) {
        uniqueCases.set(match.caseId, match);
      }
    }

    const uniqueMatches = Array.from(uniqueCases.values());

    // Prioritize match types: ACTOR > EXACT_EMAIL > DOMAIN > CLIENT_CONTACT
    const prioritizedMatch = this.getPrioritizedMatch(matches);

    if (uniqueMatches.length === 1) {
      // HIGH certainty - single case match
      const match = uniqueMatches[0];
      logger.info('High certainty contact match found', {
        email: 'redacted',
        clientId: match.clientId,
        caseId: match.caseId,
        matchType: prioritizedMatch.matchType,
      });

      return {
        clientId: match.clientId,
        clientName: match.clientName,
        caseId: match.caseId,
        caseNumber: match.caseNumber,
        certainty: 'HIGH',
        matchType: prioritizedMatch.matchType,
      };
    }

    // LOW certainty - multiple cases
    // Return the first client (they should all be the same for most scenarios)
    const firstMatch = uniqueMatches[0];
    logger.info('Low certainty contact match found', {
      email: 'redacted',
      clientId: firstMatch.clientId,
      caseCount: uniqueMatches.length,
      matchType: prioritizedMatch.matchType,
    });

    return {
      clientId: firstMatch.clientId,
      clientName: firstMatch.clientName,
      certainty: 'LOW',
      matchType: prioritizedMatch.matchType,
    };
  }

  /**
   * Get the highest priority match based on match type
   *
   * Priority order: ACTOR > EXACT_EMAIL > DOMAIN > CLIENT_CONTACT
   */
  private getPrioritizedMatch(matches: InternalMatch[]): InternalMatch {
    const priority: Record<MatchType, number> = {
      ACTOR: 0,
      EXACT_EMAIL: 1,
      DOMAIN: 2,
      CLIENT_CONTACT: 3,
    };

    return matches.reduce((best, current) => {
      if (priority[current.matchType] < priority[best.matchType]) {
        return current;
      }
      return best;
    }, matches[0]);
  }

  /**
   * Batch match multiple email addresses
   *
   * @param emails - Array of email addresses to match
   * @param firmId - The firm ID to scope the search to
   * @returns Map of email to ContactMatch
   */
  async batchFindContactMatches(
    emails: string[],
    firmId: string
  ): Promise<Map<string, ContactMatch>> {
    const results = new Map<string, ContactMatch>();

    // Process in parallel for better performance
    const matchPromises = emails.map(async (email) => {
      const match = await this.findContactMatch(email, firmId);
      return { email: email.toLowerCase().trim(), match };
    });

    const matchResults = await Promise.all(matchPromises);

    for (const { email, match } of matchResults) {
      results.set(email, match);
    }

    return results;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let contactMatcherServiceInstance: ContactMatcherService | null = null;

/**
 * Get the singleton instance of ContactMatcherService
 */
export function getContactMatcherService(): ContactMatcherService {
  if (!contactMatcherServiceInstance) {
    contactMatcherServiceInstance = new ContactMatcherService();
  }
  return contactMatcherServiceInstance;
}

/**
 * Export singleton instance for direct import
 */
export const contactMatcherService = new ContactMatcherService();
