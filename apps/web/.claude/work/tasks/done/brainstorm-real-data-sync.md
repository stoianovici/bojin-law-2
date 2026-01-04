# Brainstorm: Real MS 365 Data Sync for Local Dev

**Status**: Complete
**Date**: 2024-12-31
**Next step**: `/research brainstorm-real-data-sync`

---

## Context

**Project**: bojin-law-ui (new Next.js 16 UI for Legal Platform V2)
**Location**: `~/Developer/bojin-law-ui`
**Related**: `~/Developer/bojin-law-2` (main monorepo with backend services)

**Tech Stack**:

- Next.js 16 (App Router), TypeScript, Tailwind CSS
- Apollo Client 4 (GraphQL) → connects to gateway at `localhost:4000/graphql`
- Azure MSAL Browser for auth
- Backend runs from bojin-law-2

**Current State**:

- New UI works but only shows seeded/mock data
- bojin-law-2 had a working setup where real MS 365 data synced locally
- User could test AI classification and case population with real emails/docs

**Desired State**:

- Local dev environment that mirrors production
- Real emails and documents sync from logged-in user's MS 365 account
- Can test if cases/docs get populated correctly (including AI classification)
- Local database only - production database stays isolated

---

## Problem Statement

Replicate the bojin-law-2 local development setup in bojin-law-ui so that:

1. User can log in with real MS 365 credentials
2. Real emails/documents sync from their account to local database
3. AI classification and case population can be tested with real data
4. The app behaves as a "perfect mirror" of production

---

## Decisions

| Decision                        | Rationale                                                           |
| ------------------------------- | ------------------------------------------------------------------- |
| Research bojin-law-2 first      | Understand existing sync infrastructure before building anything    |
| Reuse existing backend services | MS 365 sync already works in bojin-law-2, no need to rebuild        |
| Document the setup              | Create clear instructions for spinning up real-data dev environment |
| Local DB isolation              | Production data must stay isolated, use local DB for dev            |

---

## Approach

**Option B → A**: Research & Document, then Reuse

1. **Research bojin-law-2** to understand:
   - What services need to run for MS 365 sync
   - Environment variables and configuration required
   - MSAL/Azure AD app registration details
   - How local DB gets populated with real data
   - Any sync workers, queue processors, or background jobs

2. **Document the setup** clearly so it's reproducible

3. **Wire up bojin-law-ui** to the existing infrastructure

---

## Rationale

- bojin-law-2 already has working MS 365 integration - no need to rebuild
- Research first prevents guessing and ensures we understand the full picture
- Documentation helps future sessions and other developers
- This is configuration/wiring work, not new feature development

---

## Open Questions for Research

- [ ] What services in bojin-law-2 handle MS 365 sync? (service names, locations)
- [ ] What environment variables are needed for MS Graph integration?
- [ ] What is the MSAL/Azure AD configuration? (tenant, client ID, scopes)
- [ ] How does the sync process work? (triggers, scheduling, data flow)
- [ ] What database setup is needed locally? (migrations, seeding vs real data)
- [ ] Are there background workers or queue processors that need to run?
- [ ] What's the startup sequence for all required services?
- [ ] Does bojin-law-ui's current MSAL config match what's needed?

---

## Next Step

Start a new session and run:

```
/research brainstorm-real-data-sync
```

This will spawn parallel agents to investigate bojin-law-2 and answer the open questions above.
