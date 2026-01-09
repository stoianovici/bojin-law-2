# Handoff: [OPS-010] Emails synced but not displayed (1049 emails)

**Session**: 2
**Date**: 2025-12-12
**Status**: Fixing (ready for deployment)

## Work Completed This Session

1. **Identified Root Cause**: The `emailViewMode` filter in `communication.store.ts` defaults to `'received'`, which hides threads where all messages have `senderEmail` matching the user's email. The filter state is persisted in localStorage.

2. **Implemented Fix 1**: Changed default `emailViewMode` from `'received'` to `'all'` in `communication.store.ts` line 111.

3. **Implemented Fix 2**: Added debug logging to `getFilteredThreads()` to show thread counts before/after each filter step.

4. **Implemented Fix 3**: Added debug logging to `communications/page.tsx` to show apiThreads count from GraphQL.

5. **Verified Build**: Build passes successfully.

## Current State

- Fix is implemented and ready for deployment
- New users will see all emails by default
- Existing users with localStorage may still have `'received'` persisted - they need to click "Toate" tab or clear localStorage

## Blockers/Questions

None - fix is ready for deployment.

## Next Steps

1. **Deploy to production** - Run `pnpm deploy:production` or deploy via Render dashboard
2. **Verify in production** - Check that emails display after deployment
3. **If still not working for existing users**: Instruct them to either:
   - Click "Toate" tab in FilterBar
   - OR clear localStorage: `localStorage.removeItem('communication-filters')` and refresh

## Key Files

| File                                         | Change                                                      |
| -------------------------------------------- | ----------------------------------------------------------- |
| `apps/web/src/stores/communication.store.ts` | Changed default emailViewMode to 'all', added debug logging |
| `apps/web/src/app/communications/page.tsx`   | Added debug logging for apiThreads                          |

## Debug Commands for Browser Console

```javascript
// Check current filter state
JSON.parse(localStorage.getItem('communication-filters'));

// Reset filter to fix display issue
localStorage.removeItem('communication-filters');
location.reload();

// Check Zustand store state
// (may need to be run in React DevTools or find the store reference)
```
