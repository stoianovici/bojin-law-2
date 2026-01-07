# Page Audit - Desktop Styling

> **Issue**: [OPS-340](../../../ops/issues/ops-340.md)
> **Status**: Complete
> **Audited**: 2025-12-28

## Summary

| Severity | Count | Pages                                                                                         |
| -------- | ----- | --------------------------------------------------------------------------------------------- |
| High     | 5     | /cases/new, /admin/performance, /admin/users/pending, /admin/users/active, /activitate-echipa |
| Medium   | 9     | /reports, /emails, /communications, /admin/ai-ops/_, /analytics/_ sub-pages                   |
| Low      | 5     | /403, /auth/callback, /search, /reviews/batch, /cases/my-cases                                |

**Total Pages Audited**: 28 pages with hardcoded gray classes
**Total Estimated Changes**: ~549 occurrences across all files

---

## Migration Reference

| Current (Hardcoded)   | Target (Linear Token)                                                   |
| --------------------- | ----------------------------------------------------------------------- |
| `bg-gray-50`          | `bg-linear-bg-secondary` or `bg-neutral-50 dark:bg-linear-bg-secondary` |
| `bg-gray-100`         | `bg-linear-bg-tertiary`                                                 |
| `bg-white`            | `bg-linear-bg-primary` or `bg-white dark:bg-linear-bg-primary`          |
| `text-gray-900`       | `text-linear-text-primary`                                              |
| `text-gray-700`       | `text-linear-text-secondary`                                            |
| `text-gray-600`       | `text-linear-text-secondary`                                            |
| `text-gray-500`       | `text-linear-text-tertiary`                                             |
| `text-gray-400`       | `text-linear-text-muted`                                                |
| `border-gray-200`     | `border-linear-border-subtle`                                           |
| `border-gray-300`     | `border-linear-border`                                                  |
| `bg-blue-600`         | `bg-linear-accent`                                                      |
| `hover:bg-blue-700`   | `hover:bg-linear-accent-hover`                                          |
| `focus:ring-blue-500` | `focus:ring-linear-accent`                                              |
| `text-blue-600`       | `text-linear-accent`                                                    |
| `bg-red-50`           | `bg-linear-error/10`                                                    |
| `text-red-600`        | `text-linear-error`                                                     |
| `bg-green-100`        | `bg-linear-success/10`                                                  |
| `text-green-600`      | `text-linear-success`                                                   |
| `bg-yellow-100`       | `bg-linear-warning/10`                                                  |
| `text-yellow-600`     | `text-linear-warning`                                                   |
| `shadow-sm`, `shadow` | `shadow-linear` or remove (Linear uses borders)                         |

---

## High Priority Pages

### /cases/new - New Case Form

**File**: `apps/web/src/app/cases/new/page.tsx`
**Severity**: High (frequently used, main workflow)
**Complexity**: Complex (725 lines, local Card component)
**Total Occurrences**: 45

