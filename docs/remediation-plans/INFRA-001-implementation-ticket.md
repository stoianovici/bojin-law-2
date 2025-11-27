# INFRA-001: Enable Jest ESM Mode for Integration Tests

**Type:** Infrastructure / Technical Debt
**Priority:** High
**Severity:** Critical (blocks testing coverage)
**Status:** Ready for Development
**Assignee:** [Senior Developer TBD]
**Reporter:** Mary (Business Analyst)
**Created:** 2025-11-22
**Sprint:** [Next Available Sprint]
**Story Points:** 8 (estimated)

---

## 🎯 Problem Statement

All integration tests across the Bojin Law Platform are currently **blocked and cannot execute** due to a Jest/MSW configuration issue. The `until-async` ES module from MSW's dependencies is not being transformed by Jest, preventing 28+ integration tests from running.

**Impact:**
- ❌ **0 integration tests executable** (28+ tests written but blocked)
- ❌ **~20% of testing strategy missing** (integration layer)
- ❌ **No automated validation** of complete user workflows
- ⚠️ **Affects multiple stories:** 2.8, 2.8.3, 2.8.4, 2.9+

**Current State:**
- ✅ Unit tests: 221/221 passing (100%)
- ❌ Integration tests: 28+ written, 0 executable

---

## 📋 Acceptance Criteria

### Must Have

- [ ] Jest configured to run in ESM mode
- [ ] All 221 unit tests still pass (no regressions)
- [ ] All 28+ integration tests execute successfully
- [ ] Integration test pass rate ≥80%
- [ ] MSW v2.x loads without errors in test environment
- [ ] GraphQL mocking works correctly in integration tests
- [ ] Documentation updated (INTEGRATION_TESTS_README.md, testing-strategy.md)
- [ ] CI/CD pipeline runs integration tests (if applicable)

### Nice to Have

- [ ] Integration test pass rate 100%
- [ ] Test run time <1.5x slower than current unit tests
- [ ] Team knowledge-sharing session completed

---

## 🛠️ Implementation Tasks

### Phase 1: Research & Planning (1-2 hours)

