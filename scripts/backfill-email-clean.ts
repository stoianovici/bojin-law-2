#!/usr/bin/env npx ts-node
/**
 * OPS-090: Backfill script for email content cleaning
 *
 * Usage:
 *   npx ts-node scripts/backfill-email-clean.ts              # Process emails without clean content
 *   npx ts-node scripts/backfill-email-clean.ts --reprocess  # Re-clean ALL emails (fix formatting)
 *   npx ts-node scripts/backfill-email-clean.ts --limit=500  # Process up to 500 emails
 *   npx ts-node scripts/backfill-email-clean.ts --reprocess --limit=50  # Re-clean 50 emails
 */

import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

const prisma = new PrismaClient();

const EXTRACTION_PROMPT = `Extract only the new message content from this email. Remove:
- Email signatures (contact info, disclaimers, "Sent from iPhone", "Trimis de pe iPhone", etc.)
- Quoted replies (text after "On X wrote:", "De la:", "La data de...", or similar patterns)
- Forwarded message headers ("---------- Forwarded message ----------", "---------- Mesaj redirecționat ----------")
- Reply header blocks (From:/Sent:/To:/Subject: or De la:/Trimis:/Către:/Subiect:)
- Automatic replies ("This is an automatic reply", "Răspuns automat")

Return ONLY the actual new message text in plain text format (no HTML tags).

CRITICAL - WHITESPACE FORMATTING:
- Preserve ALL paragraph breaks as DOUBLE newlines (blank line between paragraphs)
- Preserve single line breaks within addresses, lists, or structured content
- Do NOT collapse multiple paragraphs into a single block of text
- Each distinct paragraph/thought should be separated by a blank line

IMPORTANT: Răspunde DOAR în limba română. NU include explicații, raționamente sau comentarii în engleză.
Returnează DOAR textul extras, fără meta-comentarii.

If the email is entirely quoted/forwarded with no new content, return "[Mesaj redirecționat fără conținut nou]".
If the email contains only an attachment notice with no text, return "[Doar atașament]".
If the email is a newsletter or informative bulletin with no personal message, return "[Newsletter informativ]".
If you cannot extract meaningful content, return the original text cleaned of HTML.`;

function stripHtml(html: string): string {
  let text = html;
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<\/?(div|p|br|hr|tr|li|h[1-6])[^>]*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/\n\s*\n/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  return text.trim();
}

async function cleanEmail(
  anthropic: Anthropic,
  bodyContent: string,
  bodyContentType: string
): Promise<string | null> {
  try {
    if (!bodyContent || bodyContent.trim().length < 10) {
      return bodyContent || '';
    }

    const strippedLength = stripHtml(bodyContent).trim().length;
    if (strippedLength < 50) {
      return stripHtml(bodyContent).trim();
    }

    const contentToProcess = bodyContentType === 'html' ? stripHtml(bodyContent) : bodyContent;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\n---\n\nEmail content:\n\n${contentToProcess}`,
        },
      ],
    });

    const textBlock = response.content.find(
      (block): block is { type: 'text'; text: string } => block.type === 'text'
    );
    return textBlock ? textBlock.text.trim() : stripHtml(bodyContent).trim();
  } catch (error) {
    console.error('Error cleaning email:', error);
    return stripHtml(bodyContent).trim();
  }
}

async function main() {
  // Check for --reprocess flag to re-clean emails that already have bodyContentClean
  const reprocess = process.argv.includes('--reprocess');
  const limit = parseInt(
    process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || '100'
  );

  console.log(`Starting email content backfill...`);
  console.log(`Mode: ${reprocess ? 'REPROCESS existing' : 'Process new only'}`);
  console.log(`Limit: ${limit}\n`);

  const anthropic = new Anthropic();

  // Find emails to process
  // Note: bodyContent is a required field, so we just filter on bodyContentClean for non-reprocess mode
  const emails = await prisma.email.findMany({
    where: reprocess
      ? {} // All emails (bodyContent is required, so all emails have it)
      : { bodyContentClean: null }, // Only those without clean content
    select: {
      id: true,
      subject: true,
      bodyContent: true,
      bodyContentType: true,
    },
    orderBy: { receivedDateTime: 'desc' },
    take: limit,
  });

  console.log(`Found ${emails.length} emails to process\n`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const email of emails) {
    if (!email.bodyContent || email.bodyContent.length < 100) {
      skipped++;
      continue;
    }

    try {
      process.stdout.write(`Processing: ${email.subject?.substring(0, 50)}... `);

      const cleanContent = await cleanEmail(anthropic, email.bodyContent, email.bodyContentType);

      if (cleanContent) {
        await prisma.email.update({
          where: { id: email.id },
          data: { bodyContentClean: cleanContent },
        });
        processed++;
        console.log('✓');
      } else {
        skipped++;
        console.log('skipped (no content)');
      }

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      errors++;
      console.log('✗ error');
      console.error(error);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Processed: ${processed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Remaining: ${emails.length - processed - skipped - errors}`);

  await prisma.$disconnect();
}

main().catch(console.error);
