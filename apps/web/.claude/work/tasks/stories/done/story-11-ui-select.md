# Story 11: Select Component

**Parallelizable with**: All other Phase 1 stories (different files)
**Depends on**: Install `@radix-ui/react-select` first
**Blocks**: None

---

## Task: Create Select Component

**File**: `src/components/ui/Select.tsx` (CREATE)

### Do

Create Select dropdown component wrapping Radix primitive:

```typescript
// Required exports:
export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
export type { SelectProps };
```

**Sizes** (on SelectTrigger):

- `sm` - `h-7 text-xs`
- `md` - `h-8 text-sm` (default)
- `lg` - `h-10 text-sm`

**Trigger Styling**:

```css
flex items-center justify-between
w-full
rounded-md
border border-linear-border-subtle
bg-linear-bg-elevated
px-3
text-linear-text-primary
placeholder:text-linear-text-muted

/* Focus */
focus:outline-none
focus:ring-2
focus:ring-linear-accent

/* Disabled */
disabled:opacity-50
disabled:cursor-not-allowed

/* Chevron icon */
[&>span]:flex-1 [&>span]:text-left
```

**Content Styling**:

```css
relative
z-[var(--linear-z-dropdown)]
overflow-hidden
rounded-md
border border-linear-border-subtle
bg-linear-bg-elevated
shadow-md

/* Animation */
data-[state=open]:animate-fadeIn
```

**Item Styling**:

```css
relative
flex items-center
rounded-sm
py-1.5 pl-8 pr-2
text-sm
text-linear-text-primary
cursor-pointer
outline-none

/* Focus */
focus:bg-linear-bg-tertiary
data-[highlighted]:bg-linear-bg-tertiary

/* Selected - checkmark indicator */
data-[state=checked]:before:content-['✓']
/* Or use Lucide Check icon */
```

**Features**:

- Keyboard navigation
- Typeahead search
- Grouped options with labels
- Scroll buttons for long lists
- Placeholder support
- Chevron indicator

### Example Usage

```tsx
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select a case..." />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Active Cases</SelectLabel>
      <SelectItem value="case-001">Case #2024-001</SelectItem>
      <SelectItem value="case-002">Case #2024-002</SelectItem>
    </SelectGroup>
    <SelectSeparator />
    <SelectGroup>
      <SelectLabel>Archived</SelectLabel>
      <SelectItem value="case-old">Case #2023-050</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>

// Controlled
<Select value={caseId} onValueChange={setCaseId}>
  ...
</Select>
```

### Done when

- Opens on click/keyboard
- Items selectable
- Keyboard navigation works
- Groups and labels render
- Selected item shows checkmark
- Placeholder shows when no selection
