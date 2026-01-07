# Story 14: Separator Component

**Parallelizable with**: All other Phase 1 stories (different files)
**Depends on**: Install `@radix-ui/react-separator` first
**Blocks**: None

---

## Task: Create Separator Component

**File**: `src/components/ui/Separator.tsx` (CREATE)

### Do

Create Separator (divider) component wrapping Radix primitive:

```typescript
// Required exports:
export { Separator };
export type { SeparatorProps };
```

**Props**:

- `orientation`: `'horizontal'` (default) | `'vertical'`
- `decorative`: `boolean` (default true) - if false, has separator role for a11y

**Horizontal Styling**:

```css
h-px
w-full
bg-linear-border-subtle
```

**Vertical Styling**:

```css
h-full
w-px
bg-linear-border-subtle
```

**Features**:

- Simple styling wrapper around Radix
- Both orientations
- Proper a11y (decorative vs semantic)

### Example Usage

```tsx
// Horizontal (default)
<div className="space-y-4">
  <div>Section 1</div>
  <Separator />
  <div>Section 2</div>
</div>

// Vertical in flex container
<div className="flex items-center gap-4 h-8">
  <span>Item 1</span>
  <Separator orientation="vertical" />
  <span>Item 2</span>
  <Separator orientation="vertical" />
  <span>Item 3</span>
</div>

// As semantic divider (not decorative)
<Separator decorative={false} />
```

### Done when

- Horizontal renders as full-width line
- Vertical renders as full-height line
- Uses `linear-border-subtle` color
- Accessible (decorative or separator role)
