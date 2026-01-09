# OPS-314: Desktop MorningBriefing Card Invisible Text

**Root Cause**: Missing ShadCN CSS variable definitions for `bg-card` and `text-card-foreground`
**File**: `apps/web/src/components/ui/card.tsx:10`
**Fix**: Add CSS variables OR replace with explicit Tailwind classes

## Evidence

1. Card component uses `bg-card text-card-foreground` (line 10):

   ```tsx
   className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
   ```

2. These CSS variables are NOT defined anywhere:
   - `apps/web/src/app/globals.css` - no theme variables
   - `packages/ui/src/tokens/tokens.css` - has color tokens but not ShadCN-style
   - `apps/web/tailwind.config.js` - no card color mapping

3. Screenshot shows white/invisible text on the MorningBriefing card

## Quick Fix (Recommended)

Edit `apps/web/src/components/ui/card.tsx` line 10:

```tsx
// Change from:
className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}

// To:
className={cn('rounded-lg border bg-white text-gray-900 shadow-sm', className)}
```

## Full Fix (Better Long-term)

1. Add to `apps/web/src/app/globals.css`:

```css
@layer base {
  :root {
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
  }
}
```

2. Add to `apps/web/tailwind.config.js` theme.extend.colors:

```js
card: {
  DEFAULT: "hsl(var(--card))",
  foreground: "hsl(var(--card-foreground))",
},
```

## Next Steps

1. Apply quick fix to card.tsx
2. Test on localhost:3000 with Partner dashboard
3. Run `pnpm preflight`
