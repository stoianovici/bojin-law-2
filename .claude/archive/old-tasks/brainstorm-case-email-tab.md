# Brainstorm: Case Email Tab

**Status**: Complete
**Date**: 2025-01-03
**Next step**: `/research brainstorm-case-email-tab`

---

## Problem Statement

The email tab in case details currently shows nothing because sync isn't connected. Users need to see all email threads related to a case's client and actors, with the ability to reply, add internal notes, and manage case associations.

## Decisions

> **IMPORTANT**: This section propagates unchanged through research → plan → implement.
> Be specific and complete. These are the requirements.

### Functional Decisions

| Decision                      | Details                                                                                               | Rationale                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Association by contact        | Emails linked to cases via matching participants (client email, actor emails)                         | Natural grouping without manual work                                     |
| Client-first with case filter | Default shows all threads with case client; dropdown to filter "This case only" or "All client cases" | Handles multi-case clients naturally, provides full relationship context |
| Thread view                   | Conversations grouped as threads (like Gmail), not flat message list                                  | Easier to follow conversation flow                                       |
| Sync frequency                | Every 1 minute from Microsoft Graph                                                                   | Near real-time without excessive API calls                               |
| Reply with AI assistance      | Composer opens with AI-drafted response based on thread context + case info                           | Core AI value-add for the platform                                       |
| Internal notes                | Team-only notes attached to thread, not sent externally                                               | Enables collaboration without client visibility                          |
| Link/unlink threads           | Move or copy thread to different case; unlink removes from current case but stays in client view      | Flexibility for mis-categorized or multi-case emails                     |

### Technical Decisions

| Decision            | Details                                                                 | Rationale                                                  |
| ------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| Microsoft Graph API | Use existing Graph integration for email retrieval                      | Already authenticated via Azure AD                         |
| Contact matching    | Match email addresses against case.client.email and case.actors[].email | Deterministic, no AI classification needed for association |

### Out of Scope

- Sending new emails (only reply to existing threads)
- Email search within case (defer to global search)
- Attachment preview inline (use existing document preview)
- Calendar integration in email tab

### Open Questions for Research

- [ ] What is the current state of email sync infrastructure?
- [ ] How are emails currently stored in the database schema?
- [ ] What GraphQL queries/mutations exist for emails?
- [ ] How does the existing `useEmailSync` hook work?
- [ ] Is there existing email-to-case linking logic?
- [ ] What does the Communications page currently do vs what we need here?

---

## Context Snapshot

- Linear-inspired UI redesign in progress on `feature/ui-redesign` branch
- Microsoft 365 integration exists (Azure AD auth, Graph API)
- `ai-service` has email classification capabilities
- Case detail page has tab structure already
- Email-related components exist in `src/components/email/` and `src/components/communication/`

## Next Step

Start a new session and run:

```
/research brainstorm-case-email-tab
```
