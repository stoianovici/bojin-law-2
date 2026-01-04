# Story 03: Input Component

**Parallelizable with**: All other Phase 1 stories (different files)
**Depends on**: Nothing
**Blocks**: None

---

## Task: Create Input Component

**File**: `src/components/ui/Input.tsx` (CREATE)

### Do

Create Input and TextArea components with Linear styling:

```typescript
// Required exports:
export { Input, TextArea };
export type { InputProps, TextAreaProps };
```

**Variants**:

- `default` - Standard input styling
- `error` - Red border, error state

**Sizes**:

- `sm` - `h-7 text-xs`
- `md` - `h-8 text-sm` (default)
- `lg` - `h-10 text-sm`

**Features**:

- Optional `leftAddon` (icon or text, inside input)
- Optional `rightAddon` (icon or text, inside input)
- `error` prop for error state styling
- `errorMessage` prop to display below input
- Forward ref support
- Full TypeScript with `React.InputHTMLAttributes`

**Styling**:

```css
/* Base */
bg-linear-bg-elevated
border border-linear-border-subtle
rounded-md
text-linear-text-primary
placeholder:text-linear-text-muted

/* Focus */
focus:outline-none
focus:ring-2
focus:ring-linear-accent
focus:border-transparent

/* Error */
border-linear-error
focus:ring-linear-error

/* Disabled */
disabled:opacity-50
disabled:cursor-not-allowed
```

**TextArea**:

- Same styling as Input
- `rows` prop (default 3)
- `resize` prop: `none`, `vertical`, `horizontal`, `both`
- Auto-resize option based on content

### Example Usage

```tsx
<Input placeholder="Search cases..." />
<Input leftAddon={<Search className="w-4 h-4" />} placeholder="Search..." />
<Input error errorMessage="This field is required" />
<Input size="lg" rightAddon={<Kbd>⌘K</Kbd>} />
<TextArea rows={5} placeholder="Description..." />
```

### Done when

- All sizes render correctly
- Addons positioned correctly inside input
- Error state shows red border + message
- Focus ring matches Linear style
- TextArea works with resize options
