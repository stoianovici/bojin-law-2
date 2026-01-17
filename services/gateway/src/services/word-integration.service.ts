/**
 * Word Integration Service
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Service layer for managing Word edit sessions including:
 * - Opening documents in Word desktop via protocol URL
 * - Document locking to prevent concurrent edits
 * - Lock renewal and release
 *
 * Uses Redis for lock storage with automatic expiration (30-minute TTL).
 */

import { prisma, redis } from '@legal-platform/database';
import { randomBytes } from 'crypto';
import {
  DocumentLock,
  DocumentLockRedisData,
  DocumentLockSessionType,
  DocumentLockWithUser,
  WordEditSession,
  DOCUMENT_LOCK_REDIS_KEY,
  DEFAULT_LOCK_TTL_SECONDS,
} from '@legal-platform/types';
import { OneDriveService, oneDriveService } from './onedrive.service';
import { R2StorageService, r2StorageService } from './r2-storage.service';
import { SharePointService, sharePointService } from './sharepoint.service';
import { createGraphClient, graphEndpoints } from '../config/graph.config';
import { retryWithBackoff } from '../utils/retry.util';
import { parseGraphError, logGraphError } from '../utils/graph-error-handler';
import logger from '../utils/logger';

// Configuration from environment
const LOCK_TTL_SECONDS = parseInt(
  process.env.DOCUMENT_LOCK_TTL_SECONDS || String(DEFAULT_LOCK_TTL_SECONDS),
  10
);

/**
 * Word Integration Service Class
 * Handles document locking and Word protocol URL generation
 */
export class WordIntegrationService {
  private oneDriveService: OneDriveService;
  private r2Storage: R2StorageService;
  private sharePoint: SharePointService;

  constructor(
    oneDriveSvc?: OneDriveService,
    r2Svc?: R2StorageService,
    sharePointSvc?: SharePointService
  ) {
    this.oneDriveService = oneDriveSvc || oneDriveService;
    this.r2Storage = r2Svc || r2StorageService;
    this.sharePoint = sharePointSvc || sharePointService;
  }

