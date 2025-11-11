# Security and Performance

## Security Requirements

**Frontend Security:**
- CSP Headers: Strict content security policy with specific allowlists
- XSS Prevention: React's built-in escaping + DOMPurify for user content
- Secure Storage: httpOnly cookies for tokens, sessionStorage for non-sensitive data

**Backend Security:**
- Input Validation: Zod schemas for all API inputs
- Rate Limiting: 100 req/min general, 10 req/min for AI operations
- CORS Policy: Strict origin whitelist for production
- SQL Injection Prevention: Parameterized queries via Prisma

**Authentication Security:**
- Token Storage: Access tokens in memory, refresh in httpOnly cookies
- Session Management: 30-minute access token, 7-day refresh token
- Password Policy: Azure AD enforced - min 12 chars, complexity required
- MFA: Enforced via Azure AD conditional access

## Performance Optimization

**Frontend Performance:**
- Bundle Size Target: < 200KB initial JS (gzipped)
- Loading Strategy: Route-based code splitting, lazy loading
- Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1

**Backend Performance:**
- Response Time Target: p50 < 200ms, p95 < 1s, p99 < 2s
- Database Optimization: Connection pooling, DataLoader for N+1 prevention
- Caching Strategy: Redis for sessions, CDN for static assets
