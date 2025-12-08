# Operations Verification Task

Systematic verification workflow after applying a fix.

## Prerequisites

- Issue has "Fix Applied" documented
- Code changes have been made
- Ready to verify the fix works

## Verification Workflow

### Phase 1: Direct Verification

1. **Reproduce Original Issue**
   - Follow the original reproduction steps
   - Confirm the issue NO LONGER occurs
   - Document: "Original issue: {PASS/FAIL}"

2. **Verify Expected Behavior**
   - Confirm the feature works as expected
   - Test happy path scenarios
   - Document: "Expected behavior: {PASS/FAIL}"

### Phase 2: Regression Testing

1. **Run Automated Tests**

   ```bash
   # Run relevant test suites
   npm test
   # Or specific tests related to the fix
   npm test -- --grep "{relevant pattern}"
   ```

   - Document: "Automated tests: {PASS/FAIL} ({n} passed, {m} failed)"

2. **Run Linting/Type Checks**

   ```bash
   npm run lint
   npm run type-check  # or tsc --noEmit
   ```

   - Document: "Lint/Types: {PASS/FAIL}"

3. **Manual Regression Check**
   - Test related features that could be affected
   - List features tested and results

### Phase 3: Edge Cases

Test edge cases relevant to the fix:

| Scenario      | Expected   | Actual   | Status    |
| ------------- | ---------- | -------- | --------- |
| {edge case 1} | {expected} | {actual} | PASS/FAIL |
| {edge case 2} | {expected} | {actual} | PASS/FAIL |
| ...           | ...        | ...      | ...       |

### Phase 4: Performance Check (if applicable)

If the fix could impact performance:

- Check page load times
- Check API response times
- Check memory usage
- Document any changes

### Phase 5: Documentation

Verify documentation is updated if needed:

- [ ] Code comments updated
- [ ] README updated (if applicable)
- [ ] API docs updated (if applicable)
- [ ] Changelog updated

## Verification Checklist

```markdown
## Verification Results for [OPS-XXX]

### Core Verification

- [ ] Original issue no longer reproduces
- [ ] Expected behavior confirmed working
- [ ] Automated tests pass
- [ ] Lint/type checks pass

### Regression Testing

- [ ] Related features still work
- [ ] No new errors in console/logs
- [ ] No UI/UX regressions

### Edge Cases

- [ ] {edge case 1}: {result}
- [ ] {edge case 2}: {result}

### Final Status

**Verification**: PASS / FAIL / PARTIAL

**Notes**: {any additional notes}

**Ready for**: Production / Needs more testing / Needs fix revision
```

## If Verification Fails

1. **Document What Failed**
   - Which specific check failed?
   - What was expected vs actual?

2. **Assess Severity**
   - Is it a minor issue or does the fix need revision?
   - Is the original issue fixed but new issue introduced?

3. **Next Steps**
   - Return to "Fixing" status if fix needs revision
   - Create new issue if new bug discovered
   - Proceed to close if minor/known issue

## Output

Update the ops log issue with:

- [ ] Verification results in Session Log
- [ ] Status updated to "Resolved" if passing
- [ ] Any new issues documented
