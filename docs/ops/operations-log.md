# Operations Log

> Persistent tracking of post-deployment issues, debugging sessions, and feature work.
> Individual issue details are in `issues/` (active) and `archive/` (resolved).

## Quick Reference

| ID      | Title                                             | Type        | Priority    | Status     | File                                     |
| ------- | ------------------------------------------------- | ----------- | ----------- | ---------- | ---------------------------------------- |
| OPS-001 | Communications page not loading emails            | Bug         | P0-Critical | Resolved   | [archive/ops-001.md](archive/ops-001.md) |
| OPS-002 | Legacy import stuck at 8k docs                    | Performance | P1-High     | Resolved   | [archive/ops-002.md](archive/ops-002.md) |
| OPS-003 | Restrict partner dashboard to partners            | Feature     | P2-Medium   | Resolved   | [archive/ops-003.md](archive/ops-003.md) |
| OPS-004 | Add categorization backup before export           | Feature     | P1-High     | Resolved   | [archive/ops-004.md](archive/ops-004.md) |
| OPS-005 | AI extraction and drafting not working            | Bug         | P0-Critical | Resolved   | [archive/ops-005.md](archive/ops-005.md) |
| OPS-006 | Connect AI capabilities to application UI         | Feature     | P1-High     | Resolved   | [archive/ops-006.md](archive/ops-006.md) |
| OPS-007 | AI email drafts ignore user language pref         | Bug         | P2-Medium   | Resolved   | [archive/ops-007.md](archive/ops-007.md) |
| OPS-008 | Communications section comprehensive overhaul     | Feature     | P1-High     | Resolved   | [archive/ops-008.md](archive/ops-008.md) |
| OPS-009 | Multiple re-login prompts for email/attachments   | Bug         | P1-High     | Resolved   | [archive/ops-009.md](archive/ops-009.md) |
| OPS-010 | Emails synced but not displayed (1049 emails)     | Bug         | P0-Critical | Resolved   | [archive/ops-010.md](archive/ops-010.md) |
| OPS-011 | Refocus /communications on received emails only   | Feature     | P1-High     | Resolved   | [archive/ops-011.md](archive/ops-011.md) |
| OPS-012 | Legacy import can't advance past first 100 docs   | Bug         | P1-High     | Resolved   | [archive/ops-012.md](archive/ops-012.md) |
| OPS-013 | New logins don't show up in user management       | Bug         | P1-High     | Resolved   | [archive/ops-013.md](archive/ops-013.md) |
| OPS-014 | Role-based menu visibility refinement             | Bug         | P2-Medium   | Resolved   | [archive/ops-014.md](archive/ops-014.md) |
| OPS-015 | Translate English UI sections to Romanian         | Feature     | P2-Medium   | Resolved   | [archive/ops-015.md](archive/ops-015.md) |
| OPS-016 | Redesign Communications Tab in Case Details       | Feature     | P1-High     | Resolved   | [archive/ops-016.md](archive/ops-016.md) |
| OPS-017 | AI service TypeScript compilation errors          | Bug         | P1-High     | Resolved   | [archive/ops-017.md](archive/ops-017.md) |
| OPS-018 | AI Service Deployment Failure & Render Duplicates | Bug/Infra   | P1-High     | Resolved   | [archive/ops-018.md](archive/ops-018.md) |
| OPS-019 | Activate AI Chat Bar (QuickActionsBar)            | Feature     | P1-High     | Resolved   | [archive/ops-019.md](archive/ops-019.md) |
| OPS-020 | Redesign AI Bar - Floating Pill Design            | Feature     | P2-Medium   | Resolved   | [archive/ops-020.md](archive/ops-020.md) |
| OPS-021 | Ensure dev/production parity                      | Infra       | P2-Medium   | Resolved   | [archive/ops-021.md](archive/ops-021.md) |
| OPS-022 | Email-to-Case Timeline Integration                | Feature     | P1-High     | Resolved   | [archive/ops-022.md](archive/ops-022.md) |
| OPS-023 | Gateway Service TypeScript Compilation Errors     | Bug         | P1-High     | Resolved   | [archive/ops-023.md](archive/ops-023.md) |
| OPS-024 | Email Import - Attachments Not Importing          | Bug         | P1-High     | Resolved   | [archive/ops-024.md](archive/ops-024.md) |
| OPS-025 | Email and Document Permanent Deletion             | Feature     | P1-High     | Resolved   | [archive/ops-025.md](archive/ops-025.md) |
| OPS-026 | AI Thread Summary Agent for Communications        | Feature     | P2-Medium   | Resolved   | [archive/ops-026.md](archive/ops-026.md) |
| OPS-027 | Classification Schema & Data Model                | Feature     | P1-High     | Merged     | [archive/ops-027.md](archive/ops-027.md) |
| OPS-028 | Classification Metadata UI                        | Feature     | P1-High     | Merged     | [archive/ops-028.md](archive/ops-028.md) |
| OPS-029 | AI Email Classification Service                   | Feature     | P1-High     | Merged     | [archive/ops-029.md](archive/ops-029.md) |
| OPS-030 | Email Import with Classification                  | Feature     | P1-High     | Outdated   | [archive/ops-030.md](archive/ops-030.md) |
| OPS-031 | Classification Review & Correction                | Feature     | P2-Medium   | Resolved   | [archive/ops-031.md](archive/ops-031.md) |
| OPS-032 | Repurpose /communications as Pending Queue        | Feature     | P1-High     | Superseded | [archive/ops-032.md](archive/ops-032.md) |
| OPS-033 | Firm-wide Email Search                            | Feature     | P3-Low      | Superseded | [archive/ops-033.md](archive/ops-033.md) |
| OPS-034 | Fix Web App TypeScript Errors (377→38)            | Bug         | P0-Critical | Resolved   | [archive/ops-034.md](archive/ops-034.md) |
| OPS-035 | Data Model - Classification State & Case Metadata | Feature     | P1-High     | Resolved   | [archive/ops-035.md](archive/ops-035.md) |
| OPS-036 | Simplify /communications UI                       | Feature     | P2-Medium   | Resolved   | [archive/ops-036.md](archive/ops-036.md) |
| OPS-037 | Case Communications Tab - Read-Only Mode          | Feature     | P2-Medium   | Resolved   | [archive/ops-037.md](archive/ops-037.md) |
| OPS-038 | Contacts & Metadata in Case Flow                  | Feature     | P1-High     | Resolved   | [archive/ops-038.md](archive/ops-038.md) |
| OPS-039 | Enhanced Multi-Case Classification Algorithm      | Feature     | P1-High     | Resolved   | [archive/ops-039.md](archive/ops-039.md) |
| OPS-040 | Court Email Detection & INSTANȚE Routing          | Feature     | P1-High     | Resolved   | [archive/ops-040.md](archive/ops-040.md) |
| OPS-041 | /communications Case-Organized Redesign           | Feature     | P1-High     | Resolved   | [archive/ops-041.md](archive/ops-041.md) |
| OPS-042 | Classification Modal (NECLAR Queue)               | Feature     | P1-High     | Resolved   | [archive/ops-042.md](archive/ops-042.md) |

