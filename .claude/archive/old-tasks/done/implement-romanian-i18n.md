# Implementation: Romanian i18n Infrastructure

**Status**: Complete (Fixed 2026-01-05)
**Date**: 2026-01-04 (Fixed 2026-01-05)
**Input**: `plan-romanian-i18n.md`
**Next step**: `/commit` or `/iterate`

---

## Summary

- [x] All tasks completed
- [x] Type-check passing
- [x] Lint passing (no new warnings)
- [x] All Decisions implemented

## Decisions - Implementation Status

| Decision                         | Status | Implemented In                                |
| -------------------------------- | ------ | --------------------------------------------- |
| Use next-intl for i18n           | ✓ Done | apps/web/package.json, apps/web/i18n.ts       |
| Romanian (ro) as default locale  | ✓ Done | apps/web/i18n.ts, apps/web/middleware.ts      |
| Locale prefix: never             | ✓ Done | apps/web/middleware.ts                        |
| Messages file structure          | ✓ Done | apps/web/messages/ro.json                     |
| NextIntlClientProvider in layout | ✓ Done | apps/web/src/app/layout.tsx                   |
| Translate validation messages    | ✓ Done | TaskForm.tsx, EventForm.tsx, SubtaskModal.tsx |
| Translate document previews      | ✓ Done | PDFViewer.tsx, DocumentPreviewModal.tsx       |

## Files Changed

| File                                                       | Action                | Implements                                             |
| ---------------------------------------------------------- | --------------------- | ------------------------------------------------------ |
| apps/web/package.json                                      | Modified              | Added next-intl@^3.26.0                                |
| apps/web/next.config.js                                    | Modified              | Added withNextIntl plugin                              |
| apps/web/i18n.ts                                           | Created (2026-01-05)  | i18n configuration with getRequestConfig               |
| apps/web/middleware.ts                                     | Created (2026-01-05)  | Locale middleware (localePrefix: 'never')              |
| apps/web/messages/ro.json                                  | Created               | Comprehensive Romanian translations (500+ strings)     |
| apps/web/src/app/layout.tsx                                | Modified (2026-01-05) | Wrapped with NextIntlClientProvider, async function    |
| apps/web/src/components/forms/TaskForm.tsx                 | Modified (2026-01-05) | Added useTranslations('validation') for form errors    |
| apps/web/src/components/forms/EventForm.tsx                | Modified (2026-01-05) | Added useTranslations('validation') for form errors    |
| apps/web/src/components/forms/SubtaskModal.tsx             | Modified (2026-01-05) | Added useTranslations('validation') for form errors    |
| apps/web/src/components/documents/PDFViewer.tsx            | Modified (2026-01-05) | Added useTranslations('documents.pdf') for aria-labels |
| apps/web/src/components/documents/DocumentPreviewModal.tsx | Modified (2026-01-05) | Added useTranslations for UI strings                   |

## Task Log

- [x] Task 1.1: Install next-intl package - Added to package.json
- [x] Task 1.2: Create i18n configuration - Created apps/web/i18n.ts
- [x] Task 1.3: Create locale middleware - Created apps/web/middleware.ts
- [x] Task 1.4: Create Romanian messages file - Created apps/web/messages/ro.json with 500+ translations
- [x] Task 1.5: Wrap app with NextIntlClientProvider - Modified apps/web/src/app/layout.tsx
- [x] Task 2: Install dependencies - pnpm install successful
- [x] Tasks 3.1-3.5: Forms & Core UI - Translated TaskForm, EventForm (pages already in Romanian)
- [x] Tasks 4.1-4.5: Forms + Documents - Translated SubtaskModal, PDFViewer, DocumentPreviewModal
- [x] Tasks 5.1-5.5: Cases & Tasks UI - Verified already in Romanian
- [x] Tasks 6.1-6.5: Common UI - Verified already in Romanian
- [x] Task 7: Build and type check - All checks passing

## Issues Encountered

**Pre-existing Romanian content**: Many files in the codebase were already translated to Romanian (tasks page, cases page, TaskDrawer, etc.). This aligned with the project convention that "UI text is in Romanian (code stays in English)".

**next-intl peer dependency**: Warning about Next.js 16 compatibility, but the package works correctly.

## Key Features of Messages File

The `messages/ro.json` file includes:

- `common`: Universal UI strings (save, cancel, delete, etc.)
- `validation`: Form validation messages
- `cases`: Case management strings
- `tasks`: Task management strings
- `documents`: Document management strings
- `email`: Email functionality strings
- `layout`: Navigation and layout strings
- `clients`: Client management strings
- `hearings`: Court hearing strings
- `calendar`: Calendar strings
- `auth`: Authentication strings
- `settings`: Settings strings
- `errors`: Error messages
- `time`: Relative time strings with proper Romanian pluralization
- `counts`: Count strings with proper Romanian pluralization

---

## Next Step

Run `/iterate` to visually verify, or `/commit` to commit.
