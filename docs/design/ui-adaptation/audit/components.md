# Shared Component Audit

> **Issue**: [OPS-339](../../../ops/issues/ops-339.md)
> **Status**: Complete
> **Date**: 2025-12-28

## Executive Summary

The codebase has **two parallel component systems**:

1. **`packages/ui`** - Original shared component library with heavy shadows (needs update)
2. **`apps/web/src/components/ui`** - shadcn-style components already using Linear tokens

The `packages/ui` Card and Modal need updating, but their usage is limited. Most of the app uses the shadcn Card or inline local Card components that are already Linear-aligned.

---

## Card Component

### packages/ui/src/atoms/Card.tsx (Needs Update)

| Line | Current Class               | Issue                                 | Target                        |
| ---- | --------------------------- | ------------------------------------- | ----------------------------- |
| 55   | `shadow-lg hover:shadow-xl` | Heavy shadows on `elevated` variant   | `shadow-sm hover:shadow-md`   |
| 54   | `border border-neutral-200` | Uses neutral instead of Linear tokens | `border-linear-border-subtle` |
| 50   | `bg-white`                  | Hardcoded white background            | `bg-linear-bg-secondary`      |

**Current Variants**:

```tsx
const variantStyles = {
  default: 'border border-neutral-200', // OK
  elevated: 'shadow-lg hover:shadow-xl', // Too heavy
  outlined: 'border-2 border-neutral-300', // OK
};
```

**Target State**:

```tsx
const variantStyles = {
  default: 'border border-linear-border-subtle',
  elevated: 'shadow-sm hover:shadow-md border border-linear-border-subtle',
  outlined: 'border-2 border-linear-border',
};
```

### Consumers of packages/ui Card

Only **1 component** imports from `@legal-platform/ui`:

- `apps/web/src/components/assistant/ActionConfirmCard.tsx` (line 15)

**Note**: Does not use `variant="elevated"`, so no visual impact from current shadows.

### apps/web/src/components/ui/card.tsx (Already Updated)

This shadcn-style Card is **already Linear-compliant**:

```tsx
// Line 11
'rounded-lg border border-linear-border-subtle bg-linear-bg-secondary
 text-linear-text-primary shadow-sm transition-all duration-200
 ease-in-out hover:border-linear-border'
```

**Consumers**: 21 files use this Card (most of the app)

### Local Card Components (Already Updated)

Several sections define inline Card components that are already Linear-aligned:

- `apps/web/src/components/case/sections/CaseDetailsSection.tsx` (line 60-68)
- Similar pattern in other section files

---

## Modal Component

### packages/ui/src/molecules/Modal.tsx (Needs Update)

| Line | Current Class       | Issue                | Target                  |
| ---- | ------------------- | -------------------- | ----------------------- |
| 68   | `shadow-2xl`        | Very heavy shadow    | `shadow-lg`             |
| 68   | `bg-white`          | Hardcoded white      | `bg-linear-bg-elevated` |
| 62   | `bg-neutral-900/50` | Overlay uses neutral | `bg-black/80` (OK)      |

**Current State** (line 68):

```tsx
'fixed left-1/2 top-1/2 z-modal w-full -translate-x-1/2 -translate-y-1/2
 rounded-xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150'
```

**Target State**:

```tsx
'fixed left-1/2 top-1/2 z-modal w-full -translate-x-1/2 -translate-y-1/2
 rounded-xl bg-linear-bg-elevated p-6 shadow-lg border border-linear-border-subtle
 animate-in fade-in zoom-in-95 duration-150'
```

### Consumers of packages/ui Modal

**0 components** currently import Modal from `@legal-platform/ui`.

All modal usage in the app uses:

- `apps/web/src/components/ui/dialog.tsx` (shadcn Dialog)
- Direct Radix Dialog usage

### apps/web/src/components/ui/dialog.tsx (Already Updated)

This is **already Linear-compliant** (line 38):

```tsx
'border border-linear-border-subtle bg-linear-bg-elevated ... shadow-lg';
```

---

## Additional Heavy Shadows Found

Other files with `shadow-lg`, `shadow-xl`, or `shadow-2xl` that may need review:

### High Priority (Modals/Overlays)

| File                                           | Line | Usage                        |
| ---------------------------------------------- | ---- | ---------------------------- |
| `components/mobile/AssistantSheet.tsx`         | 139  | `shadow-2xl` on mobile sheet |
| `components/preview/DocumentPreviewModal.tsx`  | 551  | `shadow-2xl` on modal        |
| `components/communication/MoveThreadModal.tsx` | 189  | `shadow-xl` on modal         |
| `components/mobile/MobileDrawer.tsx`           | 228  | `shadow-xl` on drawer        |

### Medium Priority (Dropdowns/Tooltips)

| File                                       | Line               | Usage                         |
| ------------------------------------------ | ------------------ | ----------------------------- |
| `components/dashboard/WidgetContainer.tsx` | 117                | `shadow-lg` on dropdown       |
| `components/search/GlobalSearchBar.tsx`    | 173                | `shadow-lg` on search results |
| `components/reports/ReportBuilder.tsx`     | 164, 251, 275, 343 | `shadow-lg` on selects        |

### Low Priority (Contextual)

| File                                           | Line | Usage                          |
| ---------------------------------------------- | ---- | ------------------------------ |
| `components/dashboard/PrioritizedTaskCard.tsx` | 86   | `shadow-lg` on drag state (OK) |
| `globals.css`                                  | 193  | `hover:shadow-lg` in animation |

---

## Dark Mode Considerations

1. **packages/ui components**: Use hardcoded `bg-white` - needs `bg-linear-bg-secondary` token
2. **shadcn components**: Already use Linear tokens which support dark mode
3. **Local Card components**: Already use Linear tokens

---

## Recommendations

### Immediate (OPS-339 scope)

1. Update `packages/ui/src/atoms/Card.tsx`:
   - Change `elevated` variant: `shadow-lg hover:shadow-xl` → `shadow-sm hover:shadow-md`
   - Change `bg-white` → `bg-linear-bg-secondary`
   - Change `border-neutral-200` → `border-linear-border-subtle`

2. Update `packages/ui/src/molecules/Modal.tsx`:
   - Change `shadow-2xl` → `shadow-lg`
   - Change `bg-white` → `bg-linear-bg-elevated`
   - Add `border border-linear-border-subtle`

### Future Work

- Review mobile components (`AssistantSheet`, `MobileDrawer`) for shadow alignment
- Review `DocumentPreviewModal` for shadow update
- Consider consolidating Card components (packages/ui vs shadcn vs local)

---

## Audit Checklist

- [x] Card: Document current shadow classes with line numbers
- [x] Card: Map to Linear shadow tokens
- [x] Card: Check border styling
- [x] Card: Verify background colors
- [x] Card: List all consumers
- [x] Modal: Document current shadow classes with line numbers
- [x] Modal: Map to Linear shadow tokens
- [x] Modal: Check border styling
- [x] Modal: List all consumers
- [x] Note dark mode considerations
- [x] Identify additional heavy shadow usage
