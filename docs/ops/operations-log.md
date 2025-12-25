# Operations Log

> Persistent tracking of post-deployment issues, debugging sessions, and feature work.
> Individual issue details are in `issues/` (active) and `archive/` (resolved).

## Quick Reference

| ID      | Title                                                 | Type         | Priority    | Status     | File                                     |
| ------- | ----------------------------------------------------- | ------------ | ----------- | ---------- | ---------------------------------------- |
| OPS-001 | Communications page not loading emails                | Bug          | P0-Critical | Resolved   | [archive/ops-001.md](archive/ops-001.md) |
| OPS-002 | Legacy import stuck at 8k docs                        | Performance  | P1-High     | Resolved   | [archive/ops-002.md](archive/ops-002.md) |
| OPS-003 | Restrict partner dashboard to partners                | Feature      | P2-Medium   | Resolved   | [archive/ops-003.md](archive/ops-003.md) |
| OPS-004 | Add categorization backup before export               | Feature      | P1-High     | Resolved   | [archive/ops-004.md](archive/ops-004.md) |
| OPS-005 | AI extraction and drafting not working                | Bug          | P0-Critical | Resolved   | [archive/ops-005.md](archive/ops-005.md) |
| OPS-006 | Connect AI capabilities to application UI             | Feature      | P1-High     | Resolved   | [archive/ops-006.md](archive/ops-006.md) |
| OPS-007 | AI email drafts ignore user language pref             | Bug          | P2-Medium   | Resolved   | [archive/ops-007.md](archive/ops-007.md) |
| OPS-008 | Communications section comprehensive overhaul         | Feature      | P1-High     | Resolved   | [archive/ops-008.md](archive/ops-008.md) |
| OPS-009 | Multiple re-login prompts for email/attachments       | Bug          | P1-High     | Resolved   | [archive/ops-009.md](archive/ops-009.md) |
| OPS-010 | Emails synced but not displayed (1049 emails)         | Bug          | P0-Critical | Resolved   | [archive/ops-010.md](archive/ops-010.md) |
| OPS-011 | Refocus /communications on received emails only       | Feature      | P1-High     | Resolved   | [archive/ops-011.md](archive/ops-011.md) |
| OPS-012 | Legacy import can't advance past first 100 docs       | Bug          | P1-High     | Resolved   | [archive/ops-012.md](archive/ops-012.md) |
| OPS-013 | New logins don't show up in user management           | Bug          | P1-High     | Resolved   | [archive/ops-013.md](archive/ops-013.md) |
| OPS-014 | Role-based menu visibility refinement                 | Bug          | P2-Medium   | Resolved   | [archive/ops-014.md](archive/ops-014.md) |
| OPS-015 | Translate English UI sections to Romanian             | Feature      | P2-Medium   | Resolved   | [archive/ops-015.md](archive/ops-015.md) |
| OPS-016 | Redesign Communications Tab in Case Details           | Feature      | P1-High     | Resolved   | [archive/ops-016.md](archive/ops-016.md) |
| OPS-017 | AI service TypeScript compilation errors              | Bug          | P1-High     | Resolved   | [archive/ops-017.md](archive/ops-017.md) |
| OPS-018 | AI Service Deployment Failure & Render Duplicates     | Bug/Infra    | P1-High     | Resolved   | [archive/ops-018.md](archive/ops-018.md) |
| OPS-019 | Activate AI Chat Bar (QuickActionsBar)                | Feature      | P1-High     | Resolved   | [archive/ops-019.md](archive/ops-019.md) |
| OPS-020 | Redesign AI Bar - Floating Pill Design                | Feature      | P2-Medium   | Resolved   | [archive/ops-020.md](archive/ops-020.md) |
| OPS-021 | Ensure dev/production parity                          | Infra        | P2-Medium   | Resolved   | [archive/ops-021.md](archive/ops-021.md) |
| OPS-022 | Email-to-Case Timeline Integration                    | Feature      | P1-High     | Resolved   | [archive/ops-022.md](archive/ops-022.md) |
| OPS-023 | Gateway Service TypeScript Compilation Errors         | Bug          | P1-High     | Resolved   | [archive/ops-023.md](archive/ops-023.md) |
| OPS-024 | Email Import - Attachments Not Importing              | Bug          | P1-High     | Resolved   | [archive/ops-024.md](archive/ops-024.md) |
| OPS-025 | Email and Document Permanent Deletion                 | Feature      | P1-High     | Resolved   | [archive/ops-025.md](archive/ops-025.md) |
| OPS-026 | AI Thread Summary Agent for Communications            | Feature      | P2-Medium   | Resolved   | [archive/ops-026.md](archive/ops-026.md) |
| OPS-027 | Classification Schema & Data Model                    | Feature      | P1-High     | Merged     | [archive/ops-027.md](archive/ops-027.md) |
| OPS-028 | Classification Metadata UI                            | Feature      | P1-High     | Merged     | [archive/ops-028.md](archive/ops-028.md) |
| OPS-029 | AI Email Classification Service                       | Feature      | P1-High     | Merged     | [archive/ops-029.md](archive/ops-029.md) |
| OPS-030 | Email Import with Classification                      | Feature      | P1-High     | Outdated   | [archive/ops-030.md](archive/ops-030.md) |
| OPS-031 | Classification Review & Correction                    | Feature      | P2-Medium   | Resolved   | [archive/ops-031.md](archive/ops-031.md) |
| OPS-032 | Repurpose /communications as Pending Queue            | Feature      | P1-High     | Superseded | [archive/ops-032.md](archive/ops-032.md) |
| OPS-033 | Firm-wide Email Search                                | Feature      | P3-Low      | Superseded | [archive/ops-033.md](archive/ops-033.md) |
| OPS-034 | Fix Web App TypeScript Errors (377→38)                | Bug          | P0-Critical | Resolved   | [archive/ops-034.md](archive/ops-034.md) |
| OPS-035 | Data Model - Classification State & Case Metadata     | Feature      | P1-High     | Resolved   | [archive/ops-035.md](archive/ops-035.md) |
| OPS-036 | Simplify /communications UI                           | Feature      | P2-Medium   | Resolved   | [archive/ops-036.md](archive/ops-036.md) |
| OPS-037 | Case Communications Tab - Read-Only Mode              | Feature      | P2-Medium   | Resolved   | [archive/ops-037.md](archive/ops-037.md) |
| OPS-038 | Contacts & Metadata in Case Flow                      | Feature      | P1-High     | Resolved   | [archive/ops-038.md](archive/ops-038.md) |
| OPS-039 | Enhanced Multi-Case Classification Algorithm          | Feature      | P1-High     | Resolved   | [archive/ops-039.md](archive/ops-039.md) |
| OPS-040 | Court Email Detection & INSTANȚE Routing              | Feature      | P1-High     | Resolved   | [archive/ops-040.md](archive/ops-040.md) |
| OPS-041 | /communications Case-Organized Redesign               | Feature      | P1-High     | Resolved   | [archive/ops-041.md](archive/ops-041.md) |
| OPS-042 | Classification Modal (NECLAR Queue)                   | Feature      | P1-High     | Resolved   | [archive/ops-042.md](archive/ops-042.md) |
| OPS-043 | Re-classify emails when contacts added to case        | Feature      | P2-Medium   | Resolved   | [archive/ops-043.md](archive/ops-043.md) |
| OPS-044 | Manual email thread reassignment UI                   | Feature      | P2-Medium   | Resolved   | [archive/ops-044.md](archive/ops-044.md) |
| OPS-045 | Documents Tab Fails to Load                           | Bug          | P1-High     | Resolved   | [archive/ops-045.md](archive/ops-045.md) |
| OPS-046 | Case Summary Data Model                               | Feature      | P1-High     | Resolved   | [archive/ops-046.md](archive/ops-046.md) |
| OPS-047 | Event-Driven Summary Invalidation                     | Feature      | P1-High     | Resolved   | [archive/ops-047.md](archive/ops-047.md) |
| OPS-048 | AI Summary Generation Service                         | Feature      | P1-High     | Resolved   | [archive/ops-048.md](archive/ops-048.md) |
| OPS-049 | Unified Chronology with Importance Scoring            | Feature      | P1-High     | Resolved   | [archive/ops-049.md](archive/ops-049.md) |
| OPS-050 | Overview Tab AI Summary UI                            | Feature      | P1-High     | Resolved   | [archive/ops-050.md](archive/ops-050.md) |
| OPS-051 | Time Grouping Utility for Chronology                  | Feature      | P2-Medium   | Resolved   | [archive/ops-051.md](archive/ops-051.md) |
| OPS-052 | Collapsible TimeSection Component                     | Feature      | P2-Medium   | Resolved   | [archive/ops-052.md](archive/ops-052.md) |
| OPS-053 | Chronology Tab Bar & Event Filtering                  | Feature      | P2-Medium   | Resolved   | [archive/ops-053.md](archive/ops-053.md) |
| OPS-054 | CaseChronology Integration                            | Feature      | P2-Medium   | Resolved   | [archive/ops-054.md](archive/ops-054.md) |
| OPS-055 | Chronology Tab Counts - Server-Side Totals            | Bug          | P1-High     | Resolved   | [archive/ops-055.md](archive/ops-055.md) |
| OPS-056 | Email Events Not Syncing to Chronology                | Bug          | P0-Critical | Resolved   | [archive/ops-056.md](archive/ops-056.md) |
| OPS-057 | Chronology Time Sections - Show All Periods           | UX           | P3-Low      | Resolved   | [archive/ops-057.md](archive/ops-057.md) |
| OPS-058 | Multi-Case Email Data Model                           | Feature      | P0-Critical | Resolved   | [archive/ops-058.md](archive/ops-058.md) |
| OPS-059 | Multi-Case Classification Algorithm                   | Feature      | P1-High     | Resolved   | [archive/ops-059.md](archive/ops-059.md) |
| OPS-060 | GraphQL Multi-Case Email Support                      | Feature      | P1-High     | Resolved   | [archive/ops-060.md](archive/ops-060.md) |
| OPS-061 | Multi-Case Email Data Migration                       | Feature      | P1-High     | Resolved   | [archive/ops-061.md](archive/ops-061.md) |
| OPS-062 | UI Multi-Case Email Display                           | Feature      | P2-Medium   | Resolved   | [archive/ops-062.md](archive/ops-062.md) |
| OPS-063 | AI Conversation Data Model                            | Feature      | P0-Critical | Resolved   | [archive/ops-063.md](archive/ops-063.md) |
| OPS-064 | AI Assistant GraphQL Schema                           | Feature      | P0-Critical | Resolved   | [archive/ops-064.md](archive/ops-064.md) |
| OPS-065 | Conversation Service                                  | Feature      | P0-Critical | Resolved   | [archive/ops-065.md](archive/ops-065.md) |
| OPS-066 | AI Orchestrator Service                               | Feature      | P1-High     | Resolved   | [archive/ops-066.md](archive/ops-066.md) |
| OPS-067 | Action Executor Service                               | Feature      | P1-High     | Resolved   | [archive/ops-067.md](archive/ops-067.md) |
| OPS-068 | AI Assistant Resolvers                                | Feature      | P1-High     | Resolved   | [archive/ops-068.md](archive/ops-068.md) |
| OPS-069 | Assistant Store (Zustand)                             | Feature      | P1-High     | Resolved   | [archive/ops-069.md](archive/ops-069.md) |
| OPS-070 | useAssistant Hook                                     | Feature      | P1-High     | Resolved   | [archive/ops-070.md](archive/ops-070.md) |
| OPS-071 | AssistantPill Components                              | Feature      | P1-High     | Resolved   | [archive/ops-071.md](archive/ops-071.md) |
| OPS-072 | Task & Calendar Intent Handler                        | Feature      | P2-Medium   | Resolved   | [archive/ops-072.md](archive/ops-072.md) |
| OPS-073 | Case Query Intent Handler                             | Feature      | P2-Medium   | Resolved   | [archive/ops-073.md](archive/ops-073.md) |
| OPS-074 | Email Intent Handler                                  | Feature      | P2-Medium   | Resolved   | [archive/ops-074.md](archive/ops-074.md) |
| OPS-075 | Document Intent Handler                               | Feature      | P2-Medium   | Resolved   | [archive/ops-075.md](archive/ops-075.md) |
| OPS-076 | Proactive Briefings Integration                       | Feature      | P2-Medium   | Resolved   | [archive/ops-076.md](archive/ops-076.md) |
| OPS-077 | Service Wrappers for AI Assistant Handlers            | Feature      | P1-High     | Resolved   | [archive/ops-077.md](archive/ops-077.md) |
| OPS-078 | Error Handling & Fallbacks                            | Feature      | P2-Medium   | Resolved   | [archive/ops-078.md](archive/ops-078.md) |
| OPS-079 | Integration Tests                                     | Testing      | P2-Medium   | Resolved   | [archive/ops-079.md](archive/ops-079.md) |
| OPS-080 | E2E Tests                                             | Testing      | P3-Low      | Resolved   | [archive/ops-080.md](archive/ops-080.md) |
| OPS-081 | AI Architecture - Direct Sonnet with Tools            | Architecture | P0-Critical | Resolved   | [archive/ops-081.md](archive/ops-081.md) |
| OPS-082 | Define Claude Tool Schemas                            | Feature      | P0-Critical | Resolved   | [archive/ops-082.md](archive/ops-082.md) |
| OPS-083 | Legal Assistant System Prompt                         | Feature      | P0-Critical | Resolved   | [archive/ops-083.md](archive/ops-083.md) |
| OPS-084 | Direct Sonnet Conversation with Tool Calling          | Feature      | P0-Critical | Resolved   | [archive/ops-084.md](archive/ops-084.md) |
| OPS-085 | Tool Execution Layer                                  | Feature      | P1-High     | Resolved   | [archive/ops-085.md](archive/ops-085.md) |
| OPS-086 | Frontend Tool Response Handling                       | Feature      | P1-High     | Resolved   | [archive/ops-086.md](archive/ops-086.md) |
| OPS-087 | Document & Attachment Preview                         | Feature      | P2-Medium   | Closed     | [archive/ops-087.md](archive/ops-087.md) |
| OPS-088 | Cmd+K Command Palette with cmdk Library               | Feature      | P2-Medium   | Closed     | [archive/ops-088.md](archive/ops-088.md) |
| OPS-089 | /documents Section with Folders                       | Feature      | P1-High     | Closed     | [archive/ops-089.md](archive/ops-089.md) |
| OPS-090 | Email Content Cleaning for Readability                | Feature      | P2-Medium   | Closed     | [archive/ops-090.md](archive/ops-090.md) |
| OPS-091 | Include Sent Emails in Thread Display                 | Feature      | P1-High     | Closed     | [archive/ops-091.md](archive/ops-091.md) |
| OPS-092 | Document Preview Fails with 400 Error                 | Bug          | P1-High     | Closed     | [archive/ops-092.md](archive/ops-092.md) |
| OPS-093 | AI-Created Events Not Appearing in Calendar           | Bug          | P1-High     | Closed     | [archive/ops-093.md](archive/ops-093.md) |
| OPS-094 | AI Assistant Wrong Date and Time for Events           | Bug          | P1-High     | Closed     | [archive/ops-094.md](archive/ops-094.md) |
| OPS-095 | Task Date/Time Simplification                         | Feature      | P2-Medium   | Closed     | [archive/ops-095.md](archive/ops-095.md) |
| OPS-096 | Task Card Display Redesign                            | Feature      | P2-Medium   | Closed     | [archive/ops-096.md](archive/ops-096.md) |
| OPS-097 | AI Task Creation with Editable Duration Card          | Feature      | P1-High     | Closed     | [archive/ops-097.md](archive/ops-097.md) |
| OPS-098 | Duration-Based Calendar Card Spanning                 | Feature      | P3-Low      | Closed     | [archive/ops-098.md](archive/ops-098.md) |
| OPS-099 | Mapa Data Model                                       | Feature      | P1-High     | Closed     | [archive/ops-099.md](archive/ops-099.md) |
| OPS-100 | Mapa Service Layer                                    | Feature      | P1-High     | Closed     | [archive/ops-100.md](archive/ops-100.md) |
| OPS-101 | Mapa GraphQL Schema & Resolvers                       | Feature      | P1-High     | Closed     | [archive/ops-101.md](archive/ops-101.md) |
| OPS-102 | Mapa UI Components                                    | Feature      | P1-High     | Closed     | [archive/ops-102.md](archive/ops-102.md) |
| OPS-103 | Mapa Print/Export Functionality                       | Feature      | P2-Medium   | Closed     | [archive/ops-103.md](archive/ops-103.md) |
| OPS-104 | Document Preview Fails for Non-Uploader Users         | Bug          | P1-High     | Closed     | [archive/ops-104.md](archive/ops-104.md) |
| OPS-105 | SharePoint Site Configuration                         | Infra        | P0-Critical | Closed     | [archive/ops-105.md](archive/ops-105.md) |
| OPS-106 | SharePoint Service Layer                              | Feature      | P1-High     | Closed     | [archive/ops-106.md](archive/ops-106.md) |
| OPS-107 | SharePoint GraphQL Schema Updates                     | Feature      | P1-High     | Closed     | [archive/ops-107.md](archive/ops-107.md) |
| OPS-108 | Document Upload to SharePoint                         | Feature      | P1-High     | Closed     | [archive/ops-108.md](archive/ops-108.md) |
| OPS-109 | Document Preview/Download from SharePoint             | Feature      | P1-High     | Closed     | [archive/ops-109.md](archive/ops-109.md) |
| OPS-110 | Document Migration to SharePoint                      | Feature      | P2-Medium   | Closed     | [archive/ops-110.md](archive/ops-110.md) |
| OPS-111 | Document Grid UI with Thumbnails                      | Feature      | P2-Medium   | Closed     | [archive/ops-111.md](archive/ops-111.md) |
| OPS-112 | Apollo Client Missing x-ms-access-token Header        | Bug          | P1-High     | Closed     | [archive/ops-112.md](archive/ops-112.md) |
| OPS-113 | Rule-Based Document Filtering                         | Feature      | P2-Medium   | Closed     | [archive/ops-113.md](archive/ops-113.md) |
| OPS-114 | Permanent Document Thumbnails                         | Feature      | P2-Medium   | Closed     | [archive/ops-114.md](archive/ops-114.md) |
| OPS-115 | AI Context Files - Data Model                         | Feature      | P1-High     | Closed     | [archive/ops-115.md](archive/ops-115.md) |
| OPS-116 | Event Emission Infrastructure                         | Feature      | P1-High     | Closed     | [archive/ops-116.md](archive/ops-116.md) |
| OPS-117 | User Daily Context Service                            | Feature      | P1-High     | Closed     | [archive/ops-117.md](archive/ops-117.md) |
| OPS-118 | Case Briefing Service                                 | Feature      | P1-High     | Closed     | [archive/ops-118.md](archive/ops-118.md) |
| OPS-119 | AI Assistant Context Integration                      | Feature      | P1-High     | Closed     | [archive/ops-119.md](archive/ops-119.md) |
| OPS-120 | Notification Engine                                   | Feature      | P2-Medium   | Closed     | [archive/ops-120.md](archive/ops-120.md) |
| OPS-121 | Conversation-First Thread View                        | Feature      | P1-High     | Closed     | [archive/ops-121.md](archive/ops-121.md) |
| OPS-122 | Inline Attachment Preview Panel                       | Feature      | P1-High     | Closed     | [archive/ops-122.md](archive/ops-122.md) |
| OPS-123 | Thread-Level AI Summary                               | Feature      | P2-Medium   | Closed     | [archive/ops-123.md](archive/ops-123.md) |
| OPS-124 | Three-Pane Communications Layout                      | Feature      | P1-High     | Closed     | [archive/ops-124.md](archive/ops-124.md) |
| OPS-125 | Auto-Add Sender as Case Contact on Assignment         | Feature      | P2-Medium   | Closed     | [archive/ops-125.md](archive/ops-125.md) |
| OPS-126 | Email Direction Misclassification (Sent as Received)  | Bug          | P1-High     | Closed     | [archive/ops-126.md](archive/ops-126.md) |
| OPS-127 | Thread Emails Missing Attachments in ConversationView | Bug          | P1-High     | Closed     | [archive/ops-127.md](archive/ops-127.md) |
| OPS-128 | Email Attachment Sync Not Fetching from MS Graph      | Bug/Arch     | P1-High     | Closed     | [archive/ops-128.md](archive/ops-128.md) |
| OPS-129 | Communications - Reduce Default Limit to 50           | Performance  | P1-High     | Closed     | [archive/ops-129.md](archive/ops-129.md) |
| OPS-130 | Communications - Split Email Fragments                | Performance  | P1-High     | Closed     | [archive/ops-130.md](archive/ops-130.md) |
| OPS-131 | Documents - DataLoader for Source Case Lookups        | Performance  | P1-High     | Closed     | [archive/ops-131.md](archive/ops-131.md) |
| OPS-132 | Communications - Add Load More UI                     | UI           | P2-Medium   | Closed     | [archive/ops-132.md](archive/ops-132.md) |
| OPS-133 | Documents - Add Pagination UI                         | UI           | P2-Medium   | Closed     | [archive/ops-133.md](archive/ops-133.md) |
| OPS-134 | Document Preview Action Types & Interfaces            | Feature      | P2-Medium   | Closed     | [archive/ops-134.md](archive/ops-134.md) |
| OPS-135 | Save Email Attachment to Documents Mutation           | Feature      | P2-Medium   | Resolved   | [archive/ops-135.md](archive/ops-135.md) |
| OPS-136 | Mark Attachment as Irrelevant Mutation                | Feature      | P2-Medium   | Closed     | [archive/ops-136.md](archive/ops-136.md) |
| OPS-137 | DocumentPreviewModal Action Toolbar Component         | Feature      | P2-Medium   | Closed     | [archive/ops-137.md](archive/ops-137.md) |
| OPS-138 | Role-Based Action Filtering System                    | Feature      | P2-Medium   | Closed     | [archive/ops-138.md](archive/ops-138.md) |
| OPS-139 | DocumentsContentPanel Context Integration             | Feature      | P2-Medium   | Closed     | [archive/ops-139.md](archive/ops-139.md) |
| OPS-140 | AttachmentPreviewPanel Context Integration            | Feature      | P2-Medium   | Closed     | [archive/ops-140.md](archive/ops-140.md) |
| OPS-141 | MessageView Preview Actions                           | Feature      | P3-Low      | Closed     | [archive/ops-141.md](archive/ops-141.md) |
| OPS-142 | AI Prompts Romanian Localization                      | Feature      | P2-Medium   | Closed     | [archive/ops-142.md](archive/ops-142.md) |
| OPS-143 | Tailwind Animation Config Enhancement                 | Feature      | P2-Medium   | Closed     | [archive/ops-143.md](archive/ops-143.md) |
| OPS-144 | Framer Motion Setup & Motion Components               | Feature      | P2-Medium   | Closed     | [archive/ops-144.md](archive/ops-144.md) |
| OPS-145 | Collapsible Height Animation Pattern                  | Feature      | P2-Medium   | Closed     | [archive/ops-145.md](archive/ops-145.md) |
| OPS-146 | List Animation Integration                            | Feature      | P2-Medium   | Closed     | [archive/ops-146.md](archive/ops-146.md) |
| OPS-147 | Card Hover & Loading State Polish                     | Feature      | P2-Medium   | Closed     | [archive/ops-147.md](archive/ops-147.md) |
| OPS-148 | Skeleton Shimmer Loading Pattern                      | Feature      | P2-Medium   | Closed     | [archive/ops-148.md](archive/ops-148.md) |
| OPS-149 | Tab & Panel Transition Animations                     | Feature      | P3-Low      | Closed     | [archive/ops-149.md](archive/ops-149.md) |
| OPS-150 | AI Report Types Definition                            | Task         | P2-Medium   | Closed     | [archive/ops-150.md](archive/ops-150.md) |
| OPS-151 | Predefined Report Templates + Metadata Integration    | Feature      | P2-Medium   | Resolved   | [archive/ops-151.md](archive/ops-151.md) |
| OPS-152 | Report AI Insight Service                             | Feature      | P2-Medium   | Closed     | [archive/ops-152.md](archive/ops-152.md) |
| OPS-153 | Report Data Aggregation Service                       | Feature      | P2-Medium   | Closed     | [archive/ops-153.md](archive/ops-153.md) |
| OPS-154 | Reports GraphQL Schema & Resolvers                    | Feature      | P2-Medium   | Resolved   | [archive/ops-154.md](archive/ops-154.md) |
| OPS-155 | useReportData Hook + ReportViewer Integration         | Feature      | P2-Medium   | Resolved   | [archive/ops-155.md](archive/ops-155.md) |
| OPS-156 | Fix cases-status-overview date filtering              | Bug          | P2-Medium   | Closed     | [archive/ops-156.md](archive/ops-156.md) |
| OPS-157 | Fix team-workload-distribution aggregation            | Bug          | P2-Medium   | Closed     | [archive/ops-157.md](archive/ops-157.md) |
| OPS-158 | Fix financial-realization-rate calculation            | Bug          | P2-Medium   | Closed     | [archive/ops-158.md](archive/ops-158.md) |
| OPS-159 | Implement cases-deadline-tracker                      | Feature      | P2-Medium   | Closed     | [archive/ops-159.md](archive/ops-159.md) |
| OPS-160 | Implement documents-template-usage                    | Feature      | P2-Medium   | Closed     | [archive/ops-160.md](archive/ops-160.md) |
| OPS-161 | Enhance clients-top-clients with revenue              | Feature      | P3-Low      | Closed     | [archive/ops-161.md](archive/ops-161.md) |
| OPS-162 | Document Preview - 4 Secondary Action Buttons         | Feature      | P2-Medium   | Closed     | [archive/ops-162.md](archive/ops-162.md) |
| OPS-163 | Click-to-Preview Documents with File-Type Actions     | Feature      | P2-Medium   | Closed     | [archive/ops-163.md](archive/ops-163.md) |
| OPS-164 | UI Transitions Not Applied to Current Components      | Bug          | P2-Medium   | Resolved   | [archive/ops-164.md](archive/ops-164.md) |
| OPS-171 | Document Source Type & Review Fields                  | Feature      | P1-High     | Closed     | [archive/ops-171.md](archive/ops-171.md) |
| OPS-172 | Document Status Enum Extension                        | Feature      | P1-High     | Closed     | [archive/ops-172.md](archive/ops-172.md) |
| OPS-173 | Documents Tab Separation UI                           | Feature      | P1-High     | Closed     | [archive/ops-173.md](archive/ops-173.md) |
| OPS-174 | Supervisor Review Queue Tab                           | Feature      | P2-Medium   | Closed     | [archive/ops-174.md](archive/ops-174.md) |
| OPS-175 | Promote Attachment to Working Document                | Feature      | P2-Medium   | Closed     | [archive/ops-175.md](archive/ops-175.md) |
| OPS-176 | Document Version History Drawer                       | Feature      | P2-Medium   | Closed     | [archive/ops-176.md](archive/ops-176.md) |
| OPS-177 | Review Workflow Actions                               | Feature      | P2-Medium   | Closed     | [archive/ops-177.md](archive/ops-177.md) |
| OPS-178 | SharePoint Edit Session Schema                        | Feature      | P1-High     | Closed     | [archive/ops-178.md](archive/ops-178.md) |
| OPS-179 | SharePoint Change Detection Methods                   | Feature      | P1-High     | Closed     | [archive/ops-179.md](archive/ops-179.md) |
| OPS-180 | SharePoint Document Download Method                   | Feature      | P1-High     | Closed     | [archive/ops-180.md](archive/ops-180.md) |
| OPS-181 | SharePoint-First openInWord Flow                      | Feature      | P1-High     | Closed     | [archive/ops-181.md](archive/ops-181.md) |
| OPS-182 | Lazy Version Sync on Document Access                  | Feature      | P1-High     | Closed     | [archive/ops-182.md](archive/ops-182.md) |
| OPS-183 | Frontend Auto-Sync Integration                        | Feature      | P2-Medium   | Closed     | [archive/ops-183.md](archive/ops-183.md) |
| OPS-184 | OneDrive to SharePoint Lazy Migration                 | Feature      | P3-Low      | Closed     | [archive/ops-184.md](archive/ops-184.md) |
| OPS-185 | Unify Case Communications with Thread View            | Feature      | P2-Medium   | Closed     | [archive/ops-185.md](archive/ops-185.md) |
| OPS-186 | Case Communications Shows Unrelated Emails            | Bug          | P1-High     | Closed     | [archive/ops-186.md](archive/ops-186.md) |
| OPS-187 | Schema - PersonalContact + Email Privacy Fields       | Feature      | P1-High     | Closed     | [archive/ops-187.md](archive/ops-187.md) |
| OPS-188 | SplitAssignmentButton Component                       | Feature      | P1-High     | Closed     | [archive/ops-188.md](archive/ops-188.md) |
| OPS-189 | Sidebar Sender-First Display                          | Feature      | P2-Medium   | Closed     | [archive/ops-189.md](archive/ops-189.md) |
| OPS-190 | Personal Contacts Service + GraphQL                   | Feature      | P1-High     | Closed     | [archive/ops-190.md](archive/ops-190.md) |
| OPS-191 | Email Privacy Service + GraphQL                       | Feature      | P1-High     | Closed     | [archive/ops-191.md](archive/ops-191.md) |
| OPS-192 | Action Bar - Outlook + Compose Button                 | Feature      | P2-Medium   | Closed     | [archive/ops-192.md](archive/ops-192.md) |
| OPS-193 | Personal Contacts Profile Page                        | Feature      | P2-Medium   | Closed     | [archive/ops-193.md](archive/ops-193.md) |
| OPS-194 | Partner Privacy UI + Case Details Filter              | Feature      | P2-Medium   | Closed     | [archive/ops-194.md](archive/ops-194.md) |
| OPS-195 | Multi-Case Confirmation Flow                          | Feature      | P1-High     | Closed     | [archive/ops-195.md](archive/ops-195.md) |
| OPS-196 | NECLAR Inline Assignment                              | Feature      | P1-High     | Closed     | [archive/ops-196.md](archive/ops-196.md) |
| OPS-197 | Document Rule - Assigned Emails Only                  | Feature      | P2-Medium   | Closed     | [archive/ops-197.md](archive/ops-197.md) |
| OPS-198 | Remove ClassificationModal                            | Feature      | P2-Medium   | Closed     | [archive/ops-198.md](archive/ops-198.md) |
| OPS-199 | Production Data Reset - Full Wipe & Fresh Start       | Migration    | P1-High     | Ready      | [issues/ops-199.md](issues/ops-199.md)   |
| OPS-200 | Debug SplitAssignmentButton Visibility                | Bug          | P1-High     | Closed     | [archive/ops-200.md](archive/ops-200.md) |
| OPS-201 | Move "+" Button to ConversationHeader                 | Feature      | P2-Medium   | Closed     | [archive/ops-201.md](archive/ops-201.md) |
| OPS-202 | blockSenderFromSync Mutation                          | Feature      | P1-High     | Closed     | [archive/ops-202.md](archive/ops-202.md) |
| OPS-203 | Restructure Assigned Email Action Bar                 | Feature      | P1-High     | Closed     | [archive/ops-203.md](archive/ops-203.md) |
| OPS-204 | Restructure NECLAR Action Bar                         | Feature      | P1-High     | Closed     | [archive/ops-204.md](archive/ops-204.md) |
| OPS-205 | Partner Privacy E2E Verification                      | Testing      | P2-Medium   | Closed     | [archive/ops-205.md](archive/ops-205.md) |
| OPS-206 | Merge NECLAR + Unassigned with Inline Assignment      | Feature      | P1-High     | Closed     | [archive/ops-206.md](archive/ops-206.md) |
| OPS-207 | useCaseEditPermission Hook                            | Feature      | P2-Medium   | Closed     | [archive/ops-207.md](archive/ops-207.md) |
| OPS-208 | useDraftCase Hook                                     | Feature      | P2-Medium   | Closed     | [archive/ops-208.md](archive/ops-208.md) |
| OPS-209 | DraftModeToolbar Component                            | Feature      | P2-Medium   | Closed     | [archive/ops-209.md](archive/ops-209.md) |
| OPS-210 | CaseDetailsSection Component                          | Feature      | P2-Medium   | Closed     | [archive/ops-210.md](archive/ops-210.md) |
| OPS-211 | ContactsSection Component                             | Feature      | P2-Medium   | Closed     | [archive/ops-211.md](archive/ops-211.md) |
| OPS-212 | ReferencesSection Component                           | Feature      | P2-Medium   | Closed     | [archive/ops-212.md](archive/ops-212.md) |
| OPS-213 | BillingSection Component                              | Feature      | P2-Medium   | Closed     | [archive/ops-213.md](archive/ops-213.md) |
| OPS-214 | OverviewTab Refactor                                  | Refactor     | P2-Medium   | Closed     | [archive/ops-214.md](archive/ops-214.md) |
| OPS-215 | CaseHeader Edit Toggle                                | Feature      | P2-Medium   | Closed     | [archive/ops-215.md](archive/ops-215.md) |
| OPS-216 | Draft Mode New Case Page                              | Feature      | P2-Medium   | Closed     | [archive/ops-216.md](archive/ops-216.md) |
| OPS-217 | Remove Case Modals & Update Entry Points              | Refactor     | P2-Medium   | Closed     | [archive/ops-217.md](archive/ops-217.md) |
| OPS-218 | Court Case Number Field in Case UI                    | Feature      | P2-Medium   | Closed     | [archive/ops-218.md](archive/ops-218.md) |
| OPS-219 | Expand CaseActorRole Enum                             | Feature      | P2-Medium   | Closed     | [archive/ops-219.md](archive/ops-219.md) |
| OPS-220 | ActorTypeConfig Data Model                            | Feature      | P2-Medium   | Closed     | [archive/ops-220.md](archive/ops-220.md) |
| OPS-221 | ActorTypeConfig GraphQL & Service                     | Feature      | P2-Medium   | Closed     | [archive/ops-221.md](archive/ops-221.md) |
| OPS-222 | useActorTypes Hook                                    | Feature      | P2-Medium   | Closed     | [archive/ops-222.md](archive/ops-222.md) |
| OPS-223 | Actor Type Selection UI                               | Feature      | P2-Medium   | Completed  | [issues/ops-223.md](issues/ops-223.md)   |
| OPS-224 | Fix Case Number Field Label                           | Bug          | P2-Medium   | Resolved   | [issues/ops-224.md](issues/ops-224.md)   |
| OPS-225 | OverviewTab Section Groups                            | Feature      | P2-Medium   | Completed  | [issues/ops-225.md](issues/ops-225.md)   |
| OPS-226 | Client GraphQL Query + Resolver                       | Feature      | P2-Medium   | Completed  | [issues/ops-226.md](issues/ops-226.md)   |
| OPS-227 | Client Profile Page + Case Links                      | Feature      | P2-Medium   | Completed  | [issues/ops-227.md](issues/ops-227.md)   |

