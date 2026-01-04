# Research: New Case Setup Flow

**Status**: Complete
**Date**: 2026-01-01
**Input**: `brainstorm-case-setup.md`
**Next step**: `/plan research-case-setup`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech Stack**: Next.js 16, TypeScript, Tailwind, Apollo GraphQL 4.0.11, Zustand
**Backend**: bojin-law-2 gateway at `localhost:4000/graphql`
**Auth**: Microsoft SSO via MSAL, role-based headers in Apollo Client

### Key Decisions from Brainstorm

- Client-first email hierarchy (emails organized under clients, then cases)
- Simplified classification model (emailDomains at case level, replacing CaseActor)
- Role-based permissions (Partner, Lead, Support, Observer)
- Flexible billing (fixed + hourly per-role)
- Configurable case number format

---

## Problem Statement

Design a proper case setup flow that handles:

1. Same client, multiple cases - need client autocomplete and identification
2. Email auto-classification - route emails to correct case with keywords/domains
3. Flexible billing - fixed price and hourly per-role
4. Role-based access - partners see all, others see assigned only

---

## Research Findings

### 1. Existing Code Analysis

#### Reusable Components

| Component      | File                                       | Description                                                        |
| -------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| MobileFormPage | `src/components/mobile/MobileFormPage.tsx` | Multi-step form wrapper with header, back button, fixed action bar |
| MobileInput    | `src/components/mobile/MobileInput.tsx`    | Text input with label, error states, validation                    |
| MobileSelect   | `src/components/mobile/MobileSelect.tsx`   | Native select with chevron icon                                    |
| MobileTextArea | `src/components/mobile/MobileTextArea.tsx` | Auto-resizing textarea                                             |
| InlineError    | `src/components/mobile/InlineError.tsx`    | Error display with retry action                                    |
| Dialog         | `src/components/ui/Dialog.tsx`             | Modal with size variants (sm/md/lg/xl/full)                        |
| BottomSheet    | `src/components/ui/BottomSheet.tsx`        | Mobile sheet with slide animations                                 |
| Badge          | `src/components/ui/Badge.tsx`              | Tag/chip with color variants                                       |
| Input          | `src/components/ui/Input.tsx`              | Desktop input with leftAddon/rightAddon                            |
| Select         | `src/components/ui/Select.tsx`             | Radix-based select with grouping                                   |

#### Reusable Patterns

| Pattern            | Source                                          | Description                                     |
| ------------------ | ----------------------------------------------- | ----------------------------------------------- |
| Search-as-you-type | `src/app/m/search/page.tsx`                     | Debounced (300ms) Apollo query with `useRef`    |
| Array management   | `src/components/clients/CompanyDetailsForm.tsx` | Add/remove items with UUID, per-item validation |
| Form validation    | `src/hooks/mobile/useCreateCase.ts`             | Error objects per field, validation functions   |
| Case creation hook | `src/hooks/mobile/useCreateCase.ts`             | Apollo mutation with refetchQueries             |
| Drawer panel       | `src/components/tasks/TaskDrawer.tsx`           | Full-height scrollable with fixed header        |

#### Missing Components (Need to Build)

- **TagInput** - Chip-style input for keywords/domains (model after Badge + array pattern)
- **ClientAutocomplete** - Search dropdown for client selection
- **TeamMemberSelect** - Multi-select for team assignment

### 2. Files That Need Modification

#### Priority 1: Mobile Pages

