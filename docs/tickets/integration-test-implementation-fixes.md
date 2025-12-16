# Integration Test Implementation Fixes

**Created:** 2025-11-22
**Type:** Technical Debt / Test Quality
**Priority:** Low-Medium (Non-Blocking)
**Labels:** test-implementation-fix, technical-debt, integration-tests
**Related Stories:** 2.8, 2.8.3
**Related Issue:** INFRA-001 (Infrastructure - RESOLVED)

---

## Context

Following the resolution of infrastructure issue INFRA-001, all 49 integration tests for Stories 2.8 and 2.8.3 are now **executable**. However, 47 tests (95.9%) are failing due to **test implementation issues**, not infrastructure problems.

**Infrastructure Status:** ✅ RESOLVED
**Test Execution:** ✅ All tests executable
**Test Pass Rate:** 4.1% (2/49 passing)

---

## Root Cause

After migrating from MSW v2.x to MSW v1.x to resolve infrastructure issues, the GraphQL mock handlers need to be updated with correct mock data and response configurations.

**Common Failure Patterns:**

1. **GraphQL 500 Errors:** Handlers returning 500 errors instead of mock data
2. **Missing Mock Data:** Tests expecting specific responses that aren't configured
3. **Mock Data Mismatches:** Mock responses not matching test expectations
4. **Timing Issues:** `waitFor` timeouts due to incorrect mock setups

---

## Failing Tests Summary

### Story 2.8: Case CRUD Operations UI (34 failing tests)

#### `page.integration.test.tsx` (3 failures)

- ❌ "should complete full case creation flow: open modal → fill form → submit → verify in list"
  - **Cause:** GraphQL returning 500 error instead of case list mock data
- ❌ "should show validation errors when form is submitted with invalid data"
  - **Cause:** GraphQL returning 500 error
- ❌ "should close modal without submitting when cancel button is clicked"
  - **Cause:** GraphQL returning 500 error

#### `[caseId]/page.integration.test.tsx` (10 failures)

- ❌ "should load and display case details with all related data"
  - **Cause:** GraphQL returning 500 error instead of case detail mock data
- ❌ "should display loading state while fetching case data"
  - **Cause:** GraphQL mock timing issue
- ❌ "should handle case not found (404) gracefully"
  - **Cause:** GraphQL mock not configured for error scenario
- ❌ "should edit case title: click field → edit → save → verify update"
  - **Cause:** GraphQL mutation mock returning 500 error
- ❌ "should cancel inline edit when Escape key is pressed"
  - **Cause:** GraphQL query mock returning 500 error
- ❌ "should validate field changes before submission"
  - **Cause:** GraphQL query mock returning 500 error
- ❌ "should add a team member to the case"
  - **Cause:** GraphQL mutation mock returning 500 error
- ❌ "should remove a team member with confirmation"
  - **Cause:** GraphQL mutation mock returning 500 error
- ❌ "should add a case actor"
  - **Cause:** GraphQL mutation mock returning 500 error
- ❌ "should update actor details inline"
  - **Cause:** GraphQL mutation mock returning 500 error

#### `search-and-filters.integration.test.tsx` (11 failures)

All tests failing due to GraphQL search/filter mock handlers not returning correct data:

- ❌ "should search cases: type query → verify results → select case → navigate"
- ❌ "should highlight matching text in search results"
- ❌ "should show 'No results found' when search returns empty"
- ❌ "should handle minimum 3 character query requirement"
- ❌ "should filter cases by status"
- ❌ "should filter cases by 'Assigned to Me'"
- ❌ "should persist filters in URL query parameters"
- ❌ "should restore filters from URL query parameters on page load"
- ❌ "should clear all filters when 'Clear Filters' button is clicked"
- ❌ "should combine status filter and assigned to me filter"
- ❌ "should show filtered empty state when no cases match filters"

#### `archival-and-authorization.integration.test.tsx` (10 failures)

All tests failing due to GraphQL mock handlers not configured for different user roles:

- ❌ "should archive case: open case → archive → confirm → verify status"
- ❌ "should disable archive button when case status is not Closed"
- ❌ "should handle archive mutation error (BAD_USER_INPUT)"
- ❌ "should hide archive button for Associate role"
- ❌ "should hide archive button for Paralegal role"
- ❌ "should show archive button for Partner role"
- ❌ "should handle FORBIDDEN error when non-Partner attempts to archive"
- ❌ "should hide team management controls for Paralegal role"
- ❌ "should show team management controls for Partner and Associate roles"
- ❌ "should allow editing for all roles (backend enforces restrictions)"

---

### Story 2.8.3: Role-Based Financial Visibility (13 failures)

