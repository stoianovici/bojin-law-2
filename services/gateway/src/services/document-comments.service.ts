/**
 * Document Comments Sync Service
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Service layer for synchronizing comments between the platform and Word documents.
 * Parses DOCX Open XML format to extract and inject comments.
 */

import { prisma } from '@legal-platform/database';
import { createGraphClient, graphEndpoints } from '../config/graph.config';
import { retryWithBackoff } from '../utils/retry.util';
import { parseGraphError, logGraphError } from '../utils/graph-error-handler';
import {
  DocumentComment,
  DocumentCommentWithAuthor,
  CreateCommentParams,
} from '@legal-platform/types';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';
import JSZip from 'jszip';
import { parseStringPromise, Builder } from 'xml2js';

/**
 * Extracted comment from Word document
 */
interface WordComment {
  wordCommentId: string;
  authorName: string;
  authorInitials: string;
  content: string;
  anchorText?: string;
  date: Date;
}

/**
 * Document Comments Service Class
 * Handles synchronization of comments between platform and Word documents
 */
export class DocumentCommentsService {
  /**
   * Sync comments from Word document to platform
   *
   * Flow:
   * 1. Download DOCX from OneDrive
   * 2. Extract comments from Open XML
   * 3. Upsert comments in database
   *
   * @param documentId - Document UUID
   * @param accessToken - Microsoft Graph API access token
   * @param oneDriveId - OneDrive item ID
   * @returns Number of comments synced
   */
  async syncCommentsFromWord(
    documentId: string,
    accessToken: string,
    oneDriveId: string
  ): Promise<number> {
    logger.info('Syncing comments from Word', { documentId, oneDriveId });

    try {
      // Download DOCX from OneDrive
      const docxContent = await this.downloadDocx(accessToken, oneDriveId);

      // Extract comments from DOCX
      const wordComments = await this.extractCommentsFromDocx(docxContent);

      if (wordComments.length === 0) {
        logger.debug('No comments found in Word document', { documentId });
        return 0;
      }

      // Get document to find author mappings
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { firmId: true },
      });

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Upsert comments
      let syncedCount = 0;

      for (const wordComment of wordComments) {
        // Try to find user by name or initials
        const author = await this.findUserByName(
          document.firmId,
          wordComment.authorName,
          wordComment.authorInitials
        );

        // Upsert comment
        await prisma.documentComment.upsert({
          where: {
            // Use compound unique if word comment ID exists
            id:
              (
                await prisma.documentComment.findFirst({
                  where: {
                    documentId,
                    wordCommentId: wordComment.wordCommentId,
                  },
                  select: { id: true },
                })
              )?.id || randomUUID(),
          },
          update: {
            content: wordComment.content,
            anchorText: wordComment.anchorText,
            updatedAt: new Date(),
          },
          create: {
            documentId,
            authorId: author?.id || '',
            content: wordComment.content,
            anchorText: wordComment.anchorText,
            wordCommentId: wordComment.wordCommentId,
          },
        });

        syncedCount++;
      }

      logger.info('Comments synced from Word', { documentId, count: syncedCount });