  /**
   * Open a document in Word desktop application
   *
   * Flow (SharePoint-first for speed, OneDrive fallback for legacy):
   * 1. Verify document exists and user has access
   * 2. Check/acquire document lock
   * 3. If document has sharePointItemId:
   *    a. Get metadata from SharePoint (sub-second)
   *    b. Store baseline in DocumentEditSession for version detection
   *    c. Return SharePoint webUrl
   * 4. Otherwise (legacy OneDrive path):
   *    a. Ensure document is in OneDrive (upload if needed - 3-8 seconds)
   *    b. Return OneDrive webUrl
   * 5. Generate ms-word: protocol URL
   * 6. Return session with lock token
   *
   * @param documentId - Document UUID
   * @param userId - User UUID
   * @param accessToken - Microsoft Graph API access token
   * @returns Word edit session with protocol URL
   * @throws Error if document not found, access denied, or lock unavailable
   */
  async openInWord(
    documentId: string,
    userId: string,
    accessToken: string
  ): Promise<WordEditSession> {
    logger.info('Opening document in Word', { documentId, userId });

    // 1. Verify document exists and user has access
    const document = await this.verifyDocumentAccess(documentId, userId);

    // 2. Check/acquire document lock
    const lock = await this.acquireDocumentLock(documentId, userId, 'word_desktop');

    try {
      // 3. SharePoint-first path (fast!) - OPS-181
      if (document.sharePointItemId) {
        logger.info('Using SharePoint-first path', {
          documentId,
          sharePointItemId: document.sharePointItemId,
        });

        const spMetadata = await this.sharePoint.getFileMetadata(
          accessToken,
          document.sharePointItemId
        );

        // Store baseline for version detection (OPS-182 will use this)
        await prisma.documentEditSession.upsert({
          where: { documentId },
          update: {
            userId,
            startedAt: new Date(),
            sharePointLastModified: new Date(spMetadata.lastModifiedDateTime),
            lockToken: lock.lockToken,
          },
          create: {
            documentId,
            userId,
            sharePointLastModified: new Date(spMetadata.lastModifiedDateTime),
            lockToken: lock.lockToken,
          },
        });

        // For Word Desktop, we need to construct a direct file URL
        // The webUrl from Graph API is a WOPI URL that opens read-only via ms-word: protocol
        // Word Desktop works better with direct SharePoint file paths
        const wordUrl = `ms-word:ofe|u|${spMetadata.webUrl}`;

        logger.info('Document opened in Word via SharePoint', {
          documentId,
          userId,
          sharePointItemId: document.sharePointItemId,
          lockToken: lock.lockToken.substring(0, 8) + '...',
          usingEditableShareLink: true,
        });

        return {
          documentId,
          wordUrl,
          webUrl: spMetadata.webUrl,
          lockToken: lock.lockToken,
          expiresAt: lock.expiresAt,
          oneDriveId: null,
          sharePointItemId: document.sharePointItemId,
        };
      }

      // 4. FALLBACK: Legacy OneDrive path for old documents
      logger.info('Using legacy OneDrive path (no sharePointItemId)', { documentId });

      let oneDriveId = document.oneDriveId;
      let webUrl: string | null = null;

      if (oneDriveId) {
        // Document has oneDriveId - try to fetch the webUrl using OneDrive endpoint
        // Pass isLegacyOneDrive=true since we're in the legacy code path
        webUrl = await this.getWordOnlineUrl(
          oneDriveId,
          accessToken,
          document.oneDriveUserId,
          true
        );
      }

      // If no oneDriveId or webUrl fetch failed (stale/wrong user's drive), upload fresh
      if (!webUrl) {
        logger.info('Uploading document to OneDrive (no valid webUrl)', { documentId });
        try {
          const uploadResult = await this.ensureDocumentInOneDrive(document, accessToken);
          oneDriveId = uploadResult.id;
          webUrl = uploadResult.webUrl;
        } catch (uploadError) {
          // Check if this is a legacy orphaned document (has oneDriveId but can't access it)
          const isOrphanedLegacyDoc = !!document.oneDriveId && !document.oneDriveUserId;
          if (isOrphanedLegacyDoc) {
            logger.error('Cannot open legacy orphaned document', {
              documentId,
              oneDriveId: document.oneDriveId,
              fileName: document.fileName,
              error: uploadError,
            });
            throw new Error(
              `Acest document a fost încărcat anterior de alt utilizator și nu mai este accesibil. ` +
                `Documentul trebuie reîncărcat pentru a putea fi editat în Word. ` +
                `(ID OneDrive vechi: ${document.oneDriveId?.substring(0, 8)}...)`
            );
          }
          throw uploadError;
        }
      }

      // 5. Generate Word protocol URL (for desktop Word)
      const wordUrl = webUrl ? `ms-word:ofe|u|${webUrl}` : null;

      logger.info('Document opened in Word via OneDrive', {
        documentId,
        userId,
        oneDriveId,
        lockToken: lock.lockToken.substring(0, 8) + '...',
        hasWebUrl: !!webUrl,
      });

      return {
        documentId,
        wordUrl,
        webUrl,
        lockToken: lock.lockToken,
        expiresAt: lock.expiresAt,
        oneDriveId: oneDriveId!,
        sharePointItemId: null,
      };
    } catch (error) {
      // Release lock if we fail after acquiring it
      await this.releaseDocumentLock(documentId, userId).catch((releaseError) => {
        logger.error('Failed to release lock after error', {
          documentId,
          userId,
          error: releaseError,
        });
      });
      throw error;
    }
  }