| Line    | Current                                                          | Target                                                                          |
| ------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 64      | `bg-white rounded-lg border border-gray-200 shadow-sm`           | `bg-linear-bg-primary rounded-lg border border-linear-border-subtle`            |
| 65      | `border-b border-gray-200`                                       | `border-b border-linear-border-subtle`                                          |
| 66      | `text-gray-900`                                                  | `text-linear-text-primary`                                                      |
| 92      | `text-gray-900`, `border-gray-300`, `focus:ring-blue-500`        | Use Linear tokens                                                               |
| 94-96   | Error states with `border-red-300`, `focus:ring-red-500`         | `border-linear-error`, `focus:ring-linear-error`                                |
| 96      | `bg-gray-50 cursor-not-allowed`                                  | `bg-linear-bg-secondary cursor-not-allowed`                                     |
| 100     | `border-b border-gray-200`                                       | `border-b border-linear-border-subtle`                                          |
| 101     | `text-gray-500`                                                  | `text-linear-text-tertiary`                                                     |
| 103     | `text-red-500`                                                   | `text-linear-error`                                                             |
| 140     | `text-red-600`                                                   | `text-linear-error`                                                             |
| 211     | `border border-gray-200 rounded-lg bg-gray-50`                   | `border border-linear-border-subtle rounded-lg bg-linear-bg-secondary`          |
| 217     | `border-gray-300`, `focus:ring-blue-500`, `bg-white`             | Linear tokens                                                                   |
| 226-233 | Button with `text-blue-600 border-blue-300 hover:bg-blue-50`     | `text-linear-accent border-linear-accent-muted hover:bg-linear-accent-muted/10` |
| 239     | `text-red-500 hover:text-red-700 hover:bg-red-50`                | `text-linear-error hover:bg-linear-error/10`                                    |
| 249     | `bg-white border-gray-200`                                       | `bg-linear-bg-primary border-linear-border-subtle`                              |
| 252     | `text-gray-700`                                                  | `text-linear-text-secondary`                                                    |
| 257     | `text-gray-300`, `focus:ring-blue-500`                           | Linear tokens                                                                   |
| 269     | `bg-gray-100`                                                    | `bg-linear-bg-tertiary`                                                         |
| 282     | `text-gray-600`                                                  | `text-linear-text-secondary`                                                    |
| 290-291 | `text-white bg-blue-600 hover:bg-blue-700`                       | `text-white bg-linear-accent hover:bg-linear-accent-hover`                      |
| 318     | `text-gray-500`                                                  | `text-linear-text-tertiary`                                                     |
| 326-357 | Multiple input fields with `border-gray-300 focus:ring-blue-500` | Linear tokens                                                                   |
| 380     | `text-gray-500`                                                  | `text-linear-text-tertiary`                                                     |
| 384     | `border-gray-300 focus:ring-blue-500 bg-white`                   | Linear tokens                                                                   |
| 408-442 | Input fields                                                     | Linear tokens                                                                   |
| 486     | `text-gray-500`                                                  | `text-linear-text-tertiary`                                                     |
| 554     | `bg-gray-50`                                                     | `bg-linear-bg-secondary`                                                        |
| 556     | `bg-white border-b border-gray-200`                              | `bg-linear-bg-primary border-b border-linear-border-subtle`                     |
| 560-561 | `text-gray-500 hover:text-gray-700 hover:bg-gray-100`            | Linear tokens                                                                   |
| 567     | `bg-blue-100`, `text-blue-600`                                   | `bg-linear-accent-muted`, `text-linear-accent`                                  |
| 571     | `text-gray-900`                                                  | `text-linear-text-primary`                                                      |
| 574     | `text-gray-500`                                                  | `text-linear-text-tertiary`                                                     |
| 617-618 | `text-gray-500`, `border-gray-200`                               | Linear tokens                                                                   |
| 656-662 | Button with `text-blue-600 hover:text-blue-700 hover:bg-blue-50` | Linear tokens                                                                   |
| 667-670 | `text-red-600 bg-red-50`                                         | `text-linear-error bg-linear-error/10`                                          |
| 687     | `text-gray-500`                                                  | `text-linear-text-tertiary`                                                     |

**Notes**: This page has a local `Card` component that should ideally be replaced with the shared `@/components/linear/Card` component.

---

### /admin/performance - Performance Dashboard

**File**: `apps/web/src/app/admin/performance/page.tsx`
**Severity**: High (admin dashboard, complex)
**Complexity**: Complex (931 lines, many components)
**Total Occurrences**: 76

