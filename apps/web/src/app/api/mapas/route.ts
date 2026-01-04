import { NextRequest, NextResponse } from 'next/server';
import { MOCK_MAPE, MOCK_USERS } from '@/lib/mock/documents';
import { getMapaTemplates } from '@/lib/onrc/storage';
import { MOCK_TEMPLATES } from '@/lib/mock/templates';
import type { Mapa, MapaSlot, MapaCompletionStatus } from '@/types/mapa';

// In-memory storage for created mapas (will be lost on server restart)
let createdMapas: Mapa[] = [];

/**
 * GET /api/mapas
 * Returns all mapas (mock + created)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get('caseId');

  let mapas = [...MOCK_MAPE, ...createdMapas];

  if (caseId) {
    mapas = mapas.filter((m) => m.caseId === caseId);
  }

  return NextResponse.json({ mapas });
}

/**
 * POST /api/mapas
 * Creates a new mapa (blank or from template)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, name, description, templateId } = body;

    if (!caseId || !name) {
      return NextResponse.json({ error: 'caseId and name are required' }, { status: 400 });
    }

    // Note: Case validation skipped - real cases come from database
    // The mock MOCK_CASES_WITH_MAPE only contains test data

    // Generate unique ID
    const timestamp = Date.now();
    const mapaId = `mapa-created-${timestamp}`;

    // Get template if templateId is provided
    let slots: MapaSlot[] = [];
    if (templateId) {
      // Try to get from scraped templates first
      const scrapedTemplates = await getMapaTemplates();
      let template = scrapedTemplates.find((t) => t.id === templateId);

      // Fall back to mock templates
      if (!template) {
        template = MOCK_TEMPLATES.find((t) => t.id === templateId);
      }

      if (template && template.slotDefinitions) {
        slots = template.slotDefinitions.map((slot, index) => ({
          id: `${mapaId}-slot-${index + 1}`,
          mapaId,
          name: slot.name,
          description: slot.description,
          category: slot.category,
          required: slot.required,
          order: slot.order ?? index + 1,
          status: 'pending' as const,
        }));
      }
    }

    // Calculate completion status
    const completionStatus: MapaCompletionStatus = {
      totalSlots: slots.length,
      filledSlots: 0,
      requiredSlots: slots.filter((s) => s.required).length,
      filledRequiredSlots: 0,
      isComplete: slots.filter((s) => s.required).length === 0,
      missingRequired: slots.filter((s) => s.required).map((s) => s.name),
      percentComplete: slots.length === 0 ? 100 : 0,
    };

    const now = new Date().toISOString();
    const newMapa: Mapa = {
      id: mapaId,
      caseId,
      name,
      description: description || undefined,
      createdBy: MOCK_USERS[0], // Use first mock user as creator
      createdAt: now,
      updatedAt: now,
      slots,
      completionStatus,
    };

    // Store the created mapa
    createdMapas.push(newMapa);

    return NextResponse.json({ mapa: newMapa }, { status: 201 });
  } catch (error) {
    console.error('Error creating mapa:', error);
    return NextResponse.json({ error: 'Failed to create mapa' }, { status: 500 });
  }
}