  /**
   * Acquire a document lock
   *
   * Lock flow:
   * 1. Check Redis for existing lock
   * 2. If locked by another user, throw error
   * 3. If free or already locked by same user, create/update lock
   * 4. Store in both Redis (fast checks) and PostgreSQL (persistence)
   *
   * @param documentId - Document UUID
   * @param userId - User UUID requesting the lock
   * @param sessionType - Type of editing session
   * @returns Lock details with token
   * @throws Error if document is locked by another user
   */
  async acquireDocumentLock(
    documentId: string,
    userId: string,
    sessionType: DocumentLockSessionType = 'platform'
  ): Promise<DocumentLock> {
    const redisKey = DOCUMENT_LOCK_REDIS_KEY(documentId);

    // Check for existing lock
    const existingLockData = await redis.get(redisKey);

    if (existingLockData) {
      const existingLock: DocumentLockRedisData = JSON.parse(existingLockData);

      // If locked by another user, reject
      if (existingLock.userId !== userId) {
        const lockHolder = await prisma.user.findUnique({
          where: { id: existingLock.userId },
          select: { email: true, firstName: true, lastName: true },
        });

        throw new Error(
          `Document is locked by ${lockHolder?.firstName} ${lockHolder?.lastName} (${lockHolder?.email}). ` +
            `Lock expires at ${existingLock.expiresAt}`
        );
      }

      // Same user - refresh the lock
      return this.refreshLock(documentId, userId, existingLock.lockToken, sessionType);
    }

    // Generate new lock token
    const lockToken = randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);

    // Create lock in Redis
    const lockData: DocumentLockRedisData = {
      userId,
      lockToken,
      expiresAt: expiresAt.toISOString(),
      sessionType,
      lockedAt: now.toISOString(),
    };

    await redis.setex(redisKey, LOCK_TTL_SECONDS, JSON.stringify(lockData));

    logger.info('Document lock acquired', {
      documentId,
      userId,
      lockToken: lockToken.substring(0, 8) + '...',
      expiresAt: expiresAt.toISOString(),
    });

