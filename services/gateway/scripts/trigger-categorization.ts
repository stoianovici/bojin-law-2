/**
 * Script to manually trigger email categorization
 * Run with: pnpm --filter gateway exec tsx scripts/trigger-categorization.ts
 */

import 'dotenv/config';
import { triggerProcessing } from '../src/workers/email-categorization.worker';

async function main() {
  console.log('Triggering email categorization...\n');
  const result = await triggerProcessing();
  console.log('\nResult:', JSON.stringify(result, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
