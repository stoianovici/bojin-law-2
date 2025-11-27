# Task: Validate Integration Tests After Infrastructure Fix

## Context

**Issue:** Infrastructure issue INFRA-001 blocked all integration tests (28+ tests) from executing due to Jest/MSW compatibility problems.

**Resolution:** Implemented Option 1 (MSW v1.x downgrade) - infrastructure is now working and integration tests are executable.

**Your Mission:** Validate integration tests for Stories 2.8 and 2.8.3 that were previously blocked, document results, and update story files to clear technical debt.

---

## Background (What Happened)

1. **Previous State:**
   - Integration tests written but couldn't run (MSW v2.x ESM incompatibility)
   - Error: `Cannot find module 'until-async'`
   - Stories 2.8 and 2.8.3 marked "Ready for Review" but integration tests skipped

2. **Fix Applied:**
   - Downgraded MSW from v2.12.2 → v1.3.5 (CommonJS compatible)
   - Updated GraphQL handlers to MSW v1 syntax
   - Integration tests now executable ✅

3. **Current State:**
   - Infrastructure: ✅ Working
   - Integration tests: Written but not validated
   - Stories: Blocked from "Done" until tests validated

---

## Stories Requiring Validation

### **Story 2.8: Case CRUD Operations UI**
- **Location:** `docs/stories/2.8.story.md`
- **Integration Test Files:**
  - `apps/web/src/app/cases/page.integration.test.tsx`
  - `apps/web/src/app/cases/[caseId]/page.integration.test.tsx`
  - `apps/web/src/app/cases/search-and-filters.integration.test.tsx`
  - `apps/web/src/app/cases/[caseId]/archival-and-authorization.integration.test.tsx`
- **Test Count:** ~13-15 tests

### **Story 2.8.3: Role-Based Financial Visibility**
- **Location:** `docs/stories/2.8.3.story.md`
- **Integration Test Files:**
  - `apps/web/src/app/cases/[caseId]/financial-visibility.integration.test.tsx`
- **Test Count:** ~8-10 tests

---

## Your Tasks (Follow in Order)

### Phase 1: Run Integration Tests (30 min)

1. **Navigate to web app:**
   ```bash
   cd apps/web
   ```

2. **Run ALL integration tests:**
   ```bash
   pnpm test integration.test
   ```

3. **Capture results:**
   - Total tests executed
   - Total passing
   - Total failing
   - Specific test names that failed (if any)

4. **Run Story 2.8 tests specifically:**
   ```bash
   pnpm test page.integration.test
   pnpm test search-and-filters.integration.test
   pnpm test archival-and-authorization.integration.test
   ```

5. **Run Story 2.8.3 tests:**
   ```bash
   pnpm test financial-visibility.integration.test
   ```

6. **Document Results:**
   - Create a summary: "X of Y tests passed (Z% pass rate)"
   - List any failing tests with error messages
   - Note: Some failures are expected (test implementation issues, not infrastructure)

---

### Phase 2: Analyze Failures (If Any) (30-60 min)

**IMPORTANT:** Distinguish between two types of failures:

#### Type A: Infrastructure Failures (CRITICAL - Reopen if found)
- MSW not loading
- Module import errors
- "Cannot find module" errors
- Test files not executing at all

#### Type B: Test Implementation Failures (EXPECTED - Normal debugging)
- Assertions failing (expected value vs actual)
- Mock data mismatches
- Timing issues (waitFor timeouts)
- Element not found in DOM

**Action for Type A:** Report immediately - infrastructure fix incomplete
**Action for Type B:** Document and fix as separate task (not blocking)

---

### Phase 3: Update Story Files (15-30 min)

For **Story 2.8** (`docs/stories/2.8.story.md`):

1. Find the QA Results or Testing section
2. Add integration test validation results:
   ```markdown
   ### Integration Test Validation (2025-11-22)

   **Infrastructure Status:** ✅ Fixed (MSW v1.3.5)
   **Tests Executed:** X/Y integration tests
   **Pass Rate:** Z%

   **Passing Tests:**
   - ✅ Case creation flow
   - ✅ Case detail page operations
   - [list all passing]

   **Failing Tests (Test Implementation Issues):**
   - ❌ Test name - Reason: assertion mismatch
   - [list with brief reason]

   **Next Steps:**
   - Infrastructure debt cleared ✅
   - Test implementation fixes tracked in [ticket reference]
   ```

3. Update story status if needed:
   - If >80% tests pass: Mark as "Ready for Done" ✅
   - If <80% tests pass: Keep in "Ready for Review", create follow-up task

For **Story 2.8.3** - Follow same process

---

