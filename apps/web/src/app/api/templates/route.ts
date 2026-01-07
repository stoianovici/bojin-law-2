import { NextRequest, NextResponse } from 'next/server';
import { ONRC_TEMPLATES } from '@/lib/onrc/templates-data';
import { MOCK_FIRM_TEMPLATES } from '@/lib/mock/templates';
import type { MapaTemplate } from '@/types/mapa';

/**
 * GET /api/templates
 * Returns all templates (ONRC + firm templates)
 *
 * ONRC templates come from templates-data.ts (source of truth in code)
 * This ensures templates are never lost due to database resets.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isONRC = searchParams.get('isONRC');
  const isActive = searchParams.get('isActive');

  // ONRC templates from TypeScript source of truth (58 templates)
  const onrcTemplates = ONRC_TEMPLATES;

  // Firm-specific custom templates (until backend is ready)
  const firmTemplates = MOCK_FIRM_TEMPLATES;

  // Combine templates
  let templates: MapaTemplate[] = [...onrcTemplates, ...firmTemplates];

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
