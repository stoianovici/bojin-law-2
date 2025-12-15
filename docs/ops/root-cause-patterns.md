# Root Cause Pattern Library

> Quick-reference patterns extracted from 24 resolved issues. Check these BEFORE deep investigation.

## Quick Sanity Checks (Do First)

Before diving into code, answer these questions:

| Layer        | Check                     | Command/Action                   |
| ------------ | ------------------------- | -------------------------------- |
| **DB**       | Does the data exist?      | Prisma query or `SELECT`         |
| **API**      | Does GraphQL return it?   | Test query in playground         |
| **Frontend** | Does component fetch it?  | Check Network tab                |
| **Frontend** | Does component render it? | Check for hardcoded `[]` or stub |

---

## Pattern Categories

### 1. "X Not Appearing in UI"

**Most common root causes (check in order):**

| #   | Cause                            | Example                                 | Check                                 |
| --- | -------------------------------- | --------------------------------------- | ------------------------------------- |
| 1   | **Component never fetches data** | `documents: []` hardcoded               | Search component for hardcoded arrays |
| 2   | **Missing link table records**   | CaseDocument links missing              | Check join tables                     |
| 3   | **Resolver not registered**      | emailResolvers not merged               | Check GraphQL server.ts               |
| 4   | **Field name mismatch**          | `sentAt` vs `sentDate`                  | Compare schema to component props     |
| 5   | **Filter hides data**            | `emailViewMode: 'received'` filters all | Check filter defaults + localStorage  |

**Real examples:**

- OPS-024: DocumentsTab had `documents: []` hardcoded (13 sessions!)
- OPS-010: emailViewMode defaulted to 'received', filtered all emails
- OPS-001: emailResolvers not imported in server.ts

---

### 2. "X Works Locally, Fails in Production"

| #   | Cause                       | Example                     | Check                                   |
| --- | --------------------------- | --------------------------- | --------------------------------------- |
| 1   | **Env var not set**         | `REDIS_URL` missing         | Compare .env files to Render env vars   |
| 2   | **DB migration not run**    | `isIgnored` column missing  | Check if Prisma schema matches prod DB  |
| 3   | **Dependencies in devDeps** | `@prisma/client` in devDeps | Check package.json deps vs devDeps      |
| 4   | **Pre-built dist/ in git**  | TypeScript fix not compiled | Check Dockerfile compiles at build time |
| 5   | **Different runtime**       | Node vs Docker              | Check Render runtime settings           |

**Real examples:**

- OPS-018: @prisma/client in devDependencies, not installed in production
- OPS-010: isIgnored column missing from prod DB (migration not run)
- OPS-001: Redis URL passed incorrectly to ioredis constructor

---

### 3. "Auth/Token Issues"

| #   | Cause                             | Example                         | Check                             |
| --- | --------------------------------- | ------------------------------- | --------------------------------- |
| 1   | **Token not passed to backend**   | MS token missing in context     | Check headers in apollo-client.ts |
| 2   | **Token cache location**          | sessionStorage clears on close  | Check MSAL cacheLocation          |
| 3   | **Missing scopes**                | `Mail.Read` not in loginRequest | Check MSAL scopes                 |
| 4   | **Backend rejects valid session** | Missing MS token = full 401     | Check error code granularity      |

**Real examples:**

- OPS-009: MSAL cacheLocation was sessionStorage (lost on browser close)
- OPS-001: MS access token not forwarded through GraphQL context

---

### 4. "TypeScript/Build Errors"

| #   | Cause                    | Example                        | Check                             |
| --- | ------------------------ | ------------------------------ | --------------------------------- |
| 1   | **Prisma field renames** | `sentAt` → `sentDateTime`      | Compare Prisma schema to code     |
| 2   | **Type drift**           | Zod schema vs actual usage     | Check inferred types              |
| 3   | **Missing enum values**  | AIOperationType missing entry  | Check enum definitions            |
| 4   | **tsc flags**            | `--build` needed for composite | Check tsconfig and build commands |

**Real examples:**

- OPS-017: 76 errors from Prisma field renames across 15 files
- OPS-013: `tsc` didn't emit files, needed `tsc --build --force`

---

### 5. "API/Integration Issues"

| #   | Cause                          | Example                          | Check                               |
| --- | ------------------------------ | -------------------------------- | ----------------------------------- |
| 1   | **Library API mismatch**       | authProvider expects callback    | Check library version + docs        |
| 2   | **Pagination URL handling**    | nextLink includes `/v1.0` prefix | Check URL construction              |
| 3   | **Null in non-nullable field** | conversationId: String! but null | Make field nullable or add fallback |

**Real examples:**

- OPS-001: MS Graph SDK v3 authProvider changed to callback pattern
- OPS-001: nextLink URL already had /v1.0, client added it again

---

### 6. "Stub/Mock Code in Production"

| #   | Cause                          | Example                        | Check                               |
| --- | ------------------------------ | ------------------------------ | ----------------------------------- |
| 1   | **API returns mock data**      | `/api/users/pending` hardcoded | Check API route implementation      |
| 2   | **Component uses local state** | ExtractedItemsSidebar mock     | Check if GraphQL hook is used       |
| 3   | **Placeholder text**           | "va fi implementată"           | Search for TODO/placeholder strings |

**Real examples:**

- OPS-013: /api/users/pending returned hardcoded November 2024 data
- OPS-005: AIDraftResponsePanel was complete stub with TODO comments

---

## Investigation Strategy

### Step 1: Layer Identification (2 min)

```
Is data in DB? ──No──→ Backend bug (service/migration)
      │
     Yes
      ↓
Does API return it? ──No──→ Resolver/schema bug
      │
     Yes
      ↓
Does Network tab show it? ──No──→ Apollo/fetch bug
      │
     Yes
      ↓
Frontend rendering bug (component/state)
```

### Step 2: Pattern Matching (1 min)

Read symptom → Check matching patterns above → Test most likely first

### Step 3: Parallel Verification

If uncertain, test multiple hypotheses in parallel:

- Agent 1: Check backend (DB + API layer)
- Agent 2: Check frontend (component + state)
- Agent 3: Check integration (auth + env vars)

---

## Adding New Patterns

When resolving an issue, if the root cause doesn't match existing patterns:

1. Identify the category (or create new one)
2. Add row to appropriate table
3. Include real OPS-XXX reference

Format:

```markdown
| # | **Short cause** | Example from codebase | How to check |
```