#### `financial-visibility.integration.test.tsx` (13 failures)

All tests failing due to GraphQL mock handlers not returning role-specific financial data:

- ❌ "should display case value for Partner users"
- ❌ "should display billing information section for Partner users"
- ❌ "should hide case value from Associate users"
- ❌ "should hide all financial fields from Associate users (AC2)"
- ❌ "should render nothing for financial components (AC3 - no 'Permission Denied' messages)"
- ❌ "should hide case value from Paralegal users"
- ❌ "should provide clean interface for Paralegals without financial clutter (AC3)"
- ❌ "should render clean layout for Associate (no empty gaps where financial data would be)"
- ❌ "should maintain consistent layout between Partner and Associate views"
- ❌ "should complete full Partner workflow: navigate to case → see all data including financials"
- ❌ "should complete full Associate workflow: navigate to case → see case data WITHOUT financials"
- ❌ "should handle null financial fields gracefully when returned by backend (AC4)"
- ❌ "should not break query execution when financial fields denied (AC4)"

---

## Recommended Fix Approach

### Phase 1: Review MSW v1 Handler Configuration (2-3 hours)

1. Review `apps/web/src/test-utils/mocks/graphql-handlers.ts`
2. Verify all handlers use correct MSW v1.x syntax:
   ```javascript
   graphql.query('GetCases', (req, res, ctx) => {
     return res(ctx.data({ cases: mockCases }));
   });
   ```
3. Check for handlers that need mock data updates

### Phase 2: Fix Core Mock Data (4-6 hours)

1. **Case List Queries:** Fix `GetCases` handler to return proper mock data
2. **Case Detail Queries:** Fix `GetCase` handler with complete case data
3. **Mutations:** Fix `CreateCase`, `UpdateCase`, `ArchiveCase` handlers
4. **Search/Filters:** Configure handlers for search and filter scenarios
5. **Role-Based Data:** Configure handlers to return different data based on user role in context

### Phase 3: Test-Specific Fixes (6-10 hours)

1. Run tests in small groups (by file)
2. Fix mock data mismatches for each test
3. Add error scenario handlers (404, 403, validation errors)
4. Configure timing for loading state tests

### Phase 4: Validation (2-3 hours)

1. Run full integration test suite
2. Target: 80%+ pass rate
3. Document any remaining failures
4. Update story files with final pass rates

---

## Success Criteria

**Must Have:**

- [ ] All GraphQL handlers return valid mock data (not 500 errors)
- [ ] Case list and detail tests passing (>80% pass rate)
- [ ] Search and filter tests passing (>80% pass rate)
- [ ] Role-based tests (archival, financial visibility) passing (>80% pass rate)
- [ ] Overall integration test pass rate >80% (40+ of 49 tests passing)

**Nice to Have:**

- [ ] 95%+ integration test pass rate (47+ of 49 tests passing)
- [ ] All error scenarios properly tested
- [ ] Performance of mock handlers verified (no slow tests)

---

## Estimated Effort

**Total:** 14-22 hours

**Breakdown:**

- Review and analysis: 2-3 hours
- Mock data fixes: 4-6 hours
- Individual test fixes: 6-10 hours
- Validation and documentation: 2-3 hours

**Recommended:** Split across 2-3 sprints as low-priority tech debt work

---

## Impact Assessment

**Blocking:** No - Infrastructure debt already cleared
**User Impact:** None - Internal test quality issue
**Risk if Not Fixed:** Medium - Integration test coverage gap reduces confidence in refactoring and feature changes

**Benefits of Fixing:**

- Full integration test coverage for critical user workflows
- Confidence in refactoring and feature changes
- Automated validation of GraphQL API integration
- Better developer experience with working tests

---

## Files to Modify

**Primary:**

- `apps/web/src/test-utils/mocks/graphql-handlers.ts` - Update all mock handlers

**Secondary (if needed):**

- Individual test files may need assertion updates
- Mock data fixtures may need expansion

---

## Notes

- This work is **non-blocking** - infrastructure issue is resolved
- Tests are comprehensive and well-written - just need mock data fixes
- Some test failures may reveal actual bugs in components (validate during fixes)
- Consider adding mock data factory utilities to make maintenance easier
- MSW v1.x is stable - no infrastructure risk in fixing these tests

---

## Related Documentation

- Integration test infrastructure fix: `docs/remediation-plans/jest-msw-integration-tests-fix.md`
- MSW v1 documentation: https://v1.mswjs.io/docs/
- Story 2.8: `docs/stories/2.8.story.md`
- Story 2.8.3: `docs/stories/2.8.3.story.md`