| Line    | Current                                                                                                    | Target                                                               |
| ------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 171-183 | StatusBadge with `bg-green-100 text-green-800`, `bg-yellow-100 text-yellow-800`, `bg-red-100 text-red-800` | Linear semantic colors                                               |
| 187-199 | SeverityBadge similar issues                                                                               | Linear semantic colors                                               |
| 216-219 | KPICard with `border-l-green-500`, `border-l-yellow-500`, `border-l-red-500`                               | Linear colors                                                        |
| 223     | `bg-white rounded-lg shadow`                                                                               | `bg-linear-bg-primary rounded-lg border border-linear-border-subtle` |
| 225     | `text-gray-500`                                                                                            | `text-linear-text-tertiary`                                          |
| 226     | `text-gray-900`                                                                                            | `text-linear-text-primary`                                           |
| 227     | `text-gray-400`                                                                                            | `text-linear-text-muted`                                             |
| 271-278 | Error state with `bg-red-50 border-red-200 text-red-800`                                                   | Linear error colors                                                  |
| 283     | `space-y-6` (no color issue)                                                                               | OK                                                                   |
| 287     | `text-gray-900`                                                                                            | `text-linear-text-primary`                                           |
| 289     | `text-gray-500`                                                                                            | `text-linear-text-tertiary`                                          |
| 296     | `text-gray-500`                                                                                            | `text-linear-text-tertiary`                                          |
| 302     | `text-gray-500`                                                                                            | `text-linear-text-tertiary`                                          |
| 307     | `text-sm border rounded`                                                                                   | Add Linear colors                                                    |
| 315     | `text-gray-400`                                                                                            | `text-linear-text-muted`                                             |
| 320     | `border-b border-gray-200`                                                                                 | `border-b border-linear-border-subtle`                               |
| 326-330 | Tab styling with `border-blue-500 text-blue-600`, `text-gray-500`                                          | Linear accent colors                                                 |
| 410-436 | Chart containers with `bg-white rounded-lg shadow`                                                         | Linear tokens                                                        |
| 475-524 | System resources section                                                                                   | Linear tokens                                                        |
| 532-596 | API table with `bg-white`, `divide-gray-200`, `bg-gray-50`                                                 | Linear tokens                                                        |
| 571-572 | Method badges `bg-blue-100`, `bg-green-100`                                                                | Linear semantic                                                      |
| 623-729 | AI tab with similar issues                                                                                 | Linear tokens                                                        |
| 733-835 | Database tab                                                                                               | Linear tokens                                                        |
| 837-927 | Alerts tab                                                                                                 | Linear tokens                                                        |

**Notes**: Large page with many data tables and charts. Consider creating shared table/chart wrapper components with Linear styling.

---

### /admin/users/pending - Pending Users Page

**File**: `apps/web/src/app/admin/users/pending/page.tsx`
**Severity**: High (admin workflow)
**Complexity**: Complex (457 lines)
**Total Occurrences**: 37

| Line    | Current                                                                           | Target                                                    |
| ------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 181-183 | Loading state `text-gray-600`                                                     | `text-linear-text-secondary`                              |
| 190     | `text-gray-900`                                                                   | `text-linear-text-primary`                                |
| 191     | `text-gray-600`                                                                   | `text-linear-text-secondary`                              |
| 196-226 | Filter buttons with `bg-blue-600`, `bg-yellow-600`, `bg-green-600`, `bg-gray-100` | Linear semantic colors                                    |
| 228-231 | Error state `bg-red-50 border-red-200 text-red-700`                               | Linear error colors                                       |
| 239     | `bg-white rounded-lg shadow`                                                      | `bg-linear-bg-primary border border-linear-border-subtle` |
| 240     | `text-gray-500`                                                                   | `text-linear-text-tertiary`                               |
| 249-251 | `bg-white rounded-lg shadow overflow-hidden`                                      | Linear tokens                                             |
| 251     | `divide-gray-200`                                                                 | `divide-linear-border-subtle`                             |
| 252-270 | Table header `bg-gray-50`, `text-gray-500`                                        | Linear tokens                                             |
| 273-275 | `bg-white divide-gray-200`                                                        | Linear tokens                                             |
| 277     | `hover:bg-gray-50`                                                                | `hover:bg-linear-bg-hover`                                |
| 278     | `text-gray-900`                                                                   | `text-linear-text-primary`                                |
| 280-281 | `text-gray-700`                                                                   | `text-linear-text-secondary`                              |
| 284-290 | Status badges                                                                     | Linear semantic colors                                    |
| 296-306 | Role select                                                                       | Linear form styling                                       |
| 309     | `text-gray-500`                                                                   | `text-linear-text-tertiary`                               |
| 316-319 | Action button `bg-blue-600 text-white hover:bg-blue-700`                          | Linear accent                                             |
| 323     | `text-red-600 hover:text-red-800`                                                 | Linear error                                              |
| 328     | `text-gray-400`                                                                   | `text-linear-text-muted`                                  |
| 339-390 | Activation modal                                                                  | Linear modal styling                                      |
| 395-442 | Deactivation modal                                                                | Linear modal styling                                      |
| 446-452 | Toast notification                                                                | Linear toast styling                                      |

