# Operations Log

> Persistent tracking of post-deployment issues, debugging sessions, and feature work.
> Individual issue details are in `issues/` (active) and `archive/` (resolved).

## Quick Reference

| ID      | Title                                             | Type        | Priority    | Status    | File                                     |
| ------- | ------------------------------------------------- | ----------- | ----------- | --------- | ---------------------------------------- |
| OPS-001 | Communications page not loading emails            | Bug         | P0-Critical | Resolved  | [archive/ops-001.md](archive/ops-001.md) |
| OPS-002 | Legacy import stuck at 8k docs                    | Performance | P1-High     | Resolved  | [archive/ops-002.md](archive/ops-002.md) |
| OPS-003 | Restrict partner dashboard to partners            | Feature     | P2-Medium   | Resolved  | [archive/ops-003.md](archive/ops-003.md) |
| OPS-004 | Add categorization backup before export           | Feature     | P1-High     | Resolved  | [archive/ops-004.md](archive/ops-004.md) |
| OPS-005 | AI extraction and drafting not working            | Bug         | P0-Critical | Resolved  | [archive/ops-005.md](archive/ops-005.md) |
| OPS-006 | Connect AI capabilities to application UI         | Feature     | P1-High     | Resolved  | [archive/ops-006.md](archive/ops-006.md) |
| OPS-007 | AI email drafts ignore user language pref         | Bug         | P2-Medium   | Resolved  | [archive/ops-007.md](archive/ops-007.md) |
| OPS-008 | Communications section comprehensive overhaul     | Feature     | P1-High     | Resolved  | [archive/ops-008.md](archive/ops-008.md) |
| OPS-009 | Multiple re-login prompts for email/attachments   | Bug         | P1-High     | Resolved  | [archive/ops-009.md](archive/ops-009.md) |
| OPS-010 | Emails synced but not displayed (1049 emails)     | Bug         | P0-Critical | Resolved  | [archive/ops-010.md](archive/ops-010.md) |
| OPS-011 | Refocus /communications on received emails only   | Feature     | P1-High     | Resolved  | [archive/ops-011.md](archive/ops-011.md) |
| OPS-012 | Legacy import can't advance past first 100 docs   | Bug         | P1-High     | Resolved  | [archive/ops-012.md](archive/ops-012.md) |
| OPS-013 | New logins don't show up in user management       | Bug         | P1-High     | Resolved  | [archive/ops-013.md](archive/ops-013.md) |
| OPS-014 | Role-based menu visibility refinement             | Bug         | P2-Medium   | Resolved  | [archive/ops-014.md](archive/ops-014.md) |
| OPS-015 | Translate English UI sections to Romanian         | Feature     | P2-Medium   | Resolved  | [archive/ops-015.md](archive/ops-015.md) |
| OPS-016 | Redesign Communications Tab in Case Details       | Feature     | P1-High     | Resolved  | [archive/ops-016.md](archive/ops-016.md) |
| OPS-017 | AI service TypeScript compilation errors          | Bug         | P1-High     | Resolved  | [archive/ops-017.md](archive/ops-017.md) |
| OPS-018 | AI Service Deployment Failure & Render Duplicates | Bug/Infra   | P1-High     | Resolved  | [archive/ops-018.md](archive/ops-018.md) |
| OPS-019 | Activate AI Chat Bar (QuickActionsBar)            | Feature     | P1-High     | Resolved  | [archive/ops-019.md](archive/ops-019.md) |
| OPS-020 | Redesign AI Bar - Floating Pill Design            | Feature     | P2-Medium   | Resolved  | [archive/ops-020.md](archive/ops-020.md) |
| OPS-021 | Ensure dev/production parity                      | Infra       | P2-Medium   | Resolved  | [archive/ops-021.md](archive/ops-021.md) |
| OPS-022 | Email-to-Case Timeline Integration                | Feature     | P1-High     | Resolved  | [archive/ops-022.md](archive/ops-022.md) |
| OPS-023 | Gateway Service TypeScript Compilation Errors     | Bug         | P1-High     | Resolved  | [archive/ops-023.md](archive/ops-023.md) |
| OPS-024 | Email Import - Attachments Not Importing          | Bug         | P1-High     | Resolved  | [archive/ops-024.md](archive/ops-024.md) |
| OPS-025 | Email and Document Permanent Deletion             | Feature     | P1-High     | Resolved  | [archive/ops-025.md](archive/ops-025.md) |
| OPS-026 | AI Thread Summary Agent for Communications        | Feature     | P2-Medium   | Fixing    | [issues/ops-026.md](issues/ops-026.md)   |
| OPS-027 | Classification Schema & Data Model                | Feature     | P1-High     | Verifying | [issues/ops-027.md](issues/ops-027.md)   |
| OPS-028 | Classification Metadata UI                        | Feature     | P1-High     | Verifying | [issues/ops-028.md](issues/ops-028.md)   |
| OPS-029 | AI Email Classification Service                   | Feature     | P1-High     | Open      | [issues/ops-029.md](issues/ops-029.md)   |
| OPS-030 | Email Import with Classification                  | Feature     | P1-High     | Verifying | [issues/ops-030.md](issues/ops-030.md)   |
| OPS-031 | Classification Review & Correction                | Feature     | P2-Medium   | Resolved  | [archive/ops-031.md](archive/ops-031.md) |
| OPS-032 | Repurpose /communications as Pending Queue        | Feature     | P1-High     | Open      | [issues/ops-032.md](issues/ops-032.md)   |
| OPS-033 | Firm-wide Email Search                            | Feature     | P3-Low      | Open      | [issues/ops-033.md](issues/ops-033.md)   |
| OPS-034 | Fix Web App TypeScript Errors (377→38)            | Bug         | P0-Critical | Resolved  | [archive/ops-034.md](archive/ops-034.md) |

