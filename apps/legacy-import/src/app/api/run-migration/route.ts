/**
 * One-time migration endpoint to add missing columns
 * DELETE this file after successful migration
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    console.log('[Migration] Starting migration...');

    // Add extraction_progress column if it doesn't exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE legacy_import_sessions
      ADD COLUMN IF NOT EXISTS extraction_progress JSONB;
    `);

    console.log('[Migration] Added extraction_progress column');

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
    });
  } catch (error) {
    console.error('[Migration] Error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Check if column exists
  try {
    const result = (await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'legacy_import_sessions'
      AND column_name = 'extraction_progress';
    `) as { column_name: string }[];

    return NextResponse.json({
      columnExists: result.length > 0,
      message:
        result.length > 0
          ? 'extraction_progress column exists'
          : 'extraction_progress column does NOT exist - POST to this endpoint to add it',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Check failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
