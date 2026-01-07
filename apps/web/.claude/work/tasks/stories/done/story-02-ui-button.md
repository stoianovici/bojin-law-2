# Story 02: Button Component

**Parallelizable with**: All other Phase 1 stories (different files)
**Depends on**: Nothing (uses existing tokens)
**Blocks**: None

---

## Task: Create Button Component

**File**: `src/components/ui/Button.tsx` (CREATE)

### Do

Create a fully-featured Button component with Linear styling:

```typescript
// Required exports:
export { Button, buttonVariants };
export type { ButtonProps };
```

**Variants** (use `cva` from class-variance-authority):

- `primary` - `bg-linear-accent hover:bg-linear-accent-hover text-white`
- `secondary` - `bg-linear-bg-elevated hover:bg-linear-bg-tertiary text-linear-text-primary border border-linear-border-subtle`
- `ghost` - `hover:bg-linear-bg-elevated text-linear-text-secondary`
- `danger` - `bg-linear-error/10 hover:bg-linear-error/20 text-linear-error`

**Sizes**:

- `sm` - `h-7 px-2.5 text-xs`
- `md` - `h-8 px-3 text-sm` (default)
- `lg` - `h-10 px-4 text-sm`

**Features**:

- `disabled` state with reduced opacity, `pointer-events-none`
- `loading` state with spinner icon, text hidden but space preserved
- `asChild` prop using `@radix-ui/react-slot` for link composition
- `leftIcon` and `rightIcon` props for icon placement
- Forward ref support
- Full TypeScript types

**Styling**:

- `rounded-md` (or use `--linear-radius-md`)
- `font-medium`
- `transition-colors duration-150`
- Focus ring: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-offset-2 focus-visible:ring-offset-linear-bg-primary`

### Example Usage

```tsx
<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost" size="sm">Small Ghost</Button>
<Button loading>Saving...</Button>
<Button asChild><Link href="/cases">View Cases</Link></Button>
<Button leftIcon={<Plus />}>Add Case</Button>
```

### Done when

- All variants render correctly
- Loading spinner shows, hides text
- `asChild` works with Next.js Link
- TypeScript types are complete
- Accessible (button role, disabled state)