---

## Active Issues Summary

### [OPS-026] AI Thread Summary Agent for Communications

**Status:** Fixing | **Priority:** P2-Medium | **Type:** Feature | **Last Active:** 2025-12-15

Add an AI agent to the Communications tab that maintains an up-to-date summary of email threads for a case. The feature will:

1. Analyze ALL emails for a case and generate comprehensive summary
2. Display summary prominently in Communications tab (collapsible panel)
3. Auto-trigger when new emails arrive (Phase 2 - not started)

**Session 2 (2025-12-15):** Phase 1 COMPLETE - Built full Case Conversation Summary Agent:

- Frontend: `CaseConversationSummaryPanel.tsx` with rich UI
- Backend: `generateCaseConversationSummary` GraphQL mutation
- Summary includes: executive summary, chronology, key developments, status, open issues, next steps
- Ready for local verification. Phase 2 (auto-trigger) not started.

### [OPS-027 → OPS-031] Multi-Case Email Classification Feature

**Status:** Open | **Priority:** P1-High | **Type:** Feature Set | **Created:** 2025-12-16

A suite of 5 issues to solve the multi-case client email segregation problem. When a client has multiple active cases, the platform needs to classify emails to the correct case instead of importing all to one.

**Problem:** Currently, importing emails for a contact imports ALL their emails into one case, even if some belong to other cases.

**Solution:** AI-powered classification with human review for uncertain cases.

| Issue   | Title                     | Scope                                     | Dependencies  | Parallel?  |
| ------- | ------------------------- | ----------------------------------------- | ------------- | ---------- |
| OPS-027 | Schema & Data Model       | DB fields for classification metadata     | None          | Foundation |
| OPS-028 | Metadata UI               | Firm settings, case wizard, case settings | OPS-027       | ✓ with 029 |
| OPS-029 | AI Classification Service | Algorithm, court detection, confidence    | OPS-027       | ✓ with 028 |
| OPS-030 | Import Integration        | Multi-case import wizard, preview         | OPS-028 + 029 | Sequential |
| OPS-031 | Review & Correction       | Review queue, reassignment, audit         | OPS-030       | Sequential |

**Key Features:**

- Case metadata: keywords, reference numbers, classification notes
- Firm-level court/authority addresses (shared across all cases)
- AI classification with confidence scores
- Multi-case import preview
- Human review queue for uncertain emails
- Email reassignment between cases with audit trail

**Session 1 Progress (2025-12-16):**

- OPS-027: Schema complete, migration applied
- OPS-028: GraphQL + resolvers + UI components built
- OPS-029: Full algorithm implemented, unit tests pass
- **OPS-030: IMPLEMENTATION COMPLETE** - Ready for verification
  - `previewClassificationForImport` query
  - `clientHasMultipleCases` query
  - `executeClassifiedImport` mutation
  - EmailImportWizard updated with 5-step flow for multi-case clients
  - Classification step shows emails grouped by case with confidence scores
  - Users can override classification or exclude emails before import

### [OPS-032] Repurpose /communications as Pending Classification Queue

**Status:** Open | **Priority:** P1-High | **Type:** Feature | **Created:** 2025-12-16

Transform `/communications` from an inbox-style email viewer into the Pending Classification Queue.

**Key Changes:**

- Replace ThreadList/MessageView with ClassificationQueue component
- Keep MS sync controls for email ingestion
- Add pending count badge to sidebar
- Philosophy: "If it's here, it needs action"

**Depends on:** OPS-031 (Resolved) | **Parallel with:** OPS-033 (optional)

### [OPS-033] Firm-wide Email Search (Deferred)

**Status:** Open | **Priority:** P3-Low | **Type:** Feature | **Created:** 2025-12-16

Fallback feature for "find any email" use case after OPS-032 removes the inbox view.

**Recommendation:** Defer. Monitor user feedback post-OPS-032. Users can search in Outlook or case Communications tabs.

---

## Standard Procedures

- **[Deployment Flows](deployment-flows.md)** - Preflight checks, smoke tests, avoiding "works locally breaks in prod"

---

## Folder Structure

```
docs/ops/
├── operations-log.md    # This index file
├── deployment-flows.md  # Deployment procedures and scripts
├── issues/              # Active issues (empty)
└── archive/             # Resolved issues
    ├── ops-001.md through ops-017.md
```

---

## How to Use

**For new sessions:**

1. Read this index to understand current state
2. Open the specific issue file(s) you're working on
3. Update the issue file with session progress
4. Update status in this index if it changes

**When resolving issues:**

1. Move file from `issues/` to `archive/`
2. Update status in this index to "Resolved"

**When creating new issues:**

1. Create file in `issues/` using next OPS-XXX number
2. Add row to Quick Reference table above
