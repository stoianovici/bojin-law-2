import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import 'dotenv/config';

// ============================================================================
// Configuration
// ============================================================================

const config = {
  host: 'imap.mail.yahoo.com',
  port: 993,
  secure: true,
  auth: {
    user: process.env.YAHOO_EMAIL!,
    pass: process.env.YAHOO_APP_PASSWORD!, // App password, NOT your regular password
  },
  logger: false, // Set to true for debug logs
};

// ============================================================================
// Types
// ============================================================================

interface EmailSummary {
  uid: number;
  subject: string;
  from: string;
  date: Date | undefined;
  preview: string;
}

// ============================================================================
// Main Functions
// ============================================================================

async function connectToYahoo(): Promise<ImapFlow> {
  const client = new ImapFlow(config);
  await client.connect();
  console.log('✓ Connected to Yahoo Mail');
  return client;
}

async function listFolders(client: ImapFlow): Promise<void> {
  console.log('\n📁 Available folders:');
  for await (const folder of client.listTree()) {
    console.log(`  - ${folder.path}`);
    if (folder.folders) {
      for (const sub of folder.folders) {
        console.log(`    - ${sub.path}`);
      }
    }
  }
}

async function fetchRecentEmails(
  client: ImapFlow,
  folder: string = 'INBOX',
  limit: number = 10
): Promise<EmailSummary[]> {
  const lock = await client.getMailboxLock(folder);
  const emails: EmailSummary[] = [];

  try {
    console.log(`\n📬 Fetching ${limit} recent emails from ${folder}...`);

    // Get the latest messages
    const messages = client.fetch(`${Math.max(1, client.mailbox.exists - limit + 1)}:*`, {
      envelope: true,
      source: true,
      uid: true,
    });

    for await (const message of messages) {
      const parsed = await simpleParser(message.source);

      emails.push({
        uid: message.uid,
        subject: parsed.subject || '(No subject)',
        from: parsed.from?.text || 'Unknown',
        date: parsed.date,
        preview: getPreview(parsed),
      });
    }
  } finally {
    lock.release();
  }

  return emails.reverse(); // Most recent first
}

async function searchEmails(
  client: ImapFlow,
  query: string,
  folder: string = 'INBOX'
): Promise<EmailSummary[]> {
  const lock = await client.getMailboxLock(folder);
  const emails: EmailSummary[] = [];

  try {
    console.log(`\n🔍 Searching for "${query}" in ${folder}...`);

    const searchResults = await client.search({
      or: [{ subject: query }, { from: query }, { body: query }],
    });

    if (searchResults.length === 0) {
      console.log('No emails found matching your search.');
      return [];
    }

    console.log(`Found ${searchResults.length} matching emails.`);

    // Fetch details for found messages (limit to 20)
    const uidsToFetch = searchResults.slice(-20);
    const messages = client.fetch(uidsToFetch, {
      envelope: true,
      source: true,
      uid: true,
    });

    for await (const message of messages) {
      const parsed = await simpleParser(message.source);

      emails.push({
        uid: message.uid,
        subject: parsed.subject || '(No subject)',
        from: parsed.from?.text || 'Unknown',
        date: parsed.date,
        preview: getPreview(parsed),
      });
    }
  } finally {
    lock.release();
  }

  return emails.reverse();
}

async function readFullEmail(
  client: ImapFlow,
  uid: number,
  folder: string = 'INBOX'
): Promise<ParsedMail | null> {
  const lock = await client.getMailboxLock(folder);

  try {
    const message = await client.fetchOne(
      uid.toString(),
      {
        source: true,
      },
      { uid: true }
    );

    if (!message) {
      console.log('Email not found.');
      return null;
    }

    return await simpleParser(message.source);
  } finally {
    lock.release();
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getPreview(parsed: ParsedMail, length: number = 100): string {
  const text = parsed.text || '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > length ? clean.substring(0, length) + '...' : clean;
}

function formatEmail(email: EmailSummary): string {
  const dateStr =
    email.date?.toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) || 'Unknown date';

  return `
┌─────────────────────────────────────────────────────────────
│ UID: ${email.uid}
│ Date: ${dateStr}
│ From: ${email.from}
│ Subject: ${email.subject}
├─────────────────────────────────────────────────────────────
│ ${email.preview}
└─────────────────────────────────────────────────────────────`;
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  // Check for required env vars
  if (!process.env.YAHOO_EMAIL || !process.env.YAHOO_APP_PASSWORD) {
    console.error('❌ Missing environment variables!');
    console.error('Create a .env file with:');
    console.error('  YAHOO_EMAIL=your-email@yahoo.com');
    console.error('  YAHOO_APP_PASSWORD=your-app-password');
    console.error('\nTo get an app password:');
    console.error('1. Go to https://login.yahoo.com/account/security');
    console.error('2. Enable 2-step verification if not already enabled');
    console.error('3. Click "Generate app password"');
    console.error('4. Select "Other app" and give it a name');
    console.error('5. Copy the generated password to your .env file');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const isSearch = args.includes('--search');
  const searchQuery = args.find(
    (a, i) => args[i - 1] === '--search' || (!a.startsWith('--') && isSearch)
  );
  const showFolders = args.includes('--folders');
  const uidArg = args.find((a, i) => args[i - 1] === '--uid');
  const limitArg = args.find((a, i) => args[i - 1] === '--limit');
  const limit = limitArg ? parseInt(limitArg, 10) : 10;

  let client: ImapFlow | null = null;

  try {
    client = await connectToYahoo();

    if (showFolders) {
      await listFolders(client);
      return;
    }

    if (uidArg) {
      const uid = parseInt(uidArg, 10);
      const email = await readFullEmail(client, uid);
      if (email) {
        console.log('\n📧 Full Email Content:');
        console.log('═'.repeat(60));
        console.log(`From: ${email.from?.text}`);
        console.log(`To: ${email.to?.text}`);
        console.log(`Date: ${email.date?.toLocaleString('ro-RO')}`);
        console.log(`Subject: ${email.subject}`);
        console.log('─'.repeat(60));
        console.log(email.text || email.html || '(No content)');
        console.log('═'.repeat(60));
      }
      return;
    }

    let emails: EmailSummary[];

    if (isSearch && searchQuery) {
      emails = await searchEmails(client, searchQuery);
    } else {
      emails = await fetchRecentEmails(client, 'INBOX', limit);
    }

    if (emails.length === 0) {
      console.log('No emails found.');
      return;
    }

    console.log(`\n📧 ${emails.length} Emails:\n`);
    for (const email of emails) {
      console.log(formatEmail(email));
    }

    console.log('\n💡 Tips:');
    console.log('  - Read full email: pnpm read -- --uid <UID>');
    console.log('  - Search emails:   pnpm search -- "search term"');
    console.log('  - List folders:    pnpm read -- --folders');
    console.log('  - Change limit:    pnpm read -- --limit 20');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  } finally {
    if (client) {
      await client.logout();
      console.log('\n✓ Disconnected from Yahoo Mail');
    }
  }
}

main();
