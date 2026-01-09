# Brainstorm: Case History Redesign

**Status**: Complete
**Date**: 2026-01-04
**Next step**: `/research brainstorm-case-history-redesign`

---

## Problem Statement

The Cases section currently mixes day-to-day operations with historical reference, making it hard for team members to quickly understand a case's history or retrieve old documents. We need to reposition Cases as an intuitive archival experience - a place for institutional memory where both veteran and new team members can browse case history, understand what happened, and retrieve documents for reuse.

## Decisions

> **IMPORTANT**: This section propagates unchanged through research → plan → implement.
> Be specific and complete. These are the requirements.

### Functional Decisions

| Decision                      | Details                                                                                                                                                    | Rationale                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Cases = archival reference    | Cases section is for historical browsing and retrieval, not daily operations                                                                               | Separates "understand the past" from "do today's work" (Emails/Docs handle daily ops)     |
| Chapters + Timeline structure | AI groups case history into chapters (phases), each containing a timeline of events                                                                        | Provides narrative structure for complex cases while maintaining chronological detail     |
| Accordion navigation          | Chapters displayed as accordion - click to expand and see timeline within                                                                                  | Compact view, easy scanning, familiar pattern                                             |
| AI-generated chapters         | Chapters created by AI based on detected case phases: Consultanță inițială, Negociere, Prima instanță, Apel, Executare, etc.                               | Start simple with AI-only; no manual chapter management needed                            |
| Weekly AI generation          | Timeline and chapters regenerated weekly                                                                                                                   | Balance between freshness and compute cost; can adjust frequency later                    |
| Timeline events include       | Court outcomes, contract outcomes, negotiation details, deadlines met/missed, key client decisions, document milestones, team changes, case status changes | Comprehensive history without financial clutter                                           |
| No financial events           | Financial milestones excluded from timeline                                                                                                                | Separate billing/financial section handles this; avoids role-based complexity in timeline |
| Inline document access        | Documents and emails shown inline within timeline events (e.g., "3 documente atașate" → expand to see)                                                     | Quick access without leaving context                                                      |
| "Folosește ca șablon" action  | Right-click/action menu on any document to use as template                                                                                                 | Primary retrieval use case for archival docs                                              |
| Template flow                 | 1) Select target case → 2) AI updates doc with new case/client info → 3) Opens in Word → 4) Appears in /docs as working document                           | Seamless transition from archive to active work                                           |
| Search across chapters        | Search bar at top of case view to find docs/events across all chapters                                                                                     | Essential for quick retrieval when you know what you're looking for                       |
| New cases: raw list           | Cases without AI summary yet show raw chronological list of docs/emails                                                                                    | Graceful degradation; new cases may take months to have meaningful chapters               |
| No manual event addition      | Timeline is pure AI-generated, users cannot add events manually                                                                                            | Keeps archive clean; users won't maintain it anyway                                       |

### Technical Decisions

| Decision                | Details                                                                                  | Rationale                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| AI processing frequency | Weekly batch job generates/updates chapter summaries and timeline events                 | Manageable compute cost, acceptable staleness for archival use |
| Chapter storage         | Store generated chapters and events in database (not regenerated on each view)           | Performance; timeline should load instantly                    |
| Event linking           | Each timeline event links to source documents/emails by ID                               | Enables inline preview and "use as template" actions           |
| Search implementation   | Full-text search across timeline event summaries + linked document content within a case | Users need to find both "what happened" and specific docs      |

### Access Control

| Role         | Access Level                    |
| ------------ | ------------------------------- |
| Partner      | All cases                       |
| Associate    | All cases                       |
| Jr Associate | Only cases they are assigned to |

### Out of Scope

- Manual chapter creation/editing (AI-only for v1)
- Real-time timeline updates (weekly batch is sufficient)
- Financial events in timeline (separate section)
- Cross-case search (this is single-case history view)
- Mobile-specific optimizations (desktop-first for archival browsing)
- Document version comparison within timeline
- Collaborative annotations on timeline events

### Open Questions for Research

- [ ] What's the current case detail page structure? What components exist?
- [ ] How is the AI service currently set up? Can it handle weekly batch processing?
- [ ] What data is available for timeline event extraction (emails, docs, case metadata)?
- [ ] How does the current document preview/action system work?
- [ ] What's the Word integration mechanism for "open in Word"?
- [ ] How are case assignments tracked for jr associate access control?
- [ ] What Romanian legal case phases exist beyond the common ones listed?

---

## Context Snapshot

**Current state:**

- Cases section has full CRUD, search, filters, case detail with tabs
- Linear-inspired UI redesign in progress (feature/ui-redesign branch)
- Existing components: CaseHeader, WorkspaceTabs, CaseDocumentsList, etc.
- AI service exists with email classification, document generation capabilities
- Microsoft 365 integration for email/docs

**What this builds on:**

- Existing case data model and GraphQL API
- AI service infrastructure (needs batch processing capability)
- Document preview system
- Linear design system (accordion, cards, timeline patterns)

**Related work:**

- OPS-338: Linear UI Adaptation Phase 2 (Epic) - this redesign fits within the broader UI overhaul

## Next Step

Start a new session and run:

```
/research brainstorm-case-history-redesign
```
