# Plan: New Case Setup Flow

**Status**: Approved
**Date**: 2026-01-01
**Input**: `research-case-setup.md`
**Next step**: `/implement plan-case-setup`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management UI
**Path**: `/Users/mio/Developer/bojin-law-ui`
**Tech Stack**: Next.js 16, TypeScript, Tailwind, Apollo GraphQL 4.0.11, Zustand
**Backend**: bojin-law-2 gateway at `localhost:4000/graphql`

### Key Patterns to Follow

- **Search**: Debounced (300ms) Apollo query with `useRef` (see `src/app/m/search/page.tsx`)
- **Array management**: Add/remove with UUID, per-item validation (see `src/components/clients/CompanyDetailsForm.tsx`)
- **Form validation**: Error objects per field (see `src/hooks/mobile/useCreateCase.ts`)
- **Mobile forms**: Use `MobileFormPage`, `MobileInput`, `MobileSelect` components

### Design Tokens (Mobile)

```
Backgrounds: #0a0a0a (primary) → #141414 (elevated) → #1a1a1a (card)
Text: #fafafa (primary) → #a1a1a1 (secondary) → #6b6b6b (tertiary)
Accent: #3b82f6 (blue), #f59e0b (warning), #22c55e (success)
Spacing: Always px-6 (24px) for content padding
```

---

## Approach Summary

Build a comprehensive case setup flow with client autocomplete, team assignment, email classification config (keywords/domains), and flexible billing. Use mock data where backend schema changes are pending. Cover both mobile and desktop experiences. Wire the existing but unused email classification mutations.

---

## Parallel Group 1: Foundation Components & Hooks

> These 5 tasks run simultaneously via sub-agents. All CREATE operations, no conflicts.

### Task 1.1: useClientSearch Hook

- **File**: `src/hooks/mobile/useClientSearch.ts` (CREATE)
- **Do**:
  - Create hook that searches clients by name
  - Use debounced Apollo query (300ms) pattern from `useSearch.ts`
  - Accept `searchTerm: string`, return `{ clients, loading, error }`
  - Include mock data fallback for development (3-5 fake clients)
  - Client shape: `{ id, name, contactInfo, address }`
- **Done when**: Hook returns filtered clients based on search term

### Task 1.2: useTeamMembers Hook

- **File**: `src/hooks/mobile/useTeamMembers.ts` (CREATE)
- **Do**:
  - Create hook that fetches available team members
  - Query users with roles ADMIN, LAWYER, PARALEGAL
  - Return `{ members, loading, error }`
  - Include mock data fallback (5-6 fake team members)
  - Member shape: `{ id, firstName, lastName, email, role, avatarUrl }`
- **Done when**: Hook returns list of assignable team members

### Task 1.3: TagInput Component

- **File**: `src/components/mobile/TagInput.tsx` (CREATE)
- **Do**:
  - Build chip-style input for keywords/domains
  - Props: `value: string[]`, `onChange`, `placeholder`, `label`, `error`
  - Enter key or comma adds tag, X button removes
  - Validate on add (no duplicates, optional format validation via `validate` prop)
  - Style with Badge component aesthetic (rounded-full, bg-zinc-800)
  - Support `type="email"` for domain validation
- **Done when**: Can add/remove tags, shows validation errors

### Task 1.4: ClientAutocomplete Component

- **File**: `src/components/mobile/ClientAutocomplete.tsx` (CREATE)
- **Do**:
  - Build search dropdown using `useClientSearch` hook
  - Props: `value: Client | null`, `onChange`, `label`, `error`
  - Show dropdown after 2+ characters typed
  - Display client name + address in dropdown items
  - Include "Create new client" option at bottom
  - Style: elevated dropdown (bg-zinc-900), highlight on hover
- **Done when**: Can search, select existing client, or trigger new client creation

### Task 1.5: TeamMemberSelect Component

- **File**: `src/components/mobile/TeamMemberSelect.tsx` (CREATE)
- **Do**:
  - Build multi-select for team assignment using `useTeamMembers` hook
  - Props: `value: TeamAssignment[]`, `onChange`, `label`, `error`
  - TeamAssignment: `{ userId: string, role: 'Lead' | 'Support' | 'Observer' }`
  - Show avatar, name, current role for each member
  - Role selector per selected member (dropdown)
  - Require exactly one Lead
- **Done when**: Can select multiple members, assign roles, validates Lead requirement

---

