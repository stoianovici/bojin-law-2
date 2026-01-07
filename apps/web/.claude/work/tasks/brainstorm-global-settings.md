# Brainstorm: Global Settings

**Status**: Complete
**Date**: 2026-01-02
**Next step**: `/research brainstorm-global-settings`

---

## Context

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech Stack**: Next.js 16, TypeScript, Tailwind, Zustand, Apollo GraphQL, Azure MSAL
**Platform**: Desktop only (settings not needed for mobile)
**Backend**: GraphQL gateway at `localhost:4000/graphql` (bojin-law-2 monorepo)

### Relevant Existing Code

- `src/store/authStore.ts` - User roles: ADMIN (Partner), LAWYER, PARALEGAL, SECRETARY
- `src/providers/ThemeProvider.tsx` - Currently hardcoded dark theme only
- `src/types/email.ts` - Personal email classification, court email types
- `src/graphql/queries.ts` - No existing settings/preferences queries

---

## Problem Statement

The app needs a global settings page for desktop that allows:

1. **All users** to configure personal preferences (theme, email signature)
2. **Partners (ADMIN role)** to configure firm-wide settings (team access, courts, billing rates)

---

## Decisions

### Settings Structure

#### Section 1: Personal Preferences (All Users)

| Setting             | Details                                                                            |
| ------------------- | ---------------------------------------------------------------------------------- |
| **Theme**           | Dark / Light toggle. Currently hardcoded dark.                                     |
| **Email signature** | Fetch default from Outlook via Graph API. Allow user override. Persist to backend. |

#### Section 2: Firm Settings (Partners Only)

| Setting                      | Details                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Team access**              | Whitelist existing Azure AD users to access the app. Assign roles: LAWYER, PARALEGAL, SECRETARY.                               |
| **Personal email addresses** | View/manage list of email addresses marked as "personal" (populated from `/emails` classification actions).                    |
| **Courts**                   | Manage court definitions as first-class entities. Each court has: Name, Full address, Email domain(s) for auto-classification. |
| **Default hourly rates**     | Per-role billing rates (Partner, Associate, Paralegal). Used as defaults for new cases AND for time entry billing.             |

### Out of Scope

- AI configuration (separate admin UI)
- Case types (created ad-hoc per case, not pre-defined)
- MS 365 connection status (assumed always connected)
- Mobile settings (desktop only)
- Email digests / notifications

---

## Rationale

1. **Two-tier structure**: Separates personal preferences (available to everyone) from firm configuration (partners only). Matches the existing role system.

2. **Courts in settings**: Courts are first-class entities but managed in settings rather than a separate page - keeps related firm configuration together.

3. **Email signature from Outlook**: Reduces setup friction by defaulting to existing Outlook signature, while allowing customization for this app specifically.

4. **Personal email addresses visible in settings**: Users mark emails as personal in `/emails`, but partners should be able to review/manage the full list in settings.

5. **Dual-purpose hourly rates**: Firm defaults reduce data entry for new cases, while also serving as the billing rates for time tracking.

---

## Open Questions for Research

- [ ] **Email signature**: How to fetch from Outlook via Graph API? What's the exact endpoint?
- [ ] **Email signature storage**: Backend schema for persisting user preferences/signature overrides?
- [ ] **Team access**: How to query Azure AD for users to whitelist? Existing team member queries?
- [ ] **Personal email addresses**: Current backend structure for storing filtered addresses? Existing mutations?
- [ ] **Courts**: Backend schema for courts entity? CRUD operations available?
- [ ] **Hourly rates**: Backend support for firm-level default rates? How are case-level rates stored?
- [ ] **Settings page location**: Where in the app hierarchy? `/settings` route? Modal? Sidebar?

---

## Next Step

Start a new session and run:

```
/research brainstorm-global-settings
```
