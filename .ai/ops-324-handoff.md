# [OPS-324] Mobile Component Polish

## State

All mobile components now use Linear design tokens consistently. Implementation is complete and ready for verification.

## Done This Session

### Token Migration (4 components fixed)
1. **BriefCard.tsx** - Replaced light-mode colors (`gray-*`, `blue-*`, `bg-white`) with Linear tokens
2. **AssistantSheet.tsx** - Replaced `gray-*`, `bg-white` with Linear tokens
3. **MobileHeader.tsx** - Replaced `gray-*`, `blue-*`, `bg-white` with Linear tokens
4. **BriefFeed.tsx** - Replaced `gray-*`, `blue-*` with Linear tokens

### Touch Target Fixes (44px minimum)
- `MobileHome.tsx` - Avatar button: 36px → 44px (`w-11 h-11`)
- `MobileHeader.tsx` - Menu, search, avatar buttons all now 44x44px
- `MobileDrawer.tsx` - Close button, nav items, footer links all have `min-h-[44px]`
- `AssistantSheet.tsx` - Close button now 44x44px

### Active States Added
- All interactive elements now have `active:scale-[0.98]` or `active:scale-95` for tactile feedback
- Consistent `active:bg-linear-bg-tertiary` on hover areas

### Components Already Correct (no changes needed)
- `MobileTabBar.tsx` - Correct tokens, safe areas, touch targets
- `MobileDrawer.tsx` - Correct tokens, spring animations
- `MobileHome.tsx` - Correct tokens, safe area handling
- `BriefRow.tsx` - Correct tokens, active states
- `AssistantFAB.tsx` - Correct gradient, 56px touch target
- `MobileBriefing.tsx` - Correct tokens
- `SectionHeading.tsx` - Correct tokens
- `FeedSection.tsx` - Correct tokens

## Next Steps

1. **Visual Verification** - Test on mobile device or Chrome DevTools mobile emulation
   - Check all components render correctly with Linear dark theme
   - Verify touch targets are adequately sized
   - Confirm active states provide visual feedback

2. **Close Issue** - If verification passes, update status to "Done"

## Key Files

- `apps/web/src/components/mobile/BriefCard.tsx` - Token migration
- `apps/web/src/components/mobile/AssistantSheet.tsx` - Token migration + touch target
- `apps/web/src/components/mobile/MobileHeader.tsx` - Token migration + touch targets
- `apps/web/src/components/mobile/BriefFeed.tsx` - Token migration
- `apps/web/src/components/mobile/MobileHome.tsx` - Touch target fix
- `apps/web/src/components/mobile/MobileDrawer.tsx` - Touch targets + active states
- `docs/design/linear-style-tokens.md` - Reference for token values
- `docs/design/linear-style-mobile-mockup.html` - Reference for patterns
