# Research: Global Settings Backend Implementation

**Status**: Complete
**Date**: 2026-01-02
**Input**: `brainstorm-global-settings.md`
**Next step**: `/plan research-global-settings`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech Stack**: Next.js 16, TypeScript, Tailwind, Zustand, Apollo GraphQL, Azure MSAL
**Backend**: GraphQL gateway at `localhost:4000/graphql` (bojin-law-2 monorepo)
**Platform**: Desktop only (settings not needed for mobile)

**Key Decisions from Brainstorm**:

- Two-tier settings: Personal Preferences (all users) + Firm Settings (Partners/ADMIN only)
- Personal: Theme toggle, Email signature
- Firm: Team access, Personal email addresses list, Courts management, Default hourly rates

---

## Problem Statement

The app needs a global settings page for desktop that allows:

1. **All users** to configure personal preferences (theme, email signature)
2. **Partners (ADMIN role)** to configure firm-wide settings (team access, courts, billing rates, personal emails)

---

## Research Findings

### 1. Frontend Infrastructure Status

#### Settings Page & Components (All Exist)

| Component         | File                                            | Status                          |
| ----------------- | ----------------------------------------------- | ------------------------------- |
| Settings Page     | `src/app/(dashboard)/settings/page.tsx`         | ✅ Structure complete, two tabs |
| ThemeToggle       | `src/components/settings/ThemeToggle.tsx`       | ✅ **Fully functional**         |
| SignatureEditor   | `src/components/settings/SignatureEditor.tsx`   | ⚠️ UI ready, disabled           |
| TeamAccessManager | `src/components/settings/TeamAccessManager.tsx` | ⚠️ UI ready, disabled           |
| CourtManager      | `src/components/settings/CourtManager.tsx`      | ⚠️ UI ready, disabled           |
| BillingRates      | `src/components/settings/BillingRates.tsx`      | ⚠️ UI ready, disabled           |
| PersonalEmailList | `src/components/settings/PersonalEmailList.tsx` | ⚠️ UI ready, disabled           |

**Key Finding**: The frontend is 90% complete. All components show `backendPending: true` state.

#### Settings Store (Functional)

**File**: `src/store/settingsStore.ts`

```typescript
interface SettingsState {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}
// Persists to localStorage as 'settings-storage'
```

#### Settings Hooks (Stubbed)

**File**: `src/hooks/useSettings.ts`

All hooks return `backendPending: true`:

- `useUserPreferences()` - Returns theme from store, signature null
- `useFirmSettings()` - Returns null
- `useCourts()` - Returns empty array
- `usePersonalEmails()` - Returns empty array
- `useTeamAccess()` - Returns empty array

#### GraphQL Operations (Commented Out)

**File**: `src/graphql/queries.ts` (lines 840-898)

```graphql
# Pending backend - all commented out:
GET_USER_PREFERENCES    # theme, emailSignature
GET_COURTS              # court list
GET_FIRM_SETTINGS       # billing rates
GET_PERSONAL_EMAIL_ADDRESSES
GET_TEAM_ACCESS
```

**File**: `src/graphql/mutations.ts` (lines 189-288)

```graphql
# Pending backend - all commented out:
UPDATE_USER_PREFERENCES
CREATE_COURT / UPDATE_COURT / DELETE_COURT
UPDATE_FIRM_SETTINGS
ADD_PERSONAL_EMAIL / REMOVE_PERSONAL_EMAIL
ADD_TEAM_MEMBER / UPDATE_TEAM_MEMBER_ROLE / REMOVE_TEAM_MEMBER
```

#### Type Definitions (Complete)

**File**: `src/types/settings.ts`

```typescript
export type Theme = 'dark' | 'light';

export interface UserPreferences {
  theme: Theme;
  emailSignature?: string;
}

export interface Court {
  id: string;
  name: string;
  fullAddress: string;
  emailDomains: string[];
}

export interface FirmSettings {
  partnerRate: number;
  associateRate: number;
  paralegalRate: number;
}

export interface PersonalEmailAddress {
  id: string;
  emailAddress: string;
  addedBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}
```

