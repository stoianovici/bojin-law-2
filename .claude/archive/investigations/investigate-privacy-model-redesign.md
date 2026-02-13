# Investigation: Privacy Model Redesign - Default Private

**Slug**: privacy-model-redesign
**Date**: 2025-01-12
**Status**: Investigation Complete
**Severity**: N/A (Feature redesign, not bug)
**Next step**: Discuss decisions, then `/plan privacy-model-redesign`

---

## Summary

Redesign the email/document sharing model from "shared by default" to "private by default" for partners.

### Current Model (Shared by Default)

```
Email synced → Classified to case → Visible to all case team
                                  → Attachments become Documents → Visible to all
Partner can mark as private → Email hidden (but attachments still visible!)
```

### Proposed Model (Private by Default)

```
Email synced → Classified to case → Private (only syncing partner sees)
                                  → Attachments sync but stay private
Partner marks as PUBLIC → Email + attachments visible to team
```

---

## Proposed User Flow

### 1. Partner's Email View

**All classified emails start private:**

- Only the partner who synced them can see them
- Visual indicator: orange bar on right edge of email/thread row
- Team members see nothing until partner publishes

**Partner actions:**

- "Make Public" → email + all attachments become visible to team
- Bulk action: select multiple → "Make Public"

### 2. Partner's Documents View

**All synced documents start private:**

- Only syncing partner sees them in `/documents`
- Orange bar indicator for private docs
- Team sees empty or filtered list

**Partner actions:**

- "Make Public" → document visible to team
- For attachments from private emails:
  - Can publish individually without publishing the email
  - Or publish the email (auto-publishes attachments)

### 3. Team Member View

**Emails:**

- Only see emails marked public by partner
- No orange bar (they never see private items)
- Cannot change visibility

**Documents:**

- Only see documents marked public
- Cannot change visibility

### 4. Attachment Inheritance Rules

| Email State | Attachment Default | Can Override?              |
| ----------- | ------------------ | -------------------------- |
| Private     | Private            | Yes - publish individually |
| Public      | Public             | No - inherits from email   |

**Rationale:**

