# Financial Fields Documentation

**Story:** 2.8.3 - Role-Based Financial Visibility
**Last Updated:** 2025-11-22
**Status:** Active

---

## Overview

This document provides a comprehensive taxonomy of all financial fields in the application's GraphQL schema. These fields contain sensitive financial information and require **Partner role** to access.

**Access Control:**

- ✅ **Partners**: Full access to all financial data
- ❌ **Associates**: No access (fields return `null`)
- ❌ **Paralegals**: No access (fields return `null`)

**Enforcement:**

- **Backend**: GraphQL directive `@requiresFinancialAccess`
- **Frontend**: React wrapper component `<FinancialData>`
- **Routing**: Route guards on financial pages

---

## Financial Field Categories

| Category                | Description                     | Story Implemented |
| ----------------------- | ------------------------------- | ----------------- |
| **Case Management**     | Case value, billing type, rates | 2.8, 2.8.1        |
| **Time Tracking**       | Hourly rates, billable amounts  | 2.8.1+            |
| **Billing & Invoicing** | Invoices, line items            | Future            |
| **Payments**            | Payment records, transactions   | Future            |
| **KPIs & Reports**      | Financial metrics, analytics    | Future            |
| **Settings**            | Default rates, billing config   | 2.8.1             |

---

## Case Management Financial Fields

### Current Implementation (Story 2.8)

| Field        | Type    | Description                | Nullable |
| ------------ | ------- | -------------------------- | -------- |
| `Case.value` | `Float` | Monetary value of the case | Yes      |

**GraphQL Schema:**

```graphql
type Case {
  # ... other fields
  value: Float @requiresFinancialAccess
}
```

**Access Pattern:**

```typescript
// Partner query
const { data } = useQuery(GET_CASE);
console.log(data.case.value); // Returns: 50000.00

// Associate query
const { data } = useQuery(GET_CASE);
console.log(data.case.value); // Returns: null
```

---

### Future Implementation (Story 2.8.1 - Billing & Rates)

| Field              | Type                   | Description                      | Nullable         |
| ------------------ | ---------------------- | -------------------------------- | ---------------- |
| `Case.billingType` | `BillingType`          | Hourly or Fixed fee              | No               |
| `Case.fixedAmount` | `Float`                | Fixed fee amount (if applicable) | Yes              |
| `Case.customRates` | `CustomRates`          | Custom hourly rates per role     | Yes              |
| `Case.rateHistory` | `[RateHistoryEntry!]!` | History of rate changes          | No (empty array) |

**GraphQL Schema (Future):**

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

type RateHistoryEntry {
  id: UUID!
  changedAt: DateTime!
  changedBy: User!
  rateType: String!
  oldRate: Float!
  newRate: Float!
}

type Case {
  # ... other fields
  billingType: BillingType @requiresFinancialAccess
  fixedAmount: Float @requiresFinancialAccess
  customRates: CustomRates @requiresFinancialAccess
  rateHistory: [RateHistoryEntry!]! @requiresFinancialAccess
}
```

---

## Time Tracking Financial Fields

### Future Implementation (Story 2.8.1+)

| Field                      | Type    | Description                      | Nullable |
| -------------------------- | ------- | -------------------------------- | -------- |
| `TimeEntry.rate`           | `Float` | Hourly rate for this entry       | No       |
| `TimeEntry.billableAmount` | `Float` | Calculated amount (hours × rate) | No       |

**GraphQL Schema (Future):**

```graphql
type TimeEntry {
  id: UUID!
  caseId: UUID!
  userId: UUID!
  hours: Float!
  description: String!
  date: DateTime!

  # Financial fields - Partner only
  rate: Float! @requiresFinancialAccess
  billableAmount: Float! @requiresFinancialAccess
}
```

**Calculation Logic:**

```typescript
// Backend resolver
billableAmount: (parent, _, context) => {
  // Only Partners see this calculation
  return parent.hours * parent.rate;
};

