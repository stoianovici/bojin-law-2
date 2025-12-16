# Implementation Guide: Case Management Enhancements

## Stories 2.8, 2.8.1 - 2.8.4

**Target Audience:** Developers implementing case management enhancements
**Last Updated:** 2025-11-21
**Author:** Mary (Business Analyst)

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Implementation Order](#implementation-order)
4. [Story 2.8: Base Case CRUD](#story-28-base-case-crud)
5. [Story 2.8.3: Financial Visibility](#story-283-financial-visibility)
6. [Story 2.8.1: Billing & Rates](#story-281-billing--rates)
7. [Story 2.8.2: Approval Workflow](#story-282-approval-workflow)
8. [Story 2.8.4: Document Linking](#story-284-document-linking)
9. [Key Technical Patterns](#key-technical-patterns)
10. [Common Pitfalls](#common-pitfalls)
11. [Testing Strategy](#testing-strategy)
12. [Deployment Checklist](#deployment-checklist)

---

## Overview

This guide covers implementation of **five** case management features in sequence:

| Story   | Feature               | Complexity | Est. Effort | Status          |
| ------- | --------------------- | ---------- | ----------- | --------------- |
| **2.8** | **Base Case CRUD UI** | **Medium** | **2 weeks** | **CHECK FIRST** |
| 2.8.3   | Financial Visibility  | High       | 2-3 weeks   | Enhancement     |
| 2.8.1   | Billing & Rates       | Medium     | 2-3 weeks   | Enhancement     |
| 2.8.2   | Approval Workflow     | Medium     | 2 weeks     | Enhancement     |
| 2.8.4   | Document Linking      | High       | 3-4 weeks   | Enhancement     |

**Total Estimated Effort:**

- **If Story 2.8 already done:** 9-12 weeks
- **If Story 2.8 NOT done:** 11-14 weeks

---

## ⚠️ IMPORTANT: Check Story 2.8 Status First!

Before starting implementation, verify if **Story 2.8 (Base Case CRUD UI)** is already implemented:

### Quick Check

```bash
# Check for case pages
ls apps/web/src/app/cases/page.tsx
ls apps/web/src/app/cases/[caseId]/page.tsx

# Check for case components
ls apps/web/src/components/case/CaseListTable.tsx
ls apps/web/src/components/case/CreateCaseModal.tsx

# Check GraphQL schema
grep -r "type Case" services/gateway/src/graphql/schema/
```

**Or navigate to:** `http://localhost:3000/cases`

- Can you see a case list? ✅ Story 2.8 likely done
- Can you create a case? ✅ Story 2.8 likely done
- 404 or blank page? ❌ Story 2.8 needs implementation

### Decision Path

**✅ If Story 2.8 IS IMPLEMENTED:**

- Skip to Phase 1 (Story 2.8.3)
- Follow original timeline (9-12 weeks)

**❌ If Story 2.8 IS NOT IMPLEMENTED:**

- Start with Phase 0 (Story 2.8)
- This is the foundation - cannot skip!
- Follow full timeline (11-14 weeks)

**⚠️ If Story 2.8 IS PARTIALLY IMPLEMENTED:**

- Review Story 2.8 acceptance criteria (see `docs/stories/2.8.story.md`)
- Complete missing functionality before proceeding
- Adjust timeline based on what's missing

---

## Prerequisites

### Technical Knowledge Required

- ✅ TypeScript & Node.js
- ✅ GraphQL (schema, resolvers, directives)
- ✅ React & Next.js 14 (App Router)
- ✅ PostgreSQL (schema design, migrations)
- ✅ Prisma ORM (or equivalent)
- ✅ React Query for state management
- ✅ Radix UI component library

### Project Setup Required

- ✅ Development environment running
- ✅ Database access and migration tools
- ✅ GraphQL Playground available
- ✅ Storybook or component preview setup (recommended)
- ✅ Testing framework configured (Jest, RTL, Playwright)

### Documentation to Review

1. `docs/architecture/coding-standards.md`
2. `docs/architecture/data-models.md`
3. `docs/api/case-management-api.md`
4. `docs/stories/2.8.story.md` (base case CRUD)

---

## Implementation Order

### Recommended Sequence

```
PHASE 0: Base Case Management (Week 1-2) **CHECK IF ALREADY DONE**
  └─ Story 2.8: Case CRUD Operations UI
     - Case list page with filtering
     - Create case form and modal
     - Case detail page with inline editing
     - Search functionality
     - Team assignment UI
     - ⚠️ FOUNDATION: All other stories extend this!

PHASE 1: Authorization Infrastructure (Week 3-5)
  └─ Story 2.8.3: Financial Visibility
     - Establishes authorization patterns
     - Creates reusable components
     - Needed by Story 2.8.1
     - Extends case UI from Story 2.8

PHASE 2: Financial Features (Week 6-8)
  └─ Story 2.8.1: Billing & Rate Management
     - Adds billing section to case forms
     - Uses financial visibility from Phase 1
     - Extends case detail from Story 2.8

PHASE 3: Workflow & Documents (Week 9-12, Parallel)
  ├─ Story 2.8.2: Approval Workflow
  │  - Extends case creation from Story 2.8
  │  - Adds approval queue UI
  │  - Can be implemented in parallel with 2.8.4
  │
  └─ Story 2.8.4: Document Linking
     - Extends documents section from Story 2.8
     - Independent architecture change
     - Requires data migration (plan carefully)

PHASE 4: Integration & Testing (Week 13-14)
  └─ Integration testing, bug fixes, polish
```

### Rationale for Order

**Why Story 2.8 First (Phase 0)?**

- Provides the base case UI that all other stories enhance
- Stories 2.8.1-2.8.4 add features to case forms, detail pages, and workflows
- Cannot implement enhancements without the base UI
- **If already implemented, skip to Phase 1**

**Why Financial Visibility Second (Phase 1)?**

- Creates reusable authorization patterns
- Story 2.8.1 depends on `<FinancialData>` wrapper
- Establishes security foundation for financial features
- Used throughout case UI from Story 2.8

**Why Approval Workflow & Document Linking in Parallel (Phase 3)?**

- Both extend Story 2.8 independently
- No shared code or data models
- Can be developed by separate developers/teams
- Maximizes development efficiency

---

## Story 2.8: Base Case CRUD

### Overview

**Story 2.8 provides the foundation for all case management enhancements.**

This story implements:

- Case list page with filtering (status, client, assigned user)
- Create case form with client selection, case type, description
- Case detail page with all case information
- Inline editing capabilities
- Case search functionality
- Team assignment management
- Case actors management (opposing parties, witnesses, etc.)
- Case archival functionality

### Implementation Status Check

**Before proceeding, determine if Story 2.8 is already implemented:**

#### Method 1: File System Check

```bash
# Check for case pages
ls apps/web/src/app/cases/page.tsx
ls apps/web/src/app/cases/[caseId]/page.tsx

# Check for case components
ls apps/web/src/components/case/

# Expected components:
# - CaseListTable.tsx
# - CaseFilters.tsx
# - CaseSearchBar.tsx
# - CreateCaseModal.tsx
# - InlineEditField.tsx
```

#### Method 2: Application Check

1. Navigate to `http://localhost:3000/cases`
2. Expected functionality:
   - ✅ Case list displays
   - ✅ Can filter cases by status
   - ✅ Can create new case
   - ✅ Can click case to view detail
   - ✅ Can edit case fields inline
   - ✅ Can search cases

#### Method 3: GraphQL Schema Check

```bash
# Check if case schema exists
cat services/gateway/src/graphql/schema/case.graphql

# Expected types:
# - type Case { ... }
# - type Query { cases(...): [Case!]! }
# - type Mutation { createCase(...): Case! }
```

### Decision Tree

```
Does Story 2.8 exist?
│
├─ ✅ YES: All checks pass
│   └─ SKIP Phase 0
│      Start with Phase 1 (Story 2.8.3)
│      Timeline: 9-12 weeks
│
├─ ❌ NO: Checks fail or 404 errors
│   └─ IMPLEMENT Phase 0
│      Follow Story 2.8 documentation
│      Then proceed to Phase 1
│      Timeline: 11-14 weeks
│
└─ ⚠️ PARTIAL: Some checks pass, some fail
    └─ COMPLETE missing features
       Review Story 2.8 acceptance criteria
       Compare with current implementation
       Implement gaps before Phase 1
       Timeline: Adjust based on gaps
```

### Full Documentation

**For complete implementation details of Story 2.8, see:**

- **Story Document:** `docs/stories/2.8.story.md` (742 lines, 21 tasks)
- **Dev Notes:** Architecture, GraphQL API, component patterns
- **Testing Strategy:** Unit, integration, E2E tests

**Story 2.8 includes 6 phases:**

1. Case List Page Component
2. Create Case Form and Modal
3. Case Detail Page with Inline Editing
4. Case Archival Feature
5. Integration and Polish
6. Testing

**If Story 2.8 needs implementation, allocate 2 weeks and follow the detailed task breakdown in the story document.**

### What Gets Extended by Enhancement Stories

Once Story 2.8 is complete, enhancement stories will extend:

- **Story 2.8.1** extends:
  - `CreateCaseModal.tsx` - adds billing type selection
  - Case detail page - adds billing info section
  - Partner settings - adds default rates

- **Story 2.8.2** extends:
  - `createCase` mutation - adds approval workflow
  - Case list - adds pending approvals queue
  - Notifications - adds approval notifications

- **Story 2.8.3** extends:
  - All case components - wraps financial data
  - GraphQL schema - adds authorization directive
  - Navigation - hides financial pages from non-Partners

- **Story 2.8.4** extends:
  - Case detail page - changes document section
  - Document model - ownership and linking
  - File storage - reorganizes structure

---

## Story 2.8.3: Financial Visibility

### Quick Start Checklist

- [ ] Create GraphQL directive `@requiresFinancialAccess`
- [ ] Apply directive to all financial fields
- [ ] Create React context `FinancialAccessContext`
- [ ] Create wrapper component `<FinancialData>`
- [ ] Wrap all financial UI components
- [ ] Test with all user roles

### Step-by-Step Implementation

#### 1. Backend: Create GraphQL Directive

**File:** `services/gateway/src/graphql/directives/requiresFinancialAccess.ts`

```typescript
import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver, GraphQLField } from 'graphql';
import { Context } from '../types/context';

export class RequiresFinancialAccessDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field: GraphQLField<any, Context>) {
    const { resolve = defaultFieldResolver } = field;

    field.resolve = async function (source, args, context: Context, info) {
      // Check if user is Partner
      if (context.user?.role !== 'Partner') {
        // Log unauthorized access attempt
        context.logger.info('Financial data access denied', {
          userId: context.user?.id,
          firmId: context.user?.firmId,
          field: info.fieldName,
          userRole: context.user?.role,
        });

        // Return null (graceful degradation)
        return null;
      }

      // User is Partner - resolve normally
      return resolve.call(this, source, args, context, info);
    };
  }
}
```

**Register directive in schema:**

```typescript
// services/gateway/src/graphql/schema/index.ts
import { RequiresFinancialAccessDirective } from '../directives/requiresFinancialAccess';

const schemaDirectives = {
  requiresFinancialAccess: RequiresFinancialAccessDirective,
};

// Apply to schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
  schemaDirectives,
});
```

#### 2. Apply Directive to Schema Fields

**File:** `services/gateway/src/graphql/schema/case.graphql`

```graphql
# Define directive
directive @requiresFinancialAccess on FIELD_DEFINITION

type Case {
  id: UUID!
  caseNumber: String!
  title: String!

  # Financial fields - protected
  value: Float @requiresFinancialAccess
  billingType: BillingType @requiresFinancialAccess
  fixedAmount: Float @requiresFinancialAccess
  customRates: CustomRates @requiresFinancialAccess

  # Non-financial fields - accessible to all
  status: CaseStatus!
  description: String!
  # ... other fields
}
```

#### 3. Frontend: Create Financial Access Context

**File:** `apps/web/src/contexts/FinancialAccessContext.tsx`

```typescript
import { createContext, useContext, ReactNode } from 'react';
import { useSession } from '@/hooks/useSession';

interface FinancialAccessContextType {
  hasFinancialAccess: boolean;
}

const FinancialAccessContext = createContext<FinancialAccessContextType>({
  hasFinancialAccess: false,
});

export function FinancialAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const hasFinancialAccess = user?.role === 'Partner';

  return (
    <FinancialAccessContext.Provider value={{ hasFinancialAccess }}>
      {children}
    </FinancialAccessContext.Provider>
  );
}

export function useFinancialAccess() {
  const context = useContext(FinancialAccessContext);
  if (!context) {
    throw new Error('useFinancialAccess must be used within FinancialAccessProvider');
  }
  return context;
}
```

**Add to app root:**

```typescript
// apps/web/src/app/layout.tsx
import { FinancialAccessProvider } from '@/contexts/FinancialAccessContext';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          <FinancialAccessProvider>
            {children}
          </FinancialAccessProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

#### 4. Create FinancialData Wrapper Component

**File:** `apps/web/src/components/auth/FinancialData.tsx`

```typescript
import { ReactNode } from 'react';
import { useFinancialAccess } from '@/contexts/FinancialAccessContext';

interface FinancialDataProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function FinancialData({ children, fallback = null }: FinancialDataProps) {
  const { hasFinancialAccess } = useFinancialAccess();

  if (!hasFinancialAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

#### 5. Wrap Financial Components

**Example: Case Detail Page**

```tsx
// apps/web/src/app/cases/[caseId]/page.tsx
import { FinancialData } from '@/components/auth/FinancialData';

export default function CaseDetailPage({ params }) {
  const { data: caseData } = useCase(params.caseId);

  return (
    <div className="grid gap-6">
      {/* Always visible */}
      <CaseInfoSection case={caseData} />
      <ClientInfoSection client={caseData.client} />

      {/* Only visible to Partners */}
      <FinancialData>
        <BillingInfoSection case={caseData} />
      </FinancialData>

      {/* Always visible */}
      <DocumentsSection case={caseData} />
      <TeamSection case={caseData} />
    </div>
  );
}
```

**Example: Case List Table**

```tsx
// apps/web/src/components/case/CaseListTable.tsx
import { FinancialData } from '@/components/auth/FinancialData';

export function CaseListTable({ cases }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Case Number</th>
          <th>Title</th>
          <th>Client</th>
          <th>Status</th>

          {/* Financial column - only for Partners */}
          <FinancialData>
            <th>Case Value</th>
          </FinancialData>

          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {cases.map(case => (
          <tr key={case.id}>
            <td>{case.caseNumber}</td>
            <td>{case.title}</td>
            <td>{case.client.name}</td>
            <td><StatusBadge status={case.status} /></td>

            {/* Financial data - only for Partners */}
            <FinancialData>
              <td>{formatCurrency(case.value)}</td>
            </FinancialData>

            <td><CaseActions case={case} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Testing Financial Visibility

**Backend Test:**

```typescript
// services/gateway/src/graphql/resolvers/case.test.ts
describe('Financial field authorization', () => {
  it('returns null for financial fields when user is Associate', async () => {
    const context = createMockContext({ role: 'Associate' });

    const result = await executeGraphQL({
      schema,
      source: `
        query {
          case(id: "test-id") {
            id
            title
            value
          }
        }
      `,
      contextValue: context,
    });

    expect(result.data.case.id).toBeDefined();
    expect(result.data.case.title).toBeDefined();
    expect(result.data.case.value).toBeNull(); // Financial field
  });

  it('returns financial fields when user is Partner', async () => {
    const context = createMockContext({ role: 'Partner' });

    const result = await executeGraphQL({
      schema,
      source: `
        query {
          case(id: "test-id") {
            value
          }
        }
      `,
      contextValue: context,
    });

    expect(result.data.case.value).toBe(50000);
  });
});
```

**Frontend Test:**

```typescript
// apps/web/src/components/auth/FinancialData.test.tsx
import { render, screen } from '@testing-library/react';
import { FinancialData } from './FinancialData';
import { FinancialAccessProvider } from '@/contexts/FinancialAccessContext';

describe('FinancialData', () => {
  it('hides children for non-Partners', () => {
    const mockUser = { role: 'Associate' };

    render(
      <FinancialAccessProvider value={{ hasFinancialAccess: false }}>
        <FinancialData>
          <div>Financial Content</div>
        </FinancialData>
      </FinancialAccessProvider>
    );

    expect(screen.queryByText('Financial Content')).not.toBeInTheDocument();
  });

  it('shows children for Partners', () => {
    const mockUser = { role: 'Partner' };

    render(
      <FinancialAccessProvider value={{ hasFinancialAccess: true }}>
        <FinancialData>
          <div>Financial Content</div>
        </FinancialData>
      </FinancialAccessProvider>
    );

    expect(screen.getByText('Financial Content')).toBeInTheDocument();
  });
});
```

---

## Story 2.8.1: Billing & Rates

### Quick Start Checklist

- [ ] Add billing fields to Case model
- [ ] Create CaseRateHistory table
- [ ] Extend GraphQL schema for billing
- [ ] Create Partner settings page for default rates
- [ ] Add billing section to case forms
- [ ] Implement KPI calculations
- [ ] Create KPI dashboard

### Step-by-Step Implementation

#### 1. Database Schema Changes

**Migration File:** `packages/database/migrations/add-billing-to-cases.ts`

```typescript
export async function up(knex: Knex): Promise<void> {
  // Add billing fields to Case table
  await knex.schema.alterTable('cases', (table) => {
    table.enum('billing_type', ['Hourly', 'Fixed']).defaultTo('Hourly');
    table.decimal('fixed_amount', 10, 2).nullable();
    table.jsonb('custom_rates').nullable(); // { partnerRate, associateRate, paralegalRate }
  });

  // Create CaseRateHistory table
  await knex.schema.createTable('case_rate_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('case_id').notNullable().references('id').inTable('cases').onDelete('CASCADE');
    table.uuid('changed_by').notNullable().references('id').inTable('users');
    table.timestamp('changed_at').defaultTo(knex.fn.now());
    table.enum('rate_type', ['partner', 'associate', 'paralegal', 'fixed']).notNullable();
    table.decimal('old_rate', 10, 2).notNullable();
    table.decimal('new_rate', 10, 2).notNullable();
    table.uuid('firm_id').notNullable().references('id').inTable('firms');

    table.index(['case_id', 'changed_at']);
    table.index('firm_id');
  });

  // Add default rates to Firm settings
  await knex.schema.alterTable('firms', (table) => {
    table.jsonb('default_rates').nullable(); // { partnerRate, associateRate, paralegalRate }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cases', (table) => {
    table.dropColumn('billing_type');
    table.dropColumn('fixed_amount');
    table.dropColumn('custom_rates');
  });

  await knex.schema.dropTableIfExists('case_rate_history');

  await knex.schema.alterTable('firms', (table) => {
    table.dropColumn('default_rates');
  });
}
```

#### 2. GraphQL Schema Extensions

**File:** `services/gateway/src/graphql/schema/case.graphql`

```graphql
enum BillingType {
  HOURLY
  FIXED
}

type CustomRates {
  partnerRate: Float
  associateRate: Float
  paralegalRate: Float
}

type Case {
  # Existing fields...

  # Billing fields (Partners only)
  billingType: BillingType! @requiresFinancialAccess
  fixedAmount: Float @requiresFinancialAccess
  customRates: CustomRates @requiresFinancialAccess
  rateHistory: [RateHistoryEntry!]! @requiresFinancialAccess
}

type RateHistoryEntry {
  id: UUID!
  changedAt: DateTime!
  changedBy: User!
  rateType: String!
  oldRate: Float!
  newRate: Float!
}

input CreateCaseInput {
  # Existing fields...

  # Billing fields
  billingType: BillingType!
  fixedAmount: Float
  customRates: CustomRatesInput
}

input CustomRatesInput {
  partnerRate: Float
  associateRate: Float
  paralegalRate: Float
}

input UpdateCaseInput {
  # Existing fields...

  # Billing fields
  billingType: BillingType
  fixedAmount: Float
  customRates: CustomRatesInput
}
```

**File:** `services/gateway/src/graphql/schema/firm.graphql`

```graphql
type DefaultRates {
  partnerRate: Float!
  associateRate: Float!
  paralegalRate: Float!
}

type Firm {
  # Existing fields...

  defaultRates: DefaultRates @requiresFinancialAccess
}

type Mutation {
  updateDefaultRates(input: DefaultRatesInput!): DefaultRates!
}

input DefaultRatesInput {
  partnerRate: Float!
  associateRate: Float!
  paralegalRate: Float!
}
```

#### 3. Backend Resolvers

**File:** `services/gateway/src/graphql/resolvers/caseResolvers.ts`

```typescript
export const caseResolvers = {
  Mutation: {
    createCase: async (_, { input }, context: Context) => {
      const { user } = context;

      // Get firm default rates
      const firm = await context.prisma.firm.findUnique({
        where: { id: user.firmId },
        select: { defaultRates: true },
      });

      // Create case with billing info
      const newCase = await context.prisma.case.create({
        data: {
          ...input,
          firmId: user.firmId,
          // Inherit default rates if custom rates not provided
          customRates: input.customRates || firm.defaultRates,
          // Validate fixed amount if billing type is Fixed
          fixedAmount: input.billingType === 'FIXED' ? input.fixedAmount : null,
        },
        include: {
          client: true,
          teamMembers: true,
        },
      });

      // Create initial rate history entries
      if (newCase.customRates) {
        await createInitialRateHistory(context, newCase);
      }

      // Audit log
      await context.auditLog.create({
        action: 'CaseCreated',
        userId: user.id,
        resourceId: newCase.id,
        metadata: { billingType: newCase.billingType },
      });

      return newCase;
    },

    updateCase: async (_, { id, input }, context: Context) => {
      const { user } = context;

      // Get current case for comparison
      const currentCase = await context.prisma.case.findUnique({
        where: { id },
      });

      // Check for rate changes
      const rateChanges = detectRateChanges(currentCase, input);

      // Update case
      const updatedCase = await context.prisma.case.update({
        where: { id },
        data: input,
        include: { client: true, teamMembers: true },
      });

      // Record rate history if rates changed
      if (rateChanges.length > 0) {
        await recordRateChanges(context, id, rateChanges, user.id);
      }

      return updatedCase;
    },
  },

  Case: {
    rateHistory: async (parent, _, context: Context) => {
      // Only Partners can view rate history (directive enforces this)
      return context.prisma.caseRateHistory.findMany({
        where: { caseId: parent.id },
        orderBy: { changedAt: 'desc' },
        include: { changedBy: true },
      });
    },
  },
};

// Helper function to detect rate changes
function detectRateChanges(currentCase, input) {
  const changes = [];

  if (input.customRates) {
    const current = currentCase.customRates || {};
    const updated = input.customRates;

    if (current.partnerRate !== updated.partnerRate) {
      changes.push({
        rateType: 'partner',
        oldRate: current.partnerRate,
        newRate: updated.partnerRate,
      });
    }
    // Similar for associateRate, paralegalRate
  }

  if (input.fixedAmount && currentCase.fixedAmount !== input.fixedAmount) {
    changes.push({
      rateType: 'fixed',
      oldRate: currentCase.fixedAmount,
      newRate: input.fixedAmount,
    });
  }

  return changes;
}

// Helper function to record rate changes
async function recordRateChanges(context, caseId, changes, userId) {
  const entries = changes.map((change) => ({
    caseId,
    changedBy: userId,
    changedAt: new Date(),
    rateType: change.rateType,
    oldRate: change.oldRate,
    newRate: change.newRate,
    firmId: context.user.firmId,
  }));

  await context.prisma.caseRateHistory.createMany({ data: entries });
}
```

#### 4. Frontend: Partner Settings Page

**File:** `apps/web/src/app/settings/billing/page.tsx`

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUpdateDefaultRates } from '@/hooks/useDefaultRates';
import { FinancialData } from '@/components/auth/FinancialData';

const defaultRatesSchema = z.object({
  partnerRate: z.number().positive('Must be positive'),
  associateRate: z.number().positive('Must be positive'),
  paralegalRate: z.number().positive('Must be positive'),
});

export default function BillingSettingsPage() {
  const { data: currentRates, isLoading } = useDefaultRates();
  const { mutate: updateRates, isPending } = useUpdateDefaultRates();

  const form = useForm({
    resolver: zodResolver(defaultRatesSchema),
    defaultValues: currentRates,
  });

  const onSubmit = (data) => {
    updateRates(data, {
      onSuccess: () => {
        toast.success('Default rates updated');
      },
      onError: (error) => {
        toast.error('Failed to update rates');
      },
    });
  };

  return (
    <FinancialData>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Default Billing Rates</h1>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Partner Hourly Rate</label>
            <input
              type="number"
              step="0.01"
              {...form.register('partnerRate', { valueAsNumber: true })}
              className="w-full px-3 py-2 border rounded-md"
            />
            {form.formState.errors.partnerRate && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.partnerRate.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Associate Hourly Rate</label>
            <input
              type="number"
              step="0.01"
              {...form.register('associateRate', { valueAsNumber: true })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Paralegal Hourly Rate</label>
            <input
              type="number"
              step="0.01"
              {...form.register('paralegalRate', { valueAsNumber: true })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </FinancialData>
  );
}
```

#### 5. KPI Calculation Service

**File:** `services/gateway/src/services/kpiService.ts`

```typescript
export class KPIService {
  constructor(private prisma: PrismaClient) {}

  async calculateCaseRevenueKPI(caseId: string): Promise<RevenueComparison> {
    const caseData = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        timeEntries: {
          include: { user: true },
        },
      },
    });

    if (!caseData) {
      throw new Error('Case not found');
    }

    // Calculate actual revenue
    const actualRevenue =
      caseData.billingType === 'FIXED'
        ? caseData.fixedAmount
        : this.calculateHourlyRevenue(caseData.timeEntries, caseData.customRates);

    // Calculate projected hourly revenue
    const projectedRevenue = this.calculateHourlyRevenue(
      caseData.timeEntries,
      caseData.customRates
    );

    // Calculate variance
    const variance = actualRevenue - projectedRevenue;
    const variancePercent = (variance / projectedRevenue) * 100;

    return {
      caseId,
      billingType: caseData.billingType,
      actualRevenue,
      projectedRevenue,
      variance,
      variancePercent,
    };
  }

  private calculateHourlyRevenue(timeEntries: TimeEntry[], rates: CustomRates): number {
    return timeEntries.reduce((total, entry) => {
      const userRole = entry.user.role.toLowerCase();
      const rate = rates[`${userRole}Rate`] || 0;
      return total + entry.hours * rate;
    }, 0);
  }

  async getFirmRevenueKPIs(
    firmId: string,
    dateRange?: { startDate: Date; endDate: Date }
  ): Promise<RevenueComparison[]> {
    const cases = await this.prisma.case.findMany({
      where: {
        firmId,
        openedDate: dateRange
          ? {
              gte: dateRange.startDate,
              lte: dateRange.endDate,
            }
          : undefined,
      },
    });

    return Promise.all(cases.map((c) => this.calculateCaseRevenueKPI(c.id)));
  }
}
```

---

## Story 2.8.2: Approval Workflow

### Quick Start Checklist

- [ ] Add `PendingApproval` status to Case enum
- [ ] Create CaseApproval table
- [ ] Create approval mutations (approve, reject, resubmit)
- [ ] Create pending cases queue UI for Partners
- [ ] Create "My Cases" view for Associates
- [ ] Implement notification system

### Step-by-Step Implementation

#### 1. Database Schema

**Migration File:** `packages/database/migrations/add-case-approval-workflow.ts`

```typescript
export async function up(knex: Knex): Promise<void> {
  // Add PendingApproval to case status enum
  await knex.raw(`
    ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'PendingApproval'
  `);

  // Create CaseApproval table
  await knex.schema.createTable('case_approvals', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('case_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('cases')
      .onDelete('CASCADE');
    table.uuid('submitted_by').notNullable().references('id').inTable('users');
    table.timestamp('submitted_at').defaultTo(knex.fn.now());
    table.uuid('reviewed_by').nullable().references('id').inTable('users');
    table.timestamp('reviewed_at').nullable();
    table.enum('status', ['Pending', 'Approved', 'Rejected']).defaultTo('Pending');
    table.text('rejection_reason').nullable();
    table.integer('revision_count').defaultTo(0);
    table.uuid('firm_id').notNullable().references('id').inTable('firms');

    table.index(['firm_id', 'status']);
    table.index('submitted_by');
  });
}
```

#### 2. GraphQL Schema

**File:** `services/gateway/src/graphql/schema/approval.graphql`

```graphql
enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

type CaseApproval {
  id: UUID!
  caseId: UUID!
  case: Case!
  submittedBy: User!
  submittedAt: DateTime!
  reviewedBy: User
  reviewedAt: DateTime
  status: ApprovalStatus!
  rejectionReason: String
  revisionCount: Int!
}

type Case {
  # Existing fields...
  approval: CaseApproval
}

extend type Query {
  pendingCases: [Case!]!
  myCases(status: CaseStatus): [Case!]!
}

extend type Mutation {
  approveCase(caseId: UUID!): Case!
  rejectCase(input: RejectCaseInput!): Case!
  resubmitCase(caseId: UUID!): Case!
}

input RejectCaseInput {
  caseId: UUID!
  reason: String!
}
```

#### 3. Case Creation with Approval Logic

**File:** `services/gateway/src/graphql/resolvers/caseResolvers.ts`

```typescript
createCase: async (_, { input }, context: Context) => {
  const { user } = context;

  // Determine initial status based on user role
  const initialStatus = user.role === 'Partner'
    ? 'Active'  // Partners create active cases directly
    : 'PendingApproval';  // Associates need approval

  const newCase = await context.prisma.case.create({
    data: {
      ...input,
      status: initialStatus,
      firmId: user.firmId,
    },
  });

  // If Associate, create approval record and notify Partners
  if (user.role === 'Associate') {
    await context.prisma.caseApproval.create({
      data: {
        caseId: newCase.id,
        submittedBy: user.id,
        status: 'Pending',
        firmId: user.firmId,
      },
    });

    // Notify all Partners
    await context.notificationService.notifyPartners(user.firmId, {
      type: 'CasePendingApproval',
      title: 'New Case Needs Approval',
      message: `${user.firstName} ${user.lastName} submitted case "${newCase.title}"`,
      link: `/cases/${newCase.id}`,
    });
  }

  return newCase;
},
```

#### 4. Approval Resolvers

**File:** `services/gateway/src/graphql/resolvers/approvalResolvers.ts`

```typescript
export const approvalResolvers = {
  Query: {
    pendingCases: async (_, __, context: Context) => {
      const { user } = context;

      // Only Partners can view pending cases
      if (user.role !== 'Partner') {
        throw new GraphQLError('Only Partners can view pending cases', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.prisma.case.findMany({
        where: {
          firmId: user.firmId,
          status: 'PendingApproval',
        },
        include: {
          approval: true,
          submittedBy: true,
          client: true,
        },
        orderBy: { createdAt: 'asc' }, // FIFO
      });
    },

    myCases: async (_, { status }, context: Context) => {
      const { user } = context;

      // Associates see their submitted cases
      if (user.role === 'Associate') {
        return context.prisma.case.findMany({
          where: {
            firmId: user.firmId,
            approval: {
              submittedBy: user.id,
            },
            ...(status && { status }),
          },
          include: {
            approval: true,
            client: true,
          },
        });
      }

      // Partners see all firm cases
      return context.prisma.case.findMany({
        where: {
          firmId: user.firmId,
          ...(status && { status }),
        },
      });
    },
  },

  Mutation: {
    approveCase: async (_, { caseId }, context: Context) => {
      const { user } = context;

      // Only Partners can approve
      if (user.role !== 'Partner') {
        throw new GraphQLError('Only Partners can approve cases', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Update case status
      const updatedCase = await context.prisma.case.update({
        where: { id: caseId },
        data: { status: 'Active' },
        include: { approval: true },
      });

      // Update approval record
      await context.prisma.caseApproval.update({
        where: { caseId },
        data: {
          status: 'Approved',
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      // Notify submitter
      await context.notificationService.notify(updatedCase.approval.submittedBy, {
        type: 'CaseApproved',
        title: 'Case Approved',
        message: `Your case "${updatedCase.title}" has been approved`,
        link: `/cases/${updatedCase.id}`,
      });

      return updatedCase;
    },

    rejectCase: async (_, { input }, context: Context) => {
      const { user } = context;
      const { caseId, reason } = input;

      // Only Partners can reject
      if (user.role !== 'Partner') {
        throw new GraphQLError('Only Partners can reject cases', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Validate reason
      if (reason.length < 10) {
        throw new GraphQLError('Rejection reason must be at least 10 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const updatedCase = await context.prisma.case.findUnique({
        where: { id: caseId },
        include: { approval: true },
      });

      // Update approval record
      await context.prisma.caseApproval.update({
        where: { caseId },
        data: {
          status: 'Rejected',
          reviewedBy: user.id,
          reviewedAt: new Date(),
          rejectionReason: reason,
        },
      });

      // Notify submitter
      await context.notificationService.notify(updatedCase.approval.submittedBy, {
        type: 'CaseRejected',
        title: 'Case Rejected',
        message: `Your case "${updatedCase.title}" was rejected. Reason: ${reason}`,
        link: `/cases/${updatedCase.id}`,
      });

      return updatedCase;
    },

    resubmitCase: async (_, { caseId }, context: Context) => {
      const { user } = context;

      const approval = await context.prisma.caseApproval.findUnique({
        where: { caseId },
      });

      // Only original submitter can resubmit
      if (approval.submittedBy !== user.id) {
        throw new GraphQLError('Only the original submitter can resubmit', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Must be in Rejected status
      if (approval.status !== 'Rejected') {
        throw new GraphQLError('Can only resubmit rejected cases', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Update approval record
      await context.prisma.caseApproval.update({
        where: { caseId },
        data: {
          status: 'Pending',
          reviewedBy: null,
          reviewedAt: null,
          rejectionReason: null,
          revisionCount: { increment: 1 },
        },
      });

      // Notify Partners
      await context.notificationService.notifyPartners(user.firmId, {
        type: 'CaseResubmitted',
        title: 'Case Resubmitted for Review',
        message: `${user.firstName} resubmitted case (Revision #${approval.revisionCount + 1})`,
        link: `/cases/${caseId}`,
      });

      return context.prisma.case.findUnique({ where: { id: caseId } });
    },
  },
};
```

#### 5. Frontend: Pending Approvals Queue

**File:** `apps/web/src/app/cases/pending-approvals/page.tsx`

```tsx
'use client';

import { usePendingCases } from '@/hooks/usePendingCases';
import { ReviewCaseModal } from '@/components/case/ReviewCaseModal';
import { useState } from 'react';

export default function PendingApprovalsPage() {
  const { data: pendingCases, isLoading } = usePendingCases();
  const [selectedCase, setSelectedCase] = useState(null);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Pending Case Approvals ({pendingCases.length})</h1>

      {pendingCases.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No cases pending approval</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingCases.map((caseData) => (
            <div key={caseData.id} className="border rounded-lg p-4 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{caseData.title}</h3>
                  <p className="text-sm text-gray-600">Client: {caseData.client.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Submitted by {caseData.approval.submittedBy.firstName}{' '}
                    {caseData.approval.submittedBy.lastName} on{' '}
                    {new Date(caseData.approval.submittedAt).toLocaleDateString()}
                  </p>
                  {caseData.approval.revisionCount > 0 && (
                    <span className="inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded mt-2">
                      Revision #{caseData.approval.revisionCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedCase(caseData)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCase && (
        <ReviewCaseModal case={selectedCase} onClose={() => setSelectedCase(null)} />
      )}
    </div>
  );
}
```

---

## Story 2.8.4: Document Linking

### Quick Start Checklist

- [ ] Redesign Document model (Client ownership)
- [ ] Create CaseDocument join table
- [ ] Create data migration script
- [ ] Update GraphQL schema for documents
- [ ] Create document browser modal
- [ ] Implement link/unlink mutations
- [ ] Migrate file storage structure

### Key Implementation Points

**Most Complex Story - Requires Careful Planning**

1. **Data Migration is Critical**
   - Test thoroughly on staging with production data copy
   - Run in batches to avoid timeouts
   - Have rollback plan ready
   - Monitor closely during migration

2. **Storage Reorganization**
   - Old path: `/firm/case/document`
   - New path: `/firm/client/document`
   - Maintain backward compatibility during transition
   - Verify file accessibility after migration

3. **Many-to-Many Relationship**
   - Document can be linked to multiple cases
   - CaseDocument join table tracks all relationships
   - Unlink removes from one case, not all cases
   - Permanent delete requires confirmation showing affected case count

---

## Key Technical Patterns

### Pattern 1: GraphQL Directive for Authorization

**Use Case:** Protecting financial data, approval actions, etc.

```typescript
// Define once, apply everywhere
directive @requiresFinancialAccess on FIELD_DEFINITION
directive @requiresRole(role: UserRole!) on FIELD_DEFINITION

type Case {
  value: Float @requiresFinancialAccess

  # Can combine directives
  billingType: BillingType @requiresFinancialAccess @requiresRole(role: PARTNER)
}
```

### Pattern 2: React Context for Authorization

**Use Case:** Conditional UI rendering based on role

```typescript
// Single source of truth for user permissions
const { hasFinancialAccess } = useFinancialAccess();
const { isPartner, isAssociate } = useRole();

// Use throughout component tree
if (!hasFinancialAccess) return null;
```

### Pattern 3: Wrapper Components for Conditional Rendering

**Use Case:** Cleanly hide/show components based on permissions

```tsx
<FinancialData>
  <BillingSection />
</FinancialData>;

// Instead of:
{
  hasFinancialAccess && <BillingSection />;
}
```

### Pattern 4: Audit Logging Helper

**Use Case:** Consistent audit logging across all mutations

```typescript
// Create helper service
class AuditLogService {
  async log(action: string, context: Context, metadata: object) {
    await context.prisma.auditLog.create({
      data: {
        action,
        userId: context.user.id,
        firmId: context.user.firmId,
        timestamp: new Date(),
        metadata,
      },
    });
  }
}

// Use in resolvers
await context.auditLog.log('CaseApproved', context, { caseId });
```

### Pattern 5: Rate History Tracking

**Use Case:** Track changes to financial rates over time

```typescript
// Before update
const oldRates = currentCase.customRates;

// After update
const newRates = updatedCase.customRates;

// Detect and record changes
if (oldRates.partnerRate !== newRates.partnerRate) {
  await recordRateChange(caseId, 'partner', oldRates.partnerRate, newRates.partnerRate);
}
```

---

## Common Pitfalls

### Pitfall 1: Forgetting Firm Isolation

**Problem:** Users can access data from other firms

**Solution:** Always filter by `firmId` from authenticated user context

```typescript
// ❌ BAD - No firm isolation
const cases = await prisma.case.findMany({
  where: { status: 'Active' },
});

// ✅ GOOD - Firm isolated
const cases = await prisma.case.findMany({
  where: {
    firmId: context.user.firmId, // ALWAYS include this
    status: 'Active',
  },
});
```

### Pitfall 2: Trusting Client-Side Authorization

**Problem:** Security bypass if relying only on frontend checks

**Solution:** Always enforce authorization on backend

```typescript
// ❌ BAD - Only frontend check
<button onClick={deleteCase}>Delete</button>

// ✅ GOOD - Backend enforces authorization
// Frontend: Hide button from UI
{isPartner && <button onClick={deleteCase}>Delete</button>}

// Backend: Validate role
if (context.user.role !== 'Partner') {
  throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });
}
```

### Pitfall 3: Not Handling Null Financial Fields

**Problem:** Frontend crashes when financial fields return null for non-Partners

**Solution:** Always check for null before using financial data

```typescript
// ❌ BAD - Will crash for Associates
<div>{formatCurrency(case.value)}</div>

// ✅ GOOD - Handle null gracefully
<div>{case.value ? formatCurrency(case.value) : 'N/A'}</div>

// ✅ BETTER - Use FinancialData wrapper
<FinancialData>
  <div>{formatCurrency(case.value)}</div>
</FinancialData>
```

### Pitfall 4: Forgetting to Invalidate React Query Cache

**Problem:** UI shows stale data after mutations

**Solution:** Always invalidate relevant queries after mutations

```typescript
const { mutate: approveCase } = useMutation({
  mutationFn: (caseId) => approveCaseMutation(caseId),
  onSuccess: () => {
    // Invalidate pending cases list
    queryClient.invalidateQueries({ queryKey: ['pendingCases'] });
    // Invalidate specific case
    queryClient.invalidateQueries({ queryKey: ['case', caseId] });
  },
});
```

### Pitfall 5: Not Testing Data Migrations

**Problem:** Data loss or corruption during migration

**Solution:** Always test migrations on copy of production data

```bash
# 1. Create copy of production database
pg_dump production_db > backup.sql
createdb staging_db
psql staging_db < backup.sql

# 2. Run migration on staging
npm run migrate:up

# 3. Validate data integrity
npm run validate:migration

# 4. Test application against staging
npm run test:integration -- --db=staging

# 5. If successful, run on production
# If failed, rollback and fix
npm run migrate:down
```

---

## Testing Strategy

### Unit Tests (70% of testing effort)

**Backend:**

```typescript
describe('Financial Access Directive', () => {
  it('returns null for non-Partners', async () => {
    const context = { user: { role: 'Associate' } };
    const result = await resolveField(context);
    expect(result).toBeNull();
  });

  it('returns data for Partners', async () => {
    const context = { user: { role: 'Partner' } };
    const result = await resolveField(context);
    expect(result).toBeDefined();
  });
});
```

**Frontend:**

```typescript
describe('FinancialData Component', () => {
  it('hides children for non-Partners', () => {
    render(
      <MockAuthProvider role="Associate">
        <FinancialData>Secret Data</FinancialData>
      </MockAuthProvider>
    );
    expect(screen.queryByText('Secret Data')).not.toBeInTheDocument();
  });
});
```

### Integration Tests (20% of testing effort)

```typescript
describe('Case Approval Workflow', () => {
  it('complete flow: submit → reject → revise → approve', async () => {
    // Associate creates case
    const { caseId } = await createCase({ role: 'Associate' });
    expect(await getCaseStatus(caseId)).toBe('PendingApproval');

    // Partner rejects
    await rejectCase(caseId, { role: 'Partner' }, 'Needs more detail');
    expect(await getApprovalStatus(caseId)).toBe('Rejected');

    // Associate revises
    await updateCase(caseId, { role: 'Associate' }, { description: 'Updated' });
    await resubmitCase(caseId, { role: 'Associate' });

    // Partner approves
    await approveCase(caseId, { role: 'Partner' });
    expect(await getCaseStatus(caseId)).toBe('Active');
  });
});
```

### E2E Tests (10% of testing effort)

```typescript
test('Partner reviews and approves case', async ({ page }) => {
  // Login as Partner
  await page.goto('/login');
  await login(page, 'partner@example.com', 'password');

  // Navigate to pending approvals
  await page.click('text=Pending Approvals');
  expect(page.url()).toContain('/pending-approvals');

  // Review first case
  await page.click('button:has-text("Review")');
  await page.waitForSelector('[data-testid="review-modal"]');

  // Approve case
  await page.click('button:has-text("Approve Case")');
  await page.waitForSelector('text=Case approved successfully');

  // Verify case removed from queue
  await page.reload();
  expect(await page.locator('[data-testid="case-card"]').count()).toBe(0);
});
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All unit tests passing (>70% coverage)
- [ ] Integration tests passing
- [ ] E2E tests passing on staging
- [ ] Code review completed and approved
- [ ] Database migrations tested on staging
- [ ] Performance testing completed
- [ ] Security audit completed
- [ ] Documentation updated

### Deployment Steps

**Story 2.8.3 (Financial Visibility):**

1. [ ] Deploy backend with GraphQL directive
2. [ ] Verify directive works in production GraphQL Playground
3. [ ] Deploy frontend with FinancialData component
4. [ ] Test with all user roles (Partner, Associate, Paralegal)
5. [ ] Monitor logs for unauthorized access attempts

**Story 2.8.1 (Billing & Rates):**

1. [ ] Run database migration (add billing fields)
2. [ ] Deploy backend with new resolvers
3. [ ] Deploy frontend with billing UI
4. [ ] Verify existing cases still accessible
5. [ ] Test creating new cases with billing types

**Story 2.8.2 (Approval Workflow):**

1. [ ] Run database migration (add approval tables)
2. [ ] Deploy backend with approval resolvers
3. [ ] Deploy notification service updates
4. [ ] Deploy frontend with approval UI
5. [ ] Test full approval workflow
6. [ ] Verify notifications sent correctly

**Story 2.8.4 (Document Linking):**

1. [ ] Run database migration (add CaseDocument table)
2. [ ] Run data migration (populate client IDs, create links)
3. [ ] Deploy backend with new document resolvers
4. [ ] Run storage migration (move files to client-based paths)
5. [ ] Deploy frontend with document browser
6. [ ] Verify all documents accessible
7. [ ] Test document linking across cases
8. [ ] Clean up old file paths after verification

### Post-Deployment

- [ ] Monitor error logs for 24 hours
- [ ] Verify key metrics (page load times, API response times)
- [ ] Collect user feedback
- [ ] Monitor database performance (query times)
- [ ] Monitor storage usage (after document migration)
- [ ] Schedule retrospective meeting

### Rollback Plan

**If critical issues arise:**

1. **Story 2.8.3:** Disable directive, remove FinancialData wrappers (show all data)
2. **Story 2.8.1:** Rollback migration, redeploy previous version
3. **Story 2.8.2:** Set all PendingApproval cases to Active, disable approval flow
4. **Story 2.8.4:** Revert to case-based file paths, use old document model

---

## Support and Troubleshooting

### Common Issues

**Issue: "Financial data not showing for Partners"**

- Check: User role is correctly set in database
- Check: FinancialAccessContext receiving correct user data
- Check: GraphQL context includes user with correct role

**Issue: "Associate can see financial data"**

- Check: GraphQL directive applied to all financial fields
- Check: Directive logic correctly checking role === 'Partner'
- Check: Frontend using `<FinancialData>` wrapper correctly

**Issue: "Case approval notifications not sent"**

- Check: Notification service configured correctly
- Check: User has notification preferences enabled
- Check: Email service (if using email notifications) is working

**Issue: "Document browser not showing documents"**

- Check: Client ID correctly set on documents
- Check: Case-Document links created in join table
- Check: User has access to client (firm isolation)

### Getting Help

- **Architecture Questions:** Review `docs/architecture/` directory
- **API Reference:** Check `docs/api/` directory
- **Bug Reports:** Create issue in project repository
- **Code Review:** Request review from tech lead

---

## Conclusion

This implementation guide provides a comprehensive roadmap for implementing Stories 2.8.1 - 2.8.4. Follow the recommended order, use the provided code examples as starting points, avoid common pitfalls, and test thoroughly at each stage.

**Estimated Timeline:**

- **Sprint 1-2 (Weeks 1-4):** Financial Visibility + Billing & Rates
- **Sprint 3-4 (Weeks 5-8):** Approval Workflow + Document Linking (parallel)
- **Sprint 5 (Weeks 9-10):** Integration testing, bug fixes, polish

**Success Criteria:**

- All acceptance criteria met for each story
- 70%+ test coverage
- No critical bugs in production
- User acceptance testing passed
- Documentation complete

Good luck with implementation! 🚀