      return syncedCount;
    } catch (error: any) {
      logger.error('Failed to sync comments from Word', {
        documentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Sync comments from platform to Word document
   *
   * Flow:
   * 1. Get platform comments for document
   * 2. Download DOCX from OneDrive
   * 3. Inject comments into Open XML
   * 4. Upload modified DOCX to OneDrive
   *
   * @param documentId - Document UUID
   * @param accessToken - Microsoft Graph API access token
   * @param oneDriveId - OneDrive item ID
   * @returns Number of comments injected
   */
  async syncCommentsToWord(
    documentId: string,
    accessToken: string,
    oneDriveId: string
  ): Promise<number> {
    logger.info('Syncing comments to Word', { documentId, oneDriveId });

    try {
      // Get platform comments
      const platformComments = await prisma.documentComment.findMany({
        where: { documentId },
      });

      if (platformComments.length === 0) {
        logger.debug('No platform comments to sync', { documentId });
        return 0;
      }

      // Download current DOCX
      const docxContent = await this.downloadDocx(accessToken, oneDriveId);

      // Inject comments into DOCX
      const modifiedDocx = await this.injectCommentsIntoDocx(docxContent, platformComments);

      // Upload modified DOCX back to OneDrive
      await this.uploadDocx(accessToken, oneDriveId, modifiedDocx);

      logger.info('Comments synced to Word', {
        documentId,
        count: platformComments.length,
      });

      return platformComments.length;
    } catch (error: any) {
      logger.error('Failed to sync comments to Word', {
        documentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all comments for a document
   *
   * @param documentId - Document UUID
   * @returns Array of comments with author details
   */
  async getDocumentComments(documentId: string): Promise<DocumentCommentWithAuthor[]> {
    const comments = await prisma.documentComment.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });

    // Get author details for each comment
    const commentsWithAuthors: DocumentCommentWithAuthor[] = [];

    for (const comment of comments) {
      const author = comment.authorId
        ? await prisma.user.findUnique({
            where: { id: comment.authorId },
            select: { id: true, email: true, firstName: true, lastName: true },
          })
        : null;

      const resolvedByUserResult = comment.resolvedBy
        ? await prisma.user.findUnique({
            where: { id: comment.resolvedBy },
            select: { id: true, email: true, firstName: true, lastName: true },
          })
        : null;
      const resolvedByUser = resolvedByUserResult || undefined;

      commentsWithAuthors.push({
        id: comment.id,
        documentId: comment.documentId,
        versionId: comment.versionId || undefined,
        authorId: comment.authorId,
        content: comment.content,
        anchorText: comment.anchorText || undefined,
        anchorStart: comment.anchorStart || undefined,
        anchorEnd: comment.anchorEnd || undefined,
        wordCommentId: comment.wordCommentId || undefined,
        resolved: comment.resolved,
        resolvedBy: comment.resolvedBy || undefined,
        resolvedAt: comment.resolvedAt || undefined,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: author || {
          id: '',
          email: 'unknown@example.com',
          firstName: 'Unknown',
          lastName: 'User',
        },
        resolvedByUser,
      });
    }

    return commentsWithAuthors;
  }

  /**
   * Add a new comment to a document
   *
   * @param params - Comment parameters
   * @returns Created comment
   */
  async addComment(params: CreateCommentParams): Promise<DocumentComment> {
    const comment = await prisma.documentComment.create({
      data: {
        documentId: params.documentId,
        authorId: params.authorId,
        content: params.content,
        anchorText: params.anchorText,
        anchorStart: params.anchorStart,
        anchorEnd: params.anchorEnd,
        wordCommentId: params.wordCommentId,
      },
    });

    logger.info('Comment added', {
      documentId: params.documentId,
      commentId: comment.id,
    });

    return {
      id: comment.id,
      documentId: comment.documentId,
      versionId: comment.versionId || undefined,
      authorId: comment.authorId,
      content: comment.content,
      anchorText: comment.anchorText || undefined,
      anchorStart: comment.anchorStart || undefined,
      anchorEnd: comment.anchorEnd || undefined,
      wordCommentId: comment.wordCommentId || undefined,
      resolved: comment.resolved,
      resolvedBy: comment.resolvedBy || undefined,
      resolvedAt: comment.resolvedAt || undefined,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  /**
   * Resolve a comment
   *
   * @param commentId - Comment UUID
   * @param userId - User resolving the comment
   * @returns Updated comment
   */
  async resolveComment(commentId: string, userId: string): Promise<DocumentComment> {
    const comment = await prisma.documentComment.update({
      where: { id: commentId },
      data: {
        resolved: true,
        resolvedBy: userId,
        resolvedAt: new Date(),
      },
    });

    logger.info('Comment resolved', { commentId, userId });

    return {
      id: comment.id,
      documentId: comment.documentId,
      versionId: comment.versionId || undefined,
      authorId: comment.authorId,
      content: comment.content,
      anchorText: comment.anchorText || undefined,
      anchorStart: comment.anchorStart || undefined,
      anchorEnd: comment.anchorEnd || undefined,
      wordCommentId: comment.wordCommentId || undefined,
      resolved: comment.resolved,
      resolvedBy: comment.resolvedBy || undefined,
      resolvedAt: comment.resolvedAt || undefined,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  /**
   * Unresolve a comment
   *
   * @param commentId - Comment UUID
   * @returns Updated comment
   */
  async unresolveComment(commentId: string): Promise<DocumentComment> {
    const comment = await prisma.documentComment.update({
      where: { id: commentId },
      data: {
        resolved: false,
        resolvedBy: null,
        resolvedAt: null,
      },
    });

    logger.info('Comment unresolved', { commentId });

    return {
      id: comment.id,
      documentId: comment.documentId,
      versionId: comment.versionId || undefined,
      authorId: comment.authorId,
      content: comment.content,
      anchorText: comment.anchorText || undefined,
      anchorStart: comment.anchorStart || undefined,
      anchorEnd: comment.anchorEnd || undefined,
      wordCommentId: comment.wordCommentId || undefined,
      resolved: comment.resolved,
      resolvedBy: comment.resolvedBy || undefined,
      resolvedAt: comment.resolvedAt || undefined,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
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

          const item = await client.api(graphEndpoints.driveItem(oneDriveId)).get();

          const downloadUrl = item['@microsoft.graph.downloadUrl'];

          if (!downloadUrl) {
            throw new Error('No download URL available');
          }

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
      'download-docx-for-comments'
    );
  }

  /**
   * Upload modified DOCX to OneDrive
   */
  private async uploadDocx(
    accessToken: string,
    oneDriveId: string,
    content: Buffer
  ): Promise<void> {
    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          await client
            .api(graphEndpoints.driveItemContent(oneDriveId))
            .header(
              'Content-Type',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            )
            .put(content);
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'upload-docx-with-comments'
    );
  }

  /**
   * Extract comments from DOCX Open XML
   *
   * Comments are stored in word/comments.xml
   */
  private async extractCommentsFromDocx(docxBuffer: Buffer): Promise<WordComment[]> {
    const comments: WordComment[] = [];

    try {
      const zip = await JSZip.loadAsync(docxBuffer);

      // Get comments file
      const commentsXml = zip.file('word/comments.xml');

      if (!commentsXml) {
        return [];
      }

      const xmlContent = await commentsXml.async('string');
      const parsed = await parseStringPromise(xmlContent, {
        explicitArray: false,
        tagNameProcessors: [(name) => name.replace(/^w:/, '')],
      });

      const commentsRoot = parsed?.comments?.comment;

      if (!commentsRoot) {
        return [];
      }

      const commentNodes = Array.isArray(commentsRoot) ? commentsRoot : [commentsRoot];

      for (const commentNode of commentNodes) {
        const attrs = commentNode.$ || {};

        const content = this.extractTextFromComment(commentNode);

        comments.push({
          wordCommentId: attrs.id || randomUUID(),
          authorName: attrs.author || 'Unknown',
          authorInitials: attrs.initials || '',
          content,
          date: attrs.date ? new Date(attrs.date) : new Date(),
        });
      }

      return comments;
    } catch (error: any) {
      logger.error('Failed to extract comments from DOCX', { error: error.message });
      return [];
    }
  }

  /**
   * Inject comments into DOCX Open XML
   */
  private async injectCommentsIntoDocx(docxBuffer: Buffer, comments: any[]): Promise<Buffer> {
    try {
      const zip = await JSZip.loadAsync(docxBuffer);

      // Build comments XML
      const commentsXml = this.buildCommentsXml(comments);

      // Update or create comments.xml
      zip.file('word/comments.xml', commentsXml);

      // Ensure comments.xml is referenced in [Content_Types].xml
      await this.ensureContentTypeEntry(zip);

      // Ensure relationship exists
      await this.ensureCommentsRelationship(zip);

      // Generate output
      return await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });
    } catch (error: any) {
      logger.error('Failed to inject comments into DOCX', { error: error.message });
      throw error;
    }
  }

  /**
   * Build comments XML content
   */
  private buildCommentsXml(comments: any[]): string {
    const xmlBuilder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true },
    });

    const commentsObj = {
      'w:comments': {
        $: {
          'xmlns:w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        },
        'w:comment': comments.map((comment, index) => ({
          $: {
            'w:id': comment.wordCommentId || String(index),
            'w:author': 'Platform User',
            'w:initials': 'PU',
            'w:date': comment.createdAt.toISOString(),
          },
          'w:p': {
            'w:r': {
              'w:t': comment.content,
            },
          },
        })),
      },
    };

    return xmlBuilder.buildObject(commentsObj);
  }

  /**
   * Ensure content type entry for comments exists
   */
  private async ensureContentTypeEntry(zip: JSZip): Promise<void> {
    const contentTypesFile = zip.file('[Content_Types].xml');

    if (!contentTypesFile) {
      return;
    }

    let content = await contentTypesFile.async('string');

    const commentsType =
      '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>';

    if (!content.includes('/word/comments.xml')) {
      content = content.replace('</Types>', `${commentsType}</Types>`);
      zip.file('[Content_Types].xml', content);
    }
  }

  /**
   * Ensure comments relationship exists
   */
  private async ensureCommentsRelationship(zip: JSZip): Promise<void> {
    const relsFile = zip.file('word/_rels/document.xml.rels');

    if (!relsFile) {
      return;
    }

    let content = await relsFile.async('string');

    const commentsRel =
      '<Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>';

    if (!content.includes('comments.xml')) {
      content = content.replace('</Relationships>', `${commentsRel}</Relationships>`);
      zip.file('word/_rels/document.xml.rels', content);
    }
  }

  /**
   * Extract text content from a comment node
   */
  private extractTextFromComment(commentNode: any): string {
    let text = '';

    if (commentNode.p) {
      const paragraphs = Array.isArray(commentNode.p) ? commentNode.p : [commentNode.p];

      for (const p of paragraphs) {
        if (p.r) {
          const runs = Array.isArray(p.r) ? p.r : [p.r];
          for (const r of runs) {
            if (r.t) {
              if (typeof r.t === 'string') {
                text += r.t;
              } else if (r.t._) {
                text += r.t._;
              }
            }
          }
        }
      }
    }

    return text;
  }

  /**
   * Find user by name or initials
   */
  private async findUserByName(
    firmId: string,
    authorName: string,
    authorInitials: string
  ): Promise<{ id: string } | null> {
    // Try to find user by full name
    const nameParts = authorName.split(' ');

    if (nameParts.length >= 2) {
      const user = await prisma.user.findFirst({
        where: {
          firmId,
          firstName: { contains: nameParts[0], mode: 'insensitive' },
          lastName: { contains: nameParts[nameParts.length - 1], mode: 'insensitive' },
        },
        select: { id: true },
      });

      if (user) {
        return user;
      }
    }

    // Try to find by initials
    if (authorInitials && authorInitials.length >= 2) {
      const firstInitial = authorInitials[0].toUpperCase();
      const lastInitial = authorInitials[authorInitials.length - 1].toUpperCase();

      const user = await prisma.user.findFirst({
        where: {
          firmId,
          firstName: { startsWith: firstInitial, mode: 'insensitive' },
          lastName: { startsWith: lastInitial, mode: 'insensitive' },
        },
        select: { id: true },
      });

      if (user) {
        return user;
      }
    }

    return null;
  }
}

// Export singleton instance
export const documentCommentsService = new DocumentCommentsService();
