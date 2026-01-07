# Brainstorm: Romanian i18n Translation

**Status**: Complete
**Date**: 2025-01-04
**Next step**: `/research brainstorm-romanian-i18n`

---

## Problem Statement

The legal platform has a constraint that all UI text must be in Romanian, but English strings are scattered throughout the codebase. We need to audit the entire app, translate all English text to Romanian, and set up an i18n system so future features are translation-ready from the start.

## Decisions

> **IMPORTANT**: This section propagates unchanged through research → plan → implement.
> Be specific and complete. These are the requirements.

### Functional Decisions

| Decision                       | Details                                                                                              | Rationale                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Translate all user-facing text | Buttons, labels, headings, messages, errors, validation, toasts, placeholders, tooltips, aria-labels | Complete Romanian UI is a core project constraint |
| Single migration pass          | Fix everything at once, not incrementally by page                                                    | User preference for comprehensive approach        |
| Feature-based translation keys | Organize as `cases.*`, `tasks.*`, `common.*`, `validation.*` etc.                                    | Matches app structure, easy to find/maintain      |
| Romanian as default locale     | `ro` is the only active locale initially                                                             | Current requirement is Romanian-only              |

### Technical Decisions

| Decision                       | Details                                                 | Rationale                                                                            |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Use next-intl                  | Install `next-intl` package for i18n                    | Best Next.js App Router integration, TypeScript support, server component compatible |
| Single messages file initially | `apps/web/messages/ro.json`                             | Simpler to manage; can split by feature later if it grows too large                  |
| Create i18n config             | `apps/web/i18n.ts` with next-intl configuration         | Standard next-intl setup                                                             |
| Add middleware                 | `apps/web/middleware.ts` for locale handling            | Required by next-intl, even for single locale                                        |
| useTranslations hook pattern   | Components use `const t = useTranslations('namespace')` | Standard next-intl usage pattern                                                     |
| Keep code in English           | Variable names, comments, types remain English          | Only UI strings get translated (project convention)                                  |

### Out of Scope

- Adding English or other languages (infrastructure supports it, but not implementing now)
- Translating code comments or variable names
- Backend/API error messages (unless surfaced directly to users)
- Changing existing Romanian strings that are already correct
- Database content translation (case names, client names, etc. are user data)

### Open Questions for Research

- [ ] Are there any existing translation files or patterns in the codebase?
- [ ] How many files/components contain English strings? (scope estimate)
- [ ] What dynamic content patterns exist? (interpolation needs)
- [ ] Is there existing date/number formatting that should use next-intl?
- [ ] Are there any third-party components with hardcoded English text?
- [ ] What's the current error handling pattern for validation messages?

---

## Context Snapshot

- Project: Romanian legal case management platform (Bojin & Associates)
- Stack: Next.js 14 App Router, React, TailwindCSS, Apollo GraphQL
- Current state: Linear UI redesign in progress on `feature/ui-redesign` branch
- Key constraint: "UI text in Romanian" is listed in project-brief.md as non-negotiable
- Structure: Main app code in `apps/web/src/` with pages in `app/` and components in `components/`

## Next Step

Start a new session and run:
`/research brainstorm-romanian-i18n`
