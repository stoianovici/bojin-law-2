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
  // .env.local not found
}

import { syncSingleTemplate } from '../src/lib/onrc/scraper';

async function test() {
  // Check if API key is available
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  console.log('API Key available:', hasKey);
  if (!hasKey) {
    console.log('ANTHROPIC_API_KEY not set - AI will not work');
  }

  console.log('\nTesting single sync with AI...');
  const result = await syncSingleTemplate('infiintare-srl', { useAI: true });

  if (result) {
    console.log('\n=== RESULT ===');
    console.log('Name:', result.name);
    console.log('AI Enhanced:', result.aiEnhanced);
    console.log('AI Confidence:', result.aiConfidence);
    console.log('Slots count:', result.slotDefinitions.length);
    console.log('Error:', result.error);
    console.log('AI Warnings:', result.aiWarnings);
    console.log('URL Status:', result.urlStatus);

    if (result.slotDefinitions.length > 0) {
      console.log('\nSlots:');
      result.slotDefinitions.forEach((s) => {
        console.log(
          `  ${s.order}. ${s.name} (${s.category}) - ${s.required ? 'REQUIRED' : 'optional'}`
        );
      });
    }
  }
}

test().catch(console.error);
