/**
 * Track Changes Extraction Service
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Service layer for extracting and processing track changes from Word documents.
 * Parses DOCX Open XML format to extract revisions (w:ins, w:del elements).
 */

import { createGraphClient, graphEndpoints } from '../config/graph.config';
import { retryWithBackoff } from '../utils/retry.util';
import { parseGraphError, logGraphError } from '../utils/graph-error-handler';
import { TrackChange, TrackChangeType, TrackChangesSummary } from '@legal-platform/types';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';
import JSZip from 'jszip';
import { parseStringPromise } from 'xml2js';

/**
 * Track Changes Service Class
 * Handles extraction and processing of Word document track changes
 */
export class TrackChangesService {
  /**
   * Extract track changes from a Word document in OneDrive
   *
   * Flow:
   * 1. Download DOCX from OneDrive
   * 2. Parse Open XML format (unzip, parse document.xml)
   * 3. Extract w:ins (insertions) and w:del (deletions) elements
   * 4. Map to TrackChange objects
   *
   * @param documentId - Document UUID (for logging)
   * @param accessToken - Microsoft Graph API access token
   * @param oneDriveId - OneDrive item ID
   * @returns Array of track changes
   */
  async extractTrackChanges(
    documentId: string,
    accessToken: string,
    oneDriveId: string
  ): Promise<TrackChange[]> {
    logger.info('Extracting track changes from document', {
      documentId,
      oneDriveId,
    });

    try {
      // Download DOCX from OneDrive
      const docxContent = await this.downloadDocx(accessToken, oneDriveId);

      // Parse and extract track changes
      const trackChanges = await this.parseDocxForTrackChanges(docxContent);

      logger.info('Track changes extracted', {
        documentId,
        count: trackChanges.length,
      });

      return trackChanges;
    } catch (error: any) {
      logger.error('Failed to extract track changes', {
        documentId,
        oneDriveId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Format track changes into a human-readable summary
   *
   * @param trackChanges - Array of track changes
   * @returns Formatted summary object
   */
  formatChangesSummary(trackChanges: TrackChange[]): TrackChangesSummary {
    const insertions = trackChanges.filter((c) => c.type === 'INSERTION').length;
    const deletions = trackChanges.filter((c) => c.type === 'DELETION').length;
    const modifications = trackChanges.filter((c) => c.type === 'MODIFICATION').length;
    const formatChanges = trackChanges.filter((c) => c.type === 'FORMAT_CHANGE').length;

    const authors = [...new Set(trackChanges.map((c) => c.authorName))];

    // Generate summary text
    const parts: string[] = [];

    if (insertions > 0) {
      parts.push(`${insertions} insertion${insertions > 1 ? 's' : ''}`);
    }
    if (deletions > 0) {
      parts.push(`${deletions} deletion${deletions > 1 ? 's' : ''}`);
    }
    if (modifications > 0) {
      parts.push(`${modifications} modification${modifications > 1 ? 's' : ''}`);
    }
    if (formatChanges > 0) {
      parts.push(`${formatChanges} format change${formatChanges > 1 ? 's' : ''}`);
    }

    let summary = parts.length > 0 ? parts.join(', ') : 'No changes';

    if (authors.length > 0) {
      summary += ` by ${authors.join(', ')}`;
    }

    return {
      totalChanges: trackChanges.length,
      insertions,
      deletions,
      modifications,
      formatChanges,
      authors,
      summary,
    };
  }

  /**
   * Get track changes summary as a string for DocumentVersion.changesSummary
   *
   * @param trackChanges - Array of track changes
   * @returns Summary string
   */
  getChangesSummaryText(trackChanges: TrackChange[]): string {
    const summary = this.formatChangesSummary(trackChanges);
    return summary.summary;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Download DOCX file from OneDrive
   */
  private async downloadDocx(accessToken: string, oneDriveId: string): Promise<Buffer> {
    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          // Get download URL
          const item = await client.api(graphEndpoints.driveItem(oneDriveId)).get();

          const downloadUrl = item['@microsoft.graph.downloadUrl'];

          if (!downloadUrl) {
            throw new Error('No download URL available for document');
          }

          // Download content
          const response = await fetch(downloadUrl);

          if (!response.ok) {
            throw new Error(`Failed to download DOCX: ${response.status}`);
          }

          return Buffer.from(await response.arrayBuffer());
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'download-docx-for-track-changes'
    );
  }

  /**
   * Parse DOCX Open XML to extract track changes
   *
   * DOCX structure:
   * - word/document.xml contains the main document content
   * - w:ins elements represent insertions
   * - w:del elements represent deletions
   * - w:rPrChange elements represent formatting changes
   */
  private async parseDocxForTrackChanges(docxBuffer: Buffer): Promise<TrackChange[]> {
    const trackChanges: TrackChange[] = [];

    try {
      // Load the DOCX as a ZIP archive
      const zip = await JSZip.loadAsync(docxBuffer);

      // Get the main document
      const documentXml = zip.file('word/document.xml');

      if (!documentXml) {
        logger.warn('No document.xml found in DOCX');
        return [];
      }

      // Parse the XML
      const xmlContent = await documentXml.async('string');
      const parsed = await parseStringPromise(xmlContent, {
        explicitArray: false,
        tagNameProcessors: [(name) => name.replace(/^w:/, '')],
      });

      // Navigate to document body
      const body = parsed?.document?.body;

      if (!body) {
        logger.warn('No document body found');
        return [];
      }

      // Extract track changes from the body
      this.extractChangesFromNode(body, trackChanges, 0);

      return trackChanges;
    } catch (error: any) {
      logger.error('Failed to parse DOCX for track changes', {
        error: error.message,
      });
      // Return empty array rather than throwing to allow graceful degradation
      return [];
    }
  }

  /**
   * Recursively extract track changes from XML nodes
   */
  private extractChangesFromNode(
    node: any,
    trackChanges: TrackChange[],
    paragraphIndex: number
  ): void {
    if (!node || typeof node !== 'object') {
      return;
    }

    // Process insertions (w:ins)
    if (node.ins) {
      const insertions = Array.isArray(node.ins) ? node.ins : [node.ins];
      for (const ins of insertions) {
        const change = this.parseInsertionNode(ins, paragraphIndex);
        if (change) {
          trackChanges.push(change);
        }
      }
    }

    // Process deletions (w:del)
    if (node.del) {
      const deletions = Array.isArray(node.del) ? node.del : [node.del];
      for (const del of deletions) {
        const change = this.parseDeletionNode(del, paragraphIndex);
        if (change) {
          trackChanges.push(change);
        }
      }
    }

    // Process formatting changes (w:rPrChange)
    if (node.rPrChange) {
      const formatChanges = Array.isArray(node.rPrChange) ? node.rPrChange : [node.rPrChange];
      for (const fc of formatChanges) {
        const change = this.parseFormatChangeNode(fc, paragraphIndex);
        if (change) {
          trackChanges.push(change);
        }
      }
    }

    // Track paragraph index for context
    let currentParagraphIndex = paragraphIndex;
    if (node.p) {
      const paragraphs = Array.isArray(node.p) ? node.p : [node.p];
      for (const p of paragraphs) {
        this.extractChangesFromNode(p, trackChanges, currentParagraphIndex);
        currentParagraphIndex++;
      }
    }

    // Recurse into child nodes
    for (const key of Object.keys(node)) {
      if (key !== 'ins' && key !== 'del' && key !== 'rPrChange' && key !== 'p') {
        const child = node[key];
        if (Array.isArray(child)) {
          for (const item of child) {
            this.extractChangesFromNode(item, trackChanges, currentParagraphIndex);
          }
        } else if (typeof child === 'object') {
          this.extractChangesFromNode(child, trackChanges, currentParagraphIndex);
        }
      }
    }
  }

  /**
   * Parse an insertion node (w:ins)
   */
  private parseInsertionNode(node: any, paragraphIndex: number): TrackChange | null {
    try {
      const attrs = node.$ || {};
      const author = attrs.author || 'Unknown';
      const date = attrs.date ? new Date(attrs.date) : new Date();

      // Extract inserted text
      const content = this.extractTextContent(node);

      if (!content) {
        return null;
      }

      return {
        id: randomUUID(),
        type: 'INSERTION',
        authorName: author,
        content,
        timestamp: date,
        paragraphIndex,
      };
    } catch (error) {
      logger.warn('Failed to parse insertion node', { error });
      return null;
    }
  }

  /**
   * Parse a deletion node (w:del)
   */
  private parseDeletionNode(node: any, paragraphIndex: number): TrackChange | null {
    try {
      const attrs = node.$ || {};
      const author = attrs.author || 'Unknown';
      const date = attrs.date ? new Date(attrs.date) : new Date();

      // Extract deleted text
      const content = this.extractTextContent(node);

      if (!content) {
        return null;
      }

      return {
        id: randomUUID(),
        type: 'DELETION',
        authorName: author,
        content,
        originalContent: content,
        timestamp: date,
        paragraphIndex,
      };
    } catch (error) {
      logger.warn('Failed to parse deletion node', { error });
      return null;
    }
  }

  /**
   * Parse a format change node (w:rPrChange)
   */
  private parseFormatChangeNode(node: any, paragraphIndex: number): TrackChange | null {
    try {
      const attrs = node.$ || {};
      const author = attrs.author || 'Unknown';
      const date = attrs.date ? new Date(attrs.date) : new Date();

      return {
        id: randomUUID(),
        type: 'FORMAT_CHANGE',
        authorName: author,
        content: 'Format change',
        timestamp: date,
        paragraphIndex,
      };
    } catch (error) {
      logger.warn('Failed to parse format change node', { error });
      return null;
    }
  }

  /**
   * Extract text content from a node recursively
   */
  private extractTextContent(node: any): string {
    if (!node || typeof node !== 'object') {
      return '';
    }

    let text = '';

    // Check for text nodes (w:t)
    if (node.t) {
      const textNodes = Array.isArray(node.t) ? node.t : [node.t];
      for (const t of textNodes) {
        if (typeof t === 'string') {
          text += t;
        } else if (t._) {
          text += t._;
        }
      }
    }

    // Check for deleted text nodes (w:delText)
    if (node.delText) {
      const delTextNodes = Array.isArray(node.delText) ? node.delText : [node.delText];
      for (const dt of delTextNodes) {
        if (typeof dt === 'string') {
          text += dt;
        } else if (dt._) {
          text += dt._;
        }
      }
    }

    // Recurse into run elements (w:r)
    if (node.r) {
      const runs = Array.isArray(node.r) ? node.r : [node.r];
      for (const r of runs) {
        text += this.extractTextContent(r);
      }
    }

    return text;
  }
}

// Export singleton instance
export const trackChangesService = new TrackChangesService();
