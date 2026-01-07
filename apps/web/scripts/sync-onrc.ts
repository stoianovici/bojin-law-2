/**
 * ONRC Template Sync Script
 *
 * Usage: source .env.local && npx tsx scripts/sync-onrc.ts [--ai]
 *   or:  env $(cat .env.local | xargs) npx tsx scripts/sync-onrc.ts [--ai]
 *
 * Options:
 *   --ai    Enable AI-enhanced analysis (requires ANTHROPIC_API_KEY)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env.local
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (e) {
  // .env.local not found, continue with existing env
}

import { syncONRCTemplates, ONRC_PROCEDURES } from '../src/lib/onrc/scraper';
import { saveTemplates } from '../src/lib/onrc/storage';

async function main() {
  const useAI = process.argv.includes('--ai');

  console.log('='.repeat(60));
  console.log('ONRC Template Sync');
  console.log('='.repeat(60));
  console.log(`Total procedures: ${ONRC_PROCEDURES.length}`);
  console.log(`AI Enhancement: ${useAI ? 'Enabled' : 'Disabled'}`);
  console.log('='.repeat(60));
  console.log('');

  const result = await syncONRCTemplates({
    useAI,
    enrichWithAI: false,
    autoRecoverURLs: true,
  });

  // Save templates to storage so they appear in the UI
  console.log('\n[Saving] Persisting templates to storage...');
  await saveTemplates(result.templates);
  console.log('[Saved] Templates persisted successfully');

  console.log('');
  console.log('='.repeat(60));
  console.log('SYNC RESULTS');
  console.log('='.repeat(60));
  console.log(`Success: ${result.success}`);
  console.log(`Message: ${result.message}`);
  console.log(`Templates synced: ${result.templates.length}`);
  console.log(`Errors: ${result.errors.length}`);

  // Summary by category
  const byCategory = result.templates.reduce(
    (acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('');
  console.log('By Category:');
  Object.entries(byCategory).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  // AI enhancement summary
  const aiEnhanced = result.templates.filter((t) => t.aiEnhanced);
  const withErrors = result.templates.filter((t) => t.error);

  console.log('');
  console.log('Quality:');
  console.log(`  AI Enhanced: ${aiEnhanced.length}`);
  console.log(`  With Errors: ${withErrors.length}`);
  console.log(
    `  Avg Slots: ${(result.templates.reduce((sum, t) => sum + t.slotDefinitions.length, 0) / result.templates.length).toFixed(1)}`
  );

  if (result.errors.length > 0) {
    console.log('');
    console.log('Errors:');
    result.errors.forEach((err) => {
      console.log(`  ${err.procedureId}: ${err.error}`);
    });
  }

  // Sample output for first few templates
  console.log('');
  console.log('Sample Templates:');
  result.templates.slice(0, 3).forEach((t) => {
    console.log(
      `  ${t.name}: ${t.slotDefinitions.length} slots ${t.aiEnhanced ? '(AI)' : ''} ${t.error ? '[ERROR]' : ''}`
    );
  });
}

main().catch(console.error);
