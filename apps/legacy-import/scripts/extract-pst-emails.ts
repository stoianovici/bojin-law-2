/**
 * PST Email Address Extractor
 * Extracts To/From email addresses from a PST file and exports to Excel
 *
 * Usage: npx ts-node scripts/extract-pst-emails.ts "/path/to/file.pst"
 */

import * as pst from 'pst-extractor';
import * as XLSX from 'xlsx';

interface EmailContact {
  email: string;
  name: string;
  lastDate: Date | null;
  count: number;
}

// Map of email -> contact info (keeps last occurrence and count)
const contactMap = new Map<string, EmailContact>();
let processedCount = 0;

/**
 * Extracts email addresses from recipient fields
 */
function parseRecipients(message: pst.PSTMessage): {
  toNames: string[];
  toEmails: string[];
  ccNames: string[];
  ccEmails: string[];
} {
  const toNames: string[] = [];
  const toEmails: string[] = [];
  const ccNames: string[] = [];
  const ccEmails: string[] = [];

  try {
    const recipientCount = message.numberOfRecipients;

    for (let i = 0; i < recipientCount; i++) {
      try {
        const recipient = message.getRecipient(i);
        if (recipient) {
          const name = recipient.displayName || '';
          const email = recipient.emailAddress || '';
          const type = recipient.recipientType; // 1=TO, 2=CC, 3=BCC

          if (type === 1) {
            if (name) toNames.push(name);
            if (email) toEmails.push(email);
          } else if (type === 2) {
            if (name) ccNames.push(name);
            if (email) ccEmails.push(email);
          }
        }
      } catch {
        // Skip problematic recipient
      }
    }
  } catch {
    // Fall back to displayTo if recipient iteration fails
    const displayTo = message.displayTo || '';
    if (displayTo) {
      toNames.push(displayTo);
    }
  }

  return { toNames, toEmails, ccNames, ccEmails };
}

/**
 * Formats a date for Excel
 */
function formatDate(date: Date | null | undefined): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().split('T')[0] + ' ' + date.toISOString().split('T')[1].substring(0, 8);
}

/**
 * Updates contact map with email info (keeps last occurrence by date, increments count)
 */
function updateContact(email: string, name: string, date: Date | null): void {
  if (!email) return;

  const normalizedEmail = email.toLowerCase().trim();
  const existing = contactMap.get(normalizedEmail);

  if (!existing) {
    contactMap.set(normalizedEmail, { email: normalizedEmail, name, lastDate: date, count: 1 });
  } else {
    existing.count++;
    // Update name and date if this is more recent
    if (date && (!existing.lastDate || date > existing.lastDate)) {
      existing.lastDate = date;
      if (name) existing.name = name;
    }
  }
}

/**
 * Processes a folder recursively
 */
function processFolder(folder: pst.PSTFolder, folderPath: string): void {
  const currentPath = folderPath ? `${folderPath}/${folder.displayName}` : folder.displayName;

  // Process emails in this folder
  if (folder.contentCount > 0) {
    let email = folder.getNextChild();

    while (email !== null) {
      if (email instanceof pst.PSTMessage) {
        const message = email as pst.PSTMessage;

        try {
          const { toNames, toEmails } = parseRecipients(message);
          const receivedDate = message.messageDeliveryTime || message.clientSubmitTime;
          const dateObj = receivedDate instanceof Date ? receivedDate : null;

          // Track from email
          updateContact(message.senderEmailAddress || '', message.senderName || '', dateObj);

          // Track to emails
          for (let i = 0; i < toEmails.length; i++) {
            updateContact(toEmails[i], toNames[i] || '', dateObj);
          }

          processedCount++;

          if (processedCount % 500 === 0) {
            console.log(`  Processed ${processedCount} emails...`);
          }
        } catch {
          // Skip problematic email
        }
      }

      email = folder.getNextChild();
    }
  }

  // Process subfolders
  if (folder.hasSubfolders) {
    const subfolders = folder.getSubFolders();
    for (const subfolder of subfolders) {
      processFolder(subfolder, currentPath);
    }
  }
}

/**
 * Main extraction function
 */
async function extractEmails(pstPath: string): Promise<void> {
  console.log(`\nOpening PST file: ${pstPath}\n`);

  const pstFile = new pst.PSTFile(pstPath);
  const rootFolder = pstFile.getRootFolder();

  console.log('Extracting emails...\n');
  processFolder(rootFolder, '');

  console.log(`\nTotal emails processed: ${processedCount}`);
  console.log(`Unique email addresses found: ${contactMap.size}`);

  // Create Excel workbook
  const workbook = XLSX.utils.book_new();

  // Convert contact map to sorted array (by count descending)
  const contacts = Array.from(contactMap.values())
    .sort((a, b) => b.count - a.count)
    .map((c) => ({
      email: c.email,
      name: c.name,
      lastCommunication: formatDate(c.lastDate),
      communicationCount: c.count,
    }));

  const worksheet = XLSX.utils.json_to_sheet(contacts, {
    header: ['email', 'name', 'lastCommunication', 'communicationCount'],
  });

  // Set column widths
  worksheet['!cols'] = [
    { wch: 40 }, // email
    { wch: 30 }, // name
    { wch: 20 }, // lastCommunication
    { wch: 20 }, // communicationCount
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

  // Save file
  const outputPath = pstPath.replace(/\.pst$/i, '_emails.xlsx');
  XLSX.writeFile(workbook, outputPath);

  console.log(`\nExcel file saved to: ${outputPath}`);
  console.log(`  - Contacts sheet: ${contacts.length} unique emails`);
}

// Run
const pstPath = process.argv[2];
if (!pstPath) {
  console.error('Usage: npx ts-node scripts/extract-pst-emails.ts "/path/to/file.pst"');
  process.exit(1);
}

extractEmails(pstPath).catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
