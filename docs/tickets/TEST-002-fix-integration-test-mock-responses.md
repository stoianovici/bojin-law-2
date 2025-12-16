# TEST-002: Fix Integration Test Mock Responses

**Type:** Bug / Infrastructure
**Priority:** High
**Status:** Open
**Sprint:** 2.9 (or dedicated infrastructure sprint)
**Created:** 2025-11-22
**Reporter:** Mary (Business Analyst)
**Assignee:** TBD
**Labels:** `testing`, `infrastructure`, `integration-tests`, `msw`, `jest`

---

## Related Issues

- **Parent Issue:** INFRA-001 - Jest/MSW Integration Tests Infrastructure Remediation
- **Remediation Plan:** `/docs/remediation-plans/jest-msw-integration-tests-fix.md`
- **Blocked Stories:** 2.8, 2.8.3, 2.8.4, 2.9+

---

## Summary

Configure Jest to properly handle MSW v2.x mock responses by enabling ES Module support, allowing 28+ integration tests to execute and validate GraphQL API mocking across all user workflows.

---

## Problem Statement

### Current State

- ✅ **Unit tests:** 221/221 passing (100% coverage)
- ❌ **Integration tests:** 28+ tests written but **0 executable**
- ❌ **Root cause:** Jest cannot transform `until-async` ES module from MSW dependencies

### Error Message

```
Cannot find module 'until-async' from 'node_modules/msw/...'
```

### Impact

- **Critical testing gap:** No validation of complete user workflows
- **Deployment risk:** Multi-component interactions untested
- **Technical debt:** Accumulating unexecutable test code

---

## Acceptance Criteria

### Must-Have

- [ ] Jest ESM mode configured and operational
- [ ] All 221 unit tests continue to pass (no regressions)
- [ ] All 28+ integration tests execute successfully
- [ ] MSW v2.x loads without errors
- [ ] GraphQL mock responses work correctly in tests
- [ ] Integration test pass rate ≥80%

### Nice-to-Have

- [ ] 100% integration test pass rate
- [ ] Test run time <1.5x current speed
- [ ] CI/CD pipeline automatically runs integration tests

---

## Technical Details

### Affected Test Files

```
apps/web/src/app/cases/page.integration.test.tsx
apps/web/src/app/cases/[caseId]/page.integration.test.tsx
apps/web/src/app/cases/search-and-filters.integration.test.tsx
apps/web/src/app/cases/[caseId]/archival-and-authorization.integration.test.tsx
apps/web/src/app/cases/[caseId]/financial-visibility.integration.test.tsx
+ All future integration tests
```

### Root Cause

- MSW v2.x is an ES Module package with `until-async` dependency
- Jest runs in CommonJS mode by default
- `transformIgnorePatterns` configuration insufficient for ESM transformation
- No alternative exists for realistic GraphQL API mocking without MSW

---

## Implementation Plan

### Recommended Solution: Enable Jest ESM Mode

_Refer to remediation plan Option 2 for full details_

### Phase 1: Configuration (2-3 hours)

**Tasks:**

1. Update `apps/web/jest.config.js` with ESM support:

   ```javascript
   const customJestConfig = {
     extensionsToTreatAsEsm: ['.ts', '.tsx'],
     transform: {
       '^.+\\.(ts|tsx)$': [
         '@swc/jest',
         {
           jsc: {
             parser: { syntax: 'typescript', tsx: true },
             transform: { react: { runtime: 'automatic' } },
           },
           module: { type: 'es6' },
         },
       ],
     },
   };
   ```

2. Update `apps/web/package.json` test script:

   ```json
   "test": "NODE_OPTIONS='--experimental-vm-modules' jest"
   ```

3. Install additional dependencies if needed (`@swc/jest`)

### Phase 2: Validation (2-3 hours)

**Tasks:**

1. Run full unit test suite: `pnpm test`
2. Run integration tests: `pnpm test integration.test`
3. Verify specific scenarios:
   - Case creation workflow integration
   - Financial visibility integration
   - Search and filters integration
4. Check GraphQL mock responses return expected data
5. Performance benchmark (ensure <2x slowdown)

### Phase 3: Documentation (1 hour)

**Tasks:**

1. Update `apps/web/src/app/cases/INTEGRATION_TESTS_README.md`
   - Remove "Known Setup Issues" section
   - Add "Jest ESM Configuration" explanation
2. Update testing strategy documentation
3. Announce configuration changes to team

---

## Effort Estimate