---

### 2. Theme System (Functional - No Backend Needed)

**Current Implementation**:

- `next-themes` library with `attribute="class"`, `defaultTheme="dark"`
- Zustand store (`settingsStore.ts`) persists to localStorage
- CSS variables in `globals.css` for both light/dark themes fully defined
- `ThemeSync` component bridges store → next-themes
- ThemeToggle component works immediately

**What Works Now**:

- Light/dark themes fully defined in CSS
- ThemeToggle component functional
- localStorage persistence works
- No backend changes required

**Optional Enhancement**:

- Backend sync of theme preference for cross-device consistency

---

### 3. Email Signature (Backend Required)

**Critical Finding**: Microsoft Graph API `/me/mailboxSettings` does NOT return Outlook signatures. Signatures are stored locally by the Outlook client.

**Solution**: Store custom signatures in app database:

1. User enters signature in SignatureEditor
2. Backend stores via `UPDATE_USER_PREFERENCES` mutation
3. Signature appended when composing emails

**Files to Modify**:

- `src/components/settings/SignatureEditor.tsx` - Enable and connect to mutation
- `src/components/email/ComposeEmailModal.tsx` - Append signature to body

---

### 4. Team Access / Azure AD Integration

**Current State**:

- MSAL configured with `User.ReadBasic.All` scope
- `GET_TEAM_MEMBERS` query exists and works (for case assignment)
- Team access mutations commented out
- `x-ms-access-token` header passed to backend for Graph API calls

**User Roles** (defined in `src/store/authStore.ts`):

```typescript
type UserRole = 'ADMIN' | 'LAWYER' | 'PARALEGAL' | 'SECRETARY';
// ADMIN = Partner (firm settings access)
```

**Role Mapping to Backend**:

```typescript
const roleMapping = {
  ADMIN: 'Partner',
  LAWYER: 'Associate',
  PARALEGAL: 'Paralegal',
  SECRETARY: 'Paralegal',
};
```

**Azure AD User Listing**:

- Requires backend to call MS Graph: `GET /users?$filter=accountEnabled eq true`
- May need `Directory.Read.All` scope (admin consent required in production)
- Frontend passes MS token via `x-ms-access-token` header
- Backend can query Azure AD on user's behalf

**Backend Needs**:

- Query: List Azure AD users available for whitelisting
- Mutation: Add user to whitelist with role assignment
- Mutation: Update user role
- Mutation: Remove user from whitelist

---

### 5. Courts Entity

**Purpose**: First-class entities for:

1. Court reference in cases
2. Auto-classification of court emails via email domain matching

**Type Defined**: `src/types/settings.ts`

```typescript
interface Court {
  id: string;
  name: string;
  fullAddress: string;
  emailDomains: string[]; // For auto-classification
}
```

**Backend Needs**:

- CRUD operations for courts
- Email domain matching logic for auto-classification of court emails

---

### 6. Billing Rates

**Dual Purpose**:

1. Firm defaults for new cases
2. Time entry billing calculations

**Type Defined**: `src/types/settings.ts`

```typescript
interface FirmSettings {
  partnerRate: number;
  associateRate: number;
  paralegalRate: number;
}
```

**UI**: BillingRates.tsx with three currency input fields ($/hour)

**Backend Needs**:

- Store firm-level default rates
- Apply to new cases as defaults
- Use in time tracking billing

---

### 7. Personal Email Addresses

**Current Flow**:

1. User marks sender as personal via `MARK_SENDER_AS_PERSONAL` mutation ✅ (works)
2. Backend stores the address
3. **Missing**: Query to retrieve list for settings page

**Mutation Exists** (line 661 in queries.ts):

