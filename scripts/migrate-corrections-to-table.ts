/**
 * Migration Script: User Corrections JSON to Table
 *
 * Migrates userCorrections from JSON field to normalized UserCorrection table.
 * Idempotent - can be run multiple times safely.
 *
 * Usage:
 *   pnpm exec tsx scripts/migrate-corrections-to-table.ts
 *
 * Flags:
 *   --dry-run    Show what would be migrated without making changes
 *   --verbose    Show detailed progress
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface JsonCorrection {
  id: string;
  sectionId: string;
  fieldPath?: string;
  correctionType: 'override' | 'append' | 'remove' | 'note';
  originalValue?: string;
  correctedValue: string;
  reason?: string;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

function mapCorrectionType(type: string): 'OVERRIDE' | 'APPEND' | 'REMOVE' | 'NOTE' {
  switch (type.toLowerCase()) {
    case 'override':
      return 'OVERRIDE';
    case 'append':
      return 'APPEND';
    case 'remove':
      return 'REMOVE';
    case 'note':
      return 'NOTE';
    default:
      return 'OVERRIDE';
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('User Corrections Migration: JSON → Table');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));
  console.log();

  // Get all context files with non-null userCorrections JSON
  const contextFiles = await prisma.contextFile.findMany({
    where: {
      userCorrections: {
        not: null,
      },
    },
    select: {
      id: true,
      clientId: true,
      caseId: true,
      userCorrections: true,
    },
  });

  console.log(`Found ${contextFiles.length} context files with userCorrections JSON`);

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const file of contextFiles) {
    const corrections = file.userCorrections as JsonCorrection[] | null;
    if (!corrections || !Array.isArray(corrections) || corrections.length === 0) {
      if (verbose) {
        console.log(`Skipping ${file.id} - no valid corrections`);
      }
      continue;
    }

    const entityLabel = file.clientId ? `Client:${file.clientId}` : `Case:${file.caseId}`;

    if (verbose) {
      console.log(`\nProcessing ${entityLabel} (${corrections.length} corrections)`);
    }

    for (const corr of corrections) {
      try {
        // 1. Try to find by ID first (most reliable)
        if (corr.id) {
          const existingById = await prisma.userCorrection.findUnique({
            where: { id: corr.id },
          });

          if (existingById) {
            if (verbose) {
              console.log(`  ↳ Skipping (ID exists): ${corr.id}`);
            }
            totalSkipped++;
            continue;
          }
        }

        // 2. Fall back to field-based matching for legacy corrections without IDs
        // Match on timestamp instead of value to handle multiple edits to same field
        const existingByFields = await prisma.userCorrection.findFirst({
          where: {
            contextFileId: file.id,
            sectionId: corr.sectionId,
            fieldPath: corr.fieldPath ?? null,
            createdBy: corr.createdBy,
            createdAt: new Date(corr.createdAt),
          },
        });

        if (existingByFields) {
          if (verbose) {
            console.log(`  ↳ Skipping (fields match): ${corr.sectionId}/${corr.fieldPath || '-'}`);
          }
          totalSkipped++;
          continue;
        }

        if (!dryRun) {
          await prisma.userCorrection.create({
            data: {
              id: corr.id, // Preserve original ID if possible
              contextFileId: file.id,
              sectionId: corr.sectionId,
              fieldPath: corr.fieldPath || null,
              correctionType: mapCorrectionType(corr.correctionType),
              originalValue: corr.originalValue || null,
              correctedValue: corr.correctedValue,
              reason: corr.reason || null,
              createdBy: corr.createdBy,
              isActive: corr.isActive,
              createdAt: new Date(corr.createdAt),
            },
          });
        }

        if (verbose) {
          console.log(`  ✓ Migrated: ${corr.sectionId}/${corr.fieldPath || '-'}`);
        }
        totalMigrated++;
      } catch (error: any) {
        // Handle duplicate ID error gracefully (idempotency)
        if (error.code === 'P2002') {
          if (verbose) {
            console.log(`  ↳ Already exists: ${corr.id}`);
          }
          totalSkipped++;
        } else {
          console.error(`  ✗ Error migrating correction: ${error.message}`);
          totalErrors++;
        }
      }
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));
  console.log(`  Migrated:  ${totalMigrated}`);
  console.log(`  Skipped:   ${totalSkipped} (already exist)`);
  console.log(`  Errors:    ${totalErrors}`);
  console.log();

  if (dryRun) {
    console.log('DRY RUN COMPLETE - No changes were made');
    console.log('Run without --dry-run to apply changes');
  } else if (totalMigrated > 0) {
    console.log('MIGRATION COMPLETE');
    console.log();
    console.log('Next steps:');
    console.log('  1. Verify corrections in user_corrections table');
    console.log('  2. Update UnifiedContextService to use the new table');
    console.log('  3. Remove userCorrections JSON field in future schema update');
  }
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
