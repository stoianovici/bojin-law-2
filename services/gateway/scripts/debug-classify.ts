/**
 * Debug script to test classification for a specific email
 */

import 'dotenv/config';
import { prisma } from '@legal-platform/database';
import {
  classificationScoringService,
  type EmailForClassification,
} from '../src/services/classification-scoring';

async function debugClassify() {
  // Get a sent email TO solaria
  const email = await prisma.email.findFirst({
    where: {
      id: '5cce7d63-c136-4336-ae95-3b2281ce1625', // sent email to solaria
    },
    select: {
      id: true,
      conversationId: true,
      subject: true,
      bodyPreview: true,
      from: true,
      toRecipients: true,
      ccRecipients: true,
      receivedDateTime: true,
      firmId: true,
      userId: true,
    },
  });

  if (!email) {
    console.log('No email found');
    return;
  }

  console.log('Email:', {
    id: email.id,
    subject: email.subject,
    from: email.from,
    firmId: email.firmId,
    userId: email.userId,
  });

  // Check cases for this user
  const cases = await prisma.case.findMany({
    where: {
      firmId: email.firmId,
      status: { in: ['Active', 'PendingApproval'] },
      teamMembers: { some: { userId: email.userId } },
    },
    include: {
      client: true,
    },
  });

  console.log('\nCases for user:', cases.map((c) => ({
    id: c.id,
    title: c.title,
    clientName: c.client?.name,
    clientEmail: (c.client?.contactInfo as any)?.email,
  })));

  // Build email for classification
  const emailForClassify: EmailForClassification = {
    id: email.id,
    conversationId: email.conversationId,
    subject: email.subject || '',
    bodyPreview: email.bodyPreview || '',
    from: email.from as { name?: string; address: string },
    toRecipients: (email.toRecipients as Array<{ name?: string; address: string }>) || [],
    ccRecipients: (email.ccRecipients as Array<{ name?: string; address: string }>) || [],
    receivedDateTime: email.receivedDateTime,
  };

  console.log('\nRunning classification...');
  const result = await classificationScoringService.classifyEmail(
    emailForClassify,
    email.firmId,
    email.userId
  );

  console.log('\nClassification result:', JSON.stringify(result, null, 2));
}

debugClassify()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
