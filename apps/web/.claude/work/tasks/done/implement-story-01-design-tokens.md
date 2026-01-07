# Implementation: Design Tokens

**Status**: Complete
**Date**: 2025-12-29
**Input**: `stories/story-01-design-tokens.md`
**Next step**: `/commit` or more work

---

## Summary

- [x] All tasks completed
- [x] Type-check passing
- [x] Build passing

## Files Changed

| File                | Action   | Purpose                                                   |
| ------------------- | -------- | --------------------------------------------------------- |
| src/app/globals.css | Modified | Added spacing, typography, radius, shadow, z-index tokens |
| tailwind.config.js  | Modified | Exposed new tokens as Tailwind utilities                  |

## Task Completion Log

- [x] Add spacing scale tokens - Added `--linear-space-{xs,sm,md,lg,xl,2xl}` (4px-32px)
- [x] Add typography scale tokens - Added `--linear-text-{xs,sm,base,lg,xl,2xl}` (11px-20px) and `--linear-leading-{tight,normal,relaxed}`
- [x] Add border radius tokens - Added `--linear-radius-{sm,md,lg,xl,full}` (4px-9999px)
- [x] Add shadow tokens - Added `--linear-shadow-{sm,md,lg}` with light/dark theme variants
- [x] Add z-index scale tokens - Added `--linear-z-{dropdown,sticky,modal,popover,tooltip}` (50-150)
- [x] Update Tailwind config - Exposed all tokens as utility classes

## Tokens Added

### Spacing Scale (`:root`)

```css
--linear-space-xs: 4px;
--linear-space-sm: 8px;
--linear-space-md: 12px;
--linear-space-lg: 16px;
--linear-space-xl: 24px;
--linear-space-2xl: 32px;
```

### Typography Scale (`:root`)

```css
--linear-text-xs: 11px;
--linear-text-sm: 12px;
--linear-text-base: 13px;
--linear-text-lg: 14px;
--linear-text-xl: 16px;
--linear-text-2xl: 20px;

--linear-leading-tight: 1.25;
--linear-leading-normal: 1.5;
--linear-leading-relaxed: 1.625;
```

### Border Radius (`:root`)

```css
--linear-radius-sm: 4px;
--linear-radius-md: 6px;
--linear-radius-lg: 8px;
--linear-radius-xl: 12px;
--linear-radius-full: 9999px;
```

### Shadows (theme-aware)

Light theme:

```css
--linear-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.1);
--linear-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.15), 0 2px 4px -2px rgb(0 0 0 / 0.15);
--linear-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.2), 0 4px 6px -4px rgb(0 0 0 / 0.2);
```

Dark theme (deeper shadows):

```css
--linear-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
--linear-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4);
--linear-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5);
```

### Z-Index Scale (`:root`)

```css
--linear-z-dropdown: 50;
--linear-z-sticky: 60;
--linear-z-modal: 100;
--linear-z-popover: 110;
--linear-z-tooltip: 150;
```

## Tailwind Utilities Available

| Category      | Classes                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| Spacing       | `p-linear-xs`, `m-linear-sm`, `gap-linear-md`, etc.                       |
| Font Size     | `text-linear-xs`, `text-linear-base`, `text-linear-2xl`, etc.             |
| Line Height   | `leading-linear-tight`, `leading-linear-normal`, `leading-linear-relaxed` |
| Border Radius | `rounded-linear-sm`, `rounded-linear-md`, `rounded-linear-full`, etc.     |
| Box Shadow    | `shadow-linear-sm`, `shadow-linear-md`, `shadow-linear-lg`                |
| Z-Index       | `z-linear-dropdown`, `z-linear-modal`, `z-linear-tooltip`, etc.           |

## Issues Encountered

None - implementation was straightforward.

## Next Step

Run `/commit` to commit changes, or continue with more work.