```graphql
mutation MarkSenderAsPersonal($emailId: ID!, $ignoreEmail: Boolean) {
  markSenderAsPersonal(emailId: $emailId, ignoreEmail: $ignoreEmail) {
    id
    email
    createdAt
  }
}
```

**Backend Needs**:

- `GET_PERSONAL_EMAIL_ADDRESSES` query
- `REMOVE_PERSONAL_EMAIL` mutation (for partners to manage the list)

---

## Apollo Client Architecture

**File**: `src/lib/apollo-client.ts`

The Apollo Client is configured with:

- **Auth Link**: Injects `x-mock-user` header (userId, firmId, role, email) and `x-ms-access-token`
- **Error Link**: Handles `MS_TOKEN_REQUIRED` errors for token refresh
- **HTTP Link**: `credentials: 'include'` for session cookies
- **Cache**: `InMemoryCache` with `cache-and-network` fetch policy

**Pattern for Settings**:

```typescript
// Query pattern
const { data, loading, error, refetch } = useQuery(GET_USER_PREFERENCES);

// Mutation pattern
const [updatePreferences] = useMutation(UPDATE_USER_PREFERENCES);
await updatePreferences({
  variables: { input },
  refetchQueries: [{ query: GET_USER_PREFERENCES }],
});
```

---

## Backend Schema Recommendation

```graphql
# User Preferences
type UserPreference {
  id: UUID!
  userId: UUID!
  theme: Theme!
  emailSignature: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum Theme {
  DARK
  LIGHT
}

input UpdateUserPreferencesInput {
  theme: Theme
  emailSignature: String
}

# Courts
type Court {
  id: UUID!
  firmId: UUID!
  name: String!
  fullAddress: String
  emailDomains: [String!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

input CreateCourtInput {
  name: String!
  fullAddress: String
  emailDomains: [String!]!
}

input UpdateCourtInput {
  name: String
  fullAddress: String
  emailDomains: [String!]
}

# Firm Settings
type FirmSettings {
  id: UUID!
  firmId: UUID!
  defaultPartnerRate: Float
  defaultAssociateRate: Float
  defaultParalegalRate: Float
  updatedAt: DateTime!
}

input UpdateFirmSettingsInput {
  defaultPartnerRate: Float
  defaultAssociateRate: Float
  defaultParalegalRate: Float
}

# Personal Email Addresses
type PersonalEmailAddress {
  id: UUID!
  firmId: UUID!
  emailAddress: String!
  addedBy: User!
  createdAt: DateTime!
}

# Team Access
type TeamAccess {
  id: UUID!
  firmId: UUID!
  userId: UUID!
  user: User!
  role: UserRole!
  createdAt: DateTime!
}

enum UserRole {
  ADMIN
  LAWYER
  PARALEGAL
  SECRETARY
}

input AddTeamMemberInput {
  azureAdUserId: String!
  email: String!
  firstName: String!
  lastName: String!
  role: UserRole!
}

# Queries
type Query {
  userPreferences: UserPreference
  courts: [Court!]!
  firmSettings: FirmSettings
  personalEmailAddresses: [PersonalEmailAddress!]!
  teamAccess: [TeamAccess!]!
  azureAdUsers: [AzureAdUser!]! # For user picker in whitelist
}

# Mutations
type Mutation {
  updateUserPreferences(input: UpdateUserPreferencesInput!): UserPreference!

  createCourt(input: CreateCourtInput!): Court!
  updateCourt(id: ID!, input: UpdateCourtInput!): Court!
  deleteCourt(id: ID!): Boolean!

  updateFirmSettings(input: UpdateFirmSettingsInput!): FirmSettings!

  addPersonalEmail(emailAddress: String!): PersonalEmailAddress!
  removePersonalEmail(id: ID!): Boolean!

  addTeamMember(input: AddTeamMemberInput!): TeamAccess!
  updateTeamMemberRole(id: ID!, role: UserRole!): TeamAccess!
  removeTeamMember(id: ID!): Boolean!
}
```