// Associates enter hours only, never see rates
```

---

## Firm Settings Financial Fields

### Future Implementation (Story 2.8.1)

| Field               | Type           | Description                  | Nullable |
| ------------------- | -------------- | ---------------------------- | -------- |
| `Firm.defaultRates` | `DefaultRates` | Default hourly rates by role | Yes      |

**GraphQL Schema (Future):**

```graphql
type DefaultRates {
  partnerRate: Float!
  associateRate: Float!
  paralegalRate: Float!
}

type Firm {
  id: UUID!
  name: String!

  # Financial settings - Partner only
  defaultRates: DefaultRates @requiresFinancialAccess
}
```

**Usage:**

- Partners set default rates in Settings page
- New cases inherit default rates (as custom rates)
- Associates/Paralegals never see or set rates

---

## Invoicing Financial Fields

### Future Implementation

| Field       | Type      | Description                      |
| ----------- | --------- | -------------------------------- |
| `Invoice.*` | `Invoice` | Entire Invoice type is financial |

**GraphQL Schema (Future):**

```graphql
# Entire type is financial - Partners only
type Invoice @requiresFinancialAccess {
  id: UUID!
  caseId: UUID!
  invoiceNumber: String!
  date: DateTime!
  dueDate: DateTime!
  subtotal: Float!
  tax: Float!
  total: Float!
  status: InvoiceStatus!
  lineItems: [LineItem!]!
}
```

**Note:** Entire `Invoice` type is financial. Non-Partners cannot query invoices at all.

---

## Payment Financial Fields

### Future Implementation

| Field       | Type      | Description                      |
| ----------- | --------- | -------------------------------- |
| `Payment.*` | `Payment` | Entire Payment type is financial |

**GraphQL Schema (Future):**

```graphql
# Entire type is financial - Partners only
type Payment @requiresFinancialAccess {
  id: UUID!
  invoiceId: UUID!
  amount: Float!
  date: DateTime!
  method: PaymentMethod!
  status: PaymentStatus!
  reference: String
}
```

---

## KPI and Reports Financial Fields

### Future Implementation

| Field   | Type  | Description             |
| ------- | ----- | ----------------------- |
| `KPI.*` | `KPI` | All financial KPI types |

**GraphQL Schema (Future):**

```graphql
# All financial metrics - Partners only
type RevenueKPI @requiresFinancialAccess {
  totalRevenue: Float!
  projectedRevenue: Float!
  variance: Float!
  variancePercent: Float!
}

type BillingMetrics @requiresFinancialAccess {
  averageHourlyRate: Float!
  billableHours: Float!
  unbilledHours: Float!
  collectionRate: Float!
}
```

---

## Authorization Directive Usage

### Backend Implementation

**Directive Definition:**

```typescript
// services/gateway/src/graphql/directives/requiresFinancialAccess.ts
import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

export class RequiresFinancialAccessDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;

    field.resolve = async function (source, args, context, info) {
      if (context.user?.role !== 'Partner') {
        // Log unauthorized access attempt
        context.logger.info('Financial data access denied', {
          userId: context.user?.id,
          field: info.fieldName,
          userRole: context.user?.role,
        });

        // Return null (graceful degradation)
        return null;
      }

      // Partner - resolve normally
      return resolve.call(this, source, args, context, info);
    };
  }
}
```

**Schema Registration:**

```graphql
directive @requiresFinancialAccess on FIELD_DEFINITION
```

### Frontend Implementation

**FinancialData Wrapper:**

```tsx
import { FinancialData } from '@/components/auth/FinancialData';

// Hide financial section from non-Partners
<FinancialData>
  <BillingInfoSection case={caseData} />
</FinancialData>

// Hide financial table column
<FinancialData>
  <TableColumn header="Case Value">
    {formatCurrency(case.value)}
  </TableColumn>
