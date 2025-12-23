# Operations Log

> Persistent tracking of post-deployment issues, debugging sessions, and feature work.
> Individual issue details are in `issues/` (active) and `archive/` (resolved).

## Quick Reference

| ID      | Title                                             | Type         | Priority    | Status     | File                                     |
| ------- | ------------------------------------------------- | ------------ | ----------- | ---------- | ---------------------------------------- |
| OPS-001 | Communications page not loading emails            | Bug          | P0-Critical | Resolved   | [archive/ops-001.md](archive/ops-001.md) |
| OPS-002 | Legacy import stuck at 8k docs                    | Performance  | P1-High     | Resolved   | [archive/ops-002.md](archive/ops-002.md) |
| OPS-003 | Restrict partner dashboard to partners            | Feature      | P2-Medium   | Resolved   | [archive/ops-003.md](archive/ops-003.md) |
| OPS-004 | Add categorization backup before export           | Feature      | P1-High     | Resolved   | [archive/ops-004.md](archive/ops-004.md) |
| OPS-005 | AI extraction and drafting not working            | Bug          | P0-Critical | Resolved   | [archive/ops-005.md](archive/ops-005.md) |
| OPS-006 | Connect AI capabilities to application UI         | Feature      | P1-High     | Resolved   | [archive/ops-006.md](archive/ops-006.md) |
| OPS-007 | AI email drafts ignore user language pref         | Bug          | P2-Medium   | Resolved   | [archive/ops-007.md](archive/ops-007.md) |
| OPS-008 | Communications section comprehensive overhaul     | Feature      | P1-High     | Resolved   | [archive/ops-008.md](archive/ops-008.md) |
| OPS-009 | Multiple re-login prompts for email/attachments   | Bug          | P1-High     | Resolved   | [archive/ops-009.md](archive/ops-009.md) |
| OPS-010 | Emails synced but not displayed (1049 emails)     | Bug          | P0-Critical | Resolved   | [archive/ops-010.md](archive/ops-010.md) |
| OPS-011 | Refocus /communications on received emails only   | Feature      | P1-High     | Resolved   | [archive/ops-011.md](archive/ops-011.md) |
| OPS-012 | Legacy import can't advance past first 100 docs   | Bug          | P1-High     | Resolved   | [archive/ops-012.md](archive/ops-012.md) |
| OPS-013 | New logins don't show up in user management       | Bug          | P1-High     | Resolved   | [archive/ops-013.md](archive/ops-013.md) |
| OPS-014 | Role-based menu visibility refinement             | Bug          | P2-Medium   | Resolved   | [archive/ops-014.md](archive/ops-014.md) |
| OPS-015 | Translate English UI sections to Romanian         | Feature      | P2-Medium   | Resolved   | [archive/ops-015.md](archive/ops-015.md) |
| OPS-016 | Redesign Communications Tab in Case Details       | Feature      | P1-High     | Resolved   | [archive/ops-016.md](archive/ops-016.md) |
| OPS-017 | AI service TypeScript compilation errors          | Bug          | P1-High     | Resolved   | [archive/ops-017.md](archive/ops-017.md) |
| OPS-018 | AI Service Deployment Failure & Render Duplicates | Bug/Infra    | P1-High     | Resolved   | [archive/ops-018.md](archive/ops-018.md) |
| OPS-019 | Activate AI Chat Bar (QuickActionsBar)            | Feature      | P1-High     | Resolved   | [archive/ops-019.md](archive/ops-019.md) |
| OPS-020 | Redesign AI Bar - Floating Pill Design            | Feature      | P2-Medium   | Resolved   | [archive/ops-020.md](archive/ops-020.md) |
| OPS-021 | Ensure dev/production parity                      | Infra        | P2-Medium   | Resolved   | [archive/ops-021.md](archive/ops-021.md) |
| OPS-022 | Email-to-Case Timeline Integration                | Feature      | P1-High     | Resolved   | [archive/ops-022.md](archive/ops-022.md) |
| OPS-023 | Gateway Service TypeScript Compilation Errors     | Bug          | P1-High     | Resolved   | [archive/ops-023.md](archive/ops-023.md) |
| OPS-024 | Email Import - Attachments Not Importing          | Bug          | P1-High     | Resolved   | [archive/ops-024.md](archive/ops-024.md) |
| OPS-025 | Email and Document Permanent Deletion             | Feature      | P1-High     | Resolved   | [archive/ops-025.md](archive/ops-025.md) |
| OPS-026 | AI Thread Summary Agent for Communications        | Feature      | P2-Medium   | Resolved   | [archive/ops-026.md](archive/ops-026.md) |
| OPS-027 | Classification Schema & Data Model                | Feature      | P1-High     | Merged     | [archive/ops-027.md](archive/ops-027.md) |
| OPS-028 | Classification Metadata UI                        | Feature      | P1-High     | Merged     | [archive/ops-028.md](archive/ops-028.md) |
| OPS-029 | AI Email Classification Service                   | Feature      | P1-High     | Merged     | [archive/ops-029.md](archive/ops-029.md) |
| OPS-030 | Email Import with Classification                  | Feature      | P1-High     | Outdated   | [archive/ops-030.md](archive/ops-030.md) |
| OPS-031 | Classification Review & Correction                | Feature      | P2-Medium   | Resolved   | [archive/ops-031.md](archive/ops-031.md) |
| OPS-032 | Repurpose /communications as Pending Queue        | Feature      | P1-High     | Superseded | [archive/ops-032.md](archive/ops-032.md) |
| OPS-033 | Firm-wide Email Search                            | Feature      | P3-Low      | Superseded | [archive/ops-033.md](archive/ops-033.md) |
| OPS-034 | Fix Web App TypeScript Errors (377→38)            | Bug          | P0-Critical | Resolved   | [archive/ops-034.md](archive/ops-034.md) |
| OPS-035 | Data Model - Classification State & Case Metadata | Feature      | P1-High     | Resolved   | [archive/ops-035.md](archive/ops-035.md) |
| OPS-036 | Simplify /communications UI                       | Feature      | P2-Medium   | Resolved   | [archive/ops-036.md](archive/ops-036.md) |
| OPS-037 | Case Communications Tab - Read-Only Mode          | Feature      | P2-Medium   | Resolved   | [archive/ops-037.md](archive/ops-037.md) |
| OPS-038 | Contacts & Metadata in Case Flow                  | Feature      | P1-High     | Resolved   | [archive/ops-038.md](archive/ops-038.md) |
| OPS-039 | Enhanced Multi-Case Classification Algorithm      | Feature      | P1-High     | Resolved   | [archive/ops-039.md](archive/ops-039.md) |
| OPS-040 | Court Email Detection & INSTANȚE Routing          | Feature      | P1-High     | Resolved   | [archive/ops-040.md](archive/ops-040.md) |
| OPS-041 | /communications Case-Organized Redesign           | Feature      | P1-High     | Resolved   | [archive/ops-041.md](archive/ops-041.md) |
| OPS-042 | Classification Modal (NECLAR Queue)               | Feature      | P1-High     | Resolved   | [archive/ops-042.md](archive/ops-042.md) |
| OPS-043 | Re-classify emails when contacts added to case    | Feature      | P2-Medium   | Resolved   | [archive/ops-043.md](archive/ops-043.md) |
| OPS-044 | Manual email thread reassignment UI               | Feature      | P2-Medium   | Resolved   | [archive/ops-044.md](archive/ops-044.md) |
| OPS-045 | Documents Tab Fails to Load                       | Bug          | P1-High     | Resolved   | [archive/ops-045.md](archive/ops-045.md) |
| OPS-046 | Case Summary Data Model                           | Feature      | P1-High     | Resolved   | [archive/ops-046.md](archive/ops-046.md) |
| OPS-047 | Event-Driven Summary Invalidation                 | Feature      | P1-High     | Resolved   | [archive/ops-047.md](archive/ops-047.md) |
| OPS-048 | AI Summary Generation Service                     | Feature      | P1-High     | Resolved   | [archive/ops-048.md](archive/ops-048.md) |
| OPS-049 | Unified Chronology with Importance Scoring        | Feature      | P1-High     | Resolved   | [archive/ops-049.md](archive/ops-049.md) |
| OPS-050 | Overview Tab AI Summary UI                        | Feature      | P1-High     | Resolved   | [archive/ops-050.md](archive/ops-050.md) |
| OPS-051 | Time Grouping Utility for Chronology              | Feature      | P2-Medium   | Resolved   | [archive/ops-051.md](archive/ops-051.md) |
| OPS-052 | Collapsible TimeSection Component                 | Feature      | P2-Medium   | Resolved   | [archive/ops-052.md](archive/ops-052.md) |
| OPS-053 | Chronology Tab Bar & Event Filtering              | Feature      | P2-Medium   | Resolved   | [archive/ops-053.md](archive/ops-053.md) |
| OPS-054 | CaseChronology Integration                        | Feature      | P2-Medium   | Resolved   | [archive/ops-054.md](archive/ops-054.md) |
| OPS-055 | Chronology Tab Counts - Server-Side Totals        | Bug          | P1-High     | Resolved   | [archive/ops-055.md](archive/ops-055.md) |
| OPS-056 | Email Events Not Syncing to Chronology            | Bug          | P0-Critical | Resolved   | [archive/ops-056.md](archive/ops-056.md) |
| OPS-057 | Chronology Time Sections - Show All Periods       | UX           | P3-Low      | Resolved   | [archive/ops-057.md](archive/ops-057.md) |
| OPS-058 | Multi-Case Email Data Model                       | Feature      | P0-Critical | Resolved   | [archive/ops-058.md](archive/ops-058.md) |
| OPS-059 | Multi-Case Classification Algorithm               | Feature      | P1-High     | Resolved   | [archive/ops-059.md](archive/ops-059.md) |
| OPS-060 | GraphQL Multi-Case Email Support                  | Feature      | P1-High     | Resolved   | [archive/ops-060.md](archive/ops-060.md) |
| OPS-061 | Multi-Case Email Data Migration                   | Feature      | P1-High     | Resolved   | [archive/ops-061.md](archive/ops-061.md) |
| OPS-062 | UI Multi-Case Email Display                       | Feature      | P2-Medium   | Resolved   | [archive/ops-062.md](archive/ops-062.md) |
| OPS-063 | AI Conversation Data Model                        | Feature      | P0-Critical | Resolved   | [archive/ops-063.md](archive/ops-063.md) |
| OPS-064 | AI Assistant GraphQL Schema                       | Feature      | P0-Critical | Resolved   | [archive/ops-064.md](archive/ops-064.md) |
| OPS-065 | Conversation Service                              | Feature      | P0-Critical | Resolved   | [archive/ops-065.md](archive/ops-065.md) |
| OPS-066 | AI Orchestrator Service                           | Feature      | P1-High     | Resolved   | [archive/ops-066.md](archive/ops-066.md) |
| OPS-067 | Action Executor Service                           | Feature      | P1-High     | Resolved   | [archive/ops-067.md](archive/ops-067.md) |
| OPS-068 | AI Assistant Resolvers                            | Feature      | P1-High     | Resolved   | [archive/ops-068.md](archive/ops-068.md) |
| OPS-069 | Assistant Store (Zustand)                         | Feature      | P1-High     | Resolved   | [archive/ops-069.md](archive/ops-069.md) |
| OPS-070 | useAssistant Hook                                 | Feature      | P1-High     | Resolved   | [archive/ops-070.md](archive/ops-070.md) |
| OPS-071 | AssistantPill Components                          | Feature      | P1-High     | Resolved   | [archive/ops-071.md](archive/ops-071.md) |
| OPS-072 | Task & Calendar Intent Handler                    | Feature      | P2-Medium   | Resolved   | [archive/ops-072.md](archive/ops-072.md) |
| OPS-073 | Case Query Intent Handler                         | Feature      | P2-Medium   | Resolved   | [archive/ops-073.md](archive/ops-073.md) |
| OPS-074 | Email Intent Handler                              | Feature      | P2-Medium   | Resolved   | [archive/ops-074.md](archive/ops-074.md) |
| OPS-075 | Document Intent Handler                           | Feature      | P2-Medium   | Resolved   | [archive/ops-075.md](archive/ops-075.md) |
| OPS-076 | Proactive Briefings Integration                   | Feature      | P2-Medium   | Resolved   | [archive/ops-076.md](archive/ops-076.md) |
| OPS-077 | Service Wrappers for AI Assistant Handlers        | Feature      | P1-High     | Resolved   | [archive/ops-077.md](archive/ops-077.md) |
| OPS-078 | Error Handling & Fallbacks                        | Feature      | P2-Medium   | Resolved   | [archive/ops-078.md](archive/ops-078.md) |
| OPS-079 | Integration Tests                                 | Testing      | P2-Medium   | Resolved   | [archive/ops-079.md](archive/ops-079.md) |
| OPS-080 | E2E Tests                                         | Testing      | P3-Low      | Resolved   | [archive/ops-080.md](archive/ops-080.md) |
| OPS-081 | AI Architecture - Direct Sonnet with Tools        | Architecture | P0-Critical | Resolved   | [archive/ops-081.md](archive/ops-081.md) |
| OPS-082 | Define Claude Tool Schemas                        | Feature      | P0-Critical | Resolved   | [archive/ops-082.md](archive/ops-082.md) |
| OPS-083 | Legal Assistant System Prompt                     | Feature      | P0-Critical | Resolved   | [archive/ops-083.md](archive/ops-083.md) |
| OPS-084 | Direct Sonnet Conversation with Tool Calling      | Feature      | P0-Critical | Resolved   | [archive/ops-084.md](archive/ops-084.md) |
| OPS-085 | Tool Execution Layer                              | Feature      | P1-High     | Resolved   | [archive/ops-085.md](archive/ops-085.md) |
| OPS-086 | Frontend Tool Response Handling                   | Feature      | P1-High     | Resolved   | [archive/ops-086.md](archive/ops-086.md) |
| OPS-087 | Document & Attachment Preview                     | Feature      | P2-Medium   | Open       | [issues/ops-087.md](issues/ops-087.md)   |
| OPS-088 | Cmd+K Command Palette with cmdk Library           | Feature      | P2-Medium   | Open       | [issues/ops-088.md](issues/ops-088.md)   |
| OPS-089 | /documents Section with Folders                   | Feature      | P1-High     | Open       | [issues/ops-089.md](issues/ops-089.md)   |
| OPS-090 | Email Content Cleaning for Readability            | Feature      | P2-Medium   | Open       | [issues/ops-090.md](issues/ops-090.md)   |
| OPS-091 | Include Sent Emails in Thread Display             | Feature      | P1-High     | Open       | [issues/ops-091.md](issues/ops-091.md)   |
| OPS-092 | Document Preview Fails with 400 Error             | Bug          | P1-High     | Open       | [issues/ops-092.md](issues/ops-092.md)   |
| OPS-093 | AI-Created Events Not Appearing in Calendar       | Bug          | P1-High     | Fixed      | [issues/ops-093.md](issues/ops-093.md)   |
| OPS-094 | AI Assistant Wrong Date and Time for Events       | Bug          | P1-High     | Fixed      | [issues/ops-094.md](issues/ops-094.md)   |
| OPS-095 | Task Date/Time Simplification                     | Feature      | P2-Medium   | Fixed      | [issues/ops-095.md](issues/ops-095.md)   |
| OPS-096 | Task Card Display Redesign                        | Feature      | P2-Medium   | Open       | [issues/ops-096.md](issues/ops-096.md)   |
| OPS-097 | AI Task Creation with Editable Duration Card      | Feature      | P1-High     | Open       | [issues/ops-097.md](issues/ops-097.md)   |
| OPS-098 | Duration-Based Calendar Card Spanning             | Feature      | P3-Low      | Phase 2 ✓  | [issues/ops-098.md](issues/ops-098.md)   |
| OPS-099 | Mapa Data Model                                   | Feature      | P1-High     | Fixed      | [issues/ops-099.md](issues/ops-099.md)   |
| OPS-100 | Mapa Service Layer                                | Feature      | P1-High     | Fixed      | [issues/ops-100.md](issues/ops-100.md)   |
| OPS-101 | Mapa GraphQL Schema & Resolvers                   | Feature      | P1-High     | Fixed      | [issues/ops-101.md](issues/ops-101.md)   |
| OPS-102 | Mapa UI Components                                | Feature      | P1-High     | Fixed      | [issues/ops-102.md](issues/ops-102.md)   |
| OPS-103 | Mapa Print/Export Functionality                   | Feature      | P2-Medium   | Fixed      | [issues/ops-103.md](issues/ops-103.md)   |
| OPS-104 | Document Preview Fails for Non-Uploader Users     | Bug          | P1-High     | Superseded | [issues/ops-104.md](issues/ops-104.md)   |
| OPS-105 | SharePoint Site Configuration                     | Infra        | P0-Critical | Fixed      | [issues/ops-105.md](issues/ops-105.md)   |
| OPS-106 | SharePoint Service Layer                          | Feature      | P1-High     | Fixed      | [issues/ops-106.md](issues/ops-106.md)   |
| OPS-107 | SharePoint GraphQL Schema Updates                 | Feature      | P1-High     | Fixed      | [issues/ops-107.md](issues/ops-107.md)   |
| OPS-108 | Document Upload to SharePoint                     | Feature      | P1-High     | Open       | [issues/ops-108.md](issues/ops-108.md)   |
| OPS-109 | Document Preview/Download from SharePoint         | Feature      | P1-High     | Fixing     | [issues/ops-109.md](issues/ops-109.md)   |
| OPS-110 | Document Migration to SharePoint                  | Feature      | P2-Medium   | Fixing     | [issues/ops-110.md](issues/ops-110.md)   |
| OPS-111 | Document Grid UI with Thumbnails                  | Feature      | P2-Medium   | Open       | [issues/ops-111.md](issues/ops-111.md)   |
| OPS-112 | Apollo Client Missing x-ms-access-token Header    | Bug          | P1-High     | Fixed      | [issues/ops-112.md](issues/ops-112.md)   |
| OPS-113 | Rule-Based Document Filtering                     | Feature      | P2-Medium   | Fixing     | [issues/ops-113.md](issues/ops-113.md)   |
| OPS-114 | Permanent Document Thumbnails                     | Feature      | P2-Medium   | Open       | [issues/ops-114.md](issues/ops-114.md)   |