- [ ] **Task 1.1:** Research Next.js 14 + Jest ESM configuration
  - Review [official Jest ESM docs](https://jestjs.io/docs/ecmascript-modules)
  - Review [Next.js testing docs](https://nextjs.org/docs/testing)
  - Search GitHub/Stack Overflow for working examples

- [ ] **Task 1.2:** Identify potential compatibility issues
  - Review all `devDependencies` for ESM compatibility
  - Check for known issues with current setup

- [ ] **Task 1.3:** Document required configuration changes
  - Create checklist of files to modify
  - Document configuration options

**Deliverables:** Technical research notes, configuration plan

---

### Phase 2: Configuration & Setup (2-3 hours)

- [ ] **Task 2.1:** Update `apps/web/jest.config.js`

  Add ESM support configuration:
  ```javascript
  const customJestConfig = {
    // ... existing config
    extensionsToTreatAsEsm: ['.ts', '.tsx'],
    transform: {
      '^.+\\.(ts|tsx)$': ['@swc/jest', {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
        module: {
          type: 'es6',
        },
      }],
    },
  };
  ```

- [ ] **Task 2.2:** Update `apps/web/package.json` test scripts

  Add Node.js ESM flag:
  ```json
  {
    "scripts": {
      "test": "NODE_OPTIONS='--experimental-vm-modules' jest",
      "test:watch": "NODE_OPTIONS='--experimental-vm-modules' jest --watch",
      "test:coverage": "NODE_OPTIONS='--experimental-vm-modules' jest --coverage"
    }
  }
  ```

- [ ] **Task 2.3:** Install additional dependencies (if needed)
  ```bash
  pnpm add -D @swc/jest @swc/core
  ```

- [ ] **Task 2.4:** Update test imports to ESM syntax (if needed)
  - Check if any tests use `require()` syntax
  - Convert to `import` statements if necessary

**Deliverables:** Updated configuration files, installed dependencies

---

### Phase 3: Testing & Validation (2-3 hours)

- [ ] **Task 3.1:** Run all unit tests
  ```bash
  pnpm test
  ```
  **Expected:** 221/221 tests passing (no regressions)

- [ ] **Task 3.2:** Run integration tests
  ```bash
  pnpm test integration.test
  ```
  **Expected:** All integration tests execute (may have some failures)

- [ ] **Task 3.3:** Validate GraphQL mocking
  - [ ] Verify MSW handlers load correctly
  - [ ] Test GraphQL query mocking
  - [ ] Test GraphQL mutation mocking
  - [ ] Check mock data returns correctly

- [ ] **Task 3.4:** Fix failing integration tests (if any)
  - Review failure logs
  - Update test fixtures/mocks as needed
  - Target ≥80% pass rate

- [ ] **Task 3.5:** Performance check
  - Compare test run times before/after
  - Ensure <2x slower than baseline
  - Document any significant changes

- [ ] **Task 3.6:** Test on multiple environments
  - Run tests on 2-3 different developer machines
  - Verify CI/CD pipeline (if applicable)

**Deliverables:** Test execution report, performance comparison

---

### Phase 4: Documentation & Communication (1 hour)

- [ ] **Task 4.1:** Update `apps/web/src/app/cases/INTEGRATION_TESTS_README.md`
  - Remove "Known Setup Issues" section
  - Add "Jest ESM Configuration" section
  - Document how to run integration tests
  - Include troubleshooting tips

- [ ] **Task 4.2:** Update `docs/architecture/testing-strategy.md`
  - Document Jest ESM mode decision
  - Explain when to write integration tests vs unit tests
  - Add examples of integration test patterns

- [ ] **Task 4.3:** Update CI/CD pipeline (if needed)
  - Modify GitHub Actions workflow
  - Verify Node.js version supports ESM (18+)
  - Test pipeline runs successfully

- [ ] **Task 4.4:** Create team announcement
  - Explain Jest configuration changes
  - Document any new testing commands
  - Share knowledge resources

**Deliverables:** Updated documentation, team announcement

---

### Phase 5: Story Cleanup (30 minutes)

- [ ] **Task 5.1:** Update Story 2.8
  - Remove "Integration tests blocked" notes
  - Update QA results section
  - Mark integration test tasks as complete

- [ ] **Task 5.2:** Update Story 2.8.3
  - Same updates as Story 2.8

- [ ] **Task 5.3:** Clean up temporary documentation
  - Remove "Known Setup Issues" warnings
  - Update future story templates

**Deliverables:** Updated story files

---

## 🎲 Technical Approach

### Recommended Solution: Jest ESM Mode (Option 2)

**Why this approach:**
- ✅ Permanent solution (not a workaround)
- ✅ Future-proof for all ESM dependencies
- ✅ Aligns with modern JavaScript standards
- ✅ Scalable for future test infrastructure

**Alternatives considered:**
- ❌ **Option 1:** Downgrade MSW to v1.x - Temporary fix, technical debt
- ❌ **Option 3:** Hybrid test environments - Over-engineered
- ❌ **Option 4:** Manual mocks - 40+ hours, worse outcomes

**See full analysis in:** `docs/remediation-plans/jest-msw-integration-tests-fix.md`

---

## 🚨 Risks & Mitigation

### Risk 1: ESM breaks existing unit tests
- **Likelihood:** Medium
- **Mitigation:** Implement in feature branch, full regression testing before merge

### Risk 2: Performance degradation
- **Likelihood:** Low-Medium
- **Mitigation:** Use `@swc/jest` for faster transforms, benchmark before/after

### Risk 3: CI/CD pipeline breaks
- **Likelihood:** Low
- **Mitigation:** Test pipeline in draft PR, have rollback ready

**Full risk analysis in:** `docs/remediation-plans/jest-msw-integration-tests-fix.md` (Section 8)

---

## 🔄 Rollback Plan

If critical issues are found during implementation:

1. **Immediate Rollback:**
   ```bash
   git revert <commit-hash>
   pnpm install
   pnpm test
   ```

2. **Trigger Conditions:**
   - >20% of unit tests failing
   - Integration tests still not executable
   - >3x slower test runs
   - Developer workflow blocked >2 hours

3. **Fallback Strategy:**
   - Revert Jest configuration changes
   - If needed, downgrade to MSW v1.x (Option 1)
   - Document issues for future attempt

---

## 📊 Definition of Done

- [x] All acceptance criteria met
- [x] Code reviewed and approved
- [x] All tests passing (unit + integration)
- [x] Documentation updated
- [x] CI/CD pipeline passing
- [x] Team informed of changes
- [x] No critical bugs or regressions
- [x] Performance acceptable (<2x slower)
- [x] Changes merged to main branch
- [x] Stories updated (2.8, 2.8.3)

---

## 📚 Resources & References

### Documentation
- **Remediation Plan:** `docs/remediation-plans/jest-msw-integration-tests-fix.md`
- **Current Setup Issues:** `apps/web/src/app/cases/INTEGRATION_TESTS_README.md`
- **Testing Strategy:** `docs/architecture/testing-strategy.md`

### Technical References
- [Jest ESM Support](https://jestjs.io/docs/ecmascript-modules)
- [Next.js Testing Guide](https://nextjs.org/docs/testing)
- [MSW Documentation](https://mswjs.io/docs/)
- [MSW v2 Migration](https://mswjs.io/docs/migrations/1.x-to-2.x)

### Related Stories
- Story 2.8: Case CRUD Operations UI (integration tests blocked)
- Story 2.8.3: Role-Based Financial Visibility (integration tests blocked)
- Future Stories: 2.8.4, 2.9+ (will benefit from this fix)

---

## 💬 Comments & Notes

### Implementation Notes
- **Estimated Effort:** 6-8 hours for senior developer
- **Timeline:** 1-2 days if worked consecutively
- **Recommended:** Allocate full sprint for thorough testing
- **Team Impact:** Minimal (transparent to most developers)

### Success Metrics
- Integration test execution rate: 0% → 100%
- Integration test pass rate: Target ≥80%
- Unit test stability: Maintain 100% pass rate
- Developer satisfaction: Post-implementation survey

### Follow-up Work
After this issue is resolved:
- Add more integration tests for new features
- Consider E2E test setup (Playwright)
- Improve test coverage to 80%+ of user workflows

---

## 🏷️ Labels

`infrastructure` `testing` `high-priority` `technical-debt` `jest` `msw` `integration-tests` `sprint-2.9`

---

## 🔗 Related Issues

- Blocked by: None
- Blocks: Integration test execution for Stories 2.8, 2.8.3, 2.8.4, 2.9+
- Related to: TEST-001, TEST-002 (from Story 2.8 QA review)

---

## ✅ Checklist for Assignee

Before starting:
- [ ] Read full remediation plan: `docs/remediation-plans/jest-msw-integration-tests-fix.md`
- [ ] Review current Jest configuration: `apps/web/jest.config.js`
- [ ] Check out feature branch: `git checkout -b infra/jest-esm-mode`
- [ ] Ensure Node.js 18+ installed

During implementation:
- [ ] Follow Phase 1-5 tasks sequentially
- [ ] Document any deviations from plan
- [ ] Track time spent per phase
- [ ] Take notes for team knowledge sharing

Before submitting PR:
- [ ] All tests passing locally
- [ ] Documentation updated
- [ ] Self-review of changes
- [ ] Performance benchmarks recorded

---

**Questions or blockers?** Comment on this issue or reach out to Tech Lead

**Estimated Completion:** [Sprint End Date]
