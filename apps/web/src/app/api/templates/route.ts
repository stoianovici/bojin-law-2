import { NextRequest, NextResponse } from 'next/server';
import { getMapaTemplates } from '@/lib/onrc/storage';
import { MOCK_TEMPLATES, MOCK_FIRM_TEMPLATES } from '@/lib/mock/templates';
import type { MapaTemplate } from '@/types/mapa';

/**
 * GET /api/templates
 * Returns all templates (scraped ONRC + firm templates)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isONRC = searchParams.get('isONRC');
    const isActive = searchParams.get('isActive');

    // Get scraped ONRC templates
    let onrcTemplates = await getMapaTemplates();

    // If no scraped templates, fall back to mock ONRC templates
    if (onrcTemplates.length === 0) {
      onrcTemplates = MOCK_TEMPLATES.filter((t) => t.isONRC);
    }

    // Always use mock firm templates (until backend is ready)
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
  } catch (error) {
    console.error('Error fetching templates:', error);

    // Return mock data on error
    return NextResponse.json({ templates: MOCK_TEMPLATES });
  }
}
