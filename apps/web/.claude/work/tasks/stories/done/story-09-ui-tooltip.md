# Story 09: Tooltip Component

**Parallelizable with**: All other Phase 1 stories (different files)
**Depends on**: Uses existing `@radix-ui/react-tooltip`
**Blocks**: None

---

## Task: Create Tooltip Component

**File**: `src/components/ui/Tooltip.tsx` (CREATE)

### Do

Create Tooltip component wrapping Radix primitive:

```typescript
// Required exports:
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipArrow };
export type { TooltipProps };
```

**TooltipProvider** - Wrap app root (or layout):

- `delayDuration` - default 300ms
- `skipDelayDuration` - default 0ms (for moving between tooltips)

**Content Styling**:

```css
z-[var(--linear-z-tooltip)]
overflow-hidden
rounded-md
px-3 py-1.5
text-xs
bg-linear-bg-tertiary
text-linear-text-primary
border border-linear-border-subtle
shadow-md

/* Animation */
data-[state=delayed-open]:animate-fadeIn
data-[state=closed]:animate-fadeOut
```

**Positions** (via `side` prop):

- `top` (default)
- `right`
- `bottom`
- `left`

**Arrow Styling**:

```css
fill-linear-bg-tertiary
```

**Features**:

- Configurable delay before showing
- Arrow pointing to trigger
- Collision detection (flips if not enough space)
- Portal to body
- Accessible (tooltip role)

### Example Usage

```tsx
// Wrap app with provider (in layout.tsx or providers)
<TooltipProvider>
  <App />
</TooltipProvider>

// Usage
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="sm">
      <HelpCircle className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Need help? Click here for documentation.</p>
  </TooltipContent>
</Tooltip>

// With arrow and custom side
<Tooltip>
  <TooltipTrigger>Hover me</TooltipTrigger>
  <TooltipContent side="right">
    <TooltipArrow />
    Right-side tooltip
  </TooltipContent>
</Tooltip>
```

### Done when

- Shows after delay on hover
- Hides on mouse leave
- All 4 positions work
- Arrow renders correctly
- Collision detection works (flips when needed)
- Accessible
