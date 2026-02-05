/**
 * Clustering Service
 * Groups similar documents using OPTICS clustering algorithm.
 *
 * Uses density-clustering package with OPTICS for variable density clusters.
 * Noise points are grouped into an "Uncategorized" cluster.
 */

import { OPTICS } from 'density-clustering';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface ClusterStats {
  clusterCount: number;
  noiseCount: number;
  averageClusterSize: number;
  largestCluster: number;
}

interface ClusterResult {
  clusterId: string;
  documentIds: string[];
  centroidIndex: number;
}

// ============================================================================
// Constants
// ============================================================================

const OPTICS_EPSILON = 0.5; // Maximum distance for neighbors
const OPTICS_MIN_POINTS = 3; // Minimum points to form a cluster
const SAMPLES_PER_CLUSTER = 5; // Number of sample documents per cluster

// ============================================================================
// Service
// ============================================================================

export class ClusteringService {
  /**
   * Cluster documents in a session using OPTICS.
   */
  async clusterSession(
    sessionId: string,
    reducedEmbeddings: Map<string, number[]>
  ): Promise<ClusterStats> {
    if (reducedEmbeddings.size === 0) {
      return {
        clusterCount: 0,
        noiseCount: 0,
        averageClusterSize: 0,
        largestCluster: 0,
      };
    }

    console.log(`[Clustering] Processing ${reducedEmbeddings.size} documents`);

    // Convert to arrays
    const docIds = Array.from(reducedEmbeddings.keys());
    const embeddings = docIds.map((id) => reducedEmbeddings.get(id)!);

    // Run OPTICS clustering
    const clusters = this.runOPTICS(embeddings);

    console.log(`[Clustering] OPTICS found ${clusters.length} clusters`);

    // Process clusters and find noise points
    const clusterResults: ClusterResult[] = [];
    const clusteredIndices = new Set<number>();

    for (const clusterIndices of clusters) {
      if (clusterIndices.length >= OPTICS_MIN_POINTS) {
        const clusterDocIds = clusterIndices.map((i) => docIds[i]);
        const centroidIndex = this.findCentroid(clusterIndices, embeddings);

        clusterResults.push({
          clusterId: uuidv4(),
          documentIds: clusterDocIds,
          centroidIndex,
        });

        clusterIndices.forEach((i) => clusteredIndices.add(i));
      }
    }

    // Find noise points (not in any cluster)
    const noiseDocIds: string[] = [];
    for (let i = 0; i < docIds.length; i++) {
      if (!clusteredIndices.has(i)) {
        noiseDocIds.push(docIds[i]);
      }
    }

    // Create a noise cluster if there are noise points
    if (noiseDocIds.length > 0) {
      clusterResults.push({
        clusterId: uuidv4(),
        documentIds: noiseDocIds,
        centroidIndex: 0, // No meaningful centroid for noise
      });
    }

    // Save clusters to database
    await this.createClusters(clusterResults, sessionId, docIds, embeddings);

    // Calculate stats
    const stats: ClusterStats = {
      clusterCount: clusterResults.length,
      noiseCount: noiseDocIds.length,
      averageClusterSize:
        clusterResults.length > 0 ? Math.round(docIds.length / clusterResults.length) : 0,
      largestCluster: Math.max(...clusterResults.map((c) => c.documentIds.length), 0),
    };

    // Update session with clustering stats
    await prisma.legacyImportSession.update({
      where: { id: sessionId },
      data: {
        clusteringStats: stats as any,
      },
    });

    console.log(
      `[Clustering] Complete: ${stats.clusterCount} clusters, ${stats.noiseCount} noise points`
    );

    return stats;
  }

  /**
   * Run OPTICS clustering algorithm.
   */
  private runOPTICS(embeddings: number[][]): number[][] {
    const optics = new OPTICS();

    // OPTICS returns an array of cluster arrays (indices)
    const clusters = optics.run(embeddings, OPTICS_EPSILON, OPTICS_MIN_POINTS);

    return clusters;
  }

  /**
   * Find the centroid (most central point) of a cluster.
   * Returns the index of the point closest to the mean.
   */
  private findCentroid(clusterIndices: number[], embeddings: number[][]): number {
    if (clusterIndices.length === 0) return 0;
    if (clusterIndices.length === 1) return clusterIndices[0];

    // Calculate mean embedding
    const dims = embeddings[0].length;
    const mean = new Array(dims).fill(0);

    for (const idx of clusterIndices) {
      for (let d = 0; d < dims; d++) {
        mean[d] += embeddings[idx][d];
      }
    }
    for (let d = 0; d < dims; d++) {
      mean[d] /= clusterIndices.length;
    }

    // Find point closest to mean
    let minDist = Infinity;
    let centroidIdx = clusterIndices[0];

    for (const idx of clusterIndices) {
      const dist = this.euclideanDistance(embeddings[idx], mean);
      if (dist < minDist) {
        minDist = dist;
        centroidIdx = idx;
      }
    }

    return centroidIdx;
  }

  /**
   * Calculate Euclidean distance between two vectors.
   */
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(sum);
  }

  /**
   * Select sample document IDs closest to centroid.
   */
  private selectSamples(
    clusterResult: ClusterResult,
    docIds: string[],
    embeddings: number[][]
  ): string[] {
    const { documentIds, centroidIndex } = clusterResult;

    if (documentIds.length <= SAMPLES_PER_CLUSTER) {
      return documentIds;
    }

    // Get embedding of centroid
    const docIdToIndex = new Map(docIds.map((id, i) => [id, i]));
    const centroidEmbedding = embeddings[centroidIndex];

    // Calculate distances from centroid
    const distances = documentIds.map((docId) => {
      const idx = docIdToIndex.get(docId)!;
      return {
        docId,
        distance: this.euclideanDistance(embeddings[idx], centroidEmbedding),
      };
    });

    // Sort by distance and take closest
    distances.sort((a, b) => a.distance - b.distance);
    return distances.slice(0, SAMPLES_PER_CLUSTER).map((d) => d.docId);
  }

  /**
   * Create cluster records in database.
   */
  private async createClusters(
    clusterResults: ClusterResult[],
    sessionId: string,
    docIds: string[],
    embeddings: number[][]
  ): Promise<void> {
    // Create clusters
    for (let i = 0; i < clusterResults.length; i++) {
      const result = clusterResults[i];
      const isNoiseCluster = i === clusterResults.length - 1 && result.documentIds.length > 0;

      // Select sample documents
      const samples = this.selectSamples(result, docIds, embeddings);

      // Create cluster record
      await prisma.documentCluster.create({
        data: {
          id: result.clusterId,
          sessionId,
          suggestedName: isNoiseCluster ? 'Neclasificate' : `Cluster ${i + 1}`,
          suggestedNameEn: isNoiseCluster ? 'Uncategorized' : `Cluster ${i + 1}`,
          description: isNoiseCluster ? 'Documente care nu se potrivesc în niciun grup' : null,
          documentCount: result.documentIds.length,
          sampleDocumentIds: samples,
          status: isNoiseCluster ? 'Rejected' : 'Pending', // Auto-reject noise cluster
        },
      });

      // Update documents with cluster ID
      await prisma.extractedDocument.updateMany({
        where: {
          id: { in: result.documentIds },
        },
        data: {
          clusterId: result.clusterId,
        },
      });

      if (i % 10 === 0) {
        console.log(`[Clustering] Created cluster ${i + 1}/${clusterResults.length}`);
      }
    }
  }
}

export const clusteringService = new ClusteringService();
