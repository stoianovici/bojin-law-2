# Story 08: DropdownMenu Component

**Parallelizable with**: All other Phase 1 stories (different files)
**Depends on**: Uses existing `@radix-ui/react-dropdown-menu`
**Blocks**: None

---

## Task: Create DropdownMenu Component

**File**: `src/components/ui/DropdownMenu.tsx` (CREATE)

### Do

Create DropdownMenu component wrapping Radix primitive:

```typescript
// Required exports:
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
```

**Content Styling**:

```css
z-[var(--linear-z-dropdown)]
min-w-[180px]
overflow-hidden
rounded-md
border border-linear-border-subtle
bg-linear-bg-elevated
p-1
shadow-md

/* Animation */
data-[state=open]:animate-fadeIn
data-[side=top]:animate-slideDown
data-[side=bottom]:animate-slideUp
```

**Item Styling**:

```css
relative
flex items-center
rounded-sm
px-2 py-1.5
text-sm
text-linear-text-primary
cursor-pointer
outline-none

/* Focus/hover */
focus:bg-linear-bg-tertiary
hover:bg-linear-bg-tertiary

/* Disabled */
data-[disabled]:opacity-50
data-[disabled]:pointer-events-none
```

**Sub-components Styling**:

```tsx
// DropdownMenuLabel - section header
className = 'px-2 py-1.5 text-xs font-semibold text-linear-text-muted';

// DropdownMenuSeparator - divider line
className = 'my-1 h-px bg-linear-border-subtle';

// DropdownMenuShortcut - keyboard shortcut hint (right side)
className = 'ml-auto text-xs text-linear-text-muted';

// DropdownMenuCheckboxItem - with checkmark indicator
// DropdownMenuRadioItem - with radio dot indicator
```

**Features**:

- Full keyboard navigation (arrow keys, enter, escape)
- Typeahead search
- Submenu support with arrow indicator
- Checkbox and radio items with visual indicators
- Shortcut display (e.g., "⌘S")
- Icon support in items

### Example Usage

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuItem>
      <Edit className="mr-2 h-4 w-4" />
      Edit
      <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
    </DropdownMenuItem>
    <DropdownMenuItem>
      <Copy className="mr-2 h-4 w-4" />
      Duplicate
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Share className="mr-2 h-4 w-4" />
        Share
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem>Email</DropdownMenuItem>
        <DropdownMenuItem>Link</DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="text-linear-error">
      <Trash className="mr-2 h-4 w-4" />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Done when

- Opens on trigger click
- Full keyboard navigation works
- Submenus open correctly
- Checkbox/radio items toggle
- Animations smooth
- Accessible (menu role, aria)