| File                            | Current                                                       | Changes Needed                                                                   |
| ------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/app/m/cases/new/page.tsx`  | Basic form (title, clientName text, type, description, value) | Add client autocomplete, team assignment, keywords, emailDomains, billing config |
| `src/app/m/cases/[id]/page.tsx` | Detail view with tabs                                         | Add team management, email classification config                                 |
| `src/app/m/cases/page.tsx`      | Case list                                                     | Show team lead, filter by assignment                                             |

#### Priority 2: GraphQL

| File                       | Changes Needed                                                     |
| -------------------------- | ------------------------------------------------------------------ |
| `src/graphql/mutations.ts` | Expand CREATE_CASE input, add updateCase, createClient, assignTeam |
| `src/graphql/queries.ts`   | Update GET_CASE fields, add useClientSearch query usage            |

#### Priority 3: Hooks

| File                                       | Changes Needed                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `src/hooks/mobile/useCreateCase.ts`        | Expand CreateCaseInput to include clientId, teamMembers, keywords, emailDomains, billing |
| NEW: `src/hooks/mobile/useClientSearch.ts` | Client autocomplete search hook                                                          |
| NEW: `src/hooks/mobile/useTeamMembers.ts`  | Fetch available team members                                                             |

#### Priority 4: Desktop

| File                                       | Changes Needed                     |
| ------------------------------------------ | ---------------------------------- |
| `src/app/(dashboard)/cases/page.tsx`       | Role-based filtering, team display |
| `src/components/cases/CaseDetailPanel.tsx` | Team management section            |
| `src/components/cases/CaseDetailTabs.tsx`  | Show Lead/Support/Observer roles   |

### 3. GraphQL Schema Status

#### Current Case Fields

```typescript
// From GET_CASE query
{
  (id, caseNumber, title, description, status, type);
  (openedDate, closedDate, createdAt, updatedAt);
  client: {
    (id, name, contactInfo, address);
  }
  teamMembers: [
    {
      id,
      role,
      user: { id, firstName, lastName, email, role, avatarUrl },
    },
  ];
  actors: [{ id, name, role, organization, email, phone }]; // CaseActor - to be deprecated
}
```

#### Current CreateCaseInput

```typescript
interface CreateCaseInput {
  title: string;
  clientName: string; // ← Should become clientId
  type: string;
  description: string;
  value?: number;
  billingType?: 'HOURLY' | 'FIXED';
  fixedAmount?: number;
}
```

#### Schema Gaps (Backend Changes Required)

**Client Fields Missing**:

- `businessNames[]` - for aliases, trading names
- `emailDomains[]` - for auto-classification
- `phoneNumbers[]` - array instead of single

**Case Fields Missing**:

- `keywords[]` - for email matching
- `emailDomains[]` - associates, opposing party domains
- `courtFileNumbers[]` - multiple per case
- `hourlyRates` - per-role rates
- `estimatedValue` - for reporting

**Mutations Missing**:

- `updateCase` - modify case fields
- `createClient` / `updateClient` - explicit client management
- `assignTeamMember` / `removeTeamMember` - team management
- `submitForApproval` - workflow transition

### 4. Email Integration Status

#### Current State: 80% Complete

**UI Built**:

- `NeclarAssignmentBar.tsx` - Classification UI with suggestions
- `SplitAssignmentButton.tsx` - 80/20 split for case suggestions
- `EmailCaseSidebar.tsx` - DOSARE/NEATRIBUIT/INSTANȚE/NECLAR sections
- All email viewing and reply components working

**Mutations Defined but NOT WIRED**:

```graphql
CLASSIFY_UNCERTAIN_EMAIL($emailId: ID!, $action: ClassificationActionInput!)
MARK_SENDER_AS_PERSONAL($emailId: ID!, $ignoreEmail: Boolean)
ASSIGN_THREAD_TO_CASE($conversationId: String!, $caseId: ID!)
```

**What's Missing (2-4 hours to complete)**:

1. Wire handlers in `src/app/(dashboard)/email/page.tsx`:
   - `onAssignToCase()` → call `ASSIGN_THREAD_TO_CASE`
   - `onIgnore()` → call `CLASSIFY_UNCERTAIN_EMAIL` with ignore action
   - `onMarkAsPersonal()` → call `MARK_SENDER_AS_PERSONAL`
2. Render `NeclarAssignmentBar` in `EmailConversationView.tsx` (line 204 has TODO)
3. Implement "Choose other case" dialog
4. Add error handling and refetch after actions

### 5. Role & Visibility Status

#### Current Roles

```typescript
// src/store/authStore.ts
role: 'ADMIN' | 'LAWYER' | 'PARALEGAL' | 'SECRETARY'

