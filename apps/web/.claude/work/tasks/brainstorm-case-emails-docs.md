# Brainstorm: Emails & Documents in Case Detail

**Status**: Complete
**Date**: 2026-01-02
**Next step**: `/research brainstorm-case-emails-docs`

---

## Context

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Apollo Client (GraphQL), Radix UI
**Design System**: Superhuman-inspired dark theme (see `.claude/docs/mobile-ux.md`)
**Backend**: GraphQL gateway at localhost:4000 (bojin-law-2 monorepo)

**Current State**:

- Mobile UI exists at `src/app/m/**`
- Case detail page: `src/app/m/cases/[id]/page.tsx`
- Case detail mockup: `mockups/case-detail.html`
- Current tabs in case detail: likely just task list (needs verification)

**Goal**: Add emails and documents as tabs within case detail view on mobile.

---

## Problem Statement

Lawyers need to access case-related emails and documents from mobile. Currently, the case detail view doesn't include these. We need to incorporate them in a way that:

1. Keeps case info visible at a glance
2. Handles 50+ items per case efficiently
3. Supports reading, expanding, and replying to emails
4. Supports previewing documents inline
5. Includes AI-assisted reply functionality

---

## Decisions

### Layout: Hybrid (Option C)

- **Sticky case info card** at top (always visible)
- **Horizontal tabs** below: Taskuri | Emails | Documente
- **Swipeable** tab content for natural mobile navigation

### Tab Structure

```
┌─────────────────────────────┐
│ ← Smith v. Jones        ⋯  │  Header with back nav
├─────────────────────────────┤
│ [Compact case info card]    │  Always visible summary
├─────────────────────────────┤
│ Taskuri │ Emails │ Docs     │  Horizontal tabs
├─────────────────────────────┤
│ [Tab content area]          │  Scrollable content
│                             │
└─────────────────────────────┘
        [🔍 Caută]              FAB for search
```

### Email Behavior

| Feature        | Behavior                                               |
| -------------- | ------------------------------------------------------ |
| List view      | Sender, subject, preview, timestamp                    |
| Expand         | Tap to expand inline (accordion style)                 |
| Collapse       | Tap header or another email                            |
| Reply actions  | At bottom of expanded email                            |
| AI Reply       | "Răspunde cu AI" button - prominent, with sparkle icon |
| Standard reply | Răspunde, Răspunde tuturor, Redirecționează            |

### Document Behavior

| Feature           | Behavior                                  |
| ----------------- | ----------------------------------------- |
| List view         | Icon by type, filename, size, date        |
| Preview           | Tap to expand inline preview              |
| Supported formats | PDF, images, Word, Excel (common formats) |
| Full view         | Option to open in full-screen viewer      |
| Download          | Available from expanded view              |

### Search (FAB)

- FAB button at bottom center: "Caută"
- Opens search overlay
- Searches within current tab (emails or documents)
- Filter options: date range, sender/uploader, has attachments

### Volume Handling (50+ items)

- Infinite scroll with virtualization
- Search/filter per tab
- Sort options: newest first (default), oldest, by sender

---

## Rationale

### Why Hybrid Layout (Option C)?

- Case info always visible = context preserved while browsing
- Tabs = focused views for each content type
- Better than pure sections (too long to scroll with 50+ items)
- Better than tabs-only (loses case context)

### Why Inline Expand (not new page)?

- Faster to scan multiple emails
- Keeps context of case and email list
- Reduces navigation depth
- Natural for "triage" workflow

### Why FAB for Search (not compose)?

- Compose is contextual to a specific email (reply)
- Search is global action needed from anywhere in the list
- FAB for compose would add navigation complexity

### Why AI Reply as Primary Action?

- Differentiating feature of the platform
- Lawyers benefit from AI drafting
- Standard reply still available as secondary option

---

## Open Questions for Research

- [ ] What is the email data structure from the GraphQL backend?
- [ ] What is the document data structure from the GraphQL backend?
- [ ] Are there existing queries for case emails/documents in bojin-law-2?
- [ ] What is the current case detail page structure in the codebase?
- [ ] What does the case-detail.html mockup currently show?
- [ ] What document preview libraries work well with Next.js 16?
- [ ] How should the AI reply flow work? (inline compose or bottom sheet?)
- [ ] Should swipe gestures be supported for tabs?

---

## Visual Reference

### Email List Item

```
┌─────────────────────────────────────────┐
│ 👤  Ion Popescu                    14:32│
│     Re: Revizuire contract              │
│     Am primit documentele și voi...     │
│                                    📎 2 │
└─────────────────────────────────────────┘
```

### Expanded Email

```
┌─────────────────────────────────────────┐
│ 👤  Ion Popescu                    14:32│
│     Re: Revizuire contract              │
├─────────────────────────────────────────┤
│                                         │
│ Bună ziua,                              │
│                                         │
│ Am primit documentele și voi reveni     │
│ cu comentarii până mâine dimineață.     │
│                                         │
│ Cu stimă,                               │
│ Ion Popescu                             │
│                                         │
│ 📎 contract-v2.pdf (2.4 MB)             │
│ 📎 anexa-1.docx (540 KB)                │
│                                         │
├─────────────────────────────────────────┤
│ ✨ Răspunde cu AI                       │
├─────────────────────────────────────────┤
│ ↩ Răspunde  │ ↩↩ Tuturor │ → Redirecț. │
└─────────────────────────────────────────┘
```

### Document List Item

```
┌─────────────────────────────────────────┐
│ 📄  Contract servicii juridice.pdf      │
│     2.4 MB · Adăugat de Ion · 2 zile    │
└─────────────────────────────────────────┘
```

### Document Expanded (PDF Preview)

```
┌─────────────────────────────────────────┐
│ 📄  Contract servicii juridice.pdf   ✕  │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │      [PDF Preview - Page 1/5]       │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│        ◀ 1 / 5 ▶                        │
├─────────────────────────────────────────┤
│ 📥 Descarcă     🔗 Deschide complet     │
└─────────────────────────────────────────┘
```

---

## Next Step

Start a new session and run:

```
/research brainstorm-case-emails-docs
```

This will investigate the backend data structures, existing queries, current case detail implementation, and document preview options.