---

### /admin/users/active - Active Users Page

**File**: `apps/web/src/app/admin/users/active/page.tsx`
**Severity**: High (admin workflow)
**Complexity**: Medium (281 lines)
**Total Occurrences**: 26

| Line    | Current                                      | Target                                                    |
| ------- | -------------------------------------------- | --------------------------------------------------------- |
| 122     | `text-gray-600`                              | `text-linear-text-secondary`                              |
| 130     | `text-gray-900`                              | `text-linear-text-primary`                                |
| 132     | `text-gray-600`                              | `text-linear-text-secondary`                              |
| 137     | `bg-red-50 border-red-200 text-red-700`      | Linear error colors                                       |
| 144     | `text-gray-600`                              | `text-linear-text-secondary`                              |
| 147-149 | `bg-white rounded-lg shadow`                 | `bg-linear-bg-primary border border-linear-border-subtle` |
| 148     | `text-gray-500`                              | `text-linear-text-tertiary`                               |
| 151     | `bg-white rounded-lg shadow overflow-hidden` | Linear tokens                                             |
| 152     | `divide-gray-200`                            | `divide-linear-border-subtle`                             |
| 153     | `bg-gray-50`                                 | `bg-linear-bg-secondary`                                  |
| 155-172 | Table header `text-gray-500`                 | `text-linear-text-tertiary`                               |
| 175     | `bg-white divide-gray-200`                   | Linear tokens                                             |
| 177     | `hover:bg-gray-50`                           | `hover:bg-linear-bg-hover`                                |
| 178     | `text-gray-900`                              | `text-linear-text-primary`                                |
| 181     | `text-gray-700`                              | `text-linear-text-secondary`                              |
| 188     | `border-gray-300`, `focus:ring-blue-500`     | Linear form styling                                       |
| 195     | `text-gray-700`                              | `text-linear-text-secondary`                              |
| 199     | `text-gray-500`                              | `text-linear-text-tertiary`                               |
| 205-206 | `text-red-600 hover:text-red-800`            | `text-linear-error hover:text-linear-error`               |
| 223-265 | Dialog with hardcoded colors                 | Linear modal styling                                      |
| 269-276 | Toast with `bg-green-600`, `bg-red-600`      | Linear semantic colors                                    |

---

### /activitate-echipa - Team Activity Page

**File**: `apps/web/src/app/activitate-echipa/page.tsx`
**Severity**: High (frequently used by partners)
**Complexity**: Simple (139 lines)
**Total Occurrences**: 4

| Line  | Current                                  | Target                                                           |
| ----- | ---------------------------------------- | ---------------------------------------------------------------- |
| 62    | `border-b border-gray-200 bg-white`      | `border-b border-linear-border-subtle bg-linear-bg-primary`      |
| 65    | `bg-amber-100`                           | Consider `bg-linear-warning/20` or keep as semantic              |
| 66    | `text-amber-600`                         | Consider `text-linear-warning` or keep as semantic               |
| 69    | `text-gray-900`                          | `text-linear-text-primary`                                       |
| 71-73 | `text-gray-500`                          | `text-linear-text-tertiary`                                      |
| 84    | `border-r border-gray-200 bg-gray-50/50` | `border-r border-linear-border-subtle bg-linear-bg-secondary/50` |
| 89    | `bg-white`                               | `bg-linear-bg-primary`                                           |

