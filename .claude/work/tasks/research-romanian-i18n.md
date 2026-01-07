# Research: Romanian i18n Translation

**Status**: Complete
**Date**: 2025-01-04
**Input**: `brainstorm-romanian-i18n.md`
**Next step**: `/plan research-romanian-i18n`

---

## Problem Statement

The legal platform has a constraint that all UI text must be in Romanian, but English strings are scattered throughout the codebase. We need to audit the entire app, translate all English text to Romanian, and set up an i18n system so future features are translation-ready from the start.

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from brainstorm doc.
> These are the agreed requirements. Research informs HOW, not WHAT.

### Functional Decisions

| Decision | Details | Rationale |
|----------|---------|-----------|
| Translate all user-facing text | Buttons, labels, headings, messages, errors, validation, toasts, placeholders, tooltips, aria-labels | Complete Romanian UI is a core project constraint |
| Single migration pass | Fix everything at once, not incrementally by page | User preference for comprehensive approach |
| Feature-based translation keys | Organize as `cases.*`, `tasks.*`, `common.*`, `validation.*` etc. | Matches app structure, easy to find/maintain |
| Romanian as default locale | `ro` is the only active locale initially | Current requirement is Romanian-only |

### Technical Decisions

| Decision | Details | Rationale |
|----------|---------|-----------|
| Use next-intl | Install `next-intl` package for i18n | Best Next.js App Router integration, TypeScript support, server component compatible |
| Single messages file initially | `apps/web/messages/ro.json` | Simpler to manage; can split by feature later if it grows too large |
| Create i18n config | `apps/web/i18n.ts` with next-intl configuration | Standard next-intl setup |
| Add middleware | `apps/web/middleware.ts` for locale handling | Required by next-intl, even for single locale |
| useTranslations hook pattern | Components use `const t = useTranslations('namespace')` | Standard next-intl usage pattern |
| Keep code in English | Variable names, comments, types remain English | Only UI strings get translated (project convention) |

### Out of Scope

- Adding English or other languages (infrastructure supports it, but not implementing now)
- Translating code comments or variable names
- Backend/API error messages (unless surfaced directly to users)
- Changing existing Romanian strings that are already correct
- Database content translation (case names, client names, etc. are user data)

---

## Research Findings

### Open Questions - Answered

| Question | Answer | Evidence |
|----------|--------|----------|
| Are there any existing translation files or patterns? | **No** - Starting completely fresh. No i18n config, no messages files, no next-intl installed | No `/messages/` or `/locales/` directories exist. `next-intl` not in package.json |
| How many files/components contain English strings? | **40+ files, 270-350 strings estimated** | Top files: cases/new (23), tasks/new (15), CaseDetailTabs (10), DocumentsContentPanel (11) |
| What dynamic content patterns exist? | **Pluralization, date formatting, counts, relative time** | Days/reminders pluralization, "X of Y" patterns, relative dates ("ieri", "acum 5 min") |
| Is there existing date/number formatting? | **Yes** - Already uses `toLocaleDateString('ro-RO')` in 30+ locations | `date-fns` with Romanian locale also used in time/timeline components |
| Are there third-party components with hardcoded English? | **No blockers** - All English text is in wrapper components, not library code | Radix UI accepts content via props; react-pdf errors are in our PDFViewer.tsx |
| What's the current validation message pattern? | **Manual inline validation, MIXED languages** | Forms use `useState` for errors; some Romanian in hooks, some English in form components |

### Existing Code Analysis

| Category | Files | Notes |
|----------|-------|-------|
| **Reuse as-is** | `date-fns` locale imports, `toLocaleDateString('ro-RO')` calls | Date formatting already localized, can keep or migrate to next-intl formatters |
| **Modify** | 40+ component files with English strings | See prioritized list below |
| **Create new** | `apps/web/messages/ro.json`, `apps/web/i18n.ts`, `apps/web/middleware.ts` | next-intl infrastructure |

### Patterns Discovered

**Form Validation Pattern** (manual, no Zod):
```typescript
// apps/web/src/components/forms/TaskForm.tsx:64-166
const validateForm = useCallback((): boolean => {
  const newErrors: FormErrors = {};
  if (!title.trim()) {
    newErrors.title = 'Title is required';  // ← ENGLISH - needs translation
  }
  // ...
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
}, [...]);
```

**Error Display Pattern** (via Input component):
```typescript
// apps/web/src/components/ui/input.tsx:28-82
<Input
  error={!!errors.title}
  errorMessage={errors.title}  // ← String passed as prop
/>
```

**Toast Pattern** (custom toast helper):
```typescript
// apps/web/src/components/ui/toast.tsx
toast.success('Document copiat cu succes', 'Descriere aici');
toast.error('Eroare la copiere', err.message);
```

**Pluralization Pattern** (manual ternary):
```typescript
// apps/web/src/components/documents/RequestStatusBadge.tsx:81-84
return `${days} ${days === 1 ? 'zi' : 'zile'} intarziere`;
```