## Parallel Group 2: GraphQL Layer

> These 3 tasks run simultaneously. After Group 1 completes.

### Task 2.1: Expand Mutations

- **File**: `src/graphql/mutations.ts` (MODIFY)
- **Do**:
  - Expand `CREATE_CASE` input to include:
    - `clientId: ID` (replace clientName)
    - `teamMembers: [{ userId: ID!, role: String! }]`
    - `keywords: [String!]`
    - `emailDomains: [String!]`
    - `courtFileNumbers: [String!]`
    - `hourlyRates: { partner: Float, associate: Float, paralegal: Float }`
    - `estimatedValue: Float`
  - Add `UPDATE_CASE` mutation with same fields
  - Add `ASSIGN_TEAM_MEMBER` mutation
  - Add `REMOVE_TEAM_MEMBER` mutation
  - Add `CREATE_CLIENT` mutation (name, contactInfo, address, emailDomains, businessNames)
- **Done when**: All mutations defined (will error until backend implements)

### Task 2.2: Expand Queries

- **File**: `src/graphql/queries.ts` (MODIFY)
- **Do**:
  - Add `SEARCH_CLIENTS` query (search by name, limit 10)
  - Add `GET_TEAM_MEMBERS` query (users with assignable roles)
  - Expand `GET_CASE` to include new fields when available
  - Add comments marking fields pending backend implementation
- **Done when**: Queries defined for client search and team members

### Task 2.3: Expand useCreateCase Hook

- **File**: `src/hooks/mobile/useCreateCase.ts` (MODIFY)
- **Do**:
  - Expand `CreateCaseInput` interface:
    ```typescript
    interface CreateCaseInput {
      title: string;
      clientId: string; // Changed from clientName
      type: string;
      description: string;
      teamMembers: { userId: string; role: string }[];
      keywords: string[];
      emailDomains: string[];
      courtFileNumbers: string[];
      billingType: 'HOURLY' | 'FIXED';
      fixedAmount?: number;
      hourlyRates?: { partner?: number; associate?: number; paralegal?: number };
      estimatedValue?: number;
    }
    ```
  - Update validation to require clientId and at least one Lead
  - Update mutation call with new fields
- **Done when**: Hook accepts and validates expanded input

---

## Sequential: Mobile Form Integration

> After Groups 1 & 2 complete. Single task touching the main form page.

### Task 3: Integrate Case Creation Form

- **File**: `src/app/m/cases/new/page.tsx` (MODIFY)
- **Depends on**: Tasks 1.1-1.5, 2.1-2.3
- **Do**:
  - Replace text `clientName` input with `ClientAutocomplete`
  - Add `TeamMemberSelect` after client selection
  - Add `TagInput` for keywords (label: "Cuvinte cheie email")
  - Add `TagInput` for emailDomains (label: "Domenii email")
  - Add `TagInput` for courtFileNumbers (label: "Numere dosar instanță")
  - Add billing section:
    - Toggle for HOURLY vs FIXED
    - If FIXED: show fixedAmount input
    - If HOURLY: show rate inputs per role (partner, associate, paralegal)
  - Add estimatedValue input (optional)
  - Wire all new fields to form state and submission
  - Add "Create new client" BottomSheet triggered from autocomplete
- **Done when**: Full form works with all new fields, submits expanded data

---

## Parallel Group 3: Email Classification & Auth

> These 4 tasks run simultaneously. Independent of form work.

### Task 4.1: Wire Email Classification Handlers

- **File**: `src/app/(dashboard)/email/page.tsx` (MODIFY)
- **Do**:
  - Import existing mutations: `CLASSIFY_UNCERTAIN_EMAIL`, `MARK_SENDER_AS_PERSONAL`, `ASSIGN_THREAD_TO_CASE`
  - Add `useMutation` hooks for each
  - Implement `handleAssignToCase(emailId, caseId)`:
    - Call `ASSIGN_THREAD_TO_CASE`
    - Refetch email list on success
    - Show toast on error
  - Implement `handleIgnoreEmail(emailId)`:
    - Call `CLASSIFY_UNCERTAIN_EMAIL` with ignore action
    - Refetch on success
  - Implement `handleMarkAsPersonal(emailId)`:
    - Call `MARK_SENDER_AS_PERSONAL`
    - Refetch on success
  - Pass handlers down to email components
- **Done when**: Classification actions trigger mutations and update UI

### Task 4.2: Render NeclarAssignmentBar

