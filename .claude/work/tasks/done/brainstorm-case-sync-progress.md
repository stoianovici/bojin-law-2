# Brainstorm: Case Sync Progress Indicator

**Status**: Complete
**Date**: 2026-01-04
**Next step**: `/research brainstorm-case-sync-progress`

---

## Problem Statement

When a user creates a new case, email and document syncing happens in the background. The case appears in lists immediately but with empty content, leaving users confused about whether sync is in progress or something is broken. We need visual feedback to reassure users that processing is underway.

## Decisions

> **IMPORTANT**: This section propagates unchanged through research → plan → implement.
> Be specific and complete. These are the requirements.

### Functional Decisions

| Decision | Details | Rationale |
|----------|---------|-----------|
| Show indeterminate progress bar | Animated stripe-style bar (not percentage-based) | Calms user without needing accurate progress tracking |
| Display in all case-related views | `/cases` list (card), `/emails` list, `/documents` list, case detail header | User should see sync status wherever they encounter the case |
| Auto-start sync on case creation | No manual trigger needed | Seamless UX, user expects it to "just work" |
| Run full processing pipeline | Email sync → attachment extraction → document triage → timeline building | All downstream processing should chain automatically |
| Inline error with retry | Show "Eroare sincronizare" message with retry button | User can take action without navigating elsewhere |

### Technical Decisions

| Decision | Details | Rationale |
|----------|---------|-----------|
| Add `syncStatus` field to Case | Enum: `PENDING`, `SYNCING`, `COMPLETED`, `FAILED` | Simple, queryable, no extra tables needed |
| Use polling for status updates | Frontend polls every ~5 seconds while status is `PENDING` or `SYNCING` | Simple to implement, good enough for "reassurance" UX goal |
| Stop polling when `COMPLETED` or `FAILED` | Only active cases poll | Avoid unnecessary load |

### UI Components

| Component | Location | Behavior |
|-----------|----------|----------|
| `CaseSyncProgress` | Inline in case cards/rows | Shows animated bar when syncing, error state with retry when failed |
| Progress bar style | Indeterminate (animated stripe) | Linear-inspired, subtle, not distracting |
| Romanian text | "Sincronizare în curs..." / "Eroare sincronizare" | Matches existing UI language |

### Out of Scope

- Detailed per-step progress (email vs documents vs summary)
- WebSocket/subscription-based real-time updates
- Sync job history/audit trail
- Manual sync trigger button (auto-start only)
- Notification when sync completes (inline status is sufficient)

### Open Questions for Research

- [ ] What is the current case creation flow? Where would sync get triggered?
- [ ] What backend jobs/services currently handle email sync and document processing?
- [ ] How are processing steps chained today (if at all)?
- [ ] Which GraphQL queries/mutations need to include `syncStatus`?
- [ ] Where is the Case model defined (Prisma schema)?

---

## Context Snapshot

- Platform: Legal case management for Romanian law firms
- Current branch: `feature/ui-redesign` with Linear-inspired dark theme
- Key views affected: `/cases`, `/emails`, `/documents`, case detail pages
- Design system: Linear-inspired with `bg-linear-*`, `text-linear-*` tokens
- Backend: GraphQL gateway with Prisma ORM, PostgreSQL

## Next Step

Start a new session and run:
`/research brainstorm-case-sync-progress`