---

## Medium Priority Pages

### /reports - Reports Page

**File**: `apps/web/src/app/reports/page.tsx`
**Severity**: Medium
**Complexity**: Simple (69 lines)
**Total Occurrences**: 5

| Line | Current                                                   | Target                                                      |
| ---- | --------------------------------------------------------- | ----------------------------------------------------------- |
| 16   | `bg-gray-50`                                              | `bg-linear-bg-secondary`                                    |
| 21   | `border-b border-gray-200 bg-white`                       | `border-b border-linear-border-subtle bg-linear-bg-primary` |
| 24   | `border-gray-300 bg-white text-gray-700 hover:bg-gray-50` | Linear tokens                                               |
| 42   | `border-r border-gray-200 bg-white`                       | `border-r border-linear-border-subtle bg-linear-bg-primary` |
| 53   | `border-b border-gray-200 bg-white`                       | `border-b border-linear-border-subtle bg-linear-bg-primary` |

---

### /emails - Email Page

**File**: `apps/web/src/app/emails/page.tsx`
**Severity**: Medium
**Complexity**: Simple (128 lines)
**Total Occurrences**: 11

| Line  | Current                                                                   | Target                                 |
| ----- | ------------------------------------------------------------------------- | -------------------------------------- |
| 24    | `border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900` | Use consistent Linear tokens           |
| 27    | `text-gray-900 dark:text-white`                                           | `text-linear-text-primary`             |
| 29    | `text-gray-500 dark:text-gray-400`                                        | `text-linear-text-tertiary`            |
| 47    | `bg-gray-100 dark:bg-gray-800`                                            | `bg-linear-bg-tertiary`                |
| 50-53 | Tab styling with `bg-white text-gray-900 shadow dark:bg-gray-700`         | Linear tokens                          |
| 77    | `border-r border-gray-200 dark:border-gray-700`                           | `border-r border-linear-border-subtle` |
| 92-93 | Empty state `text-gray-500 dark:text-gray-400`                            | `text-linear-text-tertiary`            |
| 94    | `text-gray-300 dark:text-gray-600`                                        | `text-linear-text-muted`               |

**Notes**: Already has dark mode classes but using gray-\* instead of Linear tokens.

---

### /analytics/\* - Analytics Sub-pages

**Files**:

- `apps/web/src/app/analytics/ai-usage/page.tsx` (26 occurrences)
- `apps/web/src/app/analytics/document-intelligence/page.tsx` (14 occurrences)
- `apps/web/src/app/analytics/document-quality/page.tsx` (34 occurrences)
- `apps/web/src/app/analytics/platform-intelligence/page.tsx` (48 occurrences)
- `apps/web/src/app/analytics/tasks/page.tsx` (2 occurrences)

**Severity**: Medium (partner-only pages)
**Complexity**: Medium to Complex
**Total Occurrences**: 124

**Common patterns to fix**:

- `bg-white rounded-lg shadow` → `bg-linear-bg-primary rounded-lg border border-linear-border-subtle`
- `text-gray-*` → appropriate `text-linear-text-*`
- `border-gray-*` → `border-linear-border-*`
- Chart wrapper styling

---

### /admin/ai-ops/\* - AI Ops Sub-pages

**Files**:

- `apps/web/src/app/admin/ai-ops/budget/page.tsx` (13 occurrences)
- `apps/web/src/app/admin/ai-ops/costs/page.tsx` (13 occurrences)
- `apps/web/src/app/admin/ai-ops/features/page.tsx` (7 occurrences)
- `apps/web/src/app/admin/ai-ops/history/page.tsx` (33 occurrences)
- `apps/web/src/app/admin/ai-ops/users/[userId]/page.tsx` (23 occurrences)

