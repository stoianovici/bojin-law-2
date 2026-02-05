/**
 * Dimension Reduction Service
 * Reduces embedding dimensions using UMAP for efficient clustering.
 *
 * Uses umap-js to reduce 1536-dimensional Voyage embeddings to 50 dimensions.
 * This makes clustering significantly faster and often more effective.
 */

import { UMAP } from 'umap-js';
import { prisma } from '@/lib/prisma';

// ============================================================================
// Types
// ============================================================================

export interface ReducedEmbeddings {
  /** Map of document ID to reduced embedding */
  embeddings: Map<string, number[]>;
  /** Original dimension count */
  originalDimensions: number;
  /** Reduced dimension count */
  reducedDimensions: number;
}

// ============================================================================
// Constants
// ============================================================================

const REDUCED_DIMENSIONS = 50;
const UMAP_N_NEIGHBORS = 15;
const UMAP_MIN_DIST = 0.1;

// ============================================================================
// Service
// ============================================================================

export class DimensionReductionService {
  /**
   * Load embeddings and reduce dimensions for a session.
   * Returns reduced embeddings in memory (not persisted).
   */
  async reduceEmbeddings(sessionId: string): Promise<ReducedEmbeddings> {
    // Load embeddings from database
    const embeddings = await this.loadEmbeddings(sessionId);

    if (embeddings.size === 0) {
      return {
        embeddings: new Map(),
        originalDimensions: 0,
        reducedDimensions: REDUCED_DIMENSIONS,
      };
    }

    console.log(`[DimReduction] Loaded ${embeddings.size} embeddings`);

    // Convert to arrays for UMAP
    const docIds = Array.from(embeddings.keys());
    const embeddingArray = docIds.map((id) => embeddings.get(id)!);

    // Get original dimensions
    const originalDimensions = embeddingArray[0].length;
    console.log(`[DimReduction] Original dimensions: ${originalDimensions}`);

    // Run UMAP
    console.log(
      `[DimReduction] Running UMAP (${originalDimensions} -> ${REDUCED_DIMENSIONS} dimensions)`
    );
    const startTime = Date.now();

    const reduced = this.runUMAP(embeddingArray);

    const elapsed = Date.now() - startTime;
    console.log(`[DimReduction] UMAP completed in ${elapsed}ms`);

    // Build result map
    const reducedMap = new Map<string, number[]>();
    for (let i = 0; i < docIds.length; i++) {
      reducedMap.set(docIds[i], reduced[i]);
    }

    return {
      embeddings: reducedMap,
      originalDimensions,
      reducedDimensions: REDUCED_DIMENSIONS,
    };
  }

  /**
   * Load embeddings from database.
   */
  private async loadEmbeddings(sessionId: string): Promise<Map<string, number[]>> {
    // Query embeddings using raw SQL (Prisma doesn't support vector type)
    const results = await prisma.$queryRaw<Array<{ id: string; embedding: string }>>`
      SELECT id, content_embedding::text as embedding
      FROM extracted_documents
      WHERE session_id = ${sessionId}
        AND triage_status = 'FirmDrafted'
        AND is_canonical = true
        AND content_embedding IS NOT NULL
    `;

    const embeddings = new Map<string, number[]>();

    for (const row of results) {
      // Parse PostgreSQL vector format: [0.1,0.2,0.3,...]
      const embedding = this.parseVectorString(row.embedding);
      if (embedding) {
        embeddings.set(row.id, embedding);
      }
    }

    return embeddings;
  }

  /**
   * Parse PostgreSQL vector string to number array.
   */
  private parseVectorString(vectorStr: string): number[] | null {
    try {
      // Remove brackets and split by comma
      const cleaned = vectorStr.replace(/[[\]]/g, '');
      const values = cleaned.split(',').map((v) => parseFloat(v.trim()));

      // Validate
      if (values.some(isNaN)) {
        return null;
      }

      return values;
    } catch {
      return null;
    }
  }

  /**
   * Run UMAP dimensionality reduction.
   */
  private runUMAP(embeddings: number[][]): number[][] {
    const umap = new UMAP({
      nComponents: REDUCED_DIMENSIONS,
      nNeighbors: Math.min(UMAP_N_NEIGHBORS, embeddings.length - 1),
      minDist: UMAP_MIN_DIST,
      spread: 1.0,
    });

    // Fit and transform
    return umap.fit(embeddings);
  }
}

export const dimensionReductionService = new DimensionReductionService();
