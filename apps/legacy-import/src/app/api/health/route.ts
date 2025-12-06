/**
 * Health Check API Route
 * Used by Render for health monitoring
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  // Debug: Check Prisma client state
  const prismaDebug = {
    hasPrisma: !!prisma,
    prismaType: typeof prisma,
    hasLegacyImportSession: !!(prisma as unknown as Record<string, unknown>)?.legacyImportSession,
    hasDocumentBatch: !!(prisma as unknown as Record<string, unknown>)?.documentBatch,
    modelKeys: prisma
      ? Object.keys(prisma).filter((k) => !k.startsWith('_') && !k.startsWith('$'))
      : [],
  };

  // Try a simple database query
  let dbStatus = 'unknown';
  let dbError = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error';
    dbError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'legacy-import',
    version: process.env.npm_package_version || '1.0.0',
    prismaDebug,
    dbStatus,
    dbError,
  });
}
