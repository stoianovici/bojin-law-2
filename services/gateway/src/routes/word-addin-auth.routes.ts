/**
 * Word Add-in Authentication Routes
 *
 * Server-side token storage for Word Add-in authentication.
 * This bypasses Office dialog messaging restrictions by:
 * 1. Storing tokens server-side with a session ID
 * 2. Letting the taskpane poll for the token
 */

import { Router, Request, Response } from 'express';

const router = Router();

// In-memory token store (sessions expire after 5 minutes)
const tokenStore = new Map<string, { token: string; account: any; expiresAt: number }>();

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of tokenStore.entries()) {
    if (data.expiresAt < now) {
      tokenStore.delete(sessionId);
    }
  }
}, 60000); // Check every minute

/**
 * POST /api/word-addin/auth/store
 * Store access token from auth dialog
 */
router.post('/store', async (req: Request, res: Response) => {
  console.log('[Word Add-in Auth] ========== STORE REQUEST ==========');
  console.log('[Word Add-in Auth] Headers:', JSON.stringify(req.headers, null, 2));
  console.log(
    '[Word Add-in Auth] Body:',
    JSON.stringify({
      ...req.body,
      accessToken: req.body.accessToken ? `[${req.body.accessToken.length} chars]` : 'missing',
    })
  );

  try {
    const { sessionId, accessToken, account } = req.body;

    if (!sessionId || !accessToken) {
      console.error(
        '[Word Add-in Auth] Missing required fields - sessionId:',
        !!sessionId,
        'accessToken:',
        !!accessToken
      );
      return res.status(400).json({ error: 'Missing sessionId or accessToken' });
    }

    console.log('[Word Add-in Auth] Storing token for session:', sessionId);
    console.log('[Word Add-in Auth] Token length:', accessToken.length);
    console.log('[Word Add-in Auth] Account:', JSON.stringify(account));

    // Store token with 5-minute expiry
    tokenStore.set(sessionId, {
      token: accessToken,
      account: account || {},
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    console.log('[Word Add-in Auth] Token stored successfully. Store size:', tokenStore.size);
    return res.json({ success: true });
  } catch (error) {
    console.error('[Word Add-in Auth] Token storage failed:', error);
    return res.status(500).json({
      error: 'Token storage failed',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/word-addin/auth/poll/:sessionId
 * Poll for token by session ID
 */
router.get('/poll/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  console.log('[Word Add-in Auth] Poll request for session:', sessionId);
  console.log('[Word Add-in Auth] Current store keys:', Array.from(tokenStore.keys()));

  const data = tokenStore.get(sessionId);

  if (!data) {
    console.log('[Word Add-in Auth] Session not found, returning ready: false');
    return res.json({ ready: false });
  }

  console.log('[Word Add-in Auth] Session found! Returning token');

  // Remove from store after retrieval (one-time use)
  tokenStore.delete(sessionId);

  return res.json({
    ready: true,
    accessToken: data.token,
    account: data.account,
  });
});

export { router as wordAddinAuthRouter };
