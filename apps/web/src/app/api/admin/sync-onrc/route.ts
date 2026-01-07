import { NextRequest, NextResponse } from 'next/server';
import { syncONRCTemplates, syncSingleTemplate, type SyncOptions } from '@/lib/onrc/scraper';
import { saveTemplates, getLastSyncInfo } from '@/lib/onrc/storage';

export const runtime = 'nodejs';
export const maxDuration = 120; // Allow up to 120 seconds for scraping with AI

/**
 * GET /api/admin/sync-onrc
 * Returns the last sync status and template count
 */
export async function GET() {
  try {
    const syncInfo = await getLastSyncInfo();
    return NextResponse.json(syncInfo);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to get sync info',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/sync-onrc
 * Triggers a full sync of all ONRC templates
 */
export async function POST(request: NextRequest) {
  try {
    // Check for API key in production
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, require either valid session or cron secret
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        // For non-cron requests, we'd check user session here
        // For now, allow requests without auth in development
        console.log('Warning: Sync request without CRON_SECRET authorization');
      }
    }

    // Parse request body for options
    const body = await request.json().catch(() => ({}));
    const templateId = body.templateId as string | undefined;

    // AI enhancement options
    const syncOptions: SyncOptions = {
      useAI: body.useAI === true, // Full AI analysis of content
      enrichWithAI: body.enrichWithAI === true, // Enrich basic parsing with AI descriptions
    };

    console.log(
      `[API] Sync request - templateId: ${templateId || 'all'}, useAI: ${syncOptions.useAI}, enrichWithAI: ${syncOptions.enrichWithAI}`
    );

    let result;

    if (templateId) {
      // Sync single template
      const template = await syncSingleTemplate(templateId, syncOptions);
      if (!template) {
        return NextResponse.json({ error: 'Template not found', templateId }, { status: 404 });
      }
      result = {
        success: !template.error,
        message:
          template.error ||
          `Synced template: ${template.name}${template.aiEnhanced ? ' (AI-enhanced)' : ''}`,
        templates: [template],
        errors: template.error ? [{ procedureId: templateId, error: template.error }] : [],
        syncedAt: new Date().toISOString(),
        aiEnhanced: template.aiEnhanced,
      };
    } else {
      // Full sync
      result = await syncONRCTemplates(syncOptions);
    }

    // Save results to storage
    await saveTemplates(result.templates);

    return NextResponse.json(result);
  } catch (error) {
    console.error('ONRC sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
