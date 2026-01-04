# Brainstorm: Historical Email Sync for Cases

**Status**: Complete
**Date**: 2026-01-01
**Next step**: `/research brainstorm-historical-email-sync`

---

## Context

**Project**: bojin-law-ui (Next.js 16, TypeScript, GraphQL via Apollo)
**Backend**: bojin-law-2 monorepo (gateway at localhost:4000)
**Auth**: Azure MSAL (Microsoft 365)
**Current state**: Only newly received emails are synced. Historical threads are not pulled when cases are set up.

## Problem Statement

When a case is created or edited and a contact (especially a client) is associated, we need to sync historical email threads with that contact. Currently, users lose context from previous conversations that happened before the case was set up in the system.

## Decisions

### Core Approach: Background Queue with Progress (Option C)

When an email/contact is associated with a case, queue a background job to fetch historical emails. The UI shows sync progress in the case's Comms section. Non-blocking to case setup.

### Sync Rules by Contact Role

| Contact Role | Behavior                                                      |
| ------------ | ------------------------------------------------------------- |
| Client       | Full historical sync, automatic                               |
| Other roles  | Manual trigger, user specifies timeframe (future development) |

### Triggers

Sync is triggered when:

1. New case is created with client contact
2. Case is edited to add client contact
3. Email from "neclar" (unclear) queue is assigned to a case

### Technical Requirements

| Requirement    | Decision                                               |
| -------------- | ------------------------------------------------------ |
| Email provider | Microsoft 365 only (MS Graph API)                      |
| Volume         | Hundreds of emails max per sync                        |
| Deduplication  | Always - no duplicate emails regardless of sync source |
| UI feedback    | Case detail page → Comms section shows "Syncing..."    |
| Error handling | Auto-retry on failure (rate limits, auth issues)       |

### Open Architectural Question

**Multiple cases per client**: A client may have multiple cases over time. When Case B is created for a client who already has emails synced for Case A:

- Should emails be **shared/linked** across cases?
- Should emails **belong to the contact** with cases as a view/filter?
- Or should emails be **copied** per case?

This affects storage, deduplication, and query patterns. **Needs research.**

## Rationale

- **Background queue over eager sync**: Case setup shouldn't block on potentially slow email fetch
- **Auto-retry over manual**: Legal workflows shouldn't require users to babysit sync jobs
- **Client-only auto-sync**: Clients have the most valuable historical context; other roles have too many edge cases for v1
- **Progress in Comms section**: Natural place users will look for email history

## Open Questions for Research

1. **Current email sync implementation** - Where in bojin-law-2? How does it work?
2. **Data model** - How are cases, contacts, and emails related? Schema exploration needed.
3. **Existing job queue infrastructure** - Is there a background job system? What tech?
4. **"Neclar" queue implementation** - How does unclear email assignment work?
5. **MS Graph API patterns** - How is it currently used? Rate limits? Pagination?
6. **Email ownership model** - Do emails belong to contacts, cases, or both? How to handle multi-case clients?

## Next Step

Start a new session and run:

```
/research brainstorm-historical-email-sync
```
