# Story 12: Tabs Component

**Parallelizable with**: All other Phase 1 stories (different files)
**Depends on**: Install `@radix-ui/react-tabs` first
**Blocks**: None

---

## Task: Create Tabs Component

**File**: `src/components/ui/Tabs.tsx` (CREATE)

### Do

Create Tabs component wrapping Radix primitive:

```typescript
// Required exports:
export { Tabs, TabsList, TabsTrigger, TabsContent };
export type { TabsProps };
```

**Variants** (on TabsList):

- `underline` - Tabs with animated underline indicator (default, Linear-style)
- `pills` - Tabs with pill/button styling

**TabsList Styling (underline variant)**:

```css
inline-flex
h-9
items-center
gap-1
border-b border-linear-border-subtle
```

**TabsTrigger Styling (underline variant)**:

```css
relative
inline-flex items-center justify-center
px-3 py-1.5
text-sm font-medium
text-linear-text-secondary
transition-colors

/* Hover */
hover:text-linear-text-primary

/* Active */
data-[state=active]:text-linear-text-primary

/* Animated underline */
after:absolute
after:bottom-0 after:left-0 after:right-0
after:h-0.5
after:bg-linear-accent
after:scale-x-0
after:transition-transform
data-[state=active]:after:scale-x-100
```

**TabsList Styling (pills variant)**:

```css
inline-flex
h-9
items-center
gap-1
rounded-lg
bg-linear-bg-tertiary
p-1
```

**TabsTrigger Styling (pills variant)**:

```css
inline-flex items-center justify-center
rounded-md
px-3 py-1
text-sm font-medium
text-linear-text-secondary
transition-colors

data-[state=active]:bg-linear-bg-elevated
data-[state=active]:text-linear-text-primary
data-[state=active]:shadow-sm
```

**TabsContent Styling**:

```css
mt-4
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-linear-accent
```

**Features**:

- Full keyboard navigation (arrow keys, home, end)
- Animated underline/pill transition
- Accessible (tablist, tab, tabpanel roles)
- Controlled or uncontrolled

### Example Usage

```tsx
// Underline variant (default)
<Tabs defaultValue="active">
  <TabsList>
    <TabsTrigger value="active">Active</TabsTrigger>
    <TabsTrigger value="archived">Archived</TabsTrigger>
    <TabsTrigger value="all">All</TabsTrigger>
  </TabsList>
  <TabsContent value="active">
    Active cases content...
  </TabsContent>
  <TabsContent value="archived">
    Archived cases content...
  </TabsContent>
  <TabsContent value="all">
    All cases content...
  </TabsContent>
</Tabs>

// Pills variant
<Tabs defaultValue="grid">
  <TabsList variant="pills">
    <TabsTrigger value="grid"><Grid className="h-4 w-4" /></TabsTrigger>
    <TabsTrigger value="list"><List className="h-4 w-4" /></TabsTrigger>
  </TabsList>
</Tabs>
```

### Done when

- Both variants render correctly
- Underline animation works smoothly
- Keyboard navigation works
- Content switches on tab change
- Accessible roles present
