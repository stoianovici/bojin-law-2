# OPS-368: Loading/Empty/Error States

## State

Core components complete and exported. Ready for verification.

## Done This Session

1. **Enhanced Skeleton component** (`apps/web/src/components/ui/skeleton.tsx`)
   - Added `variant` prop with presets: text, text-sm, title, avatar, button, card, row
   - Added `width` prop for easy customization
   - Created compound components: `SkeletonTextBlock`, `SkeletonListItem`, `SkeletonTable`, `SkeletonCard`

2. **Enhanced Spinner component** (`apps/web/src/components/ui/spinner.tsx`)
   - Added sizes: xs, sm, md, lg, xl
   - Added `label` prop for loading text below spinner
   - Added `accent` prop for purple accent color
   - Added `centered` prop for center-aligned layout
   - Created `LoadingOverlay` component for dimmed content loading
   - Created `PageLoading` component for full-page loading states
   - Uses Linear design tokens for dark mode

3. **Created EmptyState component** (`apps/web/src/components/linear/EmptyState.tsx`)
   - Variants: page, widget, inline, search
   - Presets: cases, tasks, documents, emails, events, comments, search, clients, billing, all-done
   - Props: icon, title, description, action, secondaryAction, query, neutral
   - Romanian copy built into presets

4. **Created ErrorState component** (`apps/web/src/components/linear/ErrorState.tsx`)
   - Variants: page, section, inline
   - Error codes: 403, 404, 500, network, unknown
   - Props: onRetry, onBack, homeHref, isRetrying
   - Helper components: `PageError`, `SectionError`, `InlineError`

5. **Updated ErrorBoundary** (`apps/web/src/components/errors/ErrorBoundary.tsx`)
   - Redesigned with Linear dark mode styling
   - Added `inline` prop for compact widget errors
   - Uses lucide-react icons consistently

6. **Exported from linear/index.ts**
   - EmptyState, ErrorState, PageError, SectionError, InlineError

## Next Steps

1. Verify components render correctly in browser
2. (Optional) Add skeleton states to actual pages - deferred

## Key Files

- `apps/web/src/components/ui/skeleton.tsx` - Enhanced skeleton
- `apps/web/src/components/ui/spinner.tsx` - Enhanced spinner with LoadingOverlay
- `apps/web/src/components/linear/EmptyState.tsx` - NEW
- `apps/web/src/components/linear/ErrorState.tsx` - NEW
- `apps/web/src/components/errors/ErrorBoundary.tsx` - Updated styling
- `apps/web/src/components/linear/index.ts` - Exports

## Usage Examples

```tsx
// Empty state with preset
<EmptyState preset="documents" />

// Empty state with action
<EmptyState
  preset="cases"
  action={{ label: 'Creează dosar', onClick: handleCreate }}
/>

// Search empty state
<EmptyState preset="search" variant="search" query="contract" />

// Error with retry
<ErrorState onRetry={refetch} isRetrying={isLoading} />

// Page 404
<PageError code={404} onBack={() => router.back()} />

// Loading overlay
<LoadingOverlay loading={isRefreshing}>
  <Table data={data} />
</LoadingOverlay>

// Skeleton table
<SkeletonTable rows={5} columns={4} />
```
