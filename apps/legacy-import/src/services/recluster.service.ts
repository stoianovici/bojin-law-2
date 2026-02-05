/**
 * Recluster Service
 * Handles re-clustering of reclassified documents into existing or new clusters.
 *
 * Uses Claude to match document annotations to existing cluster names,
 * then either merges into existing clusters or creates new ones.
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

interface ReclassifiedDoc {
  id: string;
  annotation: string;
  fileName: string;
}

interface ExistingCluster {
  id: string;
  name: string;
}

interface MatchResult {
  matches: Array<{ docId: string; clusterId: string }>;
  unmatched: string[];
}

export interface ReclusterStats {
  totalReclassified: number;
  matchedToExisting: number;
  newClustersCreated: number;
  unmatchedDocs: number;
}

// ============================================================================
// Constants
// ============================================================================

const HAIKU_MODEL = 'claude-3-5-haiku-20241022';

const MATCHING_SYSTEM_PROMPT = `You are a legal document categorization expert for a Romanian law firm.
Your task is to match document annotations (descriptions of what the document actually is) to existing cluster names.

Given:
1. A list of documents with their user-provided annotations describing the document type
2. A list of existing clusters with their names

For each document, determine if it belongs to an existing cluster based on semantic similarity.
If the annotation describes a document type that matches an existing cluster's name, return the cluster ID.
If no cluster is a good match, mark the document as unmatched.

Be generous with matching - if an annotation clearly describes documents that would fit in a cluster, match them.
Examples:
- "factura" matches "Facturi" cluster
- "contract de vanzare" matches "Contracte de Vânzare-Cumpărare" cluster
- "notificare catre client" matches "Notificări" cluster

Respond in JSON format:
{
  "matches": [
    { "docId": "doc-uuid", "clusterId": "cluster-uuid" }
  ],
  "unmatched": ["doc-uuid-1", "doc-uuid-2"]
}`;

const GROUPING_SYSTEM_PROMPT = `You are a legal document categorization expert for a Romanian law firm.
Your task is to group similar documents based on their annotations (user descriptions of the document type).

Given a list of documents with their annotations, group them into logical categories.
Create groups that would make sense as document clusters - documents that are the same type should be grouped together.

For each group, provide:
1. A name in Romanian (formal legal terminology)
2. An English translation of the name
3. The list of document IDs that belong to this group

Guidelines:
- Group documents with semantically similar annotations together
- If an annotation is unclear or generic, create a "Diverse" or "De revizuit" group
- Aim for groups of at least 2-3 documents when possible
- Don't create too many tiny groups - combine similar types

Respond in JSON format:
{
  "groups": [
    { "nameRo": "Contracte", "nameEn": "Contracts", "docIds": ["doc-1", "doc-2"] },
    { "nameRo": "Facturi", "nameEn": "Invoices", "docIds": ["doc-3"] }
  ]
}`;

// ============================================================================
// Service
// ============================================================================

export class ReclusterService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Re-cluster reclassified documents in a session.
   * 1. Get all docs with validationStatus = 'Reclassified'
   * 2. Get existing approved clusters
   * 3. Use AI to match annotations to cluster names
   * 4. Matched docs: add to existing cluster, reset validationStatus to 'Pending'
   * 5. Unmatched docs: create new clusters via full clustering pipeline
   */
  async recluster(sessionId: string): Promise<ReclusterStats> {
    console.log(`[Recluster] Starting re-clustering for session ${sessionId}`);

    const stats: ReclusterStats = {
      totalReclassified: 0,
      matchedToExisting: 0,
      newClustersCreated: 0,
      unmatchedDocs: 0,
    };

    try {
      // 1. Get reclassified documents
      const reclassifiedDocs = await this.getReclassifiedDocs(sessionId);
      stats.totalReclassified = reclassifiedDocs.length;

      if (reclassifiedDocs.length === 0) {
        console.log('[Recluster] No reclassified documents to process');
        await this.updateSessionStatus(sessionId, 'ReadyForValidation');
        return stats;
      }

      console.log(`[Recluster] Found ${reclassifiedDocs.length} reclassified documents`);

      // Update progress: starting
      await this.updateProgress(
        sessionId,
        0,
        reclassifiedDocs.length,
        'Matching documents to clusters'
      );

      // 2. Get existing non-deleted, approved clusters
      const existingClusters = await this.getExistingClusters(sessionId);
      console.log(`[Recluster] Found ${existingClusters.length} existing clusters`);

      // 3. Match annotations to clusters using AI
      let matchResult: MatchResult = { matches: [], unmatched: reclassifiedDocs.map((d) => d.id) };

      if (existingClusters.length > 0) {
        matchResult = await this.matchDocsToClusters(reclassifiedDocs, existingClusters);
        console.log(
          `[Recluster] AI matched ${matchResult.matches.length} docs, ${matchResult.unmatched.length} unmatched`
        );
      }

      // Update progress: matching complete
      await this.updateProgress(
        sessionId,
        matchResult.matches.length,
        reclassifiedDocs.length,
        `Matched ${matchResult.matches.length} documents to existing clusters`
      );

      // 4. Process matched documents - add to existing clusters
      if (matchResult.matches.length > 0) {
        await this.addDocsToExistingClusters(matchResult.matches);
        stats.matchedToExisting = matchResult.matches.length;
      }

      // Update progress: processing unmatched
      if (matchResult.unmatched.length > 0) {
        await this.updateProgress(
          sessionId,
          matchResult.matches.length,
          reclassifiedDocs.length,
          `Creating new clusters for ${matchResult.unmatched.length} unmatched documents`
        );
      }

      // 5. Process unmatched documents - create new clusters
      if (matchResult.unmatched.length > 0) {
        stats.unmatchedDocs = matchResult.unmatched.length;
        const newClusters = await this.createNewClustersForUnmatched(
          sessionId,
          matchResult.unmatched
        );
        stats.newClustersCreated = newClusters;
      }

      // Update progress: complete
      await this.updateProgress(
        sessionId,
        reclassifiedDocs.length,
        reclassifiedDocs.length,
        'Re-clustering complete'
      );

      // 6. Update session status back to ready for validation
      await this.updateSessionStatus(sessionId, 'ReadyForValidation');

      console.log(
        `[Recluster] Complete: ${stats.matchedToExisting} matched, ${stats.newClustersCreated} new clusters`
      );
      return stats;
    } catch (error) {
      console.error('[Recluster] Error during re-clustering:', error);
      await this.updateSessionStatus(sessionId, 'Failed', String(error));
      throw error;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async getReclassifiedDocs(sessionId: string): Promise<ReclassifiedDoc[]> {
    const docs = await prisma.extractedDocument.findMany({
      where: {
        sessionId,
        validationStatus: 'Reclassified',
      },
      select: {
        id: true,
        fileName: true,
        reclassificationNote: true,
      },
    });

    return docs.map((d) => ({
      id: d.id,
      annotation: d.reclassificationNote || '',
      fileName: d.fileName,
    }));
  }

  private async getExistingClusters(sessionId: string): Promise<ExistingCluster[]> {
    const clusters = await prisma.documentCluster.findMany({
      where: {
        sessionId,
        isDeleted: false,
        // Include approved clusters and clusters with at least some accepted docs
      },
      select: {
        id: true,
        suggestedName: true,
        approvedName: true,
      },
    });

    return clusters.map((c) => ({
      id: c.id,
      name: c.approvedName || c.suggestedName,
    }));
  }

  private async matchDocsToClusters(
    docs: ReclassifiedDoc[],
    clusters: ExistingCluster[]
  ): Promise<MatchResult> {
    const prompt = this.buildMatchingPrompt(docs, clusters);

    try {
      const response = await this.anthropic.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 2048,
        system: MATCHING_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      // Extract text content from response
      const textContent = response.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in response');
      }

      // Parse JSON from response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]) as MatchResult;

      // Validate the result
      const validMatches = result.matches.filter(
        (m) => docs.some((d) => d.id === m.docId) && clusters.some((c) => c.id === m.clusterId)
      );

      const allDocIds = new Set(docs.map((d) => d.id));
      const matchedDocIds = new Set(validMatches.map((m) => m.docId));
      const unmatched = Array.from(allDocIds).filter((id) => !matchedDocIds.has(id));

      return {
        matches: validMatches,
        unmatched,
      };
    } catch (error) {
      console.error('[Recluster] AI matching failed, marking all as unmatched:', error);
      // If AI fails, treat all as unmatched
      return {
        matches: [],
        unmatched: docs.map((d) => d.id),
      };
    }
  }

  private buildMatchingPrompt(docs: ReclassifiedDoc[], clusters: ExistingCluster[]): string {
    const docsSection = docs
      .map((d) => `- Doc ID: ${d.id}\n  File: ${d.fileName}\n  Annotation: "${d.annotation}"`)
      .join('\n\n');

    const clustersSection = clusters
      .map((c) => `- Cluster ID: ${c.id}\n  Name: "${c.name}"`)
      .join('\n\n');

    return `## Documents to Match

${docsSection}

## Existing Clusters

${clustersSection}

Match each document to the most appropriate cluster based on its annotation. If no cluster is a good semantic match, include the document ID in the "unmatched" array.`;
  }

  private async addDocsToExistingClusters(
    matches: Array<{ docId: string; clusterId: string }>
  ): Promise<void> {
    // Group matches by cluster
    const byCluster = new Map<string, string[]>();
    for (const m of matches) {
      const list = byCluster.get(m.clusterId) || [];
      list.push(m.docId);
      byCluster.set(m.clusterId, list);
    }

    // Update each cluster's documents
    for (const [clusterId, docIds] of byCluster) {
      // Update documents: assign to cluster, reset validation status, increment round
      await prisma.extractedDocument.updateMany({
        where: { id: { in: docIds } },
        data: {
          clusterId,
          validationStatus: 'Pending',
          validatedBy: null,
          validatedAt: null,
          reclassificationRound: { increment: 1 },
        },
      });

      // Update cluster document count
      const newCount = await prisma.extractedDocument.count({
        where: { clusterId },
      });

      await prisma.documentCluster.update({
        where: { id: clusterId },
        data: { documentCount: newCount },
      });

      console.log(`[Recluster] Added ${docIds.length} docs to cluster ${clusterId}`);
    }
  }

  /**
   * Create new clusters for unmatched documents.
   * Groups documents by their annotation similarity using AI, then creates clusters.
   */
  private async createNewClustersForUnmatched(
    sessionId: string,
    docIds: string[]
  ): Promise<number> {
    console.log(`[Recluster] Creating new clusters for ${docIds.length} unmatched docs`);

    // Get doc annotations for grouping
    const docs = await prisma.extractedDocument.findMany({
      where: { id: { in: docIds } },
      select: {
        id: true,
        fileName: true,
        reclassificationNote: true,
      },
    });

    // If only a few documents, create a single "Needs Review" cluster
    if (docs.length <= 3) {
      return this.createSingleClusterForDocs(sessionId, docIds);
    }

    // Use AI to group documents by annotation similarity
    const groups = await this.groupDocsByAnnotation(docs);

    // Create a cluster for each group
    let clustersCreated = 0;
    for (const group of groups) {
      const clusterId = uuidv4();
      await prisma.documentCluster.create({
        data: {
          id: clusterId,
          sessionId,
          suggestedName: group.suggestedName,
          suggestedNameEn: group.suggestedNameEn,
          description: `Documente reclasificate: ${group.suggestedName}`,
          documentCount: group.docIds.length,
          sampleDocumentIds: group.docIds.slice(0, 5),
          status: 'Pending',
        },
      });

      await prisma.extractedDocument.updateMany({
        where: { id: { in: group.docIds } },
        data: {
          clusterId,
          validationStatus: 'Pending',
          validatedBy: null,
          validatedAt: null,
          reclassificationRound: { increment: 1 },
        },
      });

      clustersCreated++;
    }

    console.log(`[Recluster] Created ${clustersCreated} new clusters from unmatched docs`);
    return clustersCreated;
  }

  /**
   * Group documents by annotation similarity using AI.
   */
  private async groupDocsByAnnotation(
    docs: Array<{ id: string; fileName: string; reclassificationNote: string | null }>
  ): Promise<Array<{ suggestedName: string; suggestedNameEn: string; docIds: string[] }>> {
    const prompt = this.buildGroupingPrompt(docs);

    try {
      const response = await this.anthropic.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 2048,
        system: GROUPING_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const textContent = response.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in response');
      }

      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]) as {
        groups: Array<{ nameRo: string; nameEn: string; docIds: string[] }>;
      };

      // Validate and return groups
      const validDocIds = new Set(docs.map((d) => d.id));
      return result.groups
        .filter((g) => g.docIds.length > 0)
        .map((g) => ({
          suggestedName: g.nameRo || 'De revizuit',
          suggestedNameEn: g.nameEn || 'Needs Review',
          docIds: g.docIds.filter((id) => validDocIds.has(id)),
        }))
        .filter((g) => g.docIds.length > 0);
    } catch (error) {
      console.error('[Recluster] AI grouping failed, creating single cluster:', error);
      // Fallback: single cluster
      return [
        {
          suggestedName: 'De revizuit',
          suggestedNameEn: 'Needs Review',
          docIds: docs.map((d) => d.id),
        },
      ];
    }
  }

  private buildGroupingPrompt(
    docs: Array<{ id: string; fileName: string; reclassificationNote: string | null }>
  ): string {
    const docsSection = docs
      .map(
        (d) =>
          `- Doc ID: ${d.id}\n  File: ${d.fileName}\n  Annotation: "${d.reclassificationNote || 'No annotation'}"`
      )
      .join('\n\n');

    return `## Documents to Group

${docsSection}

Group these documents by their annotations into logical categories. Each group should contain documents that describe similar document types.`;
  }

  private async createSingleClusterForDocs(sessionId: string, docIds: string[]): Promise<number> {
    const clusterId = uuidv4();
    await prisma.documentCluster.create({
      data: {
        id: clusterId,
        sessionId,
        suggestedName: 'De revizuit',
        suggestedNameEn: 'Needs Review',
        description: 'Documente reclasificate care necesită revizuire manuală',
        documentCount: docIds.length,
        sampleDocumentIds: docIds.slice(0, 5),
        status: 'Pending',
      },
    });

    await prisma.extractedDocument.updateMany({
      where: { id: { in: docIds } },
      data: {
        clusterId,
        validationStatus: 'Pending',
        validatedBy: null,
        validatedAt: null,
        reclassificationRound: { increment: 1 },
      },
    });

    return 1;
  }

  private async updateSessionStatus(
    sessionId: string,
    status: 'ReadyForValidation' | 'Failed' | 'ReClustering',
    error?: string
  ): Promise<void> {
    await prisma.legacyImportSession.update({
      where: { id: sessionId },
      data: {
        pipelineStatus: status,
        pipelineError: error || null,
        pipelineCompletedAt: status === 'ReadyForValidation' ? new Date() : undefined,
      },
    });
  }

  /**
   * Update progress tracking for the re-clustering operation.
   */
  private async updateProgress(
    sessionId: string,
    current: number,
    total: number,
    message: string
  ): Promise<void> {
    await prisma.legacyImportSession.update({
      where: { id: sessionId },
      data: {
        pipelineProgress: {
          stage: 'ReClustering',
          current,
          total,
          message,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }
}

export const reclusterService = new ReclusterService();
