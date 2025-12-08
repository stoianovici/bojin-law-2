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

## 11. Git Commit and Push

After documenting the resolution:

1. **Check for uncommitted changes**:
   - Run `git status` to see if there are changes related to this fix

2. **If there are uncommitted changes**:
   - Show the user what files have changed
   - Ask: "Commit these changes for OPS-XXX? (y/n)"
   - If yes, stage relevant files and commit with message:

     ```
     fix: {brief description} (OPS-XXX)

     Root cause: {root cause summary}
     Resolution: {fix summary}

     🤖 Generated with [Claude Code](https://claude.com/claude-code)

     Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
     ```

3. **Ask about pushing**:
   - "Push to remote? (y/n)"
   - If yes: `git push`

4. **Record in ops log**:
   - Add commit hash to Fix Applied section
   - Note push status

## 12. Report Summary

```
## Issue Closed: [OPS-XXX] {title}

**Resolution**: {summary}
**Total Sessions**: {n}
**Duration**: {created date} to {today}
**Commit**: {hash or "no changes"}
**Pushed**: {yes/no/n/a}

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
