/**
 * Migration: Reclassify Emails with Signal-First Algorithm
 *
 * This migration resets all Classified, ClientInbox, and Uncertain emails
 * to Pending state so they can be reclassified with the new signal-first
 * classification algorithm that properly uses:
 * - Reference numbers (for ALL emails, not just court emails)
 * - Keywords
 * - Subject patterns
 * - Company domains
 *
 * The email categorization worker will pick up the Pending emails and
 * reclassify them with the improved algorithm.
 */

import { prisma } from '@legal-platform/database';
import { EmailClassificationState } from '@prisma/client';
import type { Migration, MigrationResult } from './runner';

export const migration: Migration = {
  id: '2026_01_30_reclassify_emails_signal_first',
  description: 'Reset emails to Pending for reclassification with signal-first algorithm',

  async run(): Promise<MigrationResult> {
    // States to reset - these may have been misclassified with the old algorithm
    const statesToReset = [
      EmailClassificationState.Classified,
      EmailClassificationState.ClientInbox,
      EmailClassificationState.Uncertain,
    ];

    // Count emails by state before reset
    const counts = await prisma.email.groupBy({
      by: ['classificationState'],
      where: {
        classificationState: { in: statesToReset },
      },
      _count: true,
    });

    const countByState: Record<string, number> = {};
    let totalToReset = 0;
    for (const c of counts) {
      countByState[c.classificationState] = c._count;
      totalToReset += c._count;
    }

    if (totalToReset === 0) {
      return {
        success: true,
        message: 'No emails to reclassify',
        details: { totalReset: 0 },
      };
    }

    // Reset emails to Pending, clear case/client assignments
    // This allows the worker to reclassify them with the new algorithm
    const updateResult = await prisma.email.updateMany({
      where: {
        classificationState: { in: statesToReset },
      },
      data: {
        classificationState: EmailClassificationState.Pending,
        caseId: null,
        clientId: null,
        classificationConfidence: null,
        classifiedAt: null,
        classifiedBy: null,
      },
    });

    return {
      success: true,
      message: `Reset ${updateResult.count} emails to Pending for reclassification`,
      details: {
        totalReset: updateResult.count,
        fromClassified: countByState[EmailClassificationState.Classified] || 0,
        fromClientInbox: countByState[EmailClassificationState.ClientInbox] || 0,
        fromUncertain: countByState[EmailClassificationState.Uncertain] || 0,
      },
    };
  },
};
