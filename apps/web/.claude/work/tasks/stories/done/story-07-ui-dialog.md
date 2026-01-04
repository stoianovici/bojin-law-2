# Story 07: Dialog Component

**Parallelizable with**: All other Phase 1 stories (different files)
**Depends on**: Uses existing `@radix-ui/react-dialog`
**Blocks**: None

---

## Task: Create Dialog Component

**File**: `src/components/ui/Dialog.tsx` (CREATE)

### Do

Create Dialog (modal) component wrapping Radix primitive:

```typescript
// Required exports:
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
};
export type { DialogProps, DialogContentProps };
```

**Content Sizes** (via `size` prop on DialogContent):

- `sm` - `max-w-sm` (384px)
- `md` - `max-w-md` (448px) - default
- `lg` - `max-w-lg` (512px)
- `xl` - `max-w-xl` (576px)
- `full` - `max-w-[90vw] max-h-[90vh]`

**Overlay Styling**:

```css
fixed inset-0
bg-black/60
backdrop-blur-sm
z-[var(--linear-z-modal)]

/* Animation */
data-[state=open]:animate-fadeIn
data-[state=closed]:animate-fadeOut
```

**Content Styling**:

```css
fixed
left-1/2 top-1/2
-translate-x-1/2 -translate-y-1/2
z-[var(--linear-z-modal)]

bg-linear-bg-elevated
border border-linear-border-subtle
rounded-lg
shadow-lg

/* Animation */
data-[state=open]:animate-scaleIn
data-[state=closed]:animate-fadeOut
```

**Sub-components**:

```tsx
// DialogHeader - flex container for title area
<DialogHeader className="flex flex-col space-y-1.5 p-6 pb-0">

// DialogTitle - modal heading
<DialogTitle className="text-lg font-semibold text-linear-text-primary">

// DialogDescription - subtitle
<DialogDescription className="text-sm text-linear-text-secondary">

// DialogFooter - action buttons area
<DialogFooter className="flex justify-end gap-2 p-6 pt-4">

// DialogClose - close button, typically X in corner
// Position absolute top-right with ghost styling
```

**Features**:

- Close on Escape key (Radix default)
- Close on overlay click (configurable)
- Focus trap (Radix default)
- Scroll lock on body when open
- X close button in top-right corner

### Example Usage

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent size="md">
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogDescription>Are you sure you want to proceed?</DialogDescription>
    </DialogHeader>
    <div className="p-6 pt-0">{/* Content */}</div>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="ghost">Cancel</Button>
      </DialogClose>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Done when

- Opens/closes with animations
- All sizes work
- Focus trapped inside modal
- Escape and overlay click close
- X button closes
- Accessible (dialog role, aria labels)