// Mapped in apollo-client.ts
ADMIN → Partner, LAWYER → Associate, PARALEGAL/SECRETARY → Paralegal
```

#### Current Visibility

- Query has `assignedToMe: Boolean` filter
- Client-side filter for "My Cases" toggle
- NO role-based server-side filtering

#### Team Member Roles

- Only `Lead` role currently used/displayed
- Lead shown as "Responsabil caz"
- Others shown as "Avocat colaborator"

#### Changes Needed for New Requirements

| Requirement                   | Implementation                                          |
| ----------------------------- | ------------------------------------------------------- |
| Partners see all cases        | Server-side auth check based on role header             |
| Others see assigned only      | Default filter to `assignedToMe: true` for non-partners |
| New roles (Support, Observer) | Expand role enum, update display labels                 |
| Partner-only financials       | Conditional rendering based on user role                |
| submitForApproval workflow    | New mutation, status transition logic                   |

---

## Implementation Recommendation

### Phase 1: Backend Schema Extensions (Required First)

Request these changes from backend team:

1. Add `businessNames[]`, `emailDomains[]`, `phoneNumbers[]` to Client type
2. Add `keywords[]`, `emailDomains[]`, `courtFileNumbers[]` to Case type
3. Add `hourlyRates`, `estimatedValue` to Case type
4. Create `updateCase`, `createClient`, `updateClient` mutations
5. Add team assignment mutations

### Phase 2: Client Autocomplete & Basic Form

1. Create `useClientSearch` hook (copy pattern from `useSearch.ts`)
2. Build `ClientAutocomplete` component using debounced search
3. Update case creation form to use client ID instead of name
4. Add inline client creation via BottomSheet

### Phase 3: Team Assignment

1. Create `useTeamMembers` hook
2. Build team member selector component
3. Wire team assignment in case creation
4. Update case detail views to show/manage team

### Phase 4: Email Classification Config

1. Build `TagInput` component for keywords/domains
2. Add to case creation form (optional fields)
3. Add to case edit view
4. Wire the existing email classification mutations

### Phase 5: Billing Configuration

1. Add billing type toggle (Fixed/Hourly)
2. Conditional fields based on type
3. Hourly rates per-role with defaults from global settings

### Phase 6: Role-Based Visibility

1. Backend auth changes for query filtering
2. Frontend conditional rendering for financials
3. Update role enum and mappings

---

## File Plan

| File                                             | Action | Purpose                               |
| ------------------------------------------------ | ------ | ------------------------------------- |
| `src/hooks/mobile/useClientSearch.ts`            | Create | Client autocomplete search            |
| `src/hooks/mobile/useTeamMembers.ts`             | Create | Fetch team members for assignment     |
| `src/components/mobile/TagInput.tsx`             | Create | Chip input for keywords/domains       |
| `src/components/mobile/ClientAutocomplete.tsx`   | Create | Search dropdown for clients           |
| `src/components/mobile/TeamMemberSelect.tsx`     | Create | Multi-select for team                 |
| `src/hooks/mobile/useCreateCase.ts`              | Modify | Expand input types                    |
| `src/app/m/cases/new/page.tsx`                   | Modify | Add all new fields                    |
| `src/graphql/mutations.ts`                       | Modify | Expand CREATE_CASE, add new mutations |
| `src/graphql/queries.ts`                         | Modify | Add/verify field selections           |
| `src/app/(dashboard)/email/page.tsx`             | Modify | Wire classification handlers          |
| `src/components/email/EmailConversationView.tsx` | Modify | Render NeclarAssignmentBar            |
| `src/store/authStore.ts`                         | Modify | Add Support/Observer roles            |
| `src/lib/apollo-client.ts`                       | Modify | Update role mapping                   |

---

## Risks

| Risk                             | Impact                | Mitigation                               |
| -------------------------------- | --------------------- | ---------------------------------------- |
| Backend schema changes delayed   | Blocks Phase 1-5      | Start with UI components, mock data      |
| CaseActor deprecation complexity | Data migration needed | Gradual transition, keep backward compat |
| Email classification edge cases  | User confusion        | Good UX for "choose other case" flow     |
| Role-based visibility complexity | Security holes        | Server-side enforcement, not just client |

---

## Answers to Open Questions

1. **Client autocomplete**: Debounced search (300ms), minimum 2 characters, shows name + address in dropdown
2. **Multiple email domains/keywords UX**: TagInput component with Enter to add, X to remove, validation on add
3. **CaseActor transition**: Keep read-only in UI, move functionality to emailDomains field, deprecate over time
4. **Global settings schema**: Partner-configurable case number format, default hourly rates per role
5. **Approval workflow fit**: New cases start in `PendingApproval`, partners review and assign team, status changes to `Active`
6. **Client mutations**: Need `createClient`, `updateClient` - currently created implicitly
7. **NeclarAssignmentBar wiring**: Mutations exist, just need handlers in email page + render in conversation view

---

## Next Step

Start a new session and run:

```
/plan research-case-setup
```
