# Story 06: Avatar Component

**Parallelizable with**: All other Phase 1 stories (different files)
**Depends on**: Install `@radix-ui/react-avatar` first
**Blocks**: None

---

## Task: Create Avatar Component

**File**: `src/components/ui/Avatar.tsx` (CREATE)

### Do

Create Avatar component using Radix primitive:

```typescript
// Required exports:
export { Avatar, AvatarImage, AvatarFallback, AvatarGroup };
export type { AvatarProps };
```

**Sizes**:

- `xs` - `h-6 w-6 text-[10px]`
- `sm` - `h-8 w-8 text-xs`
- `md` - `h-10 w-10 text-sm` (default)
- `lg` - `h-12 w-12 text-base`

**Features**:

- Image with automatic fallback to initials
- `name` prop - Used to generate initials for fallback
- `src` prop - Image URL
- `status` prop - Optional indicator: `online` (green), `offline` (gray), `busy` (red)
- `AvatarGroup` - Overlapping avatars with `+N` overflow

**Sub-components**:

```tsx
// Uses @radix-ui/react-avatar
import * as AvatarPrimitive from '@radix-ui/react-avatar';
```

**Styling**:

- `rounded-full` always
- `bg-linear-bg-tertiary` for fallback background
- `text-linear-text-secondary` for initials
- Status indicator: absolute positioned dot

**Initials logic**:

```typescript
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
```

**AvatarGroup**:

- Stack avatars with negative margin overlap
- Show `+N` badge when exceeding `max` prop
- Default max: 4

### Example Usage

```tsx
<Avatar name="Ion Popescu" src="/avatars/ion.jpg" />
<Avatar name="Maria Ionescu" /> {/* Shows "MI" */}
<Avatar name="Admin" size="lg" status="online" />

<AvatarGroup max={3}>
  <Avatar name="User 1" />
  <Avatar name="User 2" />
  <Avatar name="User 3" />
  <Avatar name="User 4" />
  <Avatar name="User 5" />
</AvatarGroup>
{/* Shows 3 avatars + "+2" badge */}
```

### Done when

- Image loads with fallback on error
- Initials generated correctly from name
- All sizes render correctly
- Status indicator positioned correctly
- AvatarGroup overlaps and shows overflow count