---

## Implementation Recommendation

### Phase 1: User Preferences (Low Complexity)

1. Backend: Create `UserPreference` entity + `userPreferences` query + `updateUserPreferences` mutation
2. Frontend: Uncomment GraphQL operations, connect SignatureEditor
3. Theme already works via localStorage (optional backend sync)

### Phase 2: Firm Settings - Billing Rates (Low Complexity)

1. Backend: Create `FirmSettings` entity + query/mutation
2. Frontend: Enable BillingRates component, connect to mutation

### Phase 3: Personal Emails (Low Complexity)

1. Backend: Add `personalEmailAddresses` query (mutation already exists)
2. Frontend: Enable PersonalEmailList, add delete functionality

### Phase 4: Courts (Medium Complexity)

1. Backend: Create `Court` entity + CRUD operations
2. Backend: Add email domain matching for auto-classification
3. Frontend: Enable CourtManager, add create/edit dialog

### Phase 5: Team Access (High Complexity)

1. Backend: Azure AD user listing endpoint (using MS token from header)
2. Backend: Create `TeamAccess` entity + CRUD operations
3. Frontend: Enable TeamAccessManager, add user picker dialog

---

## File Plan

| File                                            | Action | Purpose                                      |
| ----------------------------------------------- | ------ | -------------------------------------------- |
| **Backend (bojin-law-2)**                       |        |                                              |
| `entities/UserPreference.ts`                    | Create | User preferences entity                      |
| `entities/Court.ts`                             | Create | Court entity                                 |
| `entities/FirmSettings.ts`                      | Create | Firm settings entity                         |
| `entities/PersonalEmailAddress.ts`              | Verify | May already exist from MARK_SENDER mutation  |
| `entities/TeamAccess.ts`                        | Create | Team access/whitelist entity                 |
| `resolvers/settings.ts`                         | Create | All settings queries/mutations               |
| `services/azureAdService.ts`                    | Create | Azure AD user listing                        |
| **Frontend (bojin-law-ui)**                     |        |                                              |
| `src/graphql/queries.ts`                        | Modify | Uncomment settings queries (lines 840-898)   |
| `src/graphql/mutations.ts`                      | Modify | Uncomment settings mutations (lines 189-288) |
| `src/hooks/useSettings.ts`                      | Modify | Connect to real GraphQL operations           |
| `src/components/settings/SignatureEditor.tsx`   | Modify | Enable, connect to mutation                  |
| `src/components/settings/BillingRates.tsx`      | Modify | Enable, connect to mutation                  |
| `src/components/settings/PersonalEmailList.tsx` | Modify | Enable, connect to query/mutation            |
| `src/components/settings/CourtManager.tsx`      | Modify | Enable, add create/edit dialog               |
| `src/components/settings/TeamAccessManager.tsx` | Modify | Enable, add user picker                      |

---

## Risks

| Risk                             | Impact | Mitigation                                          |
| -------------------------------- | ------ | --------------------------------------------------- |
| Azure AD admin consent required  | Medium | Implement team view first, whitelist later          |
| Email signature not from Outlook | Low    | Clear UX that this is "app signature"               |
| Type definition conflicts        | Low    | Consolidate `settings.ts` vs `useSettings.ts` types |
| Backend schema complexity        | Medium | Phase implementation by priority                    |

---

## Key Findings Summary

1. **Frontend is 90% ready** - All UI components exist, just disabled with `backendPending` flag
2. **Theme works now** - No backend needed, localStorage persistence functional
3. **Email signatures can't be fetched from Outlook** - Must store in own database
4. **GraphQL operations are templated** - Just need to uncomment when backend is ready
5. **Type definitions exist** - Minor conflict between `settings.ts` and `useSettings.ts` to resolve
6. **Apollo client pattern established** - Follow existing query/mutation patterns

---

## Next Step

Start a new session and run:

```
/plan research-global-settings
```
