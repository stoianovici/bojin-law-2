# Ops Workflow Improvements

> Blackboard for iterative improvements to /ops commands. Update as we implement and learn.

## Problem Statement

OPS-024 took 13 sessions to find a simple frontend bug. Root cause: sequential hypothesis testing + no systematic data-flow tracing.

## Improvement Areas

### 1. Parallel Hypothesis Testing

**Status:** DONE
**Idea:** Spawn 3 agents simultaneously, each investigating one hypothesis. Compare findings.
**Command:** `/ops-investigate`

### 2. Root Cause Pattern Library

**Status:** DONE
**Idea:** Extract patterns from 21 resolved issues. Surface relevant patterns during investigation.
**File:** `docs/ops/root-cause-patterns.md`

### 3. Quick Debug Protocol

**Status:** DONE (integrated into /ops-continue)
**Idea:** Before deploying, trace data flow locally: DB → Service → Resolver → Hook → Component
**Integration:** Added sanity checks to `/ops-continue`

### 4. Pre-Investigation Sanity Checks

**Status:** DONE (integrated into /ops-continue)
**Idea:** Auto-run checks on `/ops-new`: Is data in DB? Does API return it? Does component fetch it?

---

## Implementation Log

| Date       | Change                                    | Result                                  |
| ---------- | ----------------------------------------- | --------------------------------------- |
| 2025-12-15 | Initial brainstorm                        | Identified 4 improvement areas          |
| 2025-12-15 | Created `docs/ops/root-cause-patterns.md` | 6 pattern categories from 24 issues     |
| 2025-12-15 | Created `/ops-investigate` command        | Parallel 3-agent hypothesis testing     |
| 2025-12-15 | Updated `/ops-continue`                   | Now loads patterns + runs sanity checks |

---

## Next Actions

1. Test `/ops-investigate` on next real issue
2. Refine patterns as new issues reveal new categories
3. Consider: auto-suggest patterns based on symptom keywords
