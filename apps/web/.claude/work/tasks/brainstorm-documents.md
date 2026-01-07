# Brainstorm: Documents Feature with OneDrive/SharePoint Integration

**Status**: Complete
**Date**: 2025-12-29
**Next step**: `/research brainstorm-documents`

---

## Context

### Project: bojin-law-ui

- **Path**: `/Users/mio/Developer/bojin-law-ui`
- **Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Apollo Client (GraphQL), Azure MSAL, Zustand
- **Design**: Linear-inspired dark theme
- **Backend**: Reuses GraphQL gateway from bojin-law-2 (`http://localhost:4000/graphql`)

### Reference Implementation: bojin-law-2

- **Path**: `/Users/mio/Developer/bojin-law-2`
- **Existing /documents feature**: Full document management with OneDrive/SharePoint integration
- **Key files**:
  - Schema: `services/gateway/src/graphql/schema/document.graphql` (1,250 lines)
  - Preview: `apps/web/src/components/preview/DocumentPreviewModal.tsx`
  - Components: `apps/web/src/components/documents/` (36 components)
  - Hooks: `apps/web/src/hooks/useDocument*.ts`
  - Database: `packages/database/prisma/schema.prisma`

### Storage Strategy (Unchanged)

- **Primary**: SharePoint (firm-scoped, path: `Cases/{CaseNumber}/Documents/`)
- **Legacy**: OneDrive (user-scoped, pre-migration documents)
- **Fallback**: Cloudflare R2 (when cloud storage unavailable)

---

## Problem Statement

Implement `/documents` feature in bojin-law-ui with:

1. **Improved preview performance** - current Office Online iframes are slow
2. **Real-time sync** - detect SharePoint changes immediately, not just on access
3. **Full feature parity** - review workflow, version control, AI features
4. **Reuse backend** - leverage existing GraphQL mutations/queries

---

## Decisions

### 1. Backend Approach: Selective Reuse

- Reuse existing GraphQL gateway and mutations from bojin-law-2
- Add new endpoints only where improvements require them (webhooks, WebSocket)
- Keep same database schema and storage strategy

### 2. Preview: Progressive Loading (Hybrid)

**Why**: Users see something immediately; full preview loads async

**Implementation**:

1. On document click → show 800x800 thumbnail instantly (already stored in R2)
2. Start loading full preview in background
3. Client-side rendering for common types:
   - Word (.docx) → `docx-preview` library
   - PDF (.pdf) → `pdf.js` / `react-pdf`
   - Excel (.xlsx) → `xlsx` + custom renderer
   - Images → native browser rendering
4. Fall back to Office Online iframe for:
   - Complex Word docs with macros/OLE
   - PowerPoint presentations
   - Unsupported formats
5. Smooth crossfade transition: thumbnail → full preview

**Expected benefit**: Perceived load time drops from 3-5s to <500ms

### 3. Real-time Sync: Microsoft Graph Webhooks

**Why**: Push notifications beat polling; you're already on Azure

**Implementation**:

1. **Webhook endpoint**: New API route to receive Graph notifications
2. **Subscription management**:
   - Subscribe to SharePoint site/folder changes
   - Handle subscription renewal (max 30 days for SharePoint)
   - Store subscription IDs in database
3. **Client notification**:
   - WebSocket connection from frontend to gateway
   - Server broadcasts document changes to relevant clients
   - Show toast: "Document updated externally" with refresh action
4. **Version creation**:
   - On webhook notification → fetch new metadata from Graph
   - Compare with stored version → create new DocumentVersion if changed
   - Update thumbnails if needed

**Webhook payload handling**:

- Validate webhook signature
- Parse changed resource IDs
- Batch notifications (Graph may send multiple)

### 4. Review Workflow: Port As-Is

**Status flow**: DRAFT → IN_REVIEW → CHANGES_REQUESTED → FINAL → ARCHIVED

**Features to port**:

- Single reviewer assignment
- Submit for review with message
- Approve / Request changes decision
- Withdraw from review
- AI concerns detection (integrate with fine-tuned model)
- Review history timeline

**Reuse from bojin-law-2**:

- GraphQL mutations: `submitForReview`, `reviewDocument`, `withdrawFromReview`
- Status update logic in gateway
- Notification triggers

### 5. AI: Fine-tuning on Classified Documents

**Purpose**: Improve concern detection, suggestions, and compliance checking

**Approach**:

- Extract patterns from pool of classified legal documents
- Fine-tune model for domain-specific analysis
- Integrate with review workflow for automated concern detection

**Research needed**:

- Base model selection
- Training data format and preparation
- Hosting/inference infrastructure
- Integration points with existing AI features

### 6. Organization: Defer

- Keep existing folder hierarchy for now
- Smart folders, tags, and full-text search deferred to future iteration

---

## Rationale

| Decision                    | Why This Over Alternatives                                                |
| --------------------------- | ------------------------------------------------------------------------- |
| Selective backend reuse     | Faster than rewrite, allows targeted improvements                         |
| Progressive preview loading | Best perceived performance; hybrid approach handles edge cases            |
| Graph webhooks over polling | True real-time, lower server load, official Microsoft pattern             |
| Port review as-is           | Working system, no user complaints, focus effort on improvements          |
| Fine-tuning over RAG        | User has classified document pool; patterns > retrieval for this use case |

---

## Open Questions for Research

### Preview Performance

- [ ] Which client-side libraries have best fidelity vs. bundle size trade-off?
- [ ] How does `docx-preview` handle complex formatting (tables, images, headers)?
- [ ] What's the fallback detection logic for "too complex for client-side"?
- [ ] Can we lazy-load preview libraries (code splitting)?

### Microsoft Graph Webhooks

- [ ] Exact webhook registration process for SharePoint document libraries
- [ ] Subscription payload structure and validation
- [ ] Renewal strategy (30-day max lifetime)
- [ ] How to map webhook notifications to specific documents in our DB?
- [ ] Rate limits and batching behavior

### WebSocket Architecture

- [ ] Add WebSocket to existing GraphQL gateway or separate service?
- [ ] Authentication for WebSocket connections (reuse MSAL tokens?)
- [ ] Room/channel strategy (per-case? per-user? per-document?)
- [ ] Scaling considerations (multiple gateway instances)

### Fine-tuning Approach

- [ ] Which base model? (GPT-4, Claude, open-source?)
- [ ] Training data format for legal document analysis
- [ ] How to extract patterns from classified documents?
- [ ] Hosting: Azure OpenAI, self-hosted, API provider?
- [ ] Integration with existing `useDocumentIntelligence` hook

### Implementation Sequencing

- [ ] Can preview improvements be done independently of real-time sync?
- [ ] What's the minimum viable /documents for first release?
- [ ] Dependencies between frontend components and backend changes?

---

## Architecture Sketch

```
┌─────────────────────────────────────────────────────────────────┐
│                        bojin-law-ui                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ DocumentGrid │  │PreviewModal  │  │ ReviewWorkflow        │  │
│  │ (thumbnails) │  │(progressive) │  │ (status + AI concerns)│  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘  │
│         │                 │                      │              │
│  ┌──────┴─────────────────┴──────────────────────┴───────────┐  │
│  │                    Apollo Client                          │  │
│  │              + WebSocket subscription                     │  │
│  └──────────────────────────┬────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GraphQL Gateway                              │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ Document       │  │ Webhook Handler │  │ WebSocket Server │  │
│  │ Resolvers      │  │ (Graph notifs)  │  │ (client notifs)  │  │
│  └───────┬────────┘  └────────┬────────┘  └────────┬─────────┘  │
│          │                    │                    │            │
└──────────┼────────────────────┼────────────────────┼────────────┘
           │                    │                    │
           ▼                    ▼                    │
┌──────────────────┐  ┌──────────────────┐           │
│   PostgreSQL     │  │ Microsoft Graph  │◄──────────┘
│   (documents,    │  │ (SharePoint,     │  (webhook push)
│    versions)     │  │  OneDrive)       │
└──────────────────┘  └──────────────────┘
```

---

## Next Step

Start a new session and run:

```
/research brainstorm-documents
```

This will investigate the open questions and produce technical specifications for each component.
