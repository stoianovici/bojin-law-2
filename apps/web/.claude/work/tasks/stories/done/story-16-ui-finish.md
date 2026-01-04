# Story 16: UI Components Finish

**Parallelizable with**: NONE - run after all other Phase 1 stories complete
**Depends on**: Stories 01-15 complete
**Blocks**: Phase 2 (Auth), Phase 3 (Layout)

---

## Task 1: Install Missing Radix Dependencies

**Action**: Run bash command

```bash
pnpm add @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-popover \
         @radix-ui/react-separator @radix-ui/react-scroll-area @radix-ui/react-avatar
```

### Done when

- All packages installed
- No peer dependency warnings
- `pnpm install` succeeds

---

## Task 2: Create UI Component Barrel Export

**File**: `src/components/ui/index.ts` (CREATE)

### Do

Create barrel export file for all UI components:

```typescript
// Core components
export * from './Button';
export * from './Input';
export * from './Card';
export * from './Badge';
export * from './Avatar';

// Overlay components
export * from './Dialog';
export * from './DropdownMenu';
export * from './Tooltip';
export * from './Toast';
export * from './Popover';

// Form components
export * from './Select';
export * from './Tabs';

// Utility components
export * from './ScrollArea';
export * from './Separator';
```

### Done when

- All exports compile without errors
- Can import from `@/components/ui`:
  ```typescript
  import { Button, Input, Card, Badge } from '@/components/ui';
  ```

---

## Task 3: Verify Build

**Action**: Run build check

```bash
pnpm type-check && pnpm build
```

### Done when

- No TypeScript errors
- Build succeeds
- All components properly typed