    return {
      id: `lock-${documentId}`,
      documentId,
      userId,
      lockToken,
      lockedAt: now,
      expiresAt,
      sessionType,
    };
  }

  /**
   * Release a document lock
   *
   * @param documentId - Document UUID
   * @param userId - User UUID (must match lock holder)
   * @returns True if lock was released
   */
  async releaseDocumentLock(documentId: string, userId: string): Promise<boolean> {
    const redisKey = DOCUMENT_LOCK_REDIS_KEY(documentId);

    // Check existing lock
    const existingLockData = await redis.get(redisKey);

    if (existingLockData) {
      const existingLock: DocumentLockRedisData = JSON.parse(existingLockData);

      // Only the lock holder can release
      if (existingLock.userId !== userId) {
        throw new Error('Cannot release lock owned by another user');
      }
    }

    // Delete from Redis
    await redis.del(redisKey);

    logger.info('Document lock released', { documentId, userId });

    return true;
  }

  /**
   * Renew an existing document lock
   *
   * @param documentId - Document UUID
   * @param lockToken - Lock token to validate ownership
   * @returns Updated lock with new expiration
   * @throws Error if lock not found or token invalid
   */
  async renewDocumentLock(documentId: string, lockToken: string): Promise<DocumentLock> {
    const redisKey = DOCUMENT_LOCK_REDIS_KEY(documentId);

    // Verify lock exists and token matches
    const existingLockData = await redis.get(redisKey);

    if (!existingLockData) {
      throw new Error('Lock not found or expired');
    }

    const existingLock: DocumentLockRedisData = JSON.parse(existingLockData);

    if (existingLock.lockToken !== lockToken) {
      throw new Error('Invalid lock token');
    }

    // Refresh the lock
    return this.refreshLock(
      documentId,
      existingLock.userId,
      lockToken,
      existingLock.sessionType as DocumentLockSessionType
    );
  }

  /**
   * Get current lock status for a document
   *
   * @param documentId - Document UUID
   * @returns Lock details with user info, or null if not locked
   */
  async getDocumentLock(documentId: string): Promise<DocumentLockWithUser | null> {
    const redisKey = DOCUMENT_LOCK_REDIS_KEY(documentId);

    const lockData = await redis.get(redisKey);

    if (!lockData) {
      return null;
    }

    const lock: DocumentLockRedisData = JSON.parse(lockData);

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: lock.userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      // Invalid lock state - clean up
      await redis.del(redisKey);
      return null;
    }

    return {
      id: `lock-${documentId}`,
      documentId,
      userId: lock.userId,
      lockToken: lock.lockToken,
      lockedAt: new Date(lock.lockedAt),
      expiresAt: new Date(lock.expiresAt),
      sessionType: lock.sessionType as DocumentLockSessionType,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  /**
   * Check if a document is currently locked
   *
   * @param documentId - Document UUID
   * @returns True if document is locked
   */
  async isDocumentLocked(documentId: string): Promise<boolean> {
    const redisKey = DOCUMENT_LOCK_REDIS_KEY(documentId);
    const exists = await redis.exists(redisKey);
    return exists === 1;
  }

  /**
   * Check if a user holds the lock for a document
   *
   * @param documentId - Document UUID
   * @param userId - User UUID
   * @returns True if user holds the lock
   */
  async userHoldsLock(documentId: string, userId: string): Promise<boolean> {
    const redisKey = DOCUMENT_LOCK_REDIS_KEY(documentId);
    const lockData = await redis.get(redisKey);

    if (!lockData) {
      return false;
    }

    const lock: DocumentLockRedisData = JSON.parse(lockData);
    return lock.userId === userId;
  }

  // ============================================================================
  // SharePoint Sync Methods (OPS-182)
  // ============================================================================

  /**
   * Check if document changed in SharePoint and sync if needed.
   * Creates a new DocumentVersion if changes are detected.
   * OPS-182: Lazy Version Sync on Document Access
   *
   * @param documentId - Document UUID
   * @param accessToken - Microsoft Graph API access token
   * @param userId - User UUID performing the sync
   * @returns Whether sync occurred and new version number if created
   */
  async syncFromSharePointIfChanged(
    documentId: string,
    accessToken: string,
    userId: string
  ): Promise<{ synced: boolean; newVersion?: number }> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        sharePointItemId: true,
        sharePointLastModified: true,
        storagePath: true,
        fileName: true,
        fileType: true,
      },
    });

    if (!document?.sharePointItemId) {
      logger.debug('Document not in SharePoint, skipping sync', { documentId });
      return { synced: false };
    }

    // Check for changes using timestamp comparison
    const knownLastModified = document.sharePointLastModified?.toISOString() || '';
    const { changed, currentMetadata } = await this.sharePoint.checkForChanges(
      accessToken,
      document.sharePointItemId,
      knownLastModified
    );

    if (!changed || !currentMetadata) {
      logger.debug('No changes detected in SharePoint', { documentId });
      return { synced: false };
    }

    logger.info('SharePoint changes detected, syncing document', {
      documentId,
      oldLastModified: knownLastModified,
      newLastModified: currentMetadata.lastModifiedDateTime,
    });

    // Download updated content from SharePoint
    const content = await this.sharePoint.downloadDocument(accessToken, document.sharePointItemId);

    // Update R2 backup
    if (this.r2Storage.isConfigured()) {
      await this.r2Storage.uploadDocument(document.storagePath, content, document.fileType);
      logger.debug('R2 backup updated', { documentId, storagePath: document.storagePath });
    }

    // Get latest version number
    const latestVersion = await prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
    });

    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    // Create new version record
    const newVersion = await prisma.documentVersion.create({
      data: {
        documentId,
        versionNumber: newVersionNumber,
        createdBy: userId,
        changesSummary: 'Editat în Microsoft Word',
      },
    });

    // Update document with new SharePoint timestamp
    await prisma.document.update({
      where: { id: documentId },
      data: {
        sharePointLastModified: new Date(currentMetadata.lastModifiedDateTime),
        fileSize: content.length,
        updatedAt: new Date(),
      },
    });

    // Clean up any active edit session for this document
    await prisma.documentEditSession.deleteMany({
      where: { documentId },
    });

    logger.info('Document synced from SharePoint', {
      documentId,
      newVersionNumber: newVersion.versionNumber,
      fileSize: content.length,
    });

    return { synced: true, newVersion: newVersion.versionNumber };
  }

  /**
   * Close a Word editing session with sync.
   * OPS-182: Syncs from SharePoint before releasing the lock.
   * OPS-184: Migrates legacy OneDrive docs to SharePoint after session.
   *
   * @param documentId - Document UUID
   * @param lockToken - Lock token to validate ownership
   * @param accessToken - Microsoft Graph API access token
   * @param userId - User UUID
   * @returns Sync result with update status and migration info
   */
  async closeWordSession(
    documentId: string,
    lockToken: string,
    accessToken: string,
    userId: string
  ): Promise<{ updated: boolean; newVersionNumber?: number; migrated?: boolean }> {
    // Verify lock ownership
    const redisKey = DOCUMENT_LOCK_REDIS_KEY(documentId);
    const existingLockData = await redis.get(redisKey);

    if (existingLockData) {
      const existingLock: DocumentLockRedisData = JSON.parse(existingLockData);
      if (existingLock.lockToken !== lockToken) {
        throw new Error('Invalid lock token');
      }
    }

    // Sync from SharePoint before releasing lock
    const syncResult = await this.syncFromSharePointIfChanged(documentId, accessToken, userId);

    // OPS-184: Lazy migration - if document is OneDrive-only, migrate to SharePoint
    // This runs after sync so we capture any edits the user made
    const migrationResult = await this.migrateOneDriveToSharePoint(documentId, accessToken, userId);

    // Release the lock
    await this.releaseDocumentLock(documentId, userId);

    logger.info('Word session closed', {
      documentId,
      userId,
      synced: syncResult.synced,
      newVersion: syncResult.newVersion,
      migrated: migrationResult.migrated,
    });

    return {
      updated: syncResult.synced,
      newVersionNumber: syncResult.newVersion,
      migrated: migrationResult.migrated,
    };
  }

  // ============================================================================
  // OneDrive to SharePoint Migration (OPS-184)
  // ============================================================================

  /**
   * Migrate a document from OneDrive to SharePoint.
   * OPS-184: Lazy migration - called when user finishes editing a legacy document.
   *
   * This enables future edits to use the fast SharePoint-first path.
   * Migration is best-effort: if it fails, the document still works via OneDrive.
   *
   * @param documentId - Document UUID
   * @param accessToken - Microsoft Graph API access token
   * @param userId - User UUID performing the migration
   * @returns Whether migration succeeded
   */
  async migrateOneDriveToSharePoint(
    documentId: string,
    accessToken: string,
    userId: string
  ): Promise<{ migrated: boolean; sharePointItemId?: string }> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        caseLinks: {
          include: { case: { select: { caseNumber: true } } },
          take: 1,
        },
      },
    });

    if (!document) {
      logger.warn('Document not found for migration', { documentId });
      return { migrated: false };
    }

    // Already in SharePoint - no migration needed
    if (document.sharePointItemId) {
      logger.debug('Document already in SharePoint, skipping migration', { documentId });
      return { migrated: false };
    }

    // No OneDrive ID - can't migrate
    if (!document.oneDriveId) {
      logger.debug('Document has no OneDrive ID, cannot migrate', { documentId });
      return { migrated: false };
    }

    // Need case number for SharePoint folder structure
    const caseNumber = document.caseLinks[0]?.case.caseNumber;
    if (!caseNumber) {
      logger.warn('Cannot migrate document without case link', { documentId });
      return { migrated: false };
    }

    try {
      logger.info('Starting OneDrive to SharePoint migration', {
        documentId,
        oneDriveId: document.oneDriveId,
        caseNumber,
      });

      // Download current content from OneDrive
      const content = await this.oneDriveService.downloadDocument(accessToken, document.oneDriveId);

      // Upload to SharePoint
      const spResult = await this.sharePoint.uploadDocument(
        accessToken,
        caseNumber,
        document.fileName,
        content,
        document.fileType
      );

      // Update document record with SharePoint info
      await prisma.document.update({
        where: { id: documentId },
        data: {
          sharePointItemId: spResult.id,
          sharePointPath: spResult.parentPath + '/' + spResult.name,
          sharePointLastModified: new Date(spResult.lastModifiedDateTime),
          // Keep oneDriveId for reference but SharePoint is now primary
        },
      });

      logger.info('Document migrated from OneDrive to SharePoint', {
        documentId,
        oneDriveId: document.oneDriveId,
        sharePointItemId: spResult.id,
        sharePointPath: spResult.parentPath + '/' + spResult.name,
        migratedBy: userId,
      });

      return { migrated: true, sharePointItemId: spResult.id };
    } catch (error) {
      // Log but don't fail - document still works via OneDrive
      logger.error('Failed to migrate document to SharePoint', {
        documentId,
        oneDriveId: document.oneDriveId,
        caseNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      return { migrated: false };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Verify document exists and user has access
   */
  private async verifyDocumentAccess(
    documentId: string,
    userId: string
  ): Promise<{
    id: string;
    clientId: string;
    firmId: string;
    fileName: string;
    fileType: string;
    storagePath: string;
    oneDriveId: string | null;
    oneDrivePath: string | null;
    oneDriveUserId: string | null;
    sharePointItemId: string | null;
  }> {
    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        clientId: true,
        firmId: true,
        fileName: true,
        fileType: true,
        storagePath: true,
        oneDriveId: true,
        oneDrivePath: true,
        oneDriveUserId: true,
        sharePointItemId: true,
      },
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Get user and verify firm membership
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true, role: true },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Verify user belongs to same firm as document
    if (user.firmId !== document.firmId) {
      throw new Error('Access denied: User does not have access to this document');
    }

    return document;
  }

  /**
   * Ensure document exists in OneDrive, upload if needed
   *
   * Flow:
   * 1. Get case linked to document for folder structure
   * 2. Download document content from R2 storage
   * 3. Upload to OneDrive in case folder structure
   * 4. Update document record with OneDrive ID
   *
   * @param document - Document metadata
   * @param accessToken - Microsoft Graph API access token
   * @returns OneDrive item ID and webUrl
   */
  private async ensureDocumentInOneDrive(
    document: {
      id: string;
      clientId: string;
      firmId: string;
      fileName: string;
      fileType: string;
      storagePath: string;
    },
    accessToken: string
  ): Promise<{ id: string; webUrl: string }> {
    logger.info('Ensuring document is in OneDrive', { documentId: document.id });

    // Get case linked to this document for folder structure
    const caseDocument = await prisma.caseDocument.findFirst({
      where: { documentId: document.id },
      include: {
        case: {
          select: { id: true, caseNumber: true },
        },
      },
    });

    if (!caseDocument) {
      throw new Error('Document must be linked to a case to edit in Word');
    }

    // Check if R2 storage is configured
    if (!this.r2Storage.isConfigured()) {
      throw new Error(
        'R2 storage is not configured. Required environment variables: ' +
          'R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID or R2_ENDPOINT'
      );
    }

    // Download document content from R2
    logger.debug('Downloading document from R2 for OneDrive upload', {
      documentId: document.id,
      storagePath: document.storagePath,
    });

    let fileContent: Buffer;
    try {
      fileContent = await this.r2Storage.downloadDocument(document.storagePath);
    } catch (error) {
      logger.error('Failed to download document from R2', {
        documentId: document.id,
        storagePath: document.storagePath,
        error,
      });
      throw new Error(
        `Failed to retrieve document from storage: ${document.storagePath}. ` +
          'The document may not exist in storage or there may be a connectivity issue.'
      );
    }

    // Upload to OneDrive
    logger.debug('Uploading document to OneDrive', {
      documentId: document.id,
      caseId: caseDocument.caseId,
      fileName: document.fileName,
      fileSize: fileContent.length,
    });

    const oneDriveResult = await this.oneDriveService.uploadDocumentToOneDrive(
      accessToken,
      fileContent,
      {
        caseId: caseDocument.caseId,
        caseNumber: caseDocument.case.caseNumber,
        fileName: document.fileName,
        fileType: document.fileType,
        fileSize: fileContent.length,
      }
    );

    // Update document with OneDrive ID and path
    await prisma.document.update({
      where: { id: document.id },
      data: {
        oneDriveId: oneDriveResult.id,
        oneDrivePath: oneDriveResult.parentPath + '/' + oneDriveResult.name,
      },
    });

    logger.info('Document uploaded to OneDrive successfully', {
      documentId: document.id,
      oneDriveId: oneDriveResult.id,
      oneDrivePath: oneDriveResult.parentPath + '/' + oneDriveResult.name,
      webUrl: oneDriveResult.webUrl,
    });

    return { id: oneDriveResult.id, webUrl: oneDriveResult.webUrl };
  }

  /**
   * Get Word Online URL for a document.
   * For legacy documents with oneDriveUserId, uses OneDrive endpoint.
   * For SharePoint documents, uses SharePoint endpoint.
   *
   * @param itemId - OneDrive or SharePoint item ID
   * @param accessToken - Microsoft Graph API access token
   * @param oneDriveUserId - Optional: MS Graph user ID of OneDrive owner (for legacy docs)
   * @param isLegacyOneDrive - Whether this is a legacy OneDrive document (has oneDriveId, no sharePointItemId)
   */
  async getWordOnlineUrl(
    itemId: string,
    accessToken: string,
    oneDriveUserId?: string | null,
    isLegacyOneDrive: boolean = false
  ): Promise<string | null> {
    try {
      const graphClient = createGraphClient(accessToken);

      // Choose endpoint based on document type
      let endpoint: string;
      if (oneDriveUserId) {
        // Known owner - use their OneDrive
        endpoint = graphEndpoints.driveItemByOwner(oneDriveUserId, itemId);
      } else if (isLegacyOneDrive) {
        // Legacy doc without owner ID - try current user's OneDrive
        endpoint = graphEndpoints.driveItem(itemId);
      } else {
        // SharePoint document
        endpoint = graphEndpoints.sharepoint.driveItem(itemId);
      }

      logger.debug('Getting Word Online URL', {
        itemId,
        oneDriveUserId,
        endpoint,
        isLegacyOneDrive,
      });

      // Get the webUrl directly from the drive item
      try {
        const driveItem = await retryWithBackoff(() =>
          graphClient.api(endpoint).select('webUrl').get()
        );
        if (driveItem?.webUrl) {
          logger.debug('Got webUrl', { itemId, webUrl: driveItem.webUrl });
          return driveItem.webUrl;
        }
      } catch (getError) {
        logger.debug('Failed to get webUrl, trying createLink', { itemId, error: getError });
      }

      // Fallback: Create an edit link
      const createLinkEndpoint = `${endpoint}/createLink`;

      const linkResponse = await retryWithBackoff(() =>
        graphClient.api(createLinkEndpoint).post({
          type: 'edit',
          scope: 'organization',
        })
      );

      if (linkResponse?.link?.webUrl) {
        logger.debug('Created edit link', { itemId, webUrl: linkResponse.link.webUrl });
        return linkResponse.link.webUrl;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get Word Online URL', { itemId, oneDriveUserId, error });
      return null;
    }
  }

  /**
   * Refresh an existing lock
   */
  private async refreshLock(
    documentId: string,
    userId: string,
    lockToken: string,
    sessionType: DocumentLockSessionType
  ): Promise<DocumentLock> {
    const redisKey = DOCUMENT_LOCK_REDIS_KEY(documentId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);

    // Update Redis
    const lockData: DocumentLockRedisData = {
      userId,
      lockToken,
      expiresAt: expiresAt.toISOString(),
      sessionType,
      lockedAt: now.toISOString(),
    };

    await redis.setex(redisKey, LOCK_TTL_SECONDS, JSON.stringify(lockData));

    logger.debug('Document lock refreshed', {
      documentId,
      userId,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      id: `lock-${documentId}`,
      documentId,
      userId,
      lockToken,
      lockedAt: new Date(lockData.lockedAt),
      expiresAt,
      sessionType,
    };
  }
}

// Export singleton instance
export const wordIntegrationService = new WordIntegrationService();