- When partner publishes email, attachments should auto-publish (they're part of the email context)
- When email stays private, partner might still want to share a specific attachment (e.g., a contract PDF without the negotiation email)

---

## Data Model Changes

### Option A: Flip the Default (Minimal Change)

```prisma
model Email {
  // Rename: isPrivate → isPublic (default false)
  isPublic          Boolean   @default(false) @map("is_public")
  madePublicBy      String?   @map("made_public_by")
  madePublicAt      DateTime? @map("made_public_at")
}

model Document {
  // Add visibility field
  isPublic          Boolean   @default(false) @map("is_public")
  madePublicBy      String?   @map("made_public_by")
  madePublicAt      DateTime? @map("made_public_at")
}
```

**Migration:** `UPDATE emails SET is_public = NOT is_private`

### Option B: Explicit Visibility Enum (More Explicit)

```prisma
enum Visibility {
  PRIVATE      // Only owner
  TEAM         // Case team members
  FIRM         // Everyone in firm (future?)
}

model Email {
  visibility        Visibility @default(PRIVATE)
  visibilityChangedBy String?
  visibilityChangedAt DateTime?
}
```

**Pros:** More flexible for future needs
**Cons:** More complex, enum migrations are harder

### Recommendation: Option A

- Simpler migration from current `isPrivate`
- Boolean is sufficient for current needs
- Can evolve later if needed

---

## Access Control Changes

### Email Queries

**Current:**

```typescript
// email-thread.service.ts:425
if (caseId && !skipPrivacyFilter) {
  emailWhere.OR = [{ isPrivate: false }, { markedPrivateBy: userId }];
}
```

**Proposed:**

```typescript
if (caseId) {
  const isPartner = user.role === 'Partner' || user.role === 'BusinessOwner';

  if (isPartner) {
    // Partners see everything (private indicator shown in UI)
    // No filter needed
  } else {
    // Team only sees public emails
    emailWhere.isPublic = true;
  }
}
```

### Document Queries

**Current:** No visibility filtering

**Proposed:**

```typescript
// document.resolvers.ts - caseDocuments query
const isPartner = user.role === 'Partner' || user.role === 'BusinessOwner';

let where = { caseId: args.caseId };

if (!isPartner) {
  // Team only sees public documents
  where.document = { isPublic: true };
}
```

### Attachment → Document Visibility Sync

When partner publishes email:

```typescript
async publishEmail(emailId: string, userId: string) {
  // 1. Mark email public
  await prisma.email.update({
    where: { id: emailId },
    data: { isPublic: true, madePublicBy: userId, madePublicAt: new Date() }
  });

  // 2. Auto-publish all attachments
  const attachments = await prisma.emailAttachment.findMany({
    where: { emailId },
    select: { documentId: true }
  });

  await prisma.document.updateMany({
    where: { id: { in: attachments.map(a => a.documentId).filter(Boolean) } },
    data: { isPublic: true, madePublicBy: userId, madePublicAt: new Date() }
  });
}
```

---

## UI Changes

### 1. Email List Item

```
┌─────────────────────────────────────────────────┬──┐
│ From: Client Name                               │▋▋│ ← Orange bar (private)
│ Subject: Contract Review                        │▋▋│
│ Preview text...                     2h ago      │▋▋│
└─────────────────────────────────────────────────┴──┘

┌─────────────────────────────────────────────────────┐
│ From: Client Name                                   │ ← No bar (public)
│ Subject: Meeting Notes                              │
│ Preview text...                         Yesterday   │
└─────────────────────────────────────────────────────┘
```

### 2. Document List/Grid Item

```
┌────────────────────────┬──┐
│ 📄 contract.pdf       │▋▋│ ← Orange bar (private)
│ 2.5 MB • PDF          │▋▋│
└────────────────────────┴──┘
```

### 3. Actions

**Email context menu (Partner only):**

- "Fă public" / "Make public" → publishes email + attachments
- "Fă privat" / "Make private" → only if currently public

**Document context menu (Partner only):**

- "Fă public" / "Make public"
- "Fă privat" / "Make private" (only if email is also private)

**Bulk actions:**

- Select multiple → "Fă publice" / "Make public"

---

## Decisions (Confirmed)

### 1. Existing data migration

**Decision:** Make all existing emails/docs PRIVATE (fresh start for testing)

- Migration sets `isPublic = false` for all records
- Partners must review and publish what's needed

### 2. Granularity

**Decision:** Per-email visibility (not per-thread)

- Each email in a thread can have different visibility
- Thread shows in team view if ANY email in thread is public

### 3. Attachment override

**Decision:** YES - can publish individual docs from private emails

- Partner can share 1 of 5 attachments without publishing the email
- Gives flexibility for sharing contracts without negotiation context

### 4. UI for publishing

**Decision:** "Make public" button available on all emails (for partners)

- Visible in email detail view
- Also in context menu / bulk actions

### 5. Role restriction

**Decision:** Only Partners have gatekeeper role

- Partners see all emails (theirs + team's synced) with private indicator
- Associates/Paralegals only see `isPublic = true` content
- Associates' own synced emails: also private by default, but they can't publish (only Partners can)

### 6. Thread visibility display

**Derived:** Thread shows orange bar if ALL emails in thread are private

- If any email is public, thread appears in team view
- But team only sees the public emails within that thread

### 7. Reply visibility

**Derived:**

- Team member replies to public emails → public (they can only reply to public)
- Partner replies → private by default (partner must publish)

---

## Implementation Phases

### Phase 1: Database Schema

- Add `isPublic` (Boolean, default false) to Email model
- Add `madePublicBy` (String?) and `madePublicAt` (DateTime?) to Email
- Add same three fields to Document model
- Migration: `UPDATE emails SET is_public = false` (all private)
- Migration: `UPDATE documents SET is_public = false` (all private)

### Phase 2: Backend Access Control

- Email queries: filter `isPublic = true` for non-Partners
- Document queries: filter `isPublic = true` for non-Partners
- Partners see all (no filter)
- Add `publishEmail` mutation (Partner only)
- Add `publishDocument` mutation (Partner only)
- `publishEmail` auto-publishes attachments (with option to skip)

### Phase 3: GraphQL Schema

- Add `isPublic`, `madePublicBy`, `madePublicAt` to Email type
- Add same to Document/CaseDocument types
- Add `publishEmail(emailId: ID!, includeAttachments: Boolean = true)` mutation
- Add `publishDocument(documentId: ID!)` mutation
- Add `unpublishEmail` / `unpublishDocument` mutations

### Phase 4: Email UI

- Orange bar indicator for private emails (Partner view only)
- "Fă public" button in email detail header
- Checkbox: "Include attachments" (default checked)
- "Fă privat" button for currently public emails
- Thread list: orange bar if all emails in thread are private

### Phase 5: Document UI

- Orange bar indicator for private docs (Partner view only)
- "Fă public" in document context menu / detail view
- "Fă privat" for currently public docs
- Show source indicator: "From email (private)" vs "From email (public)"

### Phase 6: Bulk Operations

- Multi-select emails → "Fă publice"
- Multi-select documents → "Fă publice"

---

## Files to Modify

### Backend

| File                                                           | Changes                |
| -------------------------------------------------------------- | ---------------------- |
| `packages/database/prisma/schema.prisma`                       | Add visibility fields  |
| `services/gateway/src/services/email-thread.service.ts`        | Visibility filtering   |
| `services/gateway/src/graphql/resolvers/email.resolvers.ts`    | Publish mutations      |
| `services/gateway/src/graphql/resolvers/document.resolvers.ts` | Visibility filtering   |
| `services/gateway/src/graphql/schema/email.graphql`            | New fields + mutations |
| `services/gateway/src/graphql/schema/document.graphql`         | New fields + mutations |

### Frontend

| File                                                     | Changes               |
| -------------------------------------------------------- | --------------------- |
| `apps/web/src/components/email/EmailListItem.tsx`        | Orange bar indicator  |
| `apps/web/src/components/documents/DocumentCard.tsx`     | Orange bar indicator  |
| `apps/web/src/components/documents/DocumentListItem.tsx` | Orange bar indicator  |
| `apps/web/src/graphql/mutations.ts`                      | Publish mutations     |
| Various context menus                                    | "Make Public" actions |

---

## Questions for User

1. **Existing data:** Should current emails/docs remain visible to team, or require partner review?

2. **Visual design:** Orange bar on right - solid or gradient? Width? Only for list items or also in detail view?

3. **Bulk operations:** Should there be a "Publish all from this sender" or "Publish all from this thread" shortcut?

4. **Notifications:** Should team members be notified when new content is published?

5. **Default for new cases:** Should partners be able to set a case as "auto-publish" for trusted clients?
