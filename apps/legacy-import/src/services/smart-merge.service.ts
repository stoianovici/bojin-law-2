/**
 * Smart Cluster Merge Service
 * Uses AI to analyze cluster names and suggest intelligent merges.
 *
 * Reduces cluster fragmentation by identifying semantically similar clusters
 * that can be consolidated without losing relevance.
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';

// ============================================================================
// Types
// ============================================================================

export interface ClusterInfo {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  documentCount: number;
  status: string;
}

export interface MergeGroup {
  targetName: string;
  targetNameEn: string;
  description: string;
  clusters: ClusterInfo[];
  totalDocuments: number;
  reasoning: string;
}

export interface MergeAnalysis {
  sessionId: string;
  originalClusterCount: number;
  suggestedClusterCount: number;
  mergeGroups: MergeGroup[];
  keepSeparate: ClusterInfo[];
  estimatedReduction: number;
}

export interface MergeResult {
  success: boolean;
  mergedCount: number;
  newClusterCount: number;
  errors: string[];
}

// ============================================================================
// Constants
// ============================================================================

const HAIKU_MODEL = 'claude-3-5-haiku-20241022';

const MERGE_ANALYSIS_PROMPT = `You are a legal document categorization expert for a Romanian law firm.
Your task is to analyze a list of document cluster names and suggest which clusters should be merged.

GOAL: Reduce the number of clusters by merging semantically similar ones, while keeping distinct categories separate.

RULES for merging:
1. Merge clusters that represent the SAME type of document with minor variations (e.g., "Facturi de Asistență Juridică" and "Facturi pentru Servicii Juridice" → both are legal service invoices)
2. Merge clusters that differ only by client name or specific context (e.g., "Facturi Asistență Juridică pentru Municipiul Reșița" should merge with general invoice clusters)
3. Merge duplicate names (some clusters have the exact same name)
4. Keep separate clusters that represent genuinely DIFFERENT document types (e.g., "Contracte de Vânzare" vs "Contracte de Închiriere")
5. Combine all "Neclasificate" (Uncategorized) clusters into one
6. Academic/theoretical documents can often be merged into broader categories

TARGET: Aim for 30-50 final clusters for a collection of ~180 clusters.

For each merge group, provide:
- targetName: The best Romanian name for the merged cluster (max 60 chars)
- targetNameEn: English translation
- description: Brief Romanian description of what documents belong here
- reasoning: Why these clusters should be merged (1 sentence)
- clusterIds: Array of cluster IDs to merge

CRITICAL: Return ONLY valid JSON. No JavaScript comments (// or /* */) are allowed in JSON.