---

## Active Issues Summary

### SharePoint Migration Epic (OPS-105 → OPS-111)

| ID      | Title                                     | Priority    | Status           | Blocked By  |
| ------- | ----------------------------------------- | ----------- | ---------------- | ----------- |
| OPS-105 | SharePoint Site Configuration             | P0-Critical | Fixed            | -           |
| OPS-106 | SharePoint Service Layer                  | P1-High     | Fixed            | -           |
| OPS-107 | SharePoint GraphQL Schema Updates         | P1-High     | Fixed            | -           |
| OPS-108 | Document Upload to SharePoint             | P1-High     | Open             | -           |
| OPS-109 | Document Preview/Download from SharePoint | P1-High     | Root Cause Found | -           |
| OPS-110 | Document Migration to SharePoint          | P2-Medium   | Fixing           | OPS-108,109 |
| OPS-111 | Document Grid UI with Thumbnails          | P2-Medium   | Open             | -           |

### Other Active Issues

| ID      | Title                                          | Priority  | Status                     |
| ------- | ---------------------------------------------- | --------- | -------------------------- |
| OPS-087 | Document & Attachment Preview                  | P2-Medium | Superseded (by OPS-109)    |
| OPS-088 | Cmd+K Command Palette with cmdk Library        | P2-Medium | Open                       |
| OPS-089 | /documents Section with Folders                | P1-High   | Open                       |
| OPS-090 | Email Content Cleaning for Readability         | P2-Medium | Open                       |
| OPS-091 | Include Sent Emails in Thread Display          | P1-High   | Open                       |
| OPS-092 | Document Preview Fails with 400 Error          | P1-High   | Superseded (by OPS-109)    |
| OPS-096 | Task Card Display Redesign                     | P2-Medium | Open                       |
| OPS-097 | AI Task Creation with Editable Duration Card   | P1-High   | Open                       |
| OPS-112 | Apollo Client Missing x-ms-access-token Header | P1-High   | Fixed                      |
| OPS-098 | Duration-Based Calendar Card Spanning          | P3-Low    | Phase 2                    |
| OPS-104 | Document Preview Fails for Non-Uploader Users  | P1-High   | Superseded (by SharePoint) |
| OPS-113 | Rule-Based Document Filtering                  | P2-Medium | Fixing                     |
| OPS-114 | Permanent Document Thumbnails                  | P2-Medium | Open                       |

