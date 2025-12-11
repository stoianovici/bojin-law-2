# Handoff: [OPS-006] Connect AI capabilities to application UI

**Session**: 7
**Date**: 2025-12-10
**Status**: Investigating - Root cause found

## Work Completed This Session

### 1. Root Cause Analysis (COMPLETE)

Traced the full flow of `generateEmailDraft` mutation:

1. **Frontend** → ComposeInterface.tsx uses `useGenerateDraft` hook
2. **Hook** → Calls GraphQL mutation via Apollo Client
3. **Proxy** → `/api/graphql/route.ts` forwards to gateway with `x-mock-user` header
4. **Gateway** → Resolver finds email successfully, calls AI service
5. **AI Service** → Fails with "Anthropic API key not found"

### 2. Issues Found

**Issue 1: Port Conflict (Local Dev)**

- word-addin configured for port 3001
- When legacy-import is running on 3001, word-addin falls back to 3002
- AI service also uses port 3002
- Result: gateway's fetch to AI service fails

**Fix Applied**: Changed word-addin port from 3001 to 3005 in `apps/word-addin/vite.config.ts`

**Issue 2: Missing Anthropic API Key**

- AI service at `/api/email-drafting/generate` returns: `{"error":"Anthropic API key not found"}`
- Local `.env` has placeholder: `ANTHROPIC_API_KEY=placeholder-not-needed-for-basic-testing`
- Production needs `ANTHROPIC_API_KEY` set in Render environment variables

**Issue 3: Gateway Error Handling**

- When AI service returns an error, gateway returns the error in GraphQL response
- Frontend correctly receives error, but error message not shown to user
- This is working as designed - the error IS being propagated

## Current State

The mutation flow is now traced and understood:

1. Email lookup: WORKING (confirmed in gateway logs)
2. AI service call: FAILING (missing API key)
3. Error propagation: WORKING (GraphQL error returned)

**Test Proof:**

```bash
# AI service returns proper error:
curl -X POST http://127.0.0.1:3002/api/email-drafting/generate -H 'Content-Type: application/json' -H 'Authorization: Bearer dev-api-key' -d '{"originalEmail":{...},"firmId":"test","userId":"test"}'
# Returns: {"error":"Internal Server Error","message":"Anthropic API key not found"}
```

## Next Steps for Production

1. **Verify Render Environment Variables**:
   - AI Service needs: `ANTHROPIC_API_KEY` (real Anthropic key)
   - Gateway needs: `AI_SERVICE_URL` (internal URL to AI service)

2. **Check AI Service on Render**:
   - Is it running?
   - What's in its environment?
   - Is the endpoint responding?

3. **Test Production AI Service**:
   - If `AI_SERVICE_URL` is set, what does the gateway hit?
   - If not set, it defaults to localhost:3002 (wrong in production)

## Key Files Modified

| File                             | Changes                                          |
| -------------------------------- | ------------------------------------------------ |
| `apps/word-addin/vite.config.ts` | Changed port from 3001 to 3005 to avoid conflict |

## Key Files Reviewed

| File                                                                 | Purpose                                 |
| -------------------------------------------------------------------- | --------------------------------------- |
| `services/gateway/src/graphql/resolvers/email-drafting.resolvers.ts` | Gateway resolver - confirmed working    |
| `services/ai-service/src/routes/email-drafting.routes.ts`            | AI endpoint - confirmed needs API key   |
| `services/ai-service/src/index.ts`                                   | Routes mounted at `/api/email-drafting` |
| `apps/web/src/hooks/useEmailDraft.ts`                                | Frontend hook - confirmed working       |
| `apps/web/src/components/communication/ComposeInterface.tsx`         | UI component - confirmed working        |

## Port Assignments (Updated)

| Port | Service                      |
| ---- | ---------------------------- |
| 3000 | Web (Next.js)                |
| 3001 | Legacy Import (Next.js)      |
| 3002 | AI Service (Express)         |
| 3005 | Word Add-in (Vite) - CHANGED |
| 4000 | Gateway (Apollo)             |

## Environment Variables Needed

**AI Service (services/ai-service):**

```
ANTHROPIC_API_KEY=sk-ant-... (real key)
PORT=3002
```

**Gateway (services/gateway):**

```
AI_SERVICE_URL=http://ai-service-internal:3002 (or render internal URL)
AI_SERVICE_API_KEY=dev-api-key (or production key)
```

## Testing Commands

```bash
# Start dev environment (ports should now be clear)
pnpm dev

# Test AI service directly
curl http://localhost:3002/api/email-drafting/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-api-key" \
  -d '{"originalEmail":{...}}'

# Test gateway mutation
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "x-mock-user: {...}" \
  -d '{"query":"mutation { generateEmailDraft(...) { id body } }"}'
```