**Severity**: Medium (admin pages)
**Complexity**: Medium
**Total Occurrences**: 89

**Notes**: Main `/admin/ai-ops/page.tsx` already uses Linear tokens. Sub-pages need migration.

---

### /communications - Communications Page

**File**: `apps/web/src/app/communications/page.tsx`
**Severity**: Medium
**Complexity**: Medium
**Total Occurrences**: 27

---

## Low Priority Pages

### /403 - Forbidden Page

**File**: `apps/web/src/app/403/page.tsx`
**Severity**: Low (error page, rarely seen)
**Complexity**: Simple (33 lines)
**Total Occurrences**: 4

| Line | Current                         | Target                                          |
| ---- | ------------------------------- | ----------------------------------------------- |
| 13   | `bg-gray-50`                    | `bg-linear-bg-secondary`                        |
| 16   | `text-gray-900`                 | `text-linear-text-primary`                      |
| 17   | `text-gray-700`                 | `text-linear-text-secondary`                    |
| 18   | `text-gray-600`                 | `text-linear-text-secondary`                    |
| 25   | `bg-blue-600 hover:bg-blue-700` | `bg-linear-accent hover:bg-linear-accent-hover` |

---

### /auth/callback - Auth Callback

**File**: `apps/web/src/app/auth/callback/page.tsx`
**Severity**: Low (transitional page)
**Complexity**: Simple
**Total Occurrences**: 7

---

### /search - Search Page

**File**: `apps/web/src/app/search/page.tsx`
**Severity**: Low
**Complexity**: Simple
**Total Occurrences**: 1

---

### /reviews/batch - Batch Reviews

**File**: `apps/web/src/app/reviews/batch/page.tsx`
**Severity**: Low
**Complexity**: Simple
**Total Occurrences**: 3

---

### /cases/my-cases - My Cases

**File**: `apps/web/src/app/cases/my-cases/page.tsx`
**Severity**: Low (may be deprecated)
**Complexity**: Medium
**Total Occurrences**: 20

---

## Already Migrated Pages (No Action Needed)

These pages use Linear tokens correctly:

- `/reviews/page.tsx` - Uses PageLayout and Linear tokens
- `/admin/ai-ops/page.tsx` - Uses Linear tokens
- `/analytics/page.tsx` - Uses PageLayout and Linear tokens

---

## Audit Checklist

- [x] /403 page audited
- [x] /cases/new page audited
- [x] /admin/users/active page audited
- [x] /admin/users/pending page audited
- [x] /emails page audited
- [x] /reports page audited
- [x] /reviews/\* pages audited
- [x] /analytics/\* pages audited
- [x] /admin/performance page audited
- [x] /admin/ai-ops/\* pages audited
- [x] /activitate-echipa page audited
- [x] /communications page audited
- [x] Additional pages (auth, search, etc.) audited
- [x] Severity ratings assigned
- [x] Complexity ratings assigned
- [x] Summary statistics compiled

---

## Implementation Recommendations

1. **Start with High Priority**: Focus on `/cases/new` and `/admin/users/*` first as these are frequently used
2. **Extract Local Components**: The local `Card` component in `/cases/new` should use the shared Linear Card
3. **Create Shared Table Component**: Many admin pages have similar table styling - consider a shared `LinearTable` component
4. **Form Styling**: Create a consistent form input style using Linear tokens
5. **Status Badges**: Standardize the status/severity badge components using Linear semantic colors
6. **Toast Component**: Create a shared Toast component using Linear colors

## Notes

- All pages need dark mode consideration even if not currently implementing dark mode
- The `/emails` page already has dark mode classes but uses gray-\* instead of Linear tokens
- Some pages use `shadow-sm` which should be replaced with borders per Linear design
- Form focus states should use `focus:ring-linear-accent` consistently
