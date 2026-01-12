import { NextRequest, NextResponse } from 'next/server';
import { ONRC_TEMPLATES } from '@/lib/onrc/templates-data';
import type { MapaTemplate } from '@/types/mapa';

/**
 * GET /api/templates
 * Returns all templates (ONRC + firm templates)
 *
 * ONRC templates come from templates-data.ts (source of truth in code)
 * This ensures templates are never lost due to database resets.
 *
 * Note: Mock firm templates removed - they don't exist in the backend
 * and can't be used to create mapas. Real firm templates will come
 * from GraphQL when implemented.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isONRC = searchParams.get('isONRC');
  const isActive = searchParams.get('isActive');

  // ONRC templates from TypeScript source of truth (58 templates)
  // These work because the backend also has them in static data
  let templates: MapaTemplate[] = [...ONRC_TEMPLATES];

  // Apply filters
  if (isONRC !== null) {
    const filterValue = isONRC === 'true';
    templates = templates.filter((t) => t.isONRC === filterValue);
  }

  if (isActive !== null) {
    const filterValue = isActive === 'true';
    templates = templates.filter((t) => t.isActive === filterValue);
  }

  return NextResponse.json({ templates });
}
