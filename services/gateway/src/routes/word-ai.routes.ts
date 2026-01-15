/**
 * Word AI Routes
 * REST API endpoints for Word add-in AI features
 */

import { Router, Request, Response, NextFunction } from 'express';
import { wordAIService } from '../services/word-ai.service';
import { wordTemplateService } from '../services/word-template.service';
import { caseContextFileService } from '../services/case-context-file.service';
import { prisma } from '@legal-platform/database';
import logger from '../utils/logger';

export const wordAIRouter: Router = Router();

// ============================================================================
// Middleware - Extract user from session or Bearer token
// ============================================================================

interface SessionUser {
  userId: string;
  firmId: string;
  email: string;
  role?: string;
}

interface AuthenticatedRequest extends Request {
  sessionUser?: SessionUser;
}

/**
 * Decode JWT payload without verification (Office SSO tokens are pre-validated by Office)
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Dev mode bypass for Word add-in testing
  if (process.env.NODE_ENV !== 'production' && req.headers['x-dev-bypass'] === 'word-addin') {
    req.sessionUser = {
      userId: 'dev-user',
      firmId: '51f2f797-3109-4b79-ac43-a57ecc07bb06',
      email: 'dev@test.local',
    };
    return next();
  }

  // Check for Bearer token (Office SSO)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = decodeJwtPayload(token);

    if (payload) {
      const email = (payload.preferred_username || payload.upn || payload.email) as string;
      const userId = payload.oid as string;

      // Look up user in database by email to get firmId
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, firmId: true, email: true, role: true },
      });

      if (user) {
        req.sessionUser = {
          userId: user.id,
          firmId: user.firmId,
          email: user.email,
          role: user.role,
        };
        return next();
      }

      // User not found in DB - try with Azure AD oid
      logger.warn('Word add-in auth: User not found by email, checking by Azure OID', {
        email,
        oid: userId,
      });
    }
  }

  // Fall back to session-based auth
  const session = req.session as { user?: SessionUser };
  if (session?.user) {
    req.sessionUser = {
      userId: session.user.userId,
      firmId: session.user.firmId,
      email: session.user.email,
    };
    return next();
  }

  return res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
};

// ============================================================================
// AI Endpoints
// ============================================================================

/**
 * POST /api/ai/word/suggest
 * Get AI suggestions for text
 */
wordAIRouter.post('/suggest', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId, selectedText, cursorContext, suggestionType, caseId, customInstructions } =
      req.body;

    if (!selectedText && !cursorContext) {
      return res.status(400).json({ error: 'bad_request', message: 'Text required' });
    }

    const result = await wordAIService.getSuggestions(
      {
        documentId,
        selectedText,
        cursorContext,
        suggestionType: suggestionType || 'completion',
        caseId,
        customInstructions,
      },
      req.sessionUser!.userId,
      req.sessionUser!.firmId
    );

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Word AI suggest error', { error: message });
    res.status(500).json({ error: 'ai_error', message });
  }
});

/**
 * POST /api/ai/word/explain
 * Explain legal text
 */
wordAIRouter.post('/explain', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId, selectedText, caseId, customInstructions } = req.body;

    if (!selectedText) {
      return res.status(400).json({ error: 'bad_request', message: 'Selected text required' });
    }

    const result = await wordAIService.explainText(
      { documentId, selectedText, caseId, customInstructions },
      req.sessionUser!.userId,
      req.sessionUser!.firmId
    );

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Word AI explain error', { error: message });
    res.status(500).json({ error: 'ai_error', message });
  }
});

/**
 * POST /api/ai/word/improve
 * Improve text
 */
wordAIRouter.post('/improve', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId, selectedText, improvementType, caseId, customInstructions } = req.body;

    if (!selectedText) {
      return res.status(400).json({ error: 'bad_request', message: 'Selected text required' });
    }

    const result = await wordAIService.improveText(
      {
        documentId,
        selectedText,
        improvementType: improvementType || 'clarity',
        caseId,
        customInstructions,
      },
      req.sessionUser!.userId,
      req.sessionUser!.firmId
    );

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Word AI improve error', { error: message });
    res.status(500).json({ error: 'ai_error', message });
  }
});

/**
 * POST /api/ai/word/draft
 * Draft document content based on case/client/internal context and user prompt
 */
