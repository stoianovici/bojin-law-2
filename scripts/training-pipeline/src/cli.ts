#!/usr/bin/env node
/**
 * Training Pipeline CLI
 *
 * Run locally to generate embeddings from OneDrive documents and store in PostgreSQL.
 *
 * Usage:
 *   pnpm run login                    # Sign in with Microsoft
 *   pnpm run logout                   # Clear cached credentials
 *   pnpm run train                    # Process all new documents
 *   pnpm run train:dry-run            # Show what would be processed
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { config } from 'dotenv';
import { resolve } from 'path';

import {
  login,
  getAccessToken,
  clearTokenCache,
  getLoggedInUser,
  isLoggedIn,
} from './auth.js';

// Lazy imports - only loaded when needed (to avoid Prisma import issues for login command)
const loadEmbeddingService = () => import('./embedding-service.js');
const loadOneDriveClient = () => import('./onedrive-client.js');
const loadTextExtractor = () => import('./text-extractor.js');
const loadDatabase = () => import('./database.js');

// Load environment variables from root .env
config({ path: resolve(process.cwd(), '../../.env') });

interface ProcessingStats {
  discovered: number;
  processed: number;
  failed: number;
  skipped: number;
  totalTime: number;
}

const program = new Command();

program
  .name('training-pipeline')
  .description('Generate embeddings for categorized documents from OneDrive')
  .version('1.0.0');

// ============================================================================
// LOGIN COMMAND
// ============================================================================
program
  .command('login')
  .description('Sign in with Microsoft to access OneDrive')
  .action(async () => {
    try {
      await login();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n❌ Login failed: ${message}\n`));
      process.exit(1);
    }
  });

// ============================================================================
// LOGOUT COMMAND
// ============================================================================
program
  .command('logout')
  .description('Clear cached Microsoft credentials')
  .action(async () => {
    await clearTokenCache();
    console.log(chalk.green('\n✅ Logged out successfully\n'));
  });

// ============================================================================
// TRAIN COMMAND
// ============================================================================
program
  .command('train')
  .description('Process documents from OneDrive and generate embeddings')
  .option('--dry-run', 'Show what would be processed without making changes')
  .option('--category <name>', 'Process only a specific category')
  .option('--connection-string <url>', 'PostgreSQL connection string (defaults to DATABASE_URL)')
  .action(async (options) => {
    const startTime = Date.now();

    // Lazy load modules
    const { initializeModel, generateDocumentEmbeddings, EMBEDDING_DIMENSIONS } = await loadEmbeddingService();
    const { createGraphClient, discoverAllDocuments, downloadDocument } = await loadOneDriveClient();
    const { extractText } = await loadTextExtractor();
    const { initializeDatabase, getProcessedDocumentIds, storeTrainingDocument, createPipelineRun, updatePipelineRun, closeDatabase } = await loadDatabase();

    console.log(chalk.blue.bold('\n📚 Training Pipeline - Local Embedding Generator\n'));
    console.log(chalk.gray(`Model: multilingual-e5-base (${EMBEDDING_DIMENSIONS} dimensions)`));
    console.log(chalk.gray('Running on: your local machine\n'));

    // Check login status
    const user = await getLoggedInUser();
    if (user) {
      console.log(chalk.gray(`Signed in as: ${user.username}\n`));
    }

    // Validate environment
    const connectionString = options.connectionString || process.env.DATABASE_URL;

    if (!connectionString) {
      console.error(chalk.red('Error: DATABASE_URL or --connection-string required'));
      process.exit(1);
    }

    // Check Azure client ID
    const hasClientId = process.env.AZURE_TRAINING_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID || process.env.AZURE_CLIENT_ID;
    if (!hasClientId) {
      console.error(chalk.red('Error: AZURE_TRAINING_CLIENT_ID environment variable required'));
      console.log(chalk.gray('\nAdd to your .env file:'));
      console.log(chalk.cyan('AZURE_TRAINING_CLIENT_ID=your-app-id-here\n'));
      process.exit(1);
    }

    const stats: ProcessingStats = {
      discovered: 0,
      processed: 0,
      failed: 0,
      skipped: 0,
      totalTime: 0,
    };

    let runId: string | null = null;

    try {
      // Get access token (will fail if not logged in)
      let accessToken: string;
      try {
        accessToken = await getAccessToken();
      } catch {
        console.error(chalk.red('Not logged in. Please run: pnpm run login\n'));
        process.exit(1);
      }

      // Initialize database
      const dbSpinner = ora('Connecting to database...').start();
      initializeDatabase(connectionString);
      dbSpinner.succeed('Connected to database');

      // Get already processed documents
      const processedIds = await getProcessedDocumentIds();
      console.log(chalk.gray(`Found ${processedIds.size} already processed documents\n`));

      // Create pipeline run record (unless dry run)
      if (!options.dryRun) {
        runId = await createPipelineRun('manual');
      }

      // Initialize embedding model
      await initializeModel();
      console.log();

      // Discover documents from OneDrive
      const discoverySpinner = ora('Discovering documents from OneDrive...').start();
      const graphClient = createGraphClient(accessToken);

      let categories;
      let newCount;
      let skippedCount;

      try {
        const result = await discoverAllDocuments(graphClient, processedIds);
        categories = result.categories;
        newCount = result.newCount;
        skippedCount = result.skippedCount;
      } catch (error) {
        discoverySpinner.fail('Failed to access OneDrive');
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes('401') || message.includes('unauthorized')) {
          console.error(chalk.red('\nAccess token expired. Please run: pnpm run login\n'));
        } else {
          console.error(chalk.red(`\n${message}\n`));
        }
        process.exit(1);
      }

      stats.discovered = newCount;
      stats.skipped = skippedCount;

      if (options.category) {
        // Filter to specific category
        const filtered = categories.filter((c) => c.name === options.category);
        if (filtered.length === 0) {
          discoverySpinner.warn(`Category "${options.category}" not found or empty`);
          return;
        }
        categories.length = 0;
        categories.push(...filtered);
      }

      discoverySpinner.succeed(
        `Found ${newCount} new documents in ${categories.length} categories (${skippedCount} already processed)`
      );

      // Show what we found
      console.log();
      for (const category of categories) {
        console.log(chalk.cyan(`  📁 ${category.name}: ${category.documents.length} documents`));
      }
      console.log();

      // Dry run stops here
      if (options.dryRun) {
        console.log(chalk.yellow('Dry run - no changes made\n'));
        return;
      }

      if (newCount === 0) {
        console.log(chalk.green('No new documents to process.\n'));
        return;
      }

      // Process each category
      for (const category of categories) {
        console.log(chalk.blue.bold(`\nProcessing ${category.name}...`));

        for (const doc of category.documents) {
          const docSpinner = ora(`  ${doc.name}`).start();

          try {
            const docStartTime = Date.now();

            // Download document
            const buffer = await downloadDocument(doc);

            // Extract text
            const extraction = await extractText(buffer, doc.name);

            if (extraction.wordCount < 10) {
              docSpinner.warn(`  ${doc.name} - too short (${extraction.wordCount} words)`);
              stats.failed++;
              continue;
            }

            // Generate embeddings
            const embeddings = await generateDocumentEmbeddings(extraction.text);

            // Store in database
            await storeTrainingDocument({
              category: category.name,
              originalFilename: doc.name,
              oneDriveFileId: doc.id,
              textContent: extraction.text,
              language: extraction.language,
              wordCount: extraction.wordCount,
              metadata: category.metadataJson,
              processingDurationMs: Date.now() - docStartTime,
              embeddings,
            });

            const duration = ((Date.now() - docStartTime) / 1000).toFixed(1);
            docSpinner.succeed(
              `  ${doc.name} - ${extraction.wordCount} words, ${embeddings.length} chunks, ${extraction.language} (${duration}s)`
            );
            stats.processed++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            docSpinner.fail(`  ${doc.name} - ${errorMessage}`);
            stats.failed++;
          }
        }
      }

      stats.totalTime = Date.now() - startTime;

      // Update pipeline run
      if (runId) {
        await updatePipelineRun(runId, {
          status: 'completed',
          documentsDiscovered: stats.discovered,
          documentsProcessed: stats.processed,
          documentsFailed: stats.failed,
        });
      }

      // Print summary
      console.log(chalk.green.bold('\n✅ Processing complete!\n'));
      console.log(chalk.white(`   Discovered:  ${stats.discovered}`));
      console.log(chalk.white(`   Processed:   ${stats.processed}`));
      console.log(chalk.white(`   Failed:      ${stats.failed}`));
      console.log(chalk.white(`   Skipped:     ${stats.skipped}`));
      console.log(chalk.white(`   Total time:  ${(stats.totalTime / 1000).toFixed(1)}s\n`));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n❌ Pipeline failed: ${errorMessage}\n`));

      if (runId) {
        await updatePipelineRun(runId, {
          status: 'failed',
          documentsDiscovered: stats.discovered,
          documentsProcessed: stats.processed,
          documentsFailed: stats.failed,
          errorLog: { error: errorMessage },
        });
      }

      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

// ============================================================================
// STATUS COMMAND (bonus)
// ============================================================================
program
  .command('status')
  .description('Show current login status and configuration')
  .action(async () => {
    console.log(chalk.blue.bold('\n📊 Training Pipeline Status\n'));

    // Check login
    const user = await getLoggedInUser();
    if (user) {
      console.log(chalk.green(`✅ Logged in as: ${user.username}`));
    } else {
      console.log(chalk.yellow('⚠️  Not logged in (run: pnpm run login)'));
    }

    // Check Azure client ID
    const clientId = process.env.AZURE_TRAINING_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID || process.env.AZURE_CLIENT_ID;
    if (clientId) {
      console.log(chalk.green(`✅ AZURE_TRAINING_CLIENT_ID: configured`));
    } else {
      console.log(chalk.yellow('⚠️  AZURE_TRAINING_CLIENT_ID: not set'));
    }

    // Check database URL
    if (process.env.DATABASE_URL) {
      console.log(chalk.green(`✅ DATABASE_URL: configured`));
    } else {
      console.log(chalk.yellow('⚠️  DATABASE_URL: not set'));
    }

    console.log();
  });

program.parse();
