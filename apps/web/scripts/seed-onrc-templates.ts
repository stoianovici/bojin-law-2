#!/usr/bin/env tsx
/**
 * Seed ONRC templates from the hardcoded templates-data.ts into the database.
 *
 * This script reads the curated ONRC templates and inserts them into the
 * mapa_templates table, making the database the source of truth.
 *
 * Usage:
 *   pnpm --filter web exec tsx scripts/seed-onrc-templates.ts
 *
 * Prerequisites:
 *   - Run the migration: 20260108120000_add_onrc_template_columns
 *   - Have the database running locally
 */

import { PrismaClient } from '@prisma/client';
import { ONRC_TEMPLATES } from '../src/lib/onrc/templates-data';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting ONRC template seeding...\n');
  console.log(`Found ${ONRC_TEMPLATES.length} templates to seed.\n`);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const template of ONRC_TEMPLATES) {
    try {
      // Extract procedureId from the template id (format: "onrc-{procedureId}")
      const procedureId = template.id.replace('onrc-', '');

      const result = await prisma.mapaTemplate.upsert({
        where: { procedureId },
        create: {
          id: template.id,
          procedureId,
          name: template.name,
          description: template.description || null,
          caseType: template.caseType || null,
          slotDefinitions: template.slotDefinitions as any,
          isActive: true,
          isLocked: true,
          isONRC: true,
          sourceUrl: template.sourceUrl || null,
          contentHash: template.contentHash || null,
          lastSynced: new Date(),
          aiMetadata: null,
          firmId: null,
          createdById: null,
        },
        update: {
          name: template.name,
          description: template.description || null,
          caseType: template.caseType || null,
          slotDefinitions: template.slotDefinitions as any,
          sourceUrl: template.sourceUrl || null,
          contentHash: template.contentHash || null,
          lastSynced: new Date(),
        },
      });

      // Check if this was an insert or update by comparing timestamps
      const wasInserted =
        result.createdAt.getTime() === result.updatedAt.getTime() ||
        new Date().getTime() - result.createdAt.getTime() < 1000;

      if (wasInserted) {
        inserted++;
        console.log(`  + Inserted: ${template.name}`);
      } else {
        updated++;
        console.log(`  ~ Updated: ${template.name}`);
      }
    } catch (error) {
      errors++;
      console.error(`  ! Error with "${template.name}":`, error);
    }
  }

  console.log('\n========================================');
  console.log('Seeding complete!');
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Errors:   ${errors}`);
  console.log(`  Total:    ${ONRC_TEMPLATES.length}`);
  console.log('========================================\n');

  // Verify the count in database
  const dbCount = await prisma.mapaTemplate.count({
    where: { isONRC: true },
  });
  console.log(`ONRC templates in database: ${dbCount}`);
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
