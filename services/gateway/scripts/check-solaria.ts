import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  // Find Solaria client
  const solaria = await prisma.client.findFirst({
    where: { name: { contains: 'Solaria', mode: 'insensitive' } },
    select: { id: true, name: true, firmId: true },
  });

  if (!solaria) {
    console.log('Client Solaria not found');
    await prisma.$disconnect();
    return;
  }

  console.log('Client:', solaria.name, '| ID:', solaria.id);

  // Check emails for this client
  const emails = await prisma.email.findMany({
    where: { clientId: solaria.id },
    select: {
      id: true,
      subject: true,
      caseId: true,
      hasAttachments: true,
      _count: { select: { attachments: true } },
    },
  });

  console.log('\nTotal emails for Solaria:', emails.length);

  const clientLevelEmails = emails.filter((e) => e.caseId === null);
  console.log('Client-level emails (no case):', clientLevelEmails.length);

  const emailsWithAttachments = clientLevelEmails.filter((e) => e.hasAttachments);
  console.log('Client-level emails with hasAttachments=true:', emailsWithAttachments.length);

  // Check actual attachment records
  const attachmentCounts = clientLevelEmails.reduce((sum, e) => sum + e._count.attachments, 0);
  console.log('Total attachment records for client-level emails:', attachmentCounts);

  // Sample some emails with attachments
  if (emailsWithAttachments.length > 0) {
    console.log('\nSample client-level emails with attachments:');
    emailsWithAttachments.slice(0, 5).forEach((e) => {
      console.log('  -', e.subject?.substring(0, 60), '| attachments:', e._count.attachments);
    });
  }

  // Check EmailAttachment records for these emails
  const clientEmailIds = clientLevelEmails.map((e) => e.id);
  const attachments = await prisma.emailAttachment.findMany({
    where: { emailId: { in: clientEmailIds } },
    select: {
      id: true,
      name: true,
      documentId: true,
      storageUrl: true,
    },
    take: 10,
  });

  console.log('\nEmailAttachment records:', attachments.length);
  const withDocId = attachments.filter((a) => a.documentId);
  console.log('Attachments with documentId:', withDocId.length);

  if (attachments.length > 0) {
    console.log('\nSample attachments:');
    attachments.slice(0, 5).forEach((a) => {
      console.log('  -', a.name, '| docId:', a.documentId || 'NULL');
    });
  }

  // Check if there are Documents for this client with sourceType EMAIL_ATTACHMENT
  const docs = await prisma.document.findMany({
    where: {
      clientId: solaria.id,
      sourceType: 'EMAIL_ATTACHMENT',
    },
    select: { id: true, fileName: true },
  });
  console.log('\nDocuments with sourceType EMAIL_ATTACHMENT for Solaria:', docs.length);

  // Check CaseDocument records for this client with caseId = null
  const clientInboxDocs = await prisma.caseDocument.findMany({
    where: {
      clientId: solaria.id,
      caseId: null,
    },
  });
  console.log('CaseDocument records with caseId=null for Solaria:', clientInboxDocs.length);

  await prisma.$disconnect();
}

check().catch(console.error);