### Phase 4: Update QA Gates (15 min)

Update these files:

1. **`docs/qa/gates/2.8-case-crud-operations-ui.yml`**
   - Add integration test results
   - Mark gate as passed/failed based on criteria

2. **`docs/qa/gates/2.8.3-role-based-financial-visibility.yml`**
   - Add integration test results
   - Mark gate as passed/failed based on criteria

---

### Phase 5: Update Remediation Plan (10 min)

**File:** `docs/remediation-plans/jest-msw-integration-tests-fix.md`

Add to the end of "Implementation Summary":

```markdown
## Post-Implementation Validation (2025-11-22)

### Integration Test Execution Results

**Story 2.8:**
- Tests run: X
- Tests passed: Y
- Pass rate: Z%
- Status: ✅ Technical debt cleared

**Story 2.8.3:**
- Tests run: X
- Tests passed: Y
- Pass rate: Z%
- Status: ✅ Technical debt cleared

### Debt Clearance Confirmation

- [x] All integration tests executable (infrastructure working)
- [x] Story 2.8 integration tests validated
- [x] Story 2.8.3 integration tests validated
- [ ] Test implementation fixes tracked (if needed)
- [x] Stories unblocked for "Done"

**Conclusion:** Infrastructure issue INFRA-001 is fully resolved. Any remaining test failures are normal test implementation debugging work, not infrastructure debt.
```

---

### Phase 6: Create Follow-up Tasks (If Needed) (15 min)

**Only if there are Type B failures (test implementation issues):**

Create tickets for fixing individual failing tests:
- Title: "Fix integration test: [test name]"
- Description: Test failure details
- Priority: Low-Medium (not blocking)
- Label: "test-implementation-fix"

---

## Success Criteria

✅ **Must Have:**
- [ ] All integration tests executed (no infrastructure errors)
- [ ] Results documented in story files
- [ ] QA gates updated
- [ ] Remediation plan marked complete
- [ ] Stories 2.8 and 2.8.3 unblocked

✅ **Nice to Have:**
- [ ] 80%+ integration test pass rate
- [ ] All Type B failures documented with tickets
- [ ] Team notified of validation completion

---

## Expected Outcomes

**Likely Scenario (80% of cases):**
- Infrastructure: ✅ Works perfectly
- Pass rate: 60-80% (some test implementation issues)
- Action: Document failures, create follow-up tickets, unblock stories

**Best Case (20% chance):**
- Infrastructure: ✅ Works perfectly
- Pass rate: 95-100% (all tests pass)
- Action: Mark stories "Done", celebrate! 🎉

**Worst Case (<5% chance):**
- Infrastructure: ❌ Still has issues
- Pass rate: <20% (critical failures)
- Action: Reopen INFRA-001, escalate to James

---

## Important Notes

1. **Don't be discouraged by test failures** - They're normal! Distinguish infrastructure vs implementation issues.

2. **Speed matters** - This validation should take 2-3 hours max. Don't spend days debugging individual tests.

3. **The goal is debt clearance** - Proving infrastructure works is the win. Test implementation fixes are separate work.

4. **Communication** - Update stakeholders when done:
   - Tech Lead: "Integration tests unblocked, X% passing"
   - QA: "Ready for final validation on Stories 2.8 and 2.8.3"
   - Team: "Integration test infrastructure fixed, feel free to run"

---

## Files You'll Modify

1. `docs/stories/2.8.story.md` - Add integration test results
2. `docs/stories/2.8.3.story.md` - Add integration test results
3. `docs/qa/gates/2.8-case-crud-operations-ui.yml` - Update gate status
4. `docs/qa/gates/2.8.3-role-based-financial-visibility.yml` - Update gate status
5. `docs/remediation-plans/jest-msw-integration-tests-fix.md` - Add validation results
6. (Optional) Create follow-up task files for test fixes

---

## Commands Reference

```bash
# Navigate to web app
cd apps/web

# Run all integration tests
pnpm test integration.test

# Run specific test file
pnpm test page.integration.test.tsx

# Run tests with verbose output
pnpm test integration.test --verbose

# Run tests and show full error messages
pnpm test integration.test --no-coverage

# Check test file count
find src -name "*.integration.test.tsx" | wc -l
```

---

## Questions? Issues?

- Infrastructure still broken? → Tag @James (implemented the fix)
- Unclear test results? → Check `apps/web/src/app/cases/INTEGRATION_TESTS_README.md`
- QA gate format unclear? → Reference existing gates in `docs/qa/gates/`
- Story update format unclear? → Look at Story 2.7 for example

---

**Ready? Let's clear this technical debt! 🚀**