| Phase                 | Time          | Risk       |
| --------------------- | ------------- | ---------- |
| Configuration & Setup | 2-3 hours     | Medium     |
| Testing & Validation  | 2-3 hours     | Low        |
| Documentation         | 1 hour        | Low        |
| **Total**             | **5-7 hours** | **Medium** |

---

## Success Metrics

### Validation Checklist

- [ ] Unit test pass rate: 100% (221/221)
- [ ] Integration test execution: 100% (28+/28+)
- [ ] Integration test pass rate: ≥80%
- [ ] No critical Jest warnings/errors
- [ ] Mock responses return correct GraphQL data structures
- [ ] Test suite completes in reasonable time (<2x baseline)

### Testing Scenarios

1. **Case Creation Flow**
   - Mock `CREATE_CASE` mutation response
   - Verify case appears in list after creation

2. **Financial Visibility**
   - Mock role-based authorization responses
   - Verify financial data visibility per role

3. **Search & Filters**
   - Mock filtered case list responses
   - Verify UI updates based on mock data

---

## Risks & Mitigation

### Risk: ESM Config Breaks Unit Tests

**Likelihood:** Medium | **Impact:** High
**Mitigation:**

- Implement in feature branch
- Full regression testing before merge
- Ready rollback plan (git revert)

### Risk: Performance Degradation

**Likelihood:** Low | **Impact:** Medium
**Mitigation:**

- Use `@swc/jest` for faster transforms
- Benchmark before/after
- Consider parallel execution if needed

### Risk: CI/CD Pipeline Issues

**Likelihood:** Low | **Impact:** High
**Mitigation:**

- Test in draft PR first
- Verify Node.js version compatibility (16+)
- Update GitHub Actions workflow if needed

---

## Rollback Plan

### Trigger Conditions

- > 20% unit test failures
- Integration tests still blocked after config
- > 3x performance degradation
- Developer workflow blocked >2 hours

### Rollback Procedure

```bash
git revert <commit-hash>
pnpm install --frozen-lockfile
pnpm test
```

### Fallback Option

- Downgrade to MSW v1.x (temporary fix, technical debt)
- Documented in remediation plan Option 1

---

## Dependencies

### Technical Dependencies

- MSW v2.x (already installed: `~2.7.0`)
- Jest 29+ (already installed)
- Node.js 18+ (ESM native support)
- `@swc/jest` (may need installation)

### Blocking Dependencies

- None - can start immediately

### Blocked Work

- Story 2.8.4 integration tests
- Story 2.9 integration tests
- All future feature integration testing

---

## Definition of Done

- [x] Jest ESM mode enabled and configured
- [x] All unit tests passing (221/221)
- [x] All integration tests executable (28+)
- [x] Integration test pass rate ≥80%
- [x] MSW mock responses working correctly
- [x] Documentation updated (README, testing strategy)
- [x] Team notified of configuration changes
- [x] CI/CD pipeline validated (if applicable)
- [x] No regressions in existing functionality
- [x] Code reviewed and approved
- [x] Merged to main branch

---

## Notes

### Alternative Solutions Considered

1. **Downgrade MSW to v1.x** - Quick fix but temporary, creates technical debt
2. **Hybrid Jest configs** - Over-engineered, maintenance burden
3. **Manual mocks** - 40+ hours effort, loses MSW benefits

### Why ESM Mode?

- **Future-proof:** ES modules are JavaScript standard
- **Permanent fix:** No future MSW upgrade issues
- **Scalable:** Benefits all future ESM dependencies
- **Best practice:** Aligns with modern JavaScript ecosystem

### Team Communication

- Announce via Slack/email after implementation
- Include ESM vs CommonJS comparison guide
- 15-minute demo session (optional)
- Update developer onboarding documentation

---

## References

- **Remediation Plan:** `/docs/remediation-plans/jest-msw-integration-tests-fix.md`
- **Integration Test README:** `apps/web/src/app/cases/INTEGRATION_TESTS_README.md`
- **Jest ESM Docs:** https://jestjs.io/docs/ecmascript-modules
- **MSW v2 Docs:** https://mswjs.io/docs/
- **Next.js Testing:** https://nextjs.org/docs/testing

---

## Comments / Activity Log

**2025-11-22** - Ticket created by Mary (Business Analyst)

- Linked to INFRA-001 remediation plan
- Recommended solution: Jest ESM Mode (Option 2)
- Estimated effort: 5-7 hours
- Priority: High (blocks multiple stories)

---

**Last Updated:** 2025-11-22
**Next Review:** After implementation or if new information emerges
