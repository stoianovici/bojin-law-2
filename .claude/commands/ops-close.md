# Close Operations Issue

Close a resolved operations issue with proper documentation.

## 1. Read Current State

Read `docs/ops/operations-log.md`

## 2. Identify Issue to Close

The user's input is: $ARGUMENTS

**If issue ID provided** (e.g., "OPS-003"):

- Find that specific issue

**If no issue ID**:

- Show issues in "Verifying" status
- Ask user to confirm which to close

## 3. Verify Completeness

Before closing, verify the issue has:

- [ ] Root Cause documented
- [ ] Fix Applied documented
- [ ] Session Log with resolution details
- [ ] Files Involved listed

If any are missing, prompt user to provide them.

## 4. Gather Resolution Details

Ask user (if not already documented):

1. **Resolution Summary**: One-line summary of how it was fixed
2. **Lessons Learned**: Anything to note for future reference
3. **Follow-up Needed?**: Any related issues to create?

## 5. Update Issue

Update the issue entry:

```markdown
| **Status** | Resolved |
| **Resolved Date** | {today} |
| **Resolution** | {summary} |
```

Add final Session Log entry:

```
- [{timestamp}] RESOLVED: {resolution summary}. Total sessions: {n}. Lessons: {lessons}
```

## 6. Move Issue

Move the entire issue block from "Active Issues" or "In Progress" to the "Resolved" section.

## 7. Update Quick Reference

Update the status in the Quick Reference table to "Resolved".

## 8. Add to Session History

Add entry to Session History table:

```
| {date} | OPS-XXX | {total sessions} | Resolved: {brief summary} |
```

## 9. Clean Up Handoff Files

Optionally archive or note that handoff files for this issue can be cleaned up:

- `.ai/ops-{issue-id}-handoff.md` - Can be deleted or archived

## 10. Create Follow-up Issues (if needed)

If user mentioned follow-up work needed:

- Ask if they want to create a new issue now
- Offer to run `/ops-new` with suggested title

## 11. Remind About Code Changes

**DO NOT automatically commit or push.** Deployment should be on-demand only.

If there are uncommitted code changes:

1. **Run `git status`** to check for uncommitted changes
2. **Inform the user** about any uncommitted changes
3. **Remind them** they can use:
   - `/ops-commit` - to commit and push changes when ready
   - `/ops-deploy` - to deploy to production when ready

## 12. Report Summary

```
## Issue Closed: [OPS-XXX] {title}

**Resolution**: {summary}
**Total Sessions**: {n}
**Duration**: {created date} to {today}
**Commit**: {hash or "no changes"}
**Pushed**: {yes/no/n/a}
**Deployed**: {yes/no/pending}

### Lessons Learned
{lessons}

### Follow-up
{any follow-up issues created or noted}
```

## Important Rules

- Never close without proper documentation
- Root Cause and Fix Applied are required fields
- Preserve the full history in the Resolved section
- Lessons Learned help future debugging - encourage users to fill this in
- Always offer to commit/push when closing - fixes should be tracked in git