---

## Active Issues Summary

### Fluid UI Transitions (Epic) - OPS-143 to OPS-149 - COMPLETED ✅

**Goal**: Make the UI more fluid with transitions on state changes using a hybrid Tailwind + Framer Motion approach.

**Status**: ✅ Complete - animations now visible in main UI components

**Phase 1 - Foundation** (completed):

- ~~OPS-143: Tailwind Animation Config Enhancement~~ ✅
- ~~OPS-144: Framer Motion Setup & Motion Components~~ ✅
- ~~OPS-145: Collapsible Height Animation Pattern~~ ✅

**Phase 2 - Apply Patterns** (completed):

- ~~OPS-146: List Animation Integration~~ ✅
- ~~OPS-147: Card Hover & Loading State Polish~~ ✅
- ~~OPS-148: Skeleton Shimmer Loading Pattern~~ ✅

**Phase 3 - Refinement** (completed):

- ~~OPS-149: Tab & Panel Transition Animations~~ ✅

**Phase 4 - Fix Integration** (completed):

- ~~OPS-164: Apply animations to current active components~~ ✅
  - CaseSidebar: Thread/email list stagger animations
  - ConversationView: Message bubble entrance animations
  - Collapsible/Skeleton: Already working

---

### Predefined Reports with AI-Generated Insights (Epic) - COMPLETED ✅

