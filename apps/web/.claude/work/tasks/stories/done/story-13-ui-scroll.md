# Story 13: ScrollArea Component

**Parallelizable with**: All other Phase 1 stories (different files)
**Depends on**: Install `@radix-ui/react-scroll-area` first
**Blocks**: None

---

## Task: Create ScrollArea Component

**File**: `src/components/ui/ScrollArea.tsx` (CREATE)

### Do

Create ScrollArea component with custom scrollbars:

```typescript
// Required exports:
export { ScrollArea, ScrollBar };
export type { ScrollAreaProps };
```

**ScrollArea Styling**:

```css
relative
overflow-hidden
```

**ScrollBar Styling** (thin, subtle, Linear-style):

```css
flex
touch-none
select-none
transition-colors

/* Vertical */
data-[orientation=vertical]:w-2
data-[orientation=vertical]:border-l
data-[orientation=vertical]:border-l-transparent
data-[orientation=vertical]:p-[1px]

/* Horizontal */
data-[orientation=horizontal]:h-2
data-[orientation=horizontal]:flex-col
data-[orientation=horizontal]:border-t
data-[orientation=horizontal]:border-t-transparent
data-[orientation=horizontal]:p-[1px]
```

**ScrollBar Thumb Styling**:

```css
relative
flex-1
rounded-full
bg-linear-border-default

/* Hover - more visible */
hover:bg-linear-text-muted
```

**Features**:

- Custom thin scrollbars matching Linear aesthetic
- Vertical scrollbar (default)
- Horizontal scrollbar support
- Auto-hide option (scrollbar only visible on hover/scroll)
- Smooth scrolling

### Example Usage

```tsx
// Vertical scroll (default)
<ScrollArea className="h-[300px]">
  <div className="p-4">
    {/* Long content */}
  </div>
</ScrollArea>

// With explicit scrollbar
<ScrollArea className="h-[300px] w-[400px]">
  <div className="p-4">
    {/* Content */}
  </div>
  <ScrollBar orientation="vertical" />
</ScrollArea>

// Horizontal scroll
<ScrollArea className="w-full whitespace-nowrap">
  <div className="flex gap-4 p-4">
    {items.map(item => <Card key={item.id} />)}
  </div>
  <ScrollBar orientation="horizontal" />
</ScrollArea>

// Both directions
<ScrollArea className="h-[400px] w-full">
  <div className="min-w-[800px] p-4">
    {/* Wide and tall content */}
  </div>
  <ScrollBar orientation="vertical" />
  <ScrollBar orientation="horizontal" />
</ScrollArea>
```

### Done when

- Custom scrollbars render (not native)
- Scrollbars are thin and subtle
- Thumb dragging works
- Click-to-scroll on track works
- Horizontal scrollbar works
- Keyboard scrolling works
