# Iteration: Case Data Persistence Issues

**Status**: Review Complete
**Date**: 2026-01-03
**Input**: User report - "details set in new case or edit case don't persist (billing) or contacts' emails don't get synced"
**Next step**: Fix issues via `/implement iterate-case-data-persistence`

---

## Investigation Summary

Analyzed the case creation and update flow across:

- Frontend forms and hooks
- GraphQL mutations
- Backend resolvers
- Database schema

---

## Issues Found

### Issue 1: Custom Hourly Rates Not Sent on Case Creation

- **Location**: `apps/web/src/hooks/mobile/useCreateCase.ts`
- **What Happens**: Form collects `hourlyRates` (partner/associate/paralegal) but the hook never sends them to backend
- **Root Cause**:
  - Frontend interface accepts `hourlyRates?: { partner?: number; associate?: number; paralegal?: number }`
  - Backend GraphQL schema accepts `customRates: CustomRatesInput` with `{ partnerRate, associateRate, paralegalRate }`
  - The hook's `BackendCreateCaseInput` type only includes `billingType` and `fixedAmount`, NOT `customRates`
  - Line 109-121: Only `title`, `clientName`, `type`, `description`, `billingType`, `fixedAmount` are sent
- **Expected**: When user sets hourly rates in the form, they should be saved to the case
- **Suggested Fix**:
  - File: `apps/web/src/hooks/mobile/useCreateCase.ts`
  - Add `customRates` to `BackendCreateCaseInput` interface (lines 84-91)
  - Map `hourlyRates` to `customRates` format in the transformation (lines 109-121)

### Issue 2: Custom Hourly Rates Field Mapping Wrong on Update

- **Location**: `apps/web/src/hooks/mobile/useUpdateCase.ts`
- **What Happens**: Hook sends `hourlyRates` directly but backend expects `customRates`
- **Root Cause**:
  - Lines 89-93: `BackendUpdateCaseInput` has `hourlyRates` field
  - Lines 127-129: Sends `hourlyRates` unchanged
  - Backend GraphQL schema (case.graphql line 451): expects `customRates: CustomRatesInput`
  - Field names don't match! Backend ignores `hourlyRates`, expects `customRates`
- **Expected**: When user edits hourly rates, they should persist
- **Suggested Fix**:
  - File: `apps/web/src/hooks/mobile/useUpdateCase.ts`
  - Rename `hourlyRates` to `customRates` in `BackendUpdateCaseInput`
  - Map field names: `partner → partnerRate`, `associate → associateRate`, `paralegal → paralegalRate`

### Issue 3: Contacts/Administrators Collected But Never Used

- **Location**: `apps/web/src/app/(dashboard)/cases/new/page.tsx` (lines 123, 221, 510-513)
- **What Happens**: CompanyDetailsForm collects administrators and contacts with emails/phones, but:
  1. The `companyDetails` state is collected (line 123)
  2. The form is rendered and updates the state (lines 510-513)
  3. When "Salvează Client" is clicked, `handleCreateNewClient` is called (line 198-222)
  4. But `companyDetails` is **completely ignored** - only `newClientName/Email/Phone/Address` are used
  5. After saving, `companyDetails` is reset to default (line 221)
- **Root Cause**:
  - The `handleCreateNewClient` function (lines 198-222) only uses basic client fields
  - It builds `contactInfo` from just email + phone strings, ignoring all administrators/contacts
  - The `companyDetails` state is collected but **never** included in any API call
- **Impact**: Users can fill out detailed company info with multiple administrators and contacts, all of which is discarded
- **Note**: This requires frontend logic fix to pass `companyDetails` to the backend, plus backend enhancement to store it in `Client.contactInfo` JSON or as `CaseActor` records

### Issue 4: Team Members Not Assigned on Case Creation

- **Location**: `apps/web/src/hooks/mobile/useCreateCase.ts` + backend resolver
- **What Happens**: Frontend form allows selecting team members but they're not assigned
- **Root Cause**:
  - Hook validates `teamMembers` (lines 53-57) but never sends to backend
  - Backend `createCase` only auto-assigns the creator as Lead (lines 714-722)
  - GraphQL schema doesn't have `teamMembers` in `CreateCaseInput`
- **Impact**: Users must manually add team members after creating a case
- **Note**: This requires GraphQL schema enhancement + backend implementation

---

## Iteration Tasks

> These tasks can be passed to `/implement iterate-case-data-persistence` for fixes

### Task 1: Fix Custom Rates on Case Creation

- **File**: `apps/web/src/hooks/mobile/useCreateCase.ts` (MODIFY)
- **Do**:
  1. Add `customRates?: { partnerRate?: number; associateRate?: number; paralegalRate?: number }` to `BackendCreateCaseInput` interface
  2. In `createCase` function, map `input.hourlyRates` to `customRates` format:
     ```typescript
     if (input.hourlyRates) {
       backendInput.customRates = {
         partnerRate: input.hourlyRates.partner,
         associateRate: input.hourlyRates.associate,
         paralegalRate: input.hourlyRates.paralegal,
       };
     }
     ```
- **Done when**: Hourly rates set in new case form persist to database

### Task 2: Fix Custom Rates on Case Update

- **File**: `apps/web/src/hooks/mobile/useUpdateCase.ts` (MODIFY)
- **Do**:
  1. Rename `hourlyRates` to `customRates` in `BackendUpdateCaseInput` interface with correct field names
  2. Map `input.hourlyRates` to `customRates` format:
     ```typescript
     if (input.hourlyRates !== undefined) {
       backendInput.customRates = {
         partnerRate: input.hourlyRates.partner,
         associateRate: input.hourlyRates.associate,
         paralegalRate: input.hourlyRates.paralegal,
       };
     }
     ```
- **Done when**: Hourly rates edited in case form persist to database

---

## Out of Scope (Requires Schema Changes)

The following issues require backend GraphQL schema changes and are noted for future work:

1. **Client Contact Information**: Need to enhance Client model or use CaseActor for client contacts
2. **Team Member Assignment on Create**: Need to add `teamMembers` input to `CreateCaseInput` and implement in resolver
3. **Email Classification Fields**: Keywords, emailDomains, courtFileNumbers collected but not sent

---

## Verdict

- [x] **Issues found** - Run `/implement iterate-case-data-persistence` to fix billing rate persistence