**Goal**: Populate the empty Reports section with predefined templates that show real data and AI-generated narrative insights in Romanian.

**Phase 1 - Foundation** (completed):

- ~~OPS-150: AI Report Types Definition~~ ✅

**Phase 2 - Backend** (completed):

- ~~OPS-151: Predefined Report Templates + Metadata Integration~~ ✅
- ~~OPS-152: Report AI Insight Service~~ ✅
- ~~OPS-153: Report Data Aggregation Service~~ ✅

**Phase 3 - API Layer** (completed):

- ~~OPS-154: Reports GraphQL Schema & Resolvers~~ ✅

**Phase 4 - Frontend** (completed):

- ~~OPS-155: useReportData Hook + ReportViewer Integration~~ ✅

---

### Reports Data Accuracy (Epic) - OPS-156 to OPS-161 - COMPLETED ✅

**Goal**: Fix reports that show incorrect or no data due to wrong field names, date filtering, or missing specialized aggregation methods.

**Context**: Investigation found that `getCasesByType()` was using non-existent `caseType` enum field instead of dynamic `type` field. Similar issues exist in other reports.

**Phase 1 - Quick Fixes** (parallel) - COMPLETED ✅:

- ~~OPS-156: Fix cases-status-overview date filtering (should show all cases, not filtered by openedDate)~~ ✅
- ~~OPS-157: Fix team-workload-distribution (should show cases per team member, not task status)~~ ✅
- ~~OPS-158: Fix financial-realization-rate (needs billable/total hours ratio, not revenue by client)~~ ✅

