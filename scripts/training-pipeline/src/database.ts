/**
 * Database operations for storing training documents and embeddings
 */

import pkg from '@prisma/client';
const { PrismaClient, Prisma } = pkg;

let prisma: PrismaClient | null = null;

/**
 * Initialize Prisma client with connection string
 */
export function initializeDatabase(connectionString?: string): PrismaClient {
  if (prisma) return prisma;

  prisma = new PrismaClient({
    datasources: connectionString ? { db: { url: connectionString } } : undefined,
  });

  return prisma;
}

/**
 * Get all processed OneDrive file IDs
 */
export async function getProcessedDocumentIds(): Promise<Set<string>> {
  const documents = await prisma!.trainingDocument.findMany({
    select: { oneDriveFileId: true },
  });

  return new Set(documents.map((d: { oneDriveFileId: string }) => d.oneDriveFileId));
}

/**
 * Store a training document with its embeddings
 */
export async function storeTrainingDocument(input: {
  category: string;
  originalFilename: string;
  originalFolderPath?: string;
  oneDriveFileId: string;
  textContent: string;
  language: 'ro' | 'en' | 'mixed';
  wordCount: number;
  metadata?: Record<string, unknown>;
  processingDurationMs: number;
  embeddings: Array<{
    chunkIndex: number;
    chunkText: string;
    embedding: number[];
  }>;
}): Promise<string> {
  // Use a transaction to ensure atomicity
  const result = await prisma!.$transaction(async (tx: any) => {
    // Create the training document
    const doc = await tx.trainingDocument.create({
      data: {
        category: input.category,
        originalFilename: input.originalFilename,
        originalFolderPath: input.originalFolderPath,
        oneDriveFileId: input.oneDriveFileId,
        textContent: input.textContent,
        language: input.language,
        wordCount: input.wordCount,
        metadata: input.metadata as Prisma.InputJsonValue,
        processingDurationMs: input.processingDurationMs,
      },
    });

    // Insert embeddings using raw SQL (pgvector requires this)
    for (const emb of input.embeddings) {
      const vectorString = `[${emb.embedding.join(',')}]`;

      await tx.$executeRaw`
        INSERT INTO document_embeddings (id, document_id, chunk_index, chunk_text, embedding, token_count, created_at)
        VALUES (
          gen_random_uuid(),
          ${doc.id}::uuid,
          ${emb.chunkIndex},
          ${emb.chunkText},
          ${vectorString}::vector(768),
          ${emb.chunkText.split(/\s+/).length},
          NOW()
        )
      `;
    }

    return doc.id;
  });

  return result;
}

/**
 * Create a pipeline run record
 */
export async function createPipelineRun(runType: 'scheduled' | 'manual'): Promise<string> {
  const run = await prisma!.trainingPipelineRun.create({
    data: {
      runType,
      status: 'running',
    },
  });

  return run.id;
}

/**
 * Update pipeline run with results
 */
export async function updatePipelineRun(
  id: string,
  data: {
    status: 'completed' | 'failed';
    documentsDiscovered?: number;
    documentsProcessed?: number;
    documentsFailed?: number;
    errorLog?: Record<string, unknown>;
  }
): Promise<void> {
  await prisma!.trainingPipelineRun.update({
    where: { id },
    data: {
      status: data.status,
      completedAt: new Date(),
      documentsDiscovered: data.documentsDiscovered,
      documentsProcessed: data.documentsProcessed,
      documentsFailed: data.documentsFailed,
      errorLog: data.errorLog as Prisma.InputJsonValue,
    },
  });
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

export { prisma };
