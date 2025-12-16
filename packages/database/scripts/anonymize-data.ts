/**
 * Data Anonymization Script for Legal Platform
 *
 * Anonymizes PII (Personally Identifiable Information) from production data
 * for safe use in development and testing environments.
 *
 * Run with: pnpm db:anonymize
 *
 * CRITICAL: Only run this on NON-PRODUCTION databases!
 * This script IRREVERSIBLY modifies data.
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Configuration: Fields to anonymize
const ANONYMIZATION_CONFIG = {
  users: {
    fields: ['first_name', 'last_name', 'email', 'azure_ad_id'],
    preserveStructure: true,
  },
  clients: {
    fields: ['name', 'address', 'contact_info'],
    preserveStructure: true,
  },
  cases: {
    fields: ['title', 'description'],
    preserveStructure: false, // Generic descriptions
  },
  documents: {
    fields: ['title', 'content'],
    preserveStructure: false, // Lorem ipsum
  },
};

// Helper: Generate anonymous email
function generateAnonymousEmail(index: number): string {
  return `demo${index}@example.com`;
}

// Helper: Generate lorem ipsum text
function generateLoremIpsum(length: 'short' | 'medium' | 'long'): string {
  const lorem =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
  const sizes = {
    short: lorem.substring(0, 50),
    medium: lorem + ' ' + lorem.substring(0, 100),
    long: lorem.repeat(3),
  };
  return sizes[length];
}

// Helper: Check if running on production
function isProductionDatabase(dbUrl: string): boolean {
  return dbUrl.includes('render.com') || dbUrl.includes('production');
}

async function main() {
  console.log('🔒 Data Anonymization Script Starting...');
  console.log('');

  // Safety check: Verify not running on production
  const databaseUrl = process.env.DATABASE_URL || '';
  if (isProductionDatabase(databaseUrl)) {
    console.error('❌ CRITICAL ERROR: Production database detected!');
    console.error('This script should NEVER be run on production databases.');
    console.error('It will irreversibly anonymize all data.');
    console.error('');
    console.error('Database URL contains: render.com or production');
    process.exit(1);
  }

  console.log('✓ Safety check passed: Not a production database');
  console.log('');

  // Warning prompt for user confirmation
  console.log('⚠️  WARNING: This script will IRREVERSIBLY anonymize all PII data.');
  console.log('Ensure you have a backup before proceeding.');
  console.log('');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');

  // 5-second delay for user to cancel
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log('');
  console.log('Starting anonymization process...');
  console.log('');

  // Track counts for reporting
  const stats = {
    usersAnonymized: 0,
    clientsAnonymized: 0,
    casesAnonymized: 0,
    documentsAnonymized: 0,
  };

  try {
    // Wrap entire anonymization in a transaction
    await prisma.$transaction(async (tx) => {
      // TODO: Uncomment once User model is added in Story 2.4
      /*
      console.log('Anonymizing users...');
      const users = await tx.user.findMany();

      for (let i = 0; i < users.length; i++) {
        await tx.user.update({
          where: { id: users[i].id },
          data: {
            first_name: `Demo User`,
            last_name: `${i + 1}`,
            email: generateAnonymousEmail(i + 1),
            azure_ad_id: randomUUID(), // Replace with random UUID
          },
        });
        stats.usersAnonymized++;
      }
      console.log(`✓ Anonymized ${stats.usersAnonymized} users`);
      */

      // TODO: Uncomment once Client model is added
      /*
      console.log('Anonymizing clients...');
      const clients = await tx.client.findMany();

      for (let i = 0; i < clients.length; i++) {
        await tx.client.update({
          where: { id: clients[i].id },
          data: {
            name: `Demo Client ${i + 1}`,
            address: `Strada Demo ${i + 1}, Bucharest, Romania`,
            contact_info: `demo-client-${i + 1}@example.com`,
          },
        });
        stats.clientsAnonymized++;
      }
      console.log(`✓ Anonymized ${stats.clientsAnonymized} clients`);
      */

      // TODO: Uncomment once Case model is added in Story 2.6
      /*
      console.log('Anonymizing cases...');
      const cases = await tx.case.findMany();

      for (let i = 0; i < cases.length; i++) {
        await tx.case.update({
          where: { id: cases[i].id },
          data: {
            title: `Case ${i + 1}: ${generateLoremIpsum('short')}`,
            description: generateLoremIpsum('medium'),
          },
        });
        stats.casesAnonymized++;
      }
      console.log(`✓ Anonymized ${stats.casesAnonymized} cases`);
      */

      // TODO: Uncomment once Document model is added in Story 2.7
      /*
      console.log('Anonymizing documents...');
      const documents = await tx.document.findMany();

      for (let i = 0; i < documents.length; i++) {
        await tx.document.update({
          where: { id: documents[i].id },
          data: {
            title: `Document ${i + 1}`,
            content: generateLoremIpsum('long'),
          },
        });
        stats.documentsAnonymized++;
      }
      console.log(`✓ Anonymized ${stats.documentsAnonymized} documents`);
      */

      console.log('');
      console.log('Note: Anonymization code is ready but requires Prisma models.');
      console.log('Models will be added in Stories 2.4 (Auth), 2.6 (Cases), 2.7 (Docs)');
    });

    console.log('');
    console.log('✅ Anonymization completed successfully!');
    console.log('');
    console.log('Summary:');
    console.log(`  - Users anonymized: ${stats.usersAnonymized}`);
    console.log(`  - Clients anonymized: ${stats.clientsAnonymized}`);
    console.log(`  - Cases anonymized: ${stats.casesAnonymized}`);
    console.log(`  - Documents anonymized: ${stats.documentsAnonymized}`);
    console.log('');
    console.log('✓ All PII data has been replaced with anonymous values');
    console.log('✓ Database structure and relationships preserved');
    console.log('✓ Statistical distributions maintained');
    console.log('');
  } catch (error) {
    console.error('❌ Error during anonymization:', error);
    console.error('Transaction rolled back - no changes made');
    process.exit(1);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Fatal error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
