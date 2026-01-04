# Story 15: Popover Component

**Parallelizable with**: All other Phase 1 stories (different files)
**Depends on**: Install `@radix-ui/react-popover` first
**Blocks**: None

---

## Task: Create Popover Component

**File**: `src/components/ui/Popover.tsx` (CREATE)

### Do

Create Popover component wrapping Radix primitive:

```typescript
// Required exports:
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose, PopoverArrow };
export type { PopoverProps, PopoverContentProps };
```

**Content Styling**:

```css
z-[var(--linear-z-popover)]
w-72
rounded-lg
border border-linear-border-subtle
bg-linear-bg-elevated
p-4
shadow-lg
outline-none

/* Animation */
data-[state=open]:animate-fadeIn
data-[state=closed]:animate-fadeOut

/* Position-based slide */
data-[side=top]:animate-slideDown
data-[side=bottom]:animate-slideUp
data-[side=left]:animate-slideRight
data-[side=right]:animate-slideLeft
```

**Arrow Styling**:

```css
fill-linear-bg-elevated
```

**Props on PopoverContent**:

- `align`: `'start'` | `'center'` (default) | `'end'`
- `side`: `'top'` | `'right'` | `'bottom'` (default) | `'left'`
- `sideOffset`: number (default 4)
- `alignOffset`: number (default 0)

**Features**:

- Click outside to close (configurable)
- Escape to close
- Focus trap inside
- Collision detection (flips position if needed)
- Arrow pointing to trigger
- Portal to body

### Example Usage

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost">
      <Settings className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <div className="space-y-4">
      <h4 className="font-medium">Settings</h4>
      <div className="space-y-2">
        <label className="text-sm">Display name</label>
        <Input placeholder="Your name" />
      </div>
      <div className="flex justify-end">
        <PopoverClose asChild>
          <Button size="sm">Save</Button>
        </PopoverClose>
      </div>
    </div>
  </PopoverContent>
</Popover>

// With arrow and custom positioning
<Popover>
  <PopoverTrigger>Open</PopoverTrigger>
  <PopoverContent side="right" align="start">
    <PopoverArrow />
    <p>Content aligned to start</p>
  </PopoverContent>
</Popover>

// Using PopoverAnchor for custom positioning
<Popover>
  <PopoverAnchor asChild>
    <div>Anchor element (popover positions relative to this)</div>
  </PopoverAnchor>
  <PopoverTrigger>Open from different element</PopoverTrigger>
  <PopoverContent>Content near anchor</PopoverContent>
</Popover>
```

### Done when

- Opens on trigger click
- Closes on outside click
- Closes on Escape
- All positions work
- Collision detection flips position
- Arrow renders correctly
- Focus trapped inside