---

## SharePoint Migration (OPS-105 → OPS-111) Dependency Graph

```
                    ┌─────────────────┐
                    │   OPS-105       │
                    │  Site Config    │ ◄── YOU ARE HERE
                    │  (Admin Portal) │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              │
    ┌─────────────────┐ ┌─────────────────┐ │
    │   OPS-106       │ │   OPS-107       │ │
    │  Service Layer  │ │  GraphQL Schema │ │
    │  (can parallel) │ │  (can parallel) │ │
    └────────┬────────┘ └────────┬────────┘ │
              │                   │          │
              └─────────┬─────────┘          │
                        │                    │
         ┌──────────────┼──────────────┐     │
         │              │              │     │
         ▼              ▼              ▼     │
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   OPS-108       │ │   OPS-109       │ │   OPS-111       │
│  Upload Flow    │ │  Preview/DL     │ │  Grid UI        │
└────────┬────────┘ └────────┬────────┘ └─────────────────┘
         │                   │
         └─────────┬─────────┘
                   │
                   ▼
         ┌─────────────────┐
         │   OPS-110       │
         │  Migration      │
         └─────────────────┘

Parallelization:
- OPS-106 and OPS-107 can run concurrently after OPS-105
- OPS-108, OPS-109, OPS-111 can run concurrently after OPS-106+107
- OPS-110 runs last (needs upload+preview working)
```

