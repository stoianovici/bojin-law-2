/**
 * Contact Extraction Service
 * Extracts all contacts from PST file emails with most recent communication date
 * Part of Story 3.2.5 - Legacy Document Import
 */

import * as pst from 'pst-extractor';
// @ts-expect-error - exceljs has ESM issues with TypeScript
import ExcelJS from 'exceljs';

export interface ExtractedContact {
  email: string;
  name: string;
  lastCommunicationDate: Date;
  communicationCount: number;
  isSender: boolean; // true if we received emails FROM this contact
  isRecipient: boolean; // true if we sent emails TO this contact
}

export interface ContactExtractionResult {
  contacts: ExtractedContact[];
  totalEmails: number;
  processedEmails: number;
  errors: string[];
}

/**
 * Normalizes an email address (lowercase, trim)
 */
function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

/**
 * Extracts a valid email address from a string that might contain name + email
 */
function extractEmailFromString(str: string): string | null {
  if (!str) return null;

  // Try to extract email from "Name <email@example.com>" format
  const angleMatch = str.match(/<([^>]+@[^>]+)>/);
  if (angleMatch) {
    return normalizeEmail(angleMatch[1]);
  }

  // Try to extract email from plain email format
  const emailMatch = str.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    return normalizeEmail(emailMatch[1]);
  }

  return null;
}

/**
 * Extracts the name from a string that might contain name + email
 */
function extractNameFromString(str: string): string {
  if (!str) return '';

  // Remove email in angle brackets
  const withoutEmail = str.replace(/<[^>]+>/, '').trim();
  if (withoutEmail) {
    return withoutEmail;
  }

  // If it's just an email, use the part before @
  const emailMatch = str.match(/([a-zA-Z0-9._%+-]+)@/);
  if (emailMatch) {
    return emailMatch[1].replace(/[._-]/g, ' ');
  }

  return str;
}

/**
 * Determines if a folder is a "Sent" folder based on common naming patterns
 */
function isSentFolder(folderPath: string): boolean {
  const lowerPath = folderPath.toLowerCase();
  return (
    lowerPath.includes('sent items') ||
    lowerPath.includes('sent mail') ||
    lowerPath.includes('sent') ||
    lowerPath.includes('trimise') || // Romanian
    lowerPath.includes('elemente trimise')
  );
}

/**
 * Processes a single folder for contacts
 */