Respond in this exact JSON format:
{
  "mergeGroups": [
    {
      "targetName": "Name in Romanian",
      "targetNameEn": "Name in English",
      "description": "Description in Romanian",
      "reasoning": "Why merge these clusters",
      "clusterIds": ["id1", "id2", "id3"]
    }
  ],
  "keepSeparate": ["id4", "id5"]
}`;

// ============================================================================
// Service
// ============================================================================

export class SmartMergeService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Analyze clusters and suggest merges.
   */
  async analyzeClusters(sessionId: string): Promise<MergeAnalysis> {
    // Load all non-deleted clusters
    const clusters = await prisma.documentCluster.findMany({
      where: {
        sessionId,
        // Don't filter by isDeleted - field may not exist in all schemas
      },
      select: {
        id: true,
        suggestedName: true,
        suggestedNameEn: true,
        approvedName: true,
        description: true,
        documentCount: true,
        status: true,
      },
      orderBy: { documentCount: 'desc' },
    });

    if (clusters.length === 0) {
      return {
        sessionId,
        originalClusterCount: 0,
        suggestedClusterCount: 0,
        mergeGroups: [],
        keepSeparate: [],
        estimatedReduction: 0,
      };
    }

    console.log(`[SmartMerge] Analyzing ${clusters.length} clusters`);

    // Build cluster info list
    const clusterInfos: ClusterInfo[] = clusters.map((c) => ({
      id: c.id,
      name: c.approvedName || c.suggestedName,
      nameEn: c.suggestedNameEn,
      description: c.description,
      documentCount: c.documentCount,
      status: c.status,
    }));

    // Build prompt with cluster data
    const clusterList = clusterInfos
      .map(
        (c) =>
          `- ID: ${c.id}\n  Name: ${c.name}\n  Docs: ${c.documentCount}\n  Desc: ${c.description || 'N/A'}`
      )
      .join('\n\n');

    const prompt = `Here are ${clusters.length} document clusters to analyze:\n\n${clusterList}\n\nAnalyze these clusters and suggest optimal merges to reduce fragmentation while maintaining relevance.`;

    // Call Haiku for analysis
    const response = await this.anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 8000,
      system: MERGE_ANALYSIS_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    // Parse response
    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let analysis: { mergeGroups: any[]; keepSeparate: string[] };

    try {
      // Extract JSON from response
      let jsonText = textContent;
      const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      } else {
        const objectMatch = textContent.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonText = objectMatch[0];
        }
      }

      // Remove JavaScript-style comments that AI might include
      jsonText = jsonText
        .replace(/\/\/[^\n]*/g, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

      analysis = JSON.parse(jsonText);
    } catch (error) {
      console.error('[SmartMerge] Failed to parse AI response:', error);
      console.error('[SmartMerge] Raw response:', textContent.slice(0, 500));
      throw new Error('Failed to parse merge analysis from AI');
    }

    // Build result with full cluster info
    const clusterMap = new Map(clusterInfos.map((c) => [c.id, c]));

    const mergeGroups: MergeGroup[] = analysis.mergeGroups
      .filter((g: any) => g.clusterIds && g.clusterIds.length > 1)
      .map((g: any) => {
        const groupClusters = g.clusterIds
          .map((id: string) => clusterMap.get(id))
          .filter((c: ClusterInfo | undefined): c is ClusterInfo => c !== undefined);

        return {
          targetName: g.targetName,
          targetNameEn: g.targetNameEn,
          description: g.description,
          clusters: groupClusters,
          totalDocuments: groupClusters.reduce(
            (sum: number, c: ClusterInfo) => sum + c.documentCount,
            0
          ),
          reasoning: g.reasoning,
        };
      });

    // Find clusters that should stay separate
    const mergedIds = new Set(mergeGroups.flatMap((g) => g.clusters.map((c) => c.id)));
    const keepSeparate = clusterInfos.filter((c) => !mergedIds.has(c.id));

    const suggestedCount = mergeGroups.length + keepSeparate.length;

    console.log(`[SmartMerge] Analysis complete: ${clusters.length} → ${suggestedCount} clusters`);

    return {
      sessionId,
      originalClusterCount: clusters.length,
      suggestedClusterCount: suggestedCount,
      mergeGroups,
      keepSeparate,
      estimatedReduction: clusters.length - suggestedCount,
    };
  }

  /**
   * Execute approved merges.
   */
  async executeMerges(sessionId: string, mergeGroups: MergeGroup[]): Promise<MergeResult> {
    const errors: string[] = [];
    let mergedCount = 0;

    for (const group of mergeGroups) {
      if (group.clusters.length < 2) {
        continue; // Nothing to merge
      }

      try {
        await this.mergeClusterGroup(group);
        mergedCount++;
        console.log(
          `[SmartMerge] Merged ${group.clusters.length} clusters into "${group.targetName}"`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to merge "${group.targetName}": ${message}`);
        console.error(`[SmartMerge] Error merging group:`, error);
      }
    }

    // Get final count
    const finalCount = await prisma.documentCluster.count({
      where: { sessionId },
    });

    return {
      success: errors.length === 0,
      mergedCount,
      newClusterCount: finalCount,
      errors,
    };
  }

  /**
   * Merge a group of clusters into one.
   */
  private async mergeClusterGroup(group: MergeGroup): Promise<void> {
    const clusterIds = group.clusters.map((c) => c.id);
    const targetClusterId = clusterIds[0]; // Use first cluster as target
    const sourceClusterIds = clusterIds.slice(1);

    await prisma.$transaction(async (tx) => {
      // Collect all sample document IDs (max 5)
      const allSamples: string[] = [];
      for (const cluster of group.clusters) {
        const clusterData = await tx.documentCluster.findUnique({
          where: { id: cluster.id },
          select: { sampleDocumentIds: true },
        });
        if (clusterData?.sampleDocumentIds) {
          allSamples.push(...clusterData.sampleDocumentIds);
        }
        if (allSamples.length >= 5) break;
      }

      // Move all documents from source clusters to target
      await tx.extractedDocument.updateMany({
        where: { clusterId: { in: sourceClusterIds } },
        data: { clusterId: targetClusterId },
      });

      // Update target cluster with new name and count
      await tx.documentCluster.update({
        where: { id: targetClusterId },
        data: {
          suggestedName: group.targetName,
          suggestedNameEn: group.targetNameEn,
          description: group.description,
          documentCount: group.totalDocuments,
          sampleDocumentIds: allSamples.slice(0, 5),
          status: 'Pending', // Reset for re-validation
          approvedName: null, // Clear any previous approval
        },
      });

      // Delete source clusters
      await tx.documentCluster.deleteMany({
        where: { id: { in: sourceClusterIds } },
      });
    });
  }

  /**
   * Preview what merges would look like without executing.
   */
  async previewMerges(analysis: MergeAnalysis): Promise<string> {
    const lines: string[] = [
      `# Cluster Merge Preview`,
      ``,
      `**Current clusters:** ${analysis.originalClusterCount}`,
      `**After merge:** ${analysis.suggestedClusterCount}`,
      `**Reduction:** ${analysis.estimatedReduction} clusters (${Math.round((analysis.estimatedReduction / analysis.originalClusterCount) * 100)}%)`,
      ``,
      `## Merge Groups`,
      ``,
    ];

    for (let i = 0; i < analysis.mergeGroups.length; i++) {
      const group = analysis.mergeGroups[i];
      lines.push(`### ${i + 1}. ${group.targetName} (${group.totalDocuments} docs)`);
      lines.push(`*${group.reasoning}*`);
      lines.push(``);
      lines.push(`Merging:`);
      for (const cluster of group.clusters) {
        lines.push(`- ${cluster.name} (${cluster.documentCount} docs)`);
      }
      lines.push(``);
    }

    lines.push(`## Clusters Kept Separate (${analysis.keepSeparate.length})`);
    lines.push(``);
    for (const cluster of analysis.keepSeparate) {
      lines.push(`- ${cluster.name} (${cluster.documentCount} docs)`);
    }

    return lines.join('\n');
  }

  // ============================================================================
  // Pattern-Based Merge Detection
  // ============================================================================

  /**
   * Common patterns that indicate clusters should be merged.
   * These patterns detect similar document types regardless of specific context.
   */
  private static readonly MERGE_PATTERNS: { category: string; pattern: RegExp }[] = [
    { category: 'Facturi', pattern: /^factur/i },
    { category: 'Contracte de Asistență Juridică', pattern: /^contract.*asistență juridică/i },
    { category: 'Opinii Juridice', pattern: /^opini[ei].*juridic/i },
    { category: 'Declarații de Renunțare', pattern: /^declarați.*renunțare/i },
    { category: 'Neclasificate', pattern: /^neclasificate$/i },
    { category: 'Împuterniciri', pattern: /^împuternicir/i },
    {
      category: 'Documente Academice',
      pattern: /documente academice|reflecție juridică|teorie.*juridic/i,
    },
    { category: 'Confirmări', pattern: /^confirmar/i },
    { category: 'Cereri de Executare', pattern: /^cereri.*executare/i },
    { category: 'Studii Juridice', pattern: /^studii/i },
  ];

  /**
   * Find clusters that match known patterns and can be merged.
   * This is faster than AI analysis for obvious cases.
   */
  findPatternBasedMerges(clusters: ClusterInfo[]): Map<string, ClusterInfo[]> {
    const groups = new Map<string, ClusterInfo[]>();
    const assigned = new Set<string>();

    for (const { category, pattern } of SmartMergeService.MERGE_PATTERNS) {
      for (const cluster of clusters) {
        if (assigned.has(cluster.id)) continue;
        if (pattern.test(cluster.name)) {
          const list = groups.get(category) || [];
          list.push(cluster);
          groups.set(category, list);
          assigned.add(cluster.id);
        }
      }
    }

    // Only return groups with 2+ clusters (actual merge candidates)
    const mergeableGroups = new Map<string, ClusterInfo[]>();
    for (const entry of Array.from(groups.entries())) {
      const [category, clusterList] = entry;
      if (clusterList.length >= 2) {
        mergeableGroups.set(category, clusterList);
      }
    }

    return mergeableGroups;
  }

  /**
   * Get AI-suggested name for a merge group.
   */
  async getMergeName(
    category: string,
    clusters: ClusterInfo[]
  ): Promise<{ name: string; nameEn: string; description: string }> {
    const clusterList = clusters.map((c) => `- ${c.name} (${c.documentCount} docs)`).join('\n');

    const prompt = `These ${clusters.length} clusters will be merged into one "${category}" cluster:

${clusterList}

Suggest the best merged name in Romanian (max 50 chars), English translation, and brief description.

JSON response only (no comments):
{"nameRo": "...", "nameEn": "...", "description": "..."}`;

    const response = await this.anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return {
          name: parsed.nameRo || category,
          nameEn: parsed.nameEn || category,
          description: parsed.description || '',
        };
      } catch {
        // Fallback to category name
      }
    }

    return { name: category, nameEn: category, description: '' };
  }

  /**
   * Quick merge using pattern detection.
   * Faster alternative to full AI analysis for obvious merge cases.
   */
  async quickMerge(sessionId: string): Promise<MergeResult> {
    const clusters = await prisma.documentCluster.findMany({
      where: { sessionId },
      select: {
        id: true,
        suggestedName: true,
        suggestedNameEn: true,
        approvedName: true,
        description: true,
        documentCount: true,
        status: true,
      },
      orderBy: { documentCount: 'desc' },
    });

    const clusterInfos: ClusterInfo[] = clusters.map((c) => ({
      id: c.id,
      name: c.approvedName || c.suggestedName,
      nameEn: c.suggestedNameEn,
      description: c.description,
      documentCount: c.documentCount,
      status: c.status,
    }));

    // Find pattern-based merge groups
    const patternGroups = this.findPatternBasedMerges(clusterInfos);

    if (patternGroups.size === 0) {
      return {
        success: true,
        mergedCount: 0,
        newClusterCount: clusters.length,
        errors: [],
      };
    }

    console.log(`[SmartMerge] Found ${patternGroups.size} pattern-based merge groups`);

    const mergeGroups: MergeGroup[] = [];

    // Get AI names for each group
    for (const entry of Array.from(patternGroups.entries())) {
      const [category, groupClusters] = entry;
      const aiName = await this.getMergeName(category, groupClusters);
      const totalDocs = groupClusters.reduce((sum, c) => sum + c.documentCount, 0);

      mergeGroups.push({
        targetName: aiName.name,
        targetNameEn: aiName.nameEn,
        description: aiName.description,
        clusters: groupClusters,
        totalDocuments: totalDocs,
        reasoning: `Pattern match: ${category}`,
      });
    }

    // Execute merges
    return this.executeMerges(sessionId, mergeGroups);
  }
}

export const smartMergeService = new SmartMergeService();
