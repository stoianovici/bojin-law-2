# Story 10: Toast Component

**Parallelizable with**: All other Phase 1 stories (different files)
**Depends on**: Uses existing `@radix-ui/react-toast`
**Blocks**: None

---

## Task: Create Toast Notification System

**File**: `src/components/ui/Toast.tsx` (CREATE)

### Do

Create Toast notification system with imperative hook:

```typescript
// Required exports:
export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
  useToast,
  toast, // Imperative function
};
export type { ToastProps, ToastActionElement };
```

**Variants**:

- `default` - `bg-linear-bg-elevated border-linear-border-subtle`
- `success` - `bg-linear-success/10 border-linear-success/20`
- `error` - `bg-linear-error/10 border-linear-error/20`
- `warning` - `bg-linear-warning/10 border-linear-warning/20`

**Toast Styling**:

```css
group
pointer-events-auto
relative
flex w-full items-center justify-between
space-x-4
overflow-hidden
rounded-lg
border
p-4
shadow-lg
transition-all

/* Animation */
data-[state=open]:animate-slideInRight
data-[state=closed]:animate-fadeOut
data-[swipe=end]:animate-slideOutRight
```

**Viewport Styling**:

```css
fixed
bottom-4 right-4
z-[var(--linear-z-tooltip)]
flex
max-h-screen
w-full
flex-col-reverse
gap-2
max-w-[420px]
```

**Features**:

- Swipe to dismiss
- Auto-dismiss with configurable duration (default 5000ms)
- Progress bar for auto-dismiss
- Stack management (max 3 visible, queue others)
- Action button support

**useToast Hook**:

```typescript
function useToast() {
  return {
    toasts: Toast[],
    toast: (props: ToastProps) => void,
    dismiss: (toastId: string) => void,
  }
}

// Imperative usage (outside React)
toast({
  title: "Saved",
  description: "Changes have been saved.",
  variant: "success",
})

toast.success("Saved successfully")
toast.error("Failed to save")
toast.warning("Please review")
```

### Example Usage

```tsx
// In layout or app root
<ToastProvider>
  {children}
  <ToastViewport />
</ToastProvider>

// Usage in component
const { toast } = useToast()

<Button onClick={() => toast({
  title: "Case created",
  description: "Case #2024-001 has been created.",
  variant: "success",
})}>
  Create Case
</Button>

// With action
toast({
  title: "Document deleted",
  description: "The document has been moved to trash.",
  action: <ToastAction altText="Undo">Undo</ToastAction>,
})
```

### Done when

- Toasts appear in bottom-right
- Auto-dismiss works with progress
- Swipe to dismiss works
- All variants styled correctly
- Max 3 visible, others queued
- `useToast` hook and `toast()` function work
