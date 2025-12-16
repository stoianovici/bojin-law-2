# Close Operations Issue

Close a resolved operations issue with proper documentation.

**IMPORTANT**: This command REQUIRES local verification to be complete. Cannot close unverified issues. See `ops-protocol.md` for details.

## 1. Read Current State

Read in parallel:

- `docs/ops/operations-log.md`
- `.claude/commands/ops-protocol.md` - Verification gate protocol

## 2. Identify Issue to Close

The user's input is: $ARGUMENTS

**If issue ID provided** (e.g., "OPS-003"):

- Find that specific issue

**If no issue ID**:

- Show issues in "Verifying" status
- Ask user to confirm which to close

## 3. MANDATORY: Check Local Verification Status

**Before closing, check the issue's Local Verification Status.**

**If NOT all three steps are ✅, BLOCK closing:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 CANNOT CLOSE - VERIFICATION INCOMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This issue cannot be closed until local verification is complete.

Current verification status:
| Step | Status |
|------|--------|
| Prod data test | {✅/⬜/❌} |
| Preflight | {✅/⬜/❌} |
| Docker test | {✅/⬜/❌} |

Missing steps:
{List any that are not ✅}

To complete verification:

Step 1: Test with production data
  $ source .env.prod && pnpm dev
  → Test the specific fix/feature with real data

Step 2: Run preflight checks
  $ pnpm preflight:full
  → Must pass with no errors

Step 3: Test in production Docker
  $ pnpm preview
  → Test the fix/feature in production-identical environment

After completing all steps, run `/ops-close` again.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**DO NOT proceed with closing if verification is incomplete.**

The only exception is if user explicitly confirms override:

```
⚠️ OVERRIDE: Close without verification?

You are trying to close an issue without complete local verification.
This means the fix/feature is NOT guaranteed to work in production.

This should ONLY be done if:
- The issue was resolved by non-code means (configuration, etc.)
- The issue is being closed as "won't fix"
- The issue is a duplicate

Reason for override (required): ___

Are you sure? (yes/no)
```

If overridden, log: `- [{timestamp}] ⚠️ CLOSED WITHOUT VERIFICATION. Reason: {reason}`

## 4. Verify Completeness

Once verification is confirmed, check the issue has:

- [ ] Root Cause documented (for bugs)
- [ ] Fix Applied / Implementation documented
- [ ] Session Log with resolution details
- [ ] Files Involved listed
- [ ] Local Verification Status all ✅

If any are missing, prompt user to provide them.

## 5. Gather Resolution Details

Ask user (if not already documented):

1. **Resolution Summary**: One-line summary of how it was fixed
2. **Lessons Learned**: Anything to note for future reference
3. **Follow-up Needed?**: Any related issues to create?

## 6. Check for Pattern Library Update

If this issue revealed a new root cause pattern:

```
This issue's root cause was: {root cause}

Should this be added to docs/ops/root-cause-patterns.md?
- Yes, add to pattern library
- No, it's already covered
```

If yes, update the root cause patterns file.

## 7. Update Issue

Update the issue entry:

```markdown
| **Status** | Resolved |
| **Resolved Date** | {today} |
| **Resolution** | {summary} |
```

Update Local Verification Status to show completion:

```markdown
#### Local Verification Status

| Step           | Status | Date   | Notes                      |
| -------------- | ------ | ------ | -------------------------- |
| Prod data test | ✅     | {date} | Tested with real data      |
| Preflight      | ✅     | {date} | All checks passed          |
| Docker test    | ✅     | {date} | Works in production Docker |

**Verified**: Yes
```

Add final Session Log entry:

```
- [{timestamp}] RESOLVED: {resolution summary}. Total sessions: {n}.
  Verification: ✅ All passed (prod data, preflight, Docker)
  Lessons: {lessons}
```

## 8. Move Issue

Move the entire issue block from "Active Issues" to the "Resolved" section.

## 9. Update Quick Reference

Update the status in the Quick Reference table to "Resolved".

## 10. Clean Up Handoff Files

Archive or delete handoff files for this issue:

- `.ai/ops-{issue-id}-handoff.md` - Can be deleted or archived

## 11. Create Follow-up Issues (if needed)

If user mentioned follow-up work needed:

- Ask if they want to create a new issue now
- Offer to run `/ops-new` with suggested title

## 12. Remind About Deployment

```
## Issue Closed - Deployment Reminder

This fix/feature has been verified locally and is ready for deployment.

Since deployments are batched, this change will be deployed along with
other verified changes when you next run `/ops-deploy`.

To deploy now: `/ops-deploy`
To see all pending verified changes: `git log origin/main..HEAD`

Remember: Changes pile up between deployments. All should be verified.
```

## 13. Report Summary

```
## Issue Closed: [OPS-XXX] {title}

**Resolution**: {summary}
**Total Sessions**: {n}
**Duration**: {created date} to {today}

### Local Verification (COMPLETE)
| Step | Status | Date |
|------|--------|------|
| Prod data test | ✅ | {date} |
| Preflight | ✅ | {date} |
| Docker test | ✅ | {date} |

**Guarantee**: This fix/feature WILL work in production.

### Commit/Deploy Status
**Committed**: {hash}
**Pushed**: {yes/no}
**Deployed**: {pending - will deploy with next batch}

### Lessons Learned
{lessons}

### Pattern Library
{Added to root-cause-patterns.md: yes/no}

### Follow-up
{any follow-up issues created or noted}
```

## Important Rules

- **CANNOT close without verification** - All three steps must be ✅
- **Override requires explicit reason** - And is logged
- **Root Cause and Fix Applied are required** - Don't close without them
- **Verified means production-ready** - The guarantee
- **Deployment is separate** - Closing doesn't deploy
- **Update pattern library** - Help future debugging sessions