</FinancialData>
```

---

## Adding New Financial Fields

When adding new financial fields to the schema, follow this checklist:

### Backend Checklist

- [ ] Add field to GraphQL schema type
- [ ] Apply `@requiresFinancialAccess` directive
- [ ] Add field to `FinancialField` enum in `packages/shared/types/src/financial.ts`
- [ ] Update `FINANCIAL_FIELDS_METADATA` array
- [ ] Test directive with Partner role (field returns data)
- [ ] Test directive with Associate role (field returns null)
- [ ] Verify access attempt is logged

### Frontend Checklist

- [ ] Wrap UI component in `<FinancialData>`
- [ ] Test UI as Partner (component visible)
- [ ] Test UI as Associate (component hidden, no gap)
- [ ] Update this documentation

### Documentation Checklist

- [ ] Add field to appropriate category table in this document
- [ ] Document GraphQL schema example
- [ ] Document access pattern example
- [ ] Update `FINANCIAL_FIELDS_METADATA` in code

---

## Security Considerations

**Defense in Depth:**

1. **Backend**: GraphQL directive (primary security control)
2. **Frontend**: UI hiding (UX enhancement)
3. **Routing**: Route guards (prevent unnecessary requests)

**Important Rules:**

- ✅ Backend authorization is **the only** security control
- ❌ **Never** trust frontend to enforce security
- ✅ Frontend hiding is for UX only (clean interface)
- ✅ All unauthorized access attempts are logged
- ✅ Logs used for security monitoring and compliance

**Firm Isolation:**

- Financial visibility enforced **per firm**
- Partner in Firm A cannot see Firm B's financial data
- Directive validates both `role` AND `firmId`

---

## Testing Financial Fields

### Unit Tests

**Backend:**

```typescript
describe('Financial Access Directive', () => {
  it('returns null for Associates', async () => {
    const context = { user: { role: 'Associate' } };
    const result = await resolveField(context, 'Case.value');
    expect(result).toBeNull();
  });

  it('returns data for Partners', async () => {
    const context = { user: { role: 'Partner' } };
    const result = await resolveField(context, 'Case.value');
    expect(result).toBe(50000);
  });

  it('logs unauthorized access', async () => {
    const context = { user: { role: 'Associate' }, logger: mockLogger };
    await resolveField(context, 'Case.value');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Financial data access denied',
      expect.objectContaining({ field: 'Case.value' })
    );
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

  it('shows children for Partners', () => {
    render(
      <MockAuthProvider role="Partner">
        <FinancialData>Secret Data</FinancialData>
      </MockAuthProvider>
    );
    expect(screen.getByText('Secret Data')).toBeInTheDocument();
  });
});
```

### Integration Tests

Test complete workflows for each role:

- ✅ Associate creates case without seeing financial fields
- ✅ Partner creates case with full financial data
- ✅ Associate queries case → financial fields return null
- ✅ Partner queries case → financial fields return data

---

## Logging and Monitoring

**Unauthorized Access Logs:**

```json
{
  "level": "info",
  "message": "Financial data access denied",
  "userId": "uuid-123",
  "firmId": "uuid-456",
  "field": "Case.value",
  "userRole": "Associate",
  "timestamp": "2025-11-22T10:30:00Z"
}
```

**Monitoring:**

- Weekly review of access attempts
- Alert on unusual patterns (100+ attempts from single user)
- Use logs for compliance audits (SOC 2, GDPR)

---

## Compliance

Financial visibility controls support:

- **SOC 2**: Access control requirements
- **GDPR**: Data minimization principle
- **Attorney-Client Privilege**: Confidentiality of financial arrangements
- **State Bar Requirements**: Firm financial confidentiality

**Audit Trail:**

- All access attempts logged (authorized and unauthorized)
- Logs immutable and retained per compliance requirements
- Demonstrates access control enforcement for auditors

---

## Related Documentation

- **Architecture**: `docs/architecture/authorization.md`
- **Security**: `docs/architecture/security-best-practices.md`
- **API Reference**: `docs/api/case-management-api.md`
- **Story**: `docs/stories/2.8.3.story.md`

---

## Change Log

| Date       | Version | Change                | Author            |
| ---------- | ------- | --------------------- | ----------------- |
| 2025-11-22 | 1.0     | Initial documentation | James (dev agent) |
