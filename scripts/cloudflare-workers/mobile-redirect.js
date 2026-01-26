/**
 * Cloudflare Worker: Mobile Redirect
 *
 * Automatically redirects mobile users from app.bojin-law.com to m.bojin-law.com
 *
 * Deployment:
 * 1. Go to https://dash.cloudflare.com/workers
 * 2. Create new Worker named "mobile-redirect"
 * 3. Paste this code
 * 4. Add route: app.bojin-law.com/* -> mobile-redirect
 */

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const ua = request.headers.get('user-agent') || '';
  const url = new URL(request.url);

  // Mobile User-Agent detection
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  // Skip redirect for:
  // - API calls
  // - Static assets
  // - Already on mobile domain
  const shouldSkip =
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.includes('.') ||
    url.hostname === 'm.bojin-law.com';

  if (isMobile && !shouldSkip && url.hostname === 'app.bojin-law.com') {
    url.hostname = 'm.bojin-law.com';
    return Response.redirect(url.toString(), 302);
  }

  return fetch(request);
}
