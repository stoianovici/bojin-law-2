# Plan: Romanian i18n Translation

**Status**: Approved
**Date**: 2026-01-04
**Input**: `research-romanian-i18n.md`
**Next step**: `/implement plan-romanian-i18n`

---

## Problem Statement

The legal platform has a constraint that all UI text must be in Romanian, but English strings are scattered throughout the codebase. We need to audit the entire app, translate all English text to Romanian, and set up an i18n system so future features are translation-ready from the start.

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from research doc.
> Every task below must implement these decisions.

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
- Dev/preview pages (`/dev/preview/*`) - low priority, can remain English

---

## Implementation Approach

We will install `next-intl` and create the required infrastructure (config, middleware, messages file, provider). Then systematically migrate all English strings across ~25 component files, organized by feature area. Each component will use the `useTranslations` hook with feature-based namespaces (`cases.*`, `tasks.*`, `documents.*`, `common.*`, `validation.*`). Romanian pluralization (3 forms) will use ICU MessageFormat syntax. Existing date formatting with `date-fns` Romanian locale can coexist with next-intl.

---

## Tasks

### Parallel Group 1: Infrastructure Setup

> These tasks run simultaneously via sub-agents

#### Task 1.1: Install next-intl package

- **Implements**: Use next-intl
- **File**: `apps/web/package.json` (MODIFY)
- **Do**: Add `next-intl` as a dependency
- **Done when**: Package is listed in dependencies

#### Task 1.2: Create i18n configuration

- **Implements**: Create i18n config
- **File**: `apps/web/i18n.ts` (CREATE)
- **Do**: Create next-intl configuration with `ro` as default locale, request config for server components
- **Done when**: Config exports `getRequestConfig` function

#### Task 1.3: Create locale middleware

- **Implements**: Add middleware
- **File**: `apps/web/middleware.ts` (CREATE)
- **Do**: Create middleware that handles locale detection, configured for single `ro` locale
- **Done when**: Middleware exports default with locale matcher

#### Task 1.4: Create Romanian messages file

- **Implements**: Single messages file initially, Feature-based translation keys, Romanian as default locale
- **File**: `apps/web/messages/ro.json` (CREATE)
- **Do**: Create JSON file with all translation keys organized by namespace: `common`, `validation`, `cases`, `tasks`, `documents`, `email`, `layout`. Include all ~300 strings identified in research.
- **Done when**: JSON file contains all namespaces with Romanian translations

#### Task 1.5: Wrap app with NextIntlClientProvider

- **Implements**: Use next-intl, useTranslations hook pattern
- **File**: `apps/web/src/app/layout.tsx` (MODIFY)
- **Do**: Import and wrap children with `NextIntlClientProvider`, pass messages and locale
- **Done when**: Provider wraps the app, messages are passed correctly

---

### Sequential: After Group 1

#### Task 2: Install dependencies

- **Implements**: Use next-intl
- **Depends on**: Task 1.1
- **File**: N/A (shell command)
- **Do**: Run `pnpm install` to install the next-intl package
- **Done when**: Package installed successfully, no errors

---

### Parallel Group 2: Forms & Core UI (Priority 1)

> These tasks run simultaneously via sub-agents

#### Task 3.1: Translate cases/new page

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/app/(dashboard)/cases/new/page.tsx` (MODIFY)
- **Do**: Add `useTranslations('cases')`, replace 23 English strings with `t()` calls. Update `messages/ro.json` with new keys under `cases` namespace.
- **Done when**: No English strings remain, all labels/buttons/errors use translations

#### Task 3.2: Translate cases/edit page

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/app/(dashboard)/cases/[id]/edit/page.tsx` (MODIFY)
- **Do**: Add `useTranslations('cases')`, replace 17 English strings with `t()` calls. Reuse keys from 3.1 where possible.
- **Done when**: No English strings remain, all labels/buttons/errors use translations

#### Task 3.3: Translate tasks/new page

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/app/(dashboard)/tasks/new/page.tsx` (MODIFY)
- **Do**: Add `useTranslations('tasks')`, replace 15 English strings with `t()` calls. Update `messages/ro.json` with new keys under `tasks` namespace.
- **Done when**: No English strings remain, all labels/buttons/errors use translations

#### Task 3.4: Translate TaskForm component

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/components/forms/TaskForm.tsx` (MODIFY)
- **Do**: Add `useTranslations('tasks')` and `useTranslations('validation')`, replace 7 English validation messages with `t()` calls.
- **Done when**: All validation messages use translations

#### Task 3.5: Translate EventForm component

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/components/forms/EventForm.tsx` (MODIFY)
- **Do**: Add `useTranslations`, replace 4 English strings with `t()` calls.
- **Done when**: No English strings remain

---

### Parallel Group 3: Forms (continued) + Documents

> These tasks run simultaneously via sub-agents

#### Task 4.1: Translate SubtaskModal

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/components/forms/SubtaskModal.tsx` (MODIFY)
- **Do**: Add `useTranslations('tasks')`, replace 5 English strings with `t()` calls.
- **Done when**: No English strings remain