**Phase 2 - New Implementations** (parallel) - COMPLETED ✅:

- ~~OPS-159: Implement cases-deadline-tracker (query tasks with due dates, group by urgency)~~ ✅
- ~~OPS-160: Implement documents-template-usage (track template usage frequency)~~ ✅

**Phase 3 - Enhancements** - COMPLETED ✅:

- ~~OPS-161: Enhance clients-top-clients with revenue data~~ ✅

---

### Context-Aware Document Preview Actions (Epic) - COMPLETED ✅

**Goal**: Add contextual action toolbar to document preview modal so users can act on documents without closing the preview.

**Phase 1 - Foundation** (completed):

- ~~OPS-134: Action types & interfaces~~ ✅
- ~~OPS-135: Save attachment to documents mutation~~ ✅
- ~~OPS-136: Mark attachment irrelevant mutation~~ ✅

**Phase 2 - UI Components** (completed):

- ~~OPS-137: Action toolbar component~~ ✅
- ~~OPS-138: Role-based filtering~~ ✅

**Phase 3 - Integration** (completed):

- ~~OPS-139: Documents panel integration~~ ✅
- ~~OPS-140: Attachment panel integration~~ ✅
- ~~OPS-141: MessageView integration~~ ✅

---

### Communications UX Overhaul (Epic) - OPS-187 to OPS-199

