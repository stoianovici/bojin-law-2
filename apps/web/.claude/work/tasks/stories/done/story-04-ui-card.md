# Story 04: Card Component

**Parallelizable with**: All other Phase 1 stories (different files)
**Depends on**: Nothing
**Blocks**: None

---

## Task: Create Card Component

**File**: `src/components/ui/Card.tsx` (CREATE)

### Do

Create composable Card component with Linear styling:

```typescript
// Required exports:
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export type { CardProps };
```

**Variants**:

- `default` - `bg-linear-bg-elevated border-linear-border-subtle`
- `elevated` - `bg-linear-bg-tertiary shadow-md`
- `outline` - `bg-transparent border-linear-border-default`
- `interactive` - Adds hover state: `hover:bg-linear-bg-tertiary hover:border-linear-border-default cursor-pointer transition-colors`

**Sub-components**:

```tsx
// Card - main container
<Card variant="default" className="...">

// CardHeader - top section with flex layout
<CardHeader className="flex flex-col space-y-1.5 p-4">

// CardTitle - heading
<CardTitle className="text-lg font-semibold text-linear-text-primary">

// CardDescription - subtitle/description
<CardDescription className="text-sm text-linear-text-secondary">

// CardContent - main content area
<CardContent className="p-4 pt-0">

// CardFooter - bottom section, often for actions
<CardFooter className="flex items-center p-4 pt-0">
```

**Styling**:

- `rounded-lg` border radius
- `border` on all variants
- Smooth transitions for interactive variant

### Example Usage

```tsx
<Card>
  <CardHeader>
    <CardTitle>Case #2024-001</CardTitle>
    <CardDescription>Contract dispute - Ionescu vs. Popescu</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Active since January 15, 2024</p>
  </CardContent>
  <CardFooter>
    <Button variant="ghost" size="sm">View Details</Button>
  </CardFooter>
</Card>

<Card variant="interactive" onClick={handleClick}>
  <CardContent>Clickable card</CardContent>
</Card>
```

### Done when

- All sub-components compose correctly
- Variants apply proper styling
- Interactive variant has hover state
- Padding/spacing consistent
- Works with or without any sub-component
