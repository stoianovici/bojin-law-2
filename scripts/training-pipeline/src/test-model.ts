#!/usr/bin/env node
/**
 * Test script to verify the embedding model works correctly
 *
 * Run: pnpm run test-model
 */

import chalk from 'chalk';
import {
  initializeModel,
  generateEmbedding,
  cosineSimilarity,
  EMBEDDING_DIMENSIONS,
} from './embedding-service.js';

async function main() {
  console.log(chalk.blue.bold('\n🧪 Testing multilingual-e5-base embedding model\n'));

  // Initialize model (will download on first run)
  await initializeModel();
  console.log();

  // Test texts in Romanian and English
  const testCases = [
    {
      name: 'Romanian legal text',
      text: 'Contract de vânzare-cumpărare încheiat între părți conform legislației în vigoare.',
    },
    {
      name: 'English legal text',
      text: 'Sales agreement concluded between the parties in accordance with current legislation.',
    },
    {
      name: 'Romanian notification',
      text: 'Notificare avocateasca privind rezilierea contractului de inchiriere.',
    },
    {
      name: 'Unrelated text',
      text: 'The weather is sunny today and I want to go to the beach.',
    },
  ];

  console.log(chalk.cyan('Generating embeddings...\n'));

  const embeddings: { name: string; embedding: number[] }[] = [];

  for (const test of testCases) {
    const start = Date.now();
    const embedding = await generateEmbedding(test.text, false);
    const duration = Date.now() - start;

    embeddings.push({ name: test.name, embedding });

    console.log(chalk.white(`  ${test.name}`));
    console.log(chalk.gray(`    Text: "${test.text.slice(0, 60)}..."`));
    console.log(chalk.gray(`    Dimensions: ${embedding.length}`));
    console.log(chalk.gray(`    Time: ${duration}ms`));
    console.log();
  }

  // Verify dimensions
  console.log(chalk.cyan('Verifying dimensions...\n'));
  const allCorrect = embeddings.every((e) => e.embedding.length === EMBEDDING_DIMENSIONS);
  if (allCorrect) {
    console.log(chalk.green(`  ✅ All embeddings have correct dimensions (${EMBEDDING_DIMENSIONS})\n`));
  } else {
    console.log(chalk.red(`  ❌ Dimension mismatch!\n`));
  }

  // Calculate similarity matrix
  console.log(chalk.cyan('Similarity matrix:\n'));

  // Header
  process.stdout.write('                          ');
  for (const e of embeddings) {
    process.stdout.write(e.name.slice(0, 12).padEnd(14));
  }
  console.log();

  // Matrix
  for (let i = 0; i < embeddings.length; i++) {
    process.stdout.write(embeddings[i].name.slice(0, 24).padEnd(26));
    for (let j = 0; j < embeddings.length; j++) {
      const sim = cosineSimilarity(embeddings[i].embedding, embeddings[j].embedding);
      const simStr = sim.toFixed(3);
      if (i === j) {
        process.stdout.write(chalk.gray(simStr.padEnd(14)));
      } else if (sim > 0.7) {
        process.stdout.write(chalk.green(simStr.padEnd(14)));
      } else if (sim > 0.5) {
        process.stdout.write(chalk.yellow(simStr.padEnd(14)));
      } else {
        process.stdout.write(chalk.white(simStr.padEnd(14)));
      }
    }
    console.log();
  }

  console.log();
  console.log(chalk.gray('Higher similarity (green) = more semantically similar'));
  console.log(chalk.gray('Romanian and English legal texts should show high similarity'));
  console.log(chalk.gray('Unrelated text should show low similarity to legal texts\n'));

  console.log(chalk.green.bold('✅ Model test complete!\n'));
}

main().catch((error) => {
  console.error(chalk.red('Test failed:'), error);
  process.exit(1);
});