#### Task 4.2: Translate DocumentsContentPanel

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/components/documents/DocumentsContentPanel.tsx` (MODIFY)
- **Do**: Add `useTranslations('documents')`, replace 11 English strings with `t()` calls. Update `messages/ro.json` with new keys under `documents` namespace.
- **Done when**: No English strings remain

#### Task 4.3: Translate DocumentsSidebar

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/components/documents/DocumentsSidebar.tsx` (MODIFY)
- **Do**: Add `useTranslations('documents')`, replace 8 English strings with `t()` calls.
- **Done when**: No English strings remain

#### Task 4.4: Translate PDFViewer

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/components/documents/PDFViewer.tsx` (MODIFY)
- **Do**: Add `useTranslations('documents')`, replace 6 aria-label English strings with `t()` calls.
- **Done when**: All aria-labels use translations

#### Task 4.5: Translate DocumentPreviewModal

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/components/documents/DocumentPreviewModal.tsx` (MODIFY)
- **Do**: Add `useTranslations('documents')`, replace 6 English strings with `t()` calls.
- **Done when**: No English strings remain

---

### Parallel Group 4: Cases & Tasks UI

> These tasks run simultaneously via sub-agents

#### Task 5.1: Translate CaseDetailTabs

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/components/cases/CaseDetailTabs.tsx` (MODIFY)
- **Do**: Add `useTranslations('cases')`, replace 10 English strings with `t()` calls.
- **Done when**: No English strings remain

#### Task 5.2: Translate CaseDrawer

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/components/cases/CaseDrawer.tsx` (MODIFY)
- **Do**: Add `useTranslations('cases')`, replace 7 English strings with `t()` calls.
- **Done when**: No English strings remain

#### Task 5.3: Translate TaskDrawer

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/components/tasks/TaskDrawer.tsx` (MODIFY)
- **Do**: Add `useTranslations('tasks')`, replace 7 English strings with `t()` calls.
- **Done when**: No English strings remain

#### Task 5.4: Translate tasks page

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/app/(dashboard)/tasks/page.tsx` (MODIFY)
- **Do**: Add `useTranslations('tasks')`, replace 5 English strings with `t()` calls.
- **Done when**: No English strings remain

#### Task 5.5: Translate ComposeEmailModal

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/components/email/ComposeEmailModal.tsx` (MODIFY)
- **Do**: Add `useTranslations('email')`, replace 5 English strings with `t()` calls. Update `messages/ro.json` with new keys under `email` namespace.
- **Done when**: No English strings remain

---

### Parallel Group 5: Common UI & Remaining Files

> These tasks run simultaneously via sub-agents

#### Task 6.1: Translate Header

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/components/layout/Header.tsx` (MODIFY)
- **Do**: Add `useTranslations('layout')`, replace 4 English strings with `t()` calls. Update `messages/ro.json` with new keys under `layout` namespace.
- **Done when**: No English strings remain

#### Task 6.2: Translate ContextPanel

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/components/layout/ContextPanel.tsx` (MODIFY)
- **Do**: Add `useTranslations('layout')`, replace 4 English strings with `t()` calls.
- **Done when**: No English strings remain

#### Task 6.3: Translate Dialog sr-only text

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/components/ui/dialog.tsx` (MODIFY)
- **Do**: Add `useTranslations('common')`, replace "Close" sr-only text with `t('close')`.
- **Done when**: sr-only text uses translation

#### Task 6.4: Implement pluralization in RequestStatusBadge

- **Implements**: Translate all user-facing text, Feature-based translation keys
- **File**: `apps/web/src/components/documents/RequestStatusBadge.tsx` (MODIFY)
- **Do**: Replace manual `days === 1 ? 'zi' : 'zile'` pattern with ICU MessageFormat plural: `{days, plural, one {# zi} few {# zile} other {# zile}}`. Add to `messages/ro.json`.
- **Done when**: Pluralization uses next-intl ICU format

#### Task 6.5: Implement relative dates in mobile case page

- **Implements**: Translate all user-facing text
- **File**: `apps/web/src/app/m/cases/[id]/page.tsx` (MODIFY)
- **Do**: Replace manual relative date function with `useFormatter` from next-intl or keep existing Romanian strings if already correct. Ensure "Azi", "Ieri" patterns use translations.
- **Done when**: Relative dates use translations or are confirmed correct

---

### Final: Integration & Verification

#### Task 7: Build and type check

- **Implements**: All decisions (verification)
- **Depends on**: All previous tasks
- **File**: N/A (shell command)
- **Do**: Run `pnpm build` to verify TypeScript compilation succeeds, no missing translation keys
- **Done when**: Build completes without errors

---

## Decision Coverage Check

| Decision | Implemented by Task(s) |
|----------|------------------------|
| Translate all user-facing text | Tasks 3.1-6.5 |
| Single migration pass | All tasks in one plan |
| Feature-based translation keys | Task 1.4 (messages structure) |
| Romanian as default locale | Tasks 1.2, 1.3, 1.4 |
| Use next-intl | Tasks 1.1-1.5, 2 |
| Single messages file initially | Task 1.4 |
| Create i18n config | Task 1.2 |
| Add middleware | Task 1.3 |
| useTranslations hook pattern | Tasks 3.1-6.5 |
| Keep code in English | All tasks (variable names stay English) |

## Session Scope

- **Total tasks**: 27 tasks across 7 groups
- **Files modified**: ~25 files
- **Strings translated**: ~270-300
- **Complexity**: Medium-High (many files, but repetitive pattern)

---

## Next Step

After approval, start a new session and run:
`/implement plan-romanian-i18n`
