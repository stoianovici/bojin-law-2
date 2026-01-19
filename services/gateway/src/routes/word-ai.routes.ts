/**
 * Word AI Routes
 * REST API endpoints for Word add-in AI features
 */

import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { wordAIService } from '../services/word-ai.service';
import { wordTemplateService } from '../services/word-template.service';
import { caseContextFileService } from '../services/case-context-file.service';
import { sharePointService } from '../services/sharepoint.service';
import { AuthService } from '../services/auth.service';
import { prisma } from '@legal-platform/database';
import logger from '../utils/logger';
import { injectDocxCustomProperties } from '../utils/docx-properties';

const authService = new AuthService();

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
      enableWebSearch = false,
      includeOoxml = true,
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
      {
        contextType,
        caseId,
        clientId,
        documentName,
        prompt,
        existingContent,
        enableWebSearch,
        includeOoxml,
      },
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
        enableWebSearch = false,
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
      // Sends SSE comment (: ping) every 5 seconds - comments are ignored by SSE clients
      // but keep the connection alive through proxies, tunnels, and load balancers
      // Using 5s interval for better compatibility with Cloudflare tunnel
      const keepaliveInterval = setInterval(() => {
        try {
          res.write(`: keepalive ${Date.now()}\n\n`);
        } catch {
          // Connection may have closed
          clearInterval(keepaliveInterval);
        }
      }, 5000);

      // Clean up keepalive on client disconnect
      req.on('close', () => {
        clearInterval(keepaliveInterval);
      });

      try {
        const result = await wordAIService.draftStream(
          { contextType, caseId, clientId, documentName, prompt, existingContent, enableWebSearch },
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
          contentLength: result.content?.length ?? 0,
          writable: res.writable,
        });

        // Send completion event with metadata only
        // OOXML is fetched separately via REST endpoint to avoid SSE chunking issues
        if (res.writable) {
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
 * POST /api/ai/word/ooxml
 * Convert HTML or markdown content to OOXML fragment for Word insertion
 * Used after streaming to fetch formatted content via REST (avoids SSE chunking issues)
 *
 * Accepts either:
 * - { html: string } - HTML content (preferred for research documents)
 * - { markdown: string } - Markdown content (legacy, for contracts)
 *
 * Options:
 * - { includeTableOfContents: boolean } - Include TOC at beginning (default: true for html)
 */
wordAIRouter.post('/ooxml', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { html, markdown, includeTableOfContents } = req.body;

    if (!html && !markdown) {
      return res
        .status(400)
        .json({ error: 'bad_request', message: 'html or markdown content is required' });
    }

    let ooxmlContent: string;

    if (html && typeof html === 'string') {
      // DEBUG: Save raw HTML and OOXML to files for inspection
      const fs = await import('fs/promises');
      const path = await import('path');
      const debugDir = path.join(process.cwd(), 'debug-output');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      try {
        await fs.mkdir(debugDir, { recursive: true });
        await fs.writeFile(path.join(debugDir, `html-input-${timestamp}.html`), html);
        logger.info('Saved raw HTML to debug file', {
          path: path.join(debugDir, `html-input-${timestamp}.html`),
        });
      } catch (e) {
        logger.warn('Could not save debug HTML file', { error: String(e) });
      }

      // Try HTML-to-OOXML converter first
      const { htmlToOoxmlService } = await import('../services/html-to-ooxml.service');
      // Default to including TOC for HTML content (research documents)
      const includeToc = includeTableOfContents !== false;
      const result = htmlToOoxmlService.convertWithMetadata(html, {
        includeTableOfContents: includeToc,
      });

      logger.info('HTML-to-OOXML conversion result', {
        inputLength: html.length,
        paragraphCount: result.paragraphCount,
        hasContent: result.hasContent,
        hasHeadings: result.hasHeadings,
        includeToc,
      });

      // DEBUG: Save OOXML output to file for inspection
      try {
        await fs.writeFile(path.join(debugDir, `ooxml-output-${timestamp}.xml`), result.ooxml);
        logger.info('Saved OOXML to debug file', {
          path: path.join(debugDir, `ooxml-output-${timestamp}.xml`),
        });
      } catch (e) {
        logger.warn('Could not save debug OOXML file', { error: String(e) });
      }

      if (result.hasContent) {
        // HTML conversion succeeded with content
        ooxmlContent = result.ooxml;
      } else {
        // No HTML elements found - content is likely markdown
        // Fall back to markdown converter
        logger.info('HTML conversion produced no content, falling back to markdown converter');
        const { docxGeneratorService } = await import('../services/docx-generator.service');
        ooxmlContent = docxGeneratorService.markdownToOoxmlFragment(html);
      }
    } else if (markdown && typeof markdown === 'string') {
      // Explicit markdown request - use markdown converter
      const { docxGeneratorService } = await import('../services/docx-generator.service');
      ooxmlContent = docxGeneratorService.markdownToOoxmlFragment(markdown);
    } else {
      return res.status(400).json({ error: 'bad_request', message: 'content must be a string' });
    }

    res.json({ ooxmlContent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Word AI ooxml conversion error', { error: message });
    res.status(500).json({ error: 'conversion_error', message });
  }
});

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
// Test Endpoints (Development Only)
// ============================================================================

/**
 * POST /api/ai/word/test/multi-agent
 * Test endpoint for multi-agent research flow (dev only, no auth required)
 *
 * Example usage:
 * curl -X POST http://localhost:4000/api/ai/word/test/multi-agent \
 *   -H "Content-Type: application/json" \
 *   -d '{"prompt": "10 pagini despre executarea silită", "documentName": "Test Research"}'
 */
wordAIRouter.post('/test/multi-agent', async (req: Request, res: Response) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res
      .status(403)
      .json({ error: 'forbidden', message: 'Test endpoints disabled in production' });
  }

  try {
    const { prompt, documentName = 'Test Research Document', includeOoxml = false } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'bad_request', message: 'prompt is required' });
    }

    // Use hardcoded dev values
    const userId = 'dev-test-user';
    const firmId = '51f2f797-3109-4b79-ac43-a57ecc07bb06';

    logger.info('Starting multi-agent test', { prompt: prompt.substring(0, 100), documentName });

    const result = await wordAIService.draft(
      {
        contextType: 'internal',
        documentName,
        prompt,
        enableWebSearch: true,
        useMultiAgent: true,
        includeOoxml,
      },
      userId,
      firmId
    );

    logger.info('Multi-agent test completed', {
      tokensUsed: result.tokensUsed,
      processingTimeMs: result.processingTimeMs,
      contentLength: result.content.length,
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error('Multi-agent test error', { error: message, stack });
    res.status(500).json({
      error: 'ai_error',
      message,
      stack: process.env.NODE_ENV !== 'production' ? stack : undefined,
    });
  }
});