- **File**: `src/components/email/EmailConversationView.tsx` (MODIFY)
- **Do**:
  - Import `NeclarAssignmentBar` component
  - Check if current email has `classification === 'UNCERTAIN'`
  - Render `NeclarAssignmentBar` at top of conversation view for uncertain emails
  - Pass classification handlers from props
  - Add "Choose other case" dialog using existing Dialog component
  - Show case search/select in dialog
- **Done when**: Uncertain emails show assignment bar, actions work

### Task 4.3: Update Auth Store Roles

- **File**: `src/store/authStore.ts` (MODIFY)
- **Do**:
  - Expand role type to include case-level roles:
    ```typescript
    type UserRole = 'ADMIN' | 'LAWYER' | 'PARALEGAL' | 'SECRETARY';
    type CaseRole = 'Lead' | 'Support' | 'Observer';
    ```
  - Add helper `isPartner()` based on ADMIN role
  - Add helper `canViewFinancials()` returns true for ADMIN only
  - Keep backward compatible with existing code
- **Done when**: New role types exported, helpers available

### Task 4.4: Update Apollo Role Mapping

- **File**: `src/lib/apollo-client.ts` (MODIFY)
- **Do**:
  - Update role mapping comments to reflect new structure
  - Ensure headers still send correct role for backend auth
  - Add comment explaining case-level vs user-level roles
- **Done when**: Role mapping documented, headers unchanged

---

## Parallel Group 4: Desktop Updates

> These 3 tasks run simultaneously. After mobile form is complete.

### Task 5.1: Desktop Case List Updates

- **File**: `src/app/(dashboard)/cases/page.tsx` (MODIFY)
- **Do**:
  - Add "Team Lead" column showing lead's name
  - Add role-based default filter:
    - Partners (ADMIN): show all cases
    - Others: default to `assignedToMe: true`
  - Add toggle to switch between "My Cases" and "All Cases" (partners only)
  - Show team member count badge
- **Done when**: Case list shows team info, filters by role

### Task 5.2: Case Detail Panel Team Section

- **File**: `src/components/cases/CaseDetailPanel.tsx` (MODIFY)
- **Do**:
  - Add "Echipă" (Team) section below client info
  - Show team members with avatar, name, role badge
  - Role badges: Lead (blue), Support (gray), Observer (outline)
  - Add "Edit Team" button (opens modal for partners)
  - Conditionally show billing info for partners only
- **Done when**: Team section displays, edit triggers modal

### Task 5.3: Case Detail Tabs Team Display

- **File**: `src/components/cases/CaseDetailTabs.tsx` (MODIFY)
- **Do**:
  - Update Overview tab to show team summary
  - Add role breakdown: "1 Lead, 2 Support, 1 Observer"
  - Show team member avatars in a row
  - Link to full team management (scrolls to team section)
- **Done when**: Tabs show team summary with role breakdown

---

## Final: Integration & Testing

> Sequential, after all tasks complete.

### Task 6: Integration & Verification

- **Depends on**: All above tasks
- **Do**:
  - Run `npm run type-check` - fix any TypeScript errors
  - Run `npm run lint` - fix any linting issues
  - Manual test mobile case creation flow:
    - Search and select client
    - Assign team members with roles
    - Add keywords and email domains
    - Configure billing (both types)
    - Submit and verify data
  - Manual test email classification:
    - View uncertain email
    - Assign to case
    - Mark as personal
    - Ignore email
  - Manual test desktop:
    - Verify role-based filtering
    - Check team display in list and detail
  - Capture screenshots with `npx ts-node scripts/capture-mobile.ts`
- **Done when**: All tests pass, flows work end-to-end, no console errors

---

## Session Scope Assessment

- **Total tasks**: 16
- **Estimated complexity**: Complex
- **Parallel groups**: 4 (max 5 tasks each)
- **Sequential dependencies**: 2 (Task 3 after Groups 1+2, Task 6 after all)

### Checkpoint Recommendation

After **Task 3** (mobile form complete):

- Mobile case creation is functional
- Good stopping point for review
- Desktop and email work can continue in next session if needed

### Mock Data Note

Tasks 1.1, 1.2, 2.1, 2.2 include mock data fallbacks. When backend implements schema changes:

1. Remove mock data from hooks
2. Update GraphQL queries/mutations to match actual schema
3. Test with real backend

---

## Next Step

Start a new session and run:

```
/implement plan-case-setup
```