---

## Active Issues Summary

### [OPS-027 → OPS-031] Multi-Case Email Classification _(Archived)_

**Status:** Merged/Outdated | **Replaced by:** OPS-035 → OPS-042 | **Archived:** 2025-12-18

This feature set has been superseded by the Communications Architecture Rethink:

| Issue   | Original Scope             | New Status                      |
| ------- | -------------------------- | ------------------------------- |
| OPS-027 | Schema & Data Model        | **Merged → OPS-035** (extended) |
| OPS-028 | Metadata UI                | **Merged → OPS-038** (expanded) |
| OPS-029 | AI Classification Service  | **Merged → OPS-039** (enhanced) |
| OPS-030 | Email Import with Classify | **Outdated** (no import wizard) |
| OPS-031 | Review & Correction        | Resolved                        |

**Key change:** The new architecture uses **real-time classification on sync** instead of batch import. T0 = case creation, no historical email import.

Useful work from these issues (schema, algorithm foundations) is incorporated into OPS-035-042.

---

### [OPS-032, OPS-033] _(Superseded)_

- **OPS-032** (Pending Queue) → Replaced by OPS-041 (case-organized approach)
- **OPS-033** (Firm-wide Search) → No longer needed with case-organized /communications

---

### [OPS-035 → OPS-042] Communications Architecture Rethink ✅

**Status:** Resolved | **Priority:** P1-High | **Type:** Feature Set | **Created:** 2025-12-18 | **Completed:** 2025-12-18

Comprehensive redesign of how communications work across the platform.

**Core Principles:**

- **T0 = Case creation** - No historical email import
- **Contacts set upfront** - Required in new case flow
- **/communications = My Workspace** - Current user's emails, organized by case, action-oriented
- **Case details = Read-only Record** - All firm users' emails, AI summary, no actions
- **Court emails separate** - INSTANȚE folder for unassigned court correspondence
- **Bulletproof classification** - Robust algorithm for multi-case clients

**Dependency Graph:**

```
PHASE 1 (Parallel - Start Immediately):
├── OPS-035: Data Model (Foundation)
├── OPS-036: Simplify /communications UI
└── OPS-037: Case Communications Read-Only

PHASE 2 (After OPS-035):
├── OPS-038: Contacts & Metadata in Case Flow
├── OPS-039: Enhanced Multi-Case Classification
└── OPS-040: Court Email Detection & INSTANȚE

PHASE 3 (After Phase 2):
├── OPS-041: /communications Case-Organized Redesign
└── OPS-042: Classification Modal (NECLAR Queue)
```

| Issue   | Title                             | Scope                                  | Phase |
| ------- | --------------------------------- | -------------------------------------- | ----- |
| OPS-035 | Data Model                        | Classification state, case metadata    | 1     |
| OPS-036 | Simplify /communications          | Remove panels, filters, improve scroll | 1     |
| OPS-037 | Case Communications Read-Only     | Strip actions, show all firm users     | 1     |
| OPS-038 | Contacts & Metadata in Case Flow  | New case modal step, case edit section | 2     |
| OPS-039 | Enhanced Classification Algorithm | Multi-case scoring, thread continuity  | 2     |
| OPS-040 | Court Email Detection & INSTANȚE  | Reference number matching, court flow  | 2     |
| OPS-041 | /communications Redesign          | Case sidebar, thread view, NECLAR      | 3     |
| OPS-042 | Classification Modal              | User review for uncertain emails       | 3     |

**Key UI Changes:**

1. `/communications` becomes case-organized workspace (not inbox)
2. Left sidebar: Cases (expandable) → INSTANȚE → NECLAR sections
3. Case details/Communications: Read-only, AI summary at top, all firm users' threads
4. New case modal: Step 2 requires contacts (at least Client)
5. Case edit: Reference numbers and keywords for classification

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