**Relative Date Pattern** (manual function):
```typescript
// apps/web/src/app/m/cases/[id]/page.tsx:38-124
if (diffDays === 0) return `Azi, ${timeStr}`;
else if (diffDays === 1) return `Ieri, ${timeStr}`;
```

### Constraints Found

- **No validation library**: Forms use manual validation, not Zod/Yup - validation messages are scattered
- **Mixed language state**: Some validation messages already Romanian (in hooks), some English (in form components)
- **Romanian pluralization rules**: Romanian has 3 plural forms (one, few, other) - next-intl supports this via ICU format
- **Existing date-fns usage**: Some components already import `{ ro } from 'date-fns/locale'` - can coexist with next-intl

---

## Implementation Recommendation

### Phase 1: Infrastructure Setup
1. Install `next-intl` package
2. Create `apps/web/i18n.ts` configuration
3. Create `apps/web/middleware.ts` for locale detection
4. Create `apps/web/messages/ro.json` with initial structure
5. Wrap app with `NextIntlClientProvider`

### Phase 2: Translation Migration (by priority)

**Priority 1 - Forms & Core UI** (~100 strings):
- `apps/web/src/app/(dashboard)/cases/new/page.tsx` (23 strings)
- `apps/web/src/app/(dashboard)/cases/[id]/edit/page.tsx` (17 strings)
- `apps/web/src/app/(dashboard)/tasks/new/page.tsx` (15 strings)
- `apps/web/src/components/forms/TaskForm.tsx` (7 strings)
- `apps/web/src/components/forms/EventForm.tsx` (4 strings)
- `apps/web/src/components/forms/SubtaskModal.tsx` (5 strings)

**Priority 2 - Documents & Email** (~60 strings):
- `apps/web/src/components/documents/DocumentsContentPanel.tsx` (11 strings)
- `apps/web/src/components/documents/DocumentsSidebar.tsx` (8 strings)
- `apps/web/src/components/documents/PDFViewer.tsx` (6 strings - aria-labels)
- `apps/web/src/components/documents/DocumentPreviewModal.tsx` (6 strings)
- `apps/web/src/components/email/ComposeEmailModal.tsx` (5 strings)

**Priority 3 - Cases & Tasks UI** (~50 strings):
- `apps/web/src/components/cases/CaseDetailTabs.tsx` (10 strings)
- `apps/web/src/components/cases/CaseDrawer.tsx` (7 strings)
- `apps/web/src/components/tasks/TaskDrawer.tsx` (7 strings)
- `apps/web/src/app/(dashboard)/tasks/page.tsx` (5 strings)

**Priority 4 - Common UI & Layout** (~40 strings):
- `apps/web/src/components/layout/Header.tsx` (4 strings)
- `apps/web/src/components/layout/ContextPanel.tsx` (4 strings)
- `apps/web/src/components/ui/dialog.tsx` (1 string - "Close" sr-only)

**Priority 5 - Dev/Preview (Optional)** (~40 strings):
- `apps/web/src/app/dev/preview/[component]/page.tsx` (43 strings - dev only)

### Phase 3: Dynamic Content
- Implement plural forms for days/items/messages using ICU MessageFormat
- Create formatters for relative dates using next-intl's `useFormatter`
- Standardize "X of Y" patterns

---

## File Plan

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/package.json` | Modify | Add `next-intl` dependency |
| `apps/web/i18n.ts` | Create | next-intl configuration |
| `apps/web/middleware.ts` | Create | Locale detection middleware |
| `apps/web/messages/ro.json` | Create | Romanian translation strings (~300 keys) |
| `apps/web/src/app/layout.tsx` | Modify | Wrap with NextIntlClientProvider |
| `apps/web/src/components/forms/*.tsx` | Modify | Add useTranslations for validation messages |
| `apps/web/src/app/(dashboard)/cases/*.tsx` | Modify | Add useTranslations for form labels/buttons |
| `apps/web/src/app/(dashboard)/tasks/*.tsx` | Modify | Add useTranslations for form labels/buttons |
| `apps/web/src/components/documents/*.tsx` | Modify | Add useTranslations for buttons/errors |
| `apps/web/src/components/cases/*.tsx` | Modify | Add useTranslations for UI text |
| `apps/web/src/components/tasks/*.tsx` | Modify | Add useTranslations for UI text |
| `apps/web/src/components/ui/dialog.tsx` | Modify | Make "Close" sr-only text translatable |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Large scope (~40 files, 300 strings) could introduce bugs | Use TypeScript for translation keys; test each priority batch before moving to next |
| Some Romanian strings already exist - could get duplicated | Audit existing Romanian strings first; reuse where possible |
| Manual validation pattern is scattered | Consider centralizing validation messages in `messages/ro.json` under `validation.*` namespace |
| Pluralization complexity (Romanian has 3 forms) | Use ICU MessageFormat syntax which next-intl supports natively |
| Dev/preview pages have many strings | Mark as low priority; can remain English or be translated last |

---

## Next Step

Start a new session and run:
`/plan research-romanian-i18n`
