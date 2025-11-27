/**
 * Health Check API Route
 * Used by Render for health monitoring
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'legacy-import',
    version: process.env.npm_package_version || '1.0.0',
  });
}
