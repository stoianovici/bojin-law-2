import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Temporary migration endpoint - DELETE AFTER USE
export async function POST(request: NextRequest) {
  // Simple auth check - require a secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.MIGRATION_SECRET || 'ops004-migration'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Add new columns for OPS-004
    await prisma.$executeRawUnsafe(`
      ALTER TABLE legacy_import_sessions
      ADD COLUMN IF NOT EXISTS cleanup_scheduled_at TIMESTAMPTZ;
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE legacy_import_sessions
      ADD COLUMN IF NOT EXISTS last_snapshot_at TIMESTAMPTZ;
    `);

    return NextResponse.json({
      success: true,
      message: 'Migration completed: added cleanup_scheduled_at and last_snapshot_at columns',
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: String(error) },
      { status: 500 }
    );
  }
}

// GET to check if columns exist
export async function GET() {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'legacy_import_sessions'
      AND column_name IN ('cleanup_scheduled_at', 'last_snapshot_at')
    `;

    return NextResponse.json({
      columns: result,
      migrationNeeded: (result as unknown[]).length < 2,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