wordAIRouter.post('/draft', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      contextType = 'case',
      caseId,
      clientId,
      documentName,
      prompt,
      existingContent,
    } = req.body;

    if (!documentName || !prompt) {
      return res
        .status(400)
        .json({ error: 'bad_request', message: 'documentName and prompt are required' });
    }

    // Validate context requirements
    if (contextType === 'case' && !caseId) {
      return res
        .status(400)
        .json({ error: 'bad_request', message: 'caseId is required for case context' });
    }
    if (contextType === 'client' && !clientId) {
      return res
        .status(400)
        .json({ error: 'bad_request', message: 'clientId is required for client context' });
    }

    const result = await wordAIService.draft(
      { contextType, caseId, clientId, documentName, prompt, existingContent },
      req.sessionUser!.userId,
      req.sessionUser!.firmId
    );

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Word AI draft error', { error: message });
    res.status(500).json({ error: 'ai_error', message });
  }
});

/**
 * POST /api/ai/word/draft/stream
 * Draft document content with SSE streaming
 * Returns Server-Sent Events with real-time text chunks
 */
wordAIRouter.post(
  '/draft/stream',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        contextType = 'case',
        caseId,
        clientId,
        documentName,
        prompt,
        existingContent,
      } = req.body;

      if (!documentName || !prompt) {
        return res
          .status(400)
          .json({ error: 'bad_request', message: 'documentName and prompt are required' });
      }

      // Validate context requirements
      if (contextType === 'case' && !caseId) {
        return res
          .status(400)
          .json({ error: 'bad_request', message: 'caseId is required for case context' });
      }
      if (contextType === 'client' && !clientId) {
        return res
          .status(400)
          .json({ error: 'bad_request', message: 'clientId is required for client context' });
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.flushHeaders();

      // Send initial event
      res.write(`event: start\ndata: {"status":"started"}\n\n`);

      // Start keepalive interval to prevent connection timeout during long operations
      // Sends SSE comment (: ping) every 15 seconds - comments are ignored by SSE clients
      // but keep the connection alive through proxies and load balancers
      const keepaliveInterval = setInterval(() => {
        try {
          res.write(`: keepalive ${Date.now()}\n\n`);
        } catch {
          // Connection may have closed
          clearInterval(keepaliveInterval);
        }
      }, 15000);

      // Clean up keepalive on client disconnect
      req.on('close', () => {
        clearInterval(keepaliveInterval);
      });

      try {
        const result = await wordAIService.draftStream(
          { contextType, caseId, clientId, documentName, prompt, existingContent },
          req.sessionUser!.userId,
          req.sessionUser!.firmId,
          (chunk: string) => {
            // Send each text chunk as an SSE event
            // Escape newlines for SSE format
            const escapedChunk = JSON.stringify(chunk);
            res.write(`event: chunk\ndata: ${escapedChunk}\n\n`);
          },
          (progressEvent) => {
            // Send progress events for tool usage visibility
            res.write(`event: progress\ndata: ${JSON.stringify(progressEvent)}\n\n`);
          }
        );

        // Clear keepalive before sending final response
        clearInterval(keepaliveInterval);

        logger.info('Draft stream: sending final response', {
          contentLength: result.content.length,
          ooxmlLength: result.ooxmlContent.length,
          writable: res.writable,
        });

        // Send completion event with final data
        // Split into content chunk first, then done event with metadata
        // This prevents SSE message size issues with large OOXML
        if (res.writable) {
          // Send the main content as a chunk first
          res.write(`event: chunk\ndata: ${JSON.stringify(result.content)}\n\n`);

          // Send OOXML separately to avoid huge single message
          res.write(`event: ooxml\ndata: ${JSON.stringify(result.ooxmlContent)}\n\n`);

          // Send completion event with metadata only
          res.write(
            `event: done\ndata: ${JSON.stringify({
              title: result.title,
              tokensUsed: result.tokensUsed,
              processingTimeMs: result.processingTimeMs,
            })}\n\n`
          );
        } else {
          logger.error('Draft stream: response not writable, cannot send final data');
        }

        res.end();
      } catch (innerError: unknown) {
        clearInterval(keepaliveInterval);
        throw innerError;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Word AI draft stream error', { error: message });

      // Send error as SSE event if headers already sent
      if (res.headersSent) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: 'ai_error', message });
      }
    }
  }
);

/**
 * POST /api/ai/word/draft-from-template
 * Draft document from template
 */
wordAIRouter.post(
  '/draft-from-template',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { templateId, caseId, customInstructions, placeholderValues } = req.body;

      if (!templateId || !caseId) {
        return res
          .status(400)
          .json({ error: 'bad_request', message: 'templateId and caseId required' });
      }

      const result = await wordAIService.draftFromTemplate(
        { templateId, caseId, customInstructions, placeholderValues },
        req.sessionUser!.userId,
        req.sessionUser!.firmId
      );

      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Word AI draft error', { error: message });
      res.status(500).json({ error: 'ai_error', message });
    }
  }
);