/**
 * POST /api/ai/word/test/multi-agent/stream
 * Test endpoint for multi-agent research flow with SSE streaming (dev only)
 *
 * Example usage:
 * curl -N -X POST http://localhost:4000/api/ai/word/test/multi-agent/stream \
 *   -H "Content-Type: application/json" \
 *   -d '{"prompt": "5 pagini despre rezoluțiunea contractelor", "documentName": "Test Research"}'
 */
wordAIRouter.post('/test/multi-agent/stream', async (req: Request, res: Response) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res
      .status(403)
      .json({ error: 'forbidden', message: 'Test endpoints disabled in production' });
  }

  try {
    const { prompt, documentName = 'Test Research Document' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'bad_request', message: 'prompt is required' });
    }

    // Use hardcoded dev values
    const userId = 'dev-test-user';
    const firmId = '51f2f797-3109-4b79-ac43-a57ecc07bb06';

    logger.info('Starting multi-agent stream test', {
      prompt: prompt.substring(0, 100),
      documentName,
    });

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    res.write(`event: start\ndata: {"status":"started"}\n\n`);

    const result = await wordAIService.draftStream(
      {
        contextType: 'internal',
        documentName,
        prompt,
        enableWebSearch: true,
        useMultiAgent: true,
      },
      userId,
      firmId,
      (chunk: string) => {
        res.write(`event: chunk\ndata: ${JSON.stringify(chunk)}\n\n`);
      },
      (progressEvent) => {
        res.write(`event: progress\ndata: ${JSON.stringify(progressEvent)}\n\n`);
      }
    );

    logger.info('Multi-agent stream test completed', {
      tokensUsed: result.tokensUsed,
      processingTimeMs: result.processingTimeMs,
    });

    res.write(
      `event: done\ndata: ${JSON.stringify({
        title: result.title,
        tokensUsed: result.tokensUsed,
        processingTimeMs: result.processingTimeMs,
      })}\n\n`
    );

    res.end();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Multi-agent stream test error', { error: message });

    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: 'ai_error', message });
    }
  }
});

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
      try {
        const urlObj = new URL(url);

        // Method 1: Word Online URL with file query param
        // URLs look like: https://tenant.sharepoint.com/:w:/r/sites/.../_layouts/15/Doc.aspx?sourcedoc=...&file=filename.docx
        const fileParam = urlObj.searchParams.get('file');
        if (fileParam && !document) {
          const fileName = decodeURIComponent(fileParam);
          // SharePoint converts spaces to underscores in URLs, try both variants
          const fileNameWithSpaces = fileName.replace(/_/g, ' ');
          const fileNameWithUnderscores = fileName.replace(/ /g, '_');
          logger.info('Lookup by file param', {
            fileName,
            fileNameWithSpaces,
            fileNameWithUnderscores,
          });
          document = await prisma.document.findFirst({
            where: {
              firmId: req.sessionUser!.firmId,
              OR: [
                { fileName: { equals: fileName, mode: 'insensitive' } },
                { fileName: { equals: fileNameWithSpaces, mode: 'insensitive' } },
                { fileName: { equals: fileNameWithUnderscores, mode: 'insensitive' } },
              ],
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

        // Method 2: Direct SharePoint URL with path
        // URLs like: https://tenant.sharepoint.com/sites/.../Shared Documents/file.docx
        if (!document) {
          const pathMatch = urlObj.pathname.match(/\/sites\/[^/]+\/Shared Documents\/(.+)/i);
          if (pathMatch) {
            logger.info('Lookup by SharePoint path', { path: pathMatch[1] });
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

        // Method 3: sourcedoc GUID - search in sharePointPath URL which contains the sourcedoc
        const sourcedocParam = urlObj.searchParams.get('sourcedoc');
        if (sourcedocParam && !document) {
          // sourcedoc is a GUID like {A3A3D979-6680-4F72-81B3-9D8C6E4B46DB} or URL-encoded
          // The sharePointPath contains the full URL with sourcedoc embedded
          logger.info('Lookup by sourcedoc in sharePointPath', { sourcedoc: sourcedocParam });
          document = await prisma.document.findFirst({
            where: {
              firmId: req.sessionUser!.firmId,
              sharePointPath: { contains: sourcedocParam, mode: 'insensitive' },
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
      } catch (urlError) {
        logger.warn('Failed to parse URL for lookup', { url, error: urlError });
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

    if (!document) {
      return res.json({ case: null, client: null, document: null });
    }

    // Get case info if linked to a case
    const caseLink = document.caseLinks?.[0];
    const caseInfo = caseLink?.case || null;

    // Get client info (either from case link or directly from document)
    let clientInfo = null;
    if (document.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: document.clientId },
        select: { id: true, name: true },
      });
      clientInfo = client;
    }

    // Return document, case, and client info
    res.json({
      case: caseInfo,
      client: clientInfo,
      document: {
        id: document.id,
        fileName: document.fileName,
        sharePointPath: document.sharePointPath,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Word AI lookup-case error', { error: message });
    res.status(500).json({ error: 'fetch_error', message });
  }
});

// ============================================================================
// Document Save to Platform
// ============================================================================

/**
 * POST /api/ai/word/save-to-case
 * Save the current Word document to the platform (SharePoint) and link to a case
 *
 * Body:
 * - caseId?: string - The case to link the document to (required for new documents, optional for updates)
 * - fileName: string - Name of the document
 * - fileContent: string - Base64 encoded document content (.docx)
 * - documentId?: string - If provided, updates this specific document (edit mode)
 * - generationMetadata?: { tokensUsed, processingTimeMs } - Optional AI generation info
 */
wordAIRouter.post(
  '/save-to-case',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { caseId, fileName, fileContent, documentId, generationMetadata } = req.body;

      // Validate required fields
      if (!fileName || !fileContent) {
        return res.status(400).json({
          error: 'bad_request',
          message: 'fileName and fileContent are required',
        });
      }

      // For new documents, caseId is required. For updates, we can get context from existing document.
      if (!documentId && !caseId) {
        return res.status(400).json({
          error: 'bad_request',
          message: 'caseId is required for new documents',
        });
      }

      // Get case details if caseId provided
      let caseData: { id: string; caseNumber: string; clientId: string; title: string } | null =
        null;
      if (caseId) {
        caseData = await prisma.case.findFirst({
          where: {
            id: caseId,
            firmId: req.sessionUser!.firmId,
          },
          select: {
            id: true,
            caseNumber: true,
            clientId: true,
            title: true,
          },
        });

        if (!caseData) {
          return res.status(404).json({
            error: 'not_found',
            message: 'Case not found or access denied',
          });
        }
      }

      // Get Graph access token via OBO flow
      // The Bearer token from Word add-in is an Office SSO token that needs to be exchanged
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Bearer token required for SharePoint upload',
        });
      }

      const ssoToken = authHeader.slice(7);
      let graphAccessToken: string;

      try {
        const authResult = await authService.exchangeOfficeSsoToken(ssoToken);
        graphAccessToken = authResult.accessToken;
      } catch (tokenError) {
        logger.error('Failed to exchange Office SSO token', {
          error: tokenError instanceof Error ? tokenError.message : 'Unknown error',
        });
        return res.status(401).json({
          error: 'token_exchange_failed',
          message: 'Could not authenticate with SharePoint. Please sign in again.',
        });
      }

      // Decode base64 content to buffer
      let fileBuffer: Buffer = Buffer.from(fileContent, 'base64');
      const fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      // Ensure filename has .docx extension
      const normalizedFileName = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;

      let document;
      let isNewVersion = false;

      // If documentId provided, try to update existing or create with that ID
      if (documentId) {
        const targetDocument = await prisma.document.findFirst({
          where: {
            id: documentId,
            firmId: req.sessionUser!.firmId,
          },
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
            },
            caseLinks: {
              include: {
                case: { select: { id: true, caseNumber: true, clientId: true } },
              },
              take: 1,
            },
            client: { select: { id: true, name: true } },
          },
        });

        // If document doesn't exist with this ID, create a new one with the provided ID
        // This allows the client to pre-generate the ID and embed it in the file before upload
        if (!targetDocument) {
          // Fall through to new document creation logic, using provided documentId
          logger.info(
            'Document ID provided but not found - will create new document with this ID',
            {
              documentId,
              caseId,
            }
          );
        } else {
          // Update existing document
          isNewVersion = true;
          const nextVersionNumber = (targetDocument.versions[0]?.versionNumber || 0) + 1;

          // Get case info from document's existing link if not provided
          const docCaseLink = targetDocument.caseLinks[0];
          const effectiveCaseNumber = caseData?.caseNumber || docCaseLink?.case?.caseNumber;
          const effectiveCaseId = caseData?.id || docCaseLink?.case?.id;

          // Inject custom properties into the document for add-in context detection
          fileBuffer = await injectDocxCustomProperties(fileBuffer, {
            _platformDocumentId: targetDocument.id,
            _platformCaseId: effectiveCaseId || '',
            _platformCaseNumber: effectiveCaseNumber || '',
            _platformFileName: targetDocument.fileName,
          });
          const fileSize = fileBuffer.length;

          // Determine upload path - use case folder if available, otherwise client folder
          let spItem;
          if (effectiveCaseNumber) {
            // Upload to case folder
            spItem = await sharePointService.uploadDocument(
              graphAccessToken,
              effectiveCaseNumber,
              targetDocument.fileName,
              fileBuffer,
              fileType
            );
          } else if (targetDocument.client) {
            // Upload to client inbox folder
            spItem = await sharePointService.uploadDocumentToClientFolder(
              graphAccessToken,
              targetDocument.client.name,
              targetDocument.fileName,
              fileBuffer,
              fileType
            );
          } else {
            return res.status(400).json({
              error: 'no_upload_target',
              message: 'Document has no case or client context for upload',
            });
          }

          // Update document record
          document = await prisma.$transaction(async (tx) => {
            const updatedDoc = await tx.document.update({
              where: { id: targetDocument.id },
              data: {
                fileSize,
                sharePointItemId: spItem.id,
                sharePointPath: spItem.webUrl,
                sharePointLastModified: new Date(),
              },
            });

            await tx.documentVersion.create({
              data: {
                documentId: targetDocument.id,
                versionNumber: nextVersionNumber,
                changesSummary: 'Updated from Word Add-in',
                createdBy: req.sessionUser!.userId,
              },
            });

            return updatedDoc;
          });

          logger.info('Document updated directly by ID', {
            documentId: document.id,
            caseId: effectiveCaseId,
            clientId: targetDocument.clientId,
            fileName: targetDocument.fileName,
            versionNumber: nextVersionNumber,
          });

          return res.json({
            success: true,
            documentId: document.id,
            fileName: targetDocument.fileName,
            isNewVersion,
            sharePointUrl: document.sharePointPath,
            caseNumber: effectiveCaseNumber || null,
          });
        }
      }

      // Check if document with same name already exists for this case
      const existingDocument = await prisma.document.findFirst({
        where: {
          firmId: req.sessionUser!.firmId,
          fileName: normalizedFileName,
          caseLinks: {
            some: { caseId: caseId },
          },
        },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
          },
        },
      });

      if (existingDocument) {
        // Document exists - create new version
        isNewVersion = true;
        const nextVersionNumber = (existingDocument.versions[0]?.versionNumber || 0) + 1;

        // Inject custom properties into the document
        fileBuffer = await injectDocxCustomProperties(fileBuffer, {
          _platformDocumentId: existingDocument.id,
          _platformCaseId: caseId,
          _platformCaseNumber: caseData.caseNumber,
          _platformFileName: normalizedFileName,
        });
        const fileSize = fileBuffer.length;

        // Upload to SharePoint (will overwrite existing file)
        const spItem = await sharePointService.uploadDocument(
          graphAccessToken,
          caseData.caseNumber,
          normalizedFileName,
          fileBuffer,
          fileType
        );

        // Update document record
        document = await prisma.$transaction(async (tx) => {
          // Update document metadata
          const updatedDoc = await tx.document.update({
            where: { id: existingDocument.id },
            data: {
              fileSize,
              sharePointItemId: spItem.id,
              sharePointPath: spItem.webUrl,
              sharePointLastModified: new Date(),
            },
          });

          // Create new version
          await tx.documentVersion.create({
            data: {
              documentId: existingDocument.id,
              versionNumber: nextVersionNumber,
              changesSummary: generationMetadata
                ? `AI-generated update (${generationMetadata.tokensUsed} tokens)`
                : 'Updated from Word Add-in',
              createdBy: req.sessionUser!.userId,
            },
          });

          return updatedDoc;
        });

        logger.info('Document updated with new version', {
          documentId: document.id,
          caseId,
          fileName: normalizedFileName,
          versionNumber: nextVersionNumber,
        });
      } else {
        // New document - use client-provided ID or generate one
        // Client pre-generates ID to embed properties before upload
        const newDocumentId = documentId || randomUUID();

        // Inject custom properties into the document
        fileBuffer = await injectDocxCustomProperties(fileBuffer, {
          _platformDocumentId: newDocumentId,
          _platformCaseId: caseId,
          _platformCaseNumber: caseData.caseNumber,
          _platformFileName: normalizedFileName,
        });

        const fileSize = fileBuffer.length;

        // Upload to SharePoint with embedded properties
        const spItem = await sharePointService.uploadDocument(
          graphAccessToken,
          caseData.caseNumber,
          normalizedFileName,
          fileBuffer,
          fileType
        );

        logger.info('Document uploaded to SharePoint', {
          caseId,
          caseNumber: caseData.caseNumber,
          fileName: normalizedFileName,
          sharePointId: spItem.id,
          webUrl: spItem.webUrl,
        });

        // Create document record in database with the pre-generated ID
        document = await prisma.$transaction(async (tx) => {
          // Create the document with specific ID
          const newDocument = await tx.document.create({
            data: {
              id: newDocumentId,
              clientId: caseData.clientId,
              firmId: req.sessionUser!.firmId,
              fileName: normalizedFileName,
              fileType,
              fileSize,
              storagePath: spItem.parentPath + '/' + spItem.name,
              uploadedBy: req.sessionUser!.userId,
              uploadedAt: new Date(),
              sharePointItemId: spItem.id,
              sharePointPath: spItem.webUrl,
              status: 'DRAFT',
              sourceType: 'AI_GENERATED',
              metadata: {
                title: normalizedFileName.replace(/\.docx$/i, ''),
                sharePointWebUrl: spItem.webUrl,
                ...(generationMetadata && {
                  aiGeneration: {
                    tokensUsed: generationMetadata.tokensUsed,
                    processingTimeMs: generationMetadata.processingTimeMs,
                    generatedAt: new Date().toISOString(),
                  },
                }),
              },
            },
          });

          // Create case-document link
          await tx.caseDocument.create({
            data: {
              caseId,
              documentId: newDocument.id,
              linkedBy: req.sessionUser!.userId,
              linkedAt: new Date(),
              isOriginal: true,
              firmId: req.sessionUser!.firmId,
            },
          });

          // Create initial version
          await tx.documentVersion.create({
            data: {
              documentId: newDocument.id,
              versionNumber: 1,
              changesSummary: generationMetadata
                ? `AI-generated document (${generationMetadata.tokensUsed} tokens)`
                : 'Created from Word Add-in',
              createdBy: req.sessionUser!.userId,
            },
          });

          return newDocument;
        });

        logger.info('New document created', {
          documentId: document.id,
          caseId,
          fileName: normalizedFileName,
        });
      }

      res.json({
        success: true,
        documentId: document.id,
        fileName: normalizedFileName,
        isNewVersion,
        sharePointUrl: document.sharePointPath,
        caseNumber: caseData.caseNumber,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Word AI save-to-case error', { error: message });
      res.status(500).json({ error: 'save_error', message });
    }
  }
);