---

## Mapa Feature (OPS-099 → OPS-103) Dependency Graph

```
                    ┌─────────────────┐
                    │   OPS-099       │
                    │  Data Model     │
                    │   (Prisma)      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              │
    ┌─────────────────┐ ┌─────────────────┐ │
    │   OPS-100       │ │   OPS-101       │ │
    │  Service Layer  │ │  GraphQL Schema │ │
    │  (can parallel) │ │  (can parallel) │ │
    └────────┬────────┘ └────────┬────────┘ │
              │                   │          │
              └─────────┬─────────┘          │
                        │                    │
                        ▼                    │
              ┌─────────────────┐            │
              │   OPS-102       │            │
              │  UI Components  │            │
              └────────┬────────┘            │
                       │                     │
                       ▼                     │
              ┌─────────────────┐            │
              │   OPS-103       │◄───────────┘
              │  Print/Export   │
              └─────────────────┘

Parallelization: OPS-100 and OPS-101 can run concurrently after OPS-099
```

---

## Standard Procedures

- **[Deployment Flows](deployment-flows.md)** - Preflight checks, smoke tests, avoiding "works locally breaks in prod"

---

## Folder Structure

```
docs/ops/
├── operations-log.md    # This index file
├── deployment-flows.md  # Deployment procedures and scripts
├── issues/              # Active issues (currently empty)
└── archive/             # Resolved issues
    ├── ops-001.md through ops-086.md
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