/**
 * GET /api/ai/word/templates
 * List available templates
 */
wordAIRouter.get('/templates', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { caseType, documentType, category } = req.query;

    const templates = await wordTemplateService.listTemplates(req.sessionUser!.firmId, {
      caseType: caseType as string | undefined,
      documentType: documentType as string | undefined,
      category: category as string | undefined,
    });

    res.json({ templates });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Word AI templates error', { error: message });
    res.status(500).json({ error: 'fetch_error', message });
  }
});

// ============================================================================
// Context Endpoints
// ============================================================================

/**
 * GET /api/ai/word/context/:caseId
 * Get case context for Word add-in
 */
wordAIRouter.get(
  '/context/:caseId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { caseId } = req.params;
      const { profile = 'word_addin', format = 'json' } = req.query;

      const contextFile = await caseContextFileService.getContextFile(caseId, profile as string);

      if (!contextFile) {
        return res.status(404).json({ error: 'not_found', message: 'Context not available' });
      }

      if (format === 'text') {
        res.type('text/plain').send(contextFile.content);
      } else {
        res.json(contextFile);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Word AI context error', { error: message });
      res.status(500).json({ error: 'fetch_error', message });
    }
  }
);

/**
 * GET /api/ai/word/context/:caseId/version
 * Get context version for change detection
 */
wordAIRouter.get(
  '/context/:caseId/version',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { caseId } = req.params;
      const version = await caseContextFileService.getVersion(caseId);
      res.json(version);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Word AI context version error', { error: message });
      res.status(500).json({ error: 'fetch_error', message });
    }
  }
);

// ============================================================================
// Case & Document Lookup Endpoints
// ============================================================================

/**
 * GET /api/ai/word/cases
 * Get user's active cases for the case selector in Word add-in
 */
wordAIRouter.get('/cases', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cases = await prisma.case.findMany({
      where: {
        firmId: req.sessionUser!.firmId,
        status: { in: ['Active', 'OnHold', 'PendingApproval'] },
      },
      select: {
        id: true,
        title: true,
        caseNumber: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    res.json({ cases });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Word AI cases error', { error: message });
    res.status(500).json({ error: 'fetch_error', message });
  }
});

/**
 * GET /api/ai/word/clients
 * Get user's active clients for the client selector in Word add-in
 */
wordAIRouter.get('/clients', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clients = await prisma.client.findMany({
      where: {
        firmId: req.sessionUser!.firmId,
      },
      select: {
        id: true,
        name: true,
        clientType: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    // Map clientType to type for frontend compatibility
    const mappedClients = clients.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.clientType === 'individual' ? 'Individual' : 'Company',
    }));

    res.json({ clients: mappedClients });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Word AI clients error', { error: message });
    res.status(500).json({ error: 'fetch_error', message });
  }
});

/**
 * GET /api/ai/word/lookup-case
 * Lookup which case a document belongs to by SharePoint/OneDrive URL or path
 * Query params: url (SharePoint URL) or path (document path)
 */
wordAIRouter.get('/lookup-case', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url, path } = req.query;

    if (!url && !path) {
      return res.status(400).json({ error: 'bad_request', message: 'url or path required' });
    }

    let document = null;

    // Try to find document by SharePoint URL
    if (url && typeof url === 'string') {
      // Extract SharePoint item ID from URL if present
      // URLs look like: https://tenant.sharepoint.com/:w:/r/sites/.../_layouts/15/Doc.aspx?sourcedoc=...
      // Or direct: https://tenant.sharepoint.com/sites/.../Documents/file.docx

      // Try matching by SharePoint path
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/sites\/[^/]+\/Shared Documents\/(.+)/i);

      if (pathMatch) {
        document = await prisma.document.findFirst({
          where: {
            firmId: req.sessionUser!.firmId,
            sharePointPath: { contains: pathMatch[1] },
          },
          include: {
            caseLinks: {
              include: {
                case: { select: { id: true, title: true, caseNumber: true } },
              },
              take: 1,
            },
          },
        });
      }
    }

    // Try to find document by path/filename
    if (!document && path && typeof path === 'string') {
      const fileName = path.split('/').pop() || path;

      document = await prisma.document.findFirst({
        where: {
          firmId: req.sessionUser!.firmId,
          fileName: { equals: fileName, mode: 'insensitive' },
        },
        include: {
          caseLinks: {
            include: {
              case: { select: { id: true, title: true, caseNumber: true } },
            },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (!document || document.caseLinks.length === 0) {
      return res.json({ case: null });
    }

    res.json({ case: document.caseLinks[0].case });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Word AI lookup-case error', { error: message });
    res.status(500).json({ error: 'fetch_error', message });
  }
});