**Goal**: Replace modal-based email classification with inline assignment, add personal contact blocklist, partner privacy marking, and require confirmation for multi-case senders. Wipe existing classifications for fresh start.

**Key Changes**:

- NECLAR emails open in ThreadView with inline assignment buttons (no modal)
- Split button design: 80/20 split with confidence colors (cyan/yellow/magenta)
- Sidebar shows sender-first for unassigned emails
- "Răspunde" opens Outlook, "+ Nou" for new threads
- "Personal" marks sender as blocklist (emails won't sync)
- Partners can mark emails private (hidden from case details)
- Multi-case senders require confirmation before reply

**Parallelization Map**:

```
Phase 1 (parallel):     OPS-187 + OPS-188 + OPS-189
                             │
Phase 2 (parallel):     OPS-190 + OPS-191 + OPS-192
                             │
Phase 3 (parallel):     OPS-193 + OPS-194 + OPS-195 + OPS-196
                             │
Phase 4:                OPS-197 + OPS-198
                             │
Phase 5:                OPS-199 (migration - must be last)
```

**Phase 1 - Foundation** (parallel) - COMPLETE ✅:

- ~~OPS-187: Schema - PersonalContact + Email Privacy Fields~~ ✅
- ~~OPS-188: SplitAssignmentButton Component~~ ✅
- ~~OPS-189: Sidebar Sender-First Display~~ ✅

**Phase 2 - Backend** (after OPS-187) - COMPLETE ✅:

- ~~OPS-190: Personal Contacts Service + GraphQL~~ ✅
- ~~OPS-191: Email Privacy Service + GraphQL~~ ✅
- ~~OPS-192: Action Bar - Outlook + Compose Button~~ ✅

**Phase 3 - Integration** (after Phase 2) - COMPLETE ✅:

- ~~OPS-193: Personal Contacts Profile Page~~ ✅
- ~~OPS-194: Partner Privacy UI + Case Details Filter~~ ✅
- ~~OPS-195: Multi-Case Confirmation Flow~~ ✅
- ~~OPS-196: NECLAR Inline Assignment~~ ✅

**Phase 4 - Cleanup** (after Phase 3) - COMPLETE ✅:

- ~~OPS-197: Document Rule - Assigned Emails Only~~ ✅
- ~~OPS-198: Remove ClassificationModal~~ ✅

**Phase 5 - Migration** (after all above):

- OPS-199: Production Data Reset - Full Wipe & Fresh Start

---

### Communications Action Bar Redesign (Epic) - OPS-200 to OPS-205 - COMPLETED ✅

**Goal**: Fix action bar UI issues - SplitAssignmentButton not visible, wrong buttons for assigned vs NECLAR emails, partner privacy verification.

**Key Changes**:

- Fix SplitAssignmentButton visibility bug (80/20 split for NECLAR)
- Assigned emails: AI draft compose instead of Outlook, add Forward/Notify buttons
- NECLAR emails: Add "Răspunde" (Outlook) + "Privat" (block sender), remove "Ignoră"
- Move "+" button to header
- Verify partner privacy flow end-to-end

**Parallelization Map**:

```
Phase 1 (parallel):     OPS-200 + OPS-201 + OPS-202
                             │         │         │
Phase 2 (parallel):     OPS-203  +  OPS-204
                             │         │
Phase 3:                OPS-205
```

**Phase 1 - Foundation** (parallel) - COMPLETE ✅:

- ~~OPS-200: Debug SplitAssignmentButton Visibility~~ ✅
- ~~OPS-201: Move "+" Button to ConversationHeader~~ ✅
- ~~OPS-202: blockSenderFromSync Mutation~~ ✅ (already implemented in OPS-190)

**Phase 2 - Action Bar Restructure** (after Phase 1) - COMPLETE ✅:

- ~~OPS-203: Restructure Assigned Email Action Bar~~ ✅
- ~~OPS-204: Restructure NECLAR Action Bar~~ ✅

**Phase 3 - Verification** (after Phase 2) - COMPLETE ✅:

- ~~OPS-205: Partner Privacy E2E Verification~~ ✅

**Next:** OPS-206 - Merge NECLAR + Unassigned with inline drop-up case picker

---

### Documents Separation & Review Workflow (Epic) - OPS-171 to OPS-177

**Goal**: Separate working documents from email attachments, enable attachment-to-document promotion, add version history UI, and create supervisor review queue.

**Parallelization Map**:

```
Wave 1 (parallel):     OPS-171 + OPS-172 + OPS-176
                           │         │
Wave 2 (parallel):    OPS-173 + OPS-175
                           │
Wave 3:               OPS-174
                           │
Wave 4:               OPS-177
```

**Phase 1 - Foundation** (parallel):

- OPS-171: Document Source Type & Review Fields (schema)
- OPS-172: Document Status Enum Extension (IN_REVIEW, CHANGES_REQUESTED)
- OPS-176: Document Version History Drawer (independent)

**Phase 2 - Tab Separation** (after Phase 1):

- OPS-173: Documents Tab Separation UI ("Documente de lucru" | "Corespondență")
- OPS-175: Promote Attachment to Working Document

**Phase 3 - Supervisor Queue** (after OPS-173):

- OPS-174: Supervisor Review Queue Tab ("De revizuit")

**Phase 4 - Review Workflow** (after OPS-174):

- OPS-177: Review Workflow Actions (submit, approve, request changes)

---

### Frictionless SharePoint-First Document Editing (Epic) - OPS-178 to OPS-184

**Goal**: Eliminate friction when opening documents in Word. Currently takes 3-8 seconds (R2 download → OneDrive upload). New flow uses SharePoint directly (<1 second) and auto-detects Word edits to create versions.

**Key Insight**: SharePoint documents already have a `webUrl` that works with `ms-word:` protocol. No need to copy to OneDrive.

**Parallelization Map**:

```
Phase 1 (parallel):     OPS-178 + OPS-179 + OPS-180
                             │         │         │
Phase 2 (parallel):     OPS-181  +  OPS-182
                             │         │
Phase 3:                OPS-183 [blocked by: 182]
                             │
Phase 4 (optional):     OPS-184 [blocked by: 181]
```

**Phase 1 - Foundation** (parallel) - COMPLETE ✅:

- ~~OPS-178: SharePoint Edit Session Schema (add lastModified tracking)~~ ✅
- ~~OPS-179: SharePoint Change Detection Methods (checkForChanges)~~ ✅
- ~~OPS-180: SharePoint Document Download Method (for R2 backup sync)~~ ✅

**Phase 2 - Core Flow** (after Phase 1):

- OPS-181: SharePoint-First openInWord Flow (skip OneDrive copy)
- OPS-182: Lazy Version Sync on Document Access (auto-detect edits)

**Phase 3 - Frontend** (after OPS-182):

- OPS-183: Frontend Auto-Sync Integration (toast, version badge)

**Phase 4 - Migration** (optional, after OPS-181):

- OPS-184: OneDrive to SharePoint Lazy Migration

---

### Expandable Case Workspace (Epic) - OPS-207 to OPS-217

**Goal**: Replace modal-based case creation/editing with inline editing in the case workspace. Partners and Case Leads can edit directly in the Overview tab. New cases created at `/cases/new` in draft mode.

**Key Design Decisions**:

- Per-field saves (existing `InlineEditField` pattern)
- Warning on navigation for unsaved draft
- Leads can edit without approval (same as Partners)
- Progressive tabs: only show tabs with content in draft mode

**Parallelization Map**:

```
Phase 1 (parallel):     OPS-207 + OPS-208 + OPS-209
                             │
Phase 2 (parallel):     OPS-210 + OPS-211 + OPS-212 + OPS-213 [blocked by: 207]
                             │
Phase 3 (parallel):     OPS-214 [blocked by: 210-213] + OPS-215 [blocked by: 207]
                             │
Phase 4:                OPS-216 [blocked by: 208, 209, 214]
                             │
Phase 5:                OPS-217 [blocked by: 216]
```

**Phase 1 - Foundation** (parallel) - COMPLETE ✅:

- ~~OPS-207: useCaseEditPermission Hook (Partner/Lead check)~~ ✅
- ~~OPS-208: useDraftCase Hook (local state + useBeforeUnload)~~ ✅
- ~~OPS-209: DraftModeToolbar Component (floating save/cancel)~~ ✅

**Phase 2 - Section Components** (after OPS-207) - COMPLETE ✅:

- ~~OPS-210: CaseDetailsSection Component~~ ✅
- ~~OPS-211: ContactsSection Component~~ ✅
- ~~OPS-212: ReferencesSection Component~~ ✅
- ~~OPS-213: BillingSection Component (FinancialData wrapped)~~ ✅

**Phase 3 - Integration** (after Phase 2) - COMPLETE ✅:

- ~~OPS-214: OverviewTab Refactor (use section components)~~ ✅
- ~~OPS-215: CaseHeader Edit Toggle (?edit=true)~~ ✅

**Phase 4 - New Case Page** (after Phase 3) - COMPLETE ✅:

- ~~OPS-216: Draft Mode New Case Page (/cases/new)~~ ✅

**Phase 5 - Cleanup** (after Phase 4):

- OPS-217: Remove Case Modals & Update Entry Points

---

### Court Case Number + Dynamic Actor Types (Epic) - OPS-218 to OPS-223 ✅ COMPLETED

**Goal**: Add first-class court case number field to case create/edit, expand built-in actor roles for Romanian legal practice, and enable Partners to create custom actor types per firm.

**Key Changes**:

- Surface existing `caseNumber` DB field as "Nr. Dosar Instanță" in case UI
- Expand CaseActorRole enum with 8 new roles (Intervenient, Mandatar, Court, etc.)
- New ActorTypeConfig model for firm-scoped custom actor types
- Backwards-compatible: built-in roles use enum, custom roles use `customRoleCode` field
- "+ Tip nou" inline form for Partners (following CaseTypeConfig pattern)

**All phases completed**:

- ✅ OPS-218: Court Case Number Field in Case UI
- ✅ OPS-219: Expand CaseActorRole Enum
- ✅ OPS-220: ActorTypeConfig Data Model
- ✅ OPS-221: ActorTypeConfig GraphQL & Service
- ✅ OPS-222: useActorTypes Hook
- ✅ OPS-223: Actor Type Selection UI

---

### Case Details UI Improvements (Epic) - OPS-224 to OPS-227 - COMPLETED ✅

**Goal**: Fix case number field mislabeling, separate operational overview from editable details, and add client portfolio view for multi-case client management.

**Key Changes**:

- Fix caseNumber label from "Nr. Dosar Instanță" to "Număr Intern" (it's internal ref, not court number)
- Add collapsible section groups to OverviewTab: "Informații Dosar" (editable) vs "Stare Operațională" (read-only)
- Add client profile page showing all cases for a client
- Make client name in case details clickable to navigate to client profile

**All phases completed**:

- ~~OPS-224: Fix Case Number Field Label (Bug)~~ ✅
- ~~OPS-225: OverviewTab Section Groups~~ ✅
- ~~OPS-226: Client GraphQL Query + Resolver~~ ✅
- ~~OPS-227: Client Profile Page + Case Links~~ ✅

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
    └── ops-001.md through ops-126.md
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