function processFolder(
  folder: pst.PSTFolder,
  folderPath: string,
  contactsMap: Map<string, ExtractedContact>,
  result: ContactExtractionResult
): void {
  const isSent = isSentFolder(folderPath);

  // Iterate through emails
  if (folder.contentCount > 0) {
    let email = folder.getNextChild();

    while (email !== null) {
      result.processedEmails++;

      if (email instanceof pst.PSTMessage) {
        const message = email as pst.PSTMessage;

        try {
          const receivedDate =
            message.messageDeliveryTime || message.clientSubmitTime || new Date();
          const messageDate = receivedDate instanceof Date ? receivedDate : new Date();

          if (isSent) {
            // This is a sent email - extract recipients
            const recipients = [message.displayTo, message.displayCC, message.displayBCC].filter(
              Boolean
            );

            for (const recipientStr of recipients) {
              // Handle multiple recipients separated by semicolons
              const recipientParts = recipientStr.split(/[;,]/);
              for (const part of recipientParts) {
                const email = extractEmailFromString(part);
                if (email) {
                  const existing = contactsMap.get(email);
                  if (existing) {
                    existing.communicationCount++;
                    existing.isRecipient = true;
                    if (messageDate > existing.lastCommunicationDate) {
                      existing.lastCommunicationDate = messageDate;
                    }
                  } else {
                    contactsMap.set(email, {
                      email,
                      name: extractNameFromString(part),
                      lastCommunicationDate: messageDate,
                      communicationCount: 1,
                      isSender: false,
                      isRecipient: true,
                    });
                  }
                }
              }
            }
          } else {
            // This is a received email - extract sender
            const senderEmail = extractEmailFromString(message.senderEmailAddress || '');
            const senderName =
              message.senderName || extractNameFromString(message.senderEmailAddress || '');

            if (senderEmail) {
              const existing = contactsMap.get(senderEmail);
              if (existing) {
                existing.communicationCount++;
                existing.isSender = true;
                if (messageDate > existing.lastCommunicationDate) {
                  existing.lastCommunicationDate = messageDate;
                }
                // Update name if we have a better one
                if (senderName && (!existing.name || existing.name.includes('@'))) {
                  existing.name = senderName;
                }
              } else {
                contactsMap.set(senderEmail, {
                  email: senderEmail,
                  name: senderName,
                  lastCommunicationDate: messageDate,
                  communicationCount: 1,
                  isSender: true,
                  isRecipient: false,
                });
              }
            }
          }
        } catch (error) {
          result.errors.push(
            `Error processing email in ${folderPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      email = folder.getNextChild();
    }
  }

  // Process subfolders
  if (folder.hasSubfolders) {
    const subfolders = folder.getSubFolders();
    for (const subfolder of subfolders) {
      const subfolderPath = `${folderPath}/${subfolder.displayName}`;
      result.totalEmails += subfolder.contentCount || 0;
      processFolder(subfolder, subfolderPath, contactsMap, result);
    }
  }
}

/**
 * Extracts all contacts from a PST file buffer
 */
export async function extractContactsFromPST(pstBuffer: Buffer): Promise<ContactExtractionResult> {
  return new Promise((resolve, reject) => {
    try {
      const pstFile = new pst.PSTFile(pstBuffer as unknown as string);

      const contactsMap = new Map<string, ExtractedContact>();
      const result: ContactExtractionResult = {
        contacts: [],
        totalEmails: 0,
        processedEmails: 0,
        errors: [],
      };

      const rootFolder = pstFile.getRootFolder();
      result.totalEmails = rootFolder.contentCount || 0;

      // Process all folders
      processFolder(rootFolder, rootFolder.displayName || 'Root', contactsMap, result);

      // Convert map to array and sort by last communication date (most recent first)
      result.contacts = Array.from(contactsMap.values()).sort(
        (a, b) => b.lastCommunicationDate.getTime() - a.lastCommunicationDate.getTime()
      );

      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generates an Excel file with extracted contacts
 */
export async function generateContactsExcel(contacts: ExtractedContact[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Legal Platform - Legacy Import';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Contacts', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Define columns
  worksheet.columns = [
    { header: 'Email', key: 'email', width: 40 },
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Last Communication', key: 'lastCommunication', width: 20 },
    { header: 'Communication Count', key: 'count', width: 18 },
    { header: 'Received From', key: 'receivedFrom', width: 12 },
    { header: 'Sent To', key: 'sentTo', width: 12 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Add data rows
  for (const contact of contacts) {
    worksheet.addRow({
      email: contact.email,
      name: contact.name,
      lastCommunication: contact.lastCommunicationDate,
      count: contact.communicationCount,
      receivedFrom: contact.isSender ? 'Yes' : '',
      sentTo: contact.isRecipient ? 'Yes' : '',
    });
  }

  // Format date column
  worksheet.getColumn('lastCommunication').numFmt = 'yyyy-mm-dd';

  // Add autofilter
  worksheet.autoFilter = {
    from: 'A1',
    to: 'F1',
  };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Full extraction pipeline: PST buffer to Excel buffer
 */
export async function extractContactsToExcel(
  pstBuffer: Buffer
): Promise<{ excelBuffer: Buffer; result: ContactExtractionResult }> {
  const result = await extractContactsFromPST(pstBuffer);
  const excelBuffer = await generateContactsExcel(result.contacts);
  return { excelBuffer, result };
}
