# Brainstorm: Mape Feature + ONRC Integration

**Status**: Complete
**Date**: 2024-12-29
**Next step**: `/research brainstorm-mape-onrc`

---

## Context

**Project**: bojin-law-ui (Next.js 16 legal platform UI)
**Backend**: bojin-law-2 (GraphQL gateway, partial mape implementation exists)
**Tech stack**: Next.js 16, TypeScript, Apollo Client, Tailwind, Radix UI
**Users**: Lawyers and paralegals at Romanian law firm

---

## Problem Statement

The firm needs a robust "mape" (binder) feature to manage document collections for cases. Currently, binders are created manually with ad-hoc checklists.

Two key improvements needed:

1. **ONRC integration**: Pre-built templates for all SRL procedures from onrc.ro, auto-synced monthly
2. **Smart automation**: Auto-detect existing docs, auto-request missing docs, auto-generate forms

---

## Feature Definition

### What is a Mape?

A **mape** (binder) is a case-linked document collection with a checklist. It has a physical output: printed cover page + documents in order.

### Data Model

```
Template
├── id
├── name (e.g., "Înființare SRL")
├── source (onrc | custom)
├── sourceUrl (for ONRC templates - page to monitor)
├── lastSynced (timestamp)
├── contentHash (for change detection)
├── items[]
│   ├── name
│   ├── description
│   ├── defaultResponsible (internal | client | other)
│   ├── generatable (boolean - can system create this?)
│   └── templateId (link to doc generation template, if generatable)

Mape
├── id
├── case (link)
├── client (link)
├── template (optional link - null if created from scratch)
├── assignee (user link - typically paralegal)
├── status (incomplete | complete)
├── createdAt
├── completedAt
├── items[]
│   ├── id
│   ├── templateItem (optional link)
│   ├── name
│   ├── order (for print sequence)
│   ├── responsible (user | external contact)
│   ├── status (pending | requested | received | final)
│   ├── document (link to Document entity when assigned)
│   ├── requestedAt (timestamp)
│   ├── lastReminderAt (timestamp)
│   ├── reminderCount (number)
│   └── notes
```

### Workflows

#### 1. Create Mape

**From template (ONRC or custom):**

1. User selects case
2. User picks template (e.g., "Înființare SRL")
3. System creates mape with checklist from template
4. System scans case documents and auto-matches existing docs to checklist items
5. System identifies which items it can generate (forms with client data)
6. User sees: checklist with some items already satisfied, some ready to generate, some need requesting

**From scratch:**

1. User selects case
2. User adds checklist items manually (current behavior)
3. Same auto-matching runs on existing case docs

#### 2. Collect Documents

| Source             | Status Flow                            | System Action                                       |
| ------------------ | -------------------------------------- | --------------------------------------------------- |
| Already in case    | pending → final                        | System auto-suggests, user confirms, doc linked     |
| Request from party | pending → requested → received → final | System drafts email, sends, tracks, reminds         |
| Generate from data | pending → final                        | System prefills template, user reviews, marks final |
| Upload new         | pending → received → final             | User uploads, reviews, marks final                  |

**Reminder escalation:**

- Day 3: First reminder
- Day 7: Second reminder
- Day 8+: Daily reminders

**Email attachments:**

- When user assigns an email attachment to a checklist item, the attachment gets renamed from generic name (e.g., "IMG_2847.pdf") to proper document name (e.g., "Act identitate Ion Popescu.pdf")

#### 3. Complete & Print

**Completion:**

- Mape is "complete" when all items have status = final
- No partial completion states

**Print output:**

1. Cover page: Case name, client name, date, table of contents (checklist in order)
2. Documents: In checklist order, each document in sequence

### ONRC Template Sync

**Approach**: Hybrid (Option C) - Auto-update with changelog

**Monthly sync job (runs on backend):**

1. Fetch all SRL procedure pages from onrc.ro
2. For each procedure:
   - Parse document requirements list
   - Compute content hash
   - Compare with stored template
3. If changed:
   - Update template
   - Log diff (what was added/removed/modified)
   - Mark as "updated on [date]"
4. If scrape fails:
   - Notify admin via email/in-app notification
   - Keep existing template (don't break anything)

**Admin visibility:**

- Dashboard shows last sync time, any failures
- Each template shows "Last updated: [date]" badge
- Changelog viewable per template

**Template integrity:**

- ONRC templates are **locked** (users cannot modify checklist)
- If user needs extra docs, they add to case's /documents and copy to mape
- This ensures ONRC templates always match official requirements

### Document Generation

**Scope for v1:** All SRL-related ONRC forms that can be generated

**How it works:**

1. Template item marked as `generatable = true` with link to doc template
2. When mape created, system checks if it has required data to generate
3. User clicks "Generate" → system prefills template with client/case data
4. User reviews generated document
5. User marks as final → document saved and linked to mape item

**Data sources for prefill:**

- Client entity (name, CUI, address, associates, administrators, etc.)
- Case entity (case-specific data)
- Other documents in case (extracted data - future enhancement)

### Smart Document Matching

**On mape creation:**

1. System scans all documents in the case
2. For each checklist item, system looks for matching documents by:
   - Document type/category
   - Document name patterns
   - Metadata tags
3. Confident matches: auto-link with status = final
4. Uncertain matches: suggest to user, user confirms

**Confidence levels:**

- High (auto-link): Document type exactly matches, recent, belongs to correct client
- Medium (suggest): Name pattern matches, needs user confirmation
- Low (ignore): Don't suggest, user assigns manually if needed

---

## Decisions

| Decision                  | Choice                                           | Rationale                                             |
| ------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| Sync approach             | Hybrid (auto-update + changelog)                 | Automation for efficiency, audit trail for confidence |
| Template modification     | Locked for ONRC templates                        | Ensures compliance with official requirements         |
| Reminder schedule         | 3 days → 7 days → daily                          | Escalation without being immediately aggressive       |
| Document generation scope | All SRL ONRC forms                               | Complete coverage for the target use case             |
| Auto-matching             | System suggests, user confirms uncertain matches | Balance automation with accuracy                      |
| Mape status               | Binary (complete/incomplete)                     | Simple, clear - either ready to print or not          |

---

## Open Questions for Research

- [ ] What is the exact structure of ONRC's website? Can we reliably scrape procedure lists?
- [ ] What SRL procedures exist on ONRC and what are their document requirements?
- [ ] What is the current mape implementation in bojin-law-2? Schema, API, UI components?
- [ ] What document generation approach fits best? (PDF from templates, DOCX manipulation, etc.)
- [ ] How does the current email system work in bojin-law-2? Can we extend it for doc requests?
- [ ] What client/case data is available for prefilling forms?

---

## Architecture Considerations

**Frontend (bojin-law-ui):**

- Mape list view (per case)
- Mape detail view (checklist, statuses, actions)
- Template picker (when creating new mape)
- Document assignment UI (from case docs, emails)
- Print preview / print action
- Admin: template sync status dashboard

**Backend (bojin-law-2):**

- Mape CRUD operations (extend existing)
- Template management
- ONRC sync job (cron, scraper)
- Document request emails + reminder job
- Document generation service
- Document matching service

**Integrations:**

- ONRC website (scraping)
- Email system (requests, reminders)
- Print service (cover page + docs)
- Document storage (existing system)

---

## Next Step

Start a new session and run:

```
/research brainstorm-mape-onrc
```

Research should investigate:

1. ONRC website structure and scrapeability
2. Current bojin-law-2 mape implementation
3. Email system capabilities
4. Document generation options
5. Available client/case data for prefill
