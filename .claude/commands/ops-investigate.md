# Parallel Investigation

Run parallel hypothesis exploration to quickly identify root cause. Use this when initial triage suggests multiple possible causes.

## Input

The user's input is: $ARGUMENTS

This should be either:

- An OPS issue ID (e.g., "OPS-024")
- A symptom description (e.g., "documents not appearing")

## 1. Load Context

Read in parallel:

- `docs/ops/operations-log.md` - Current issues
- `docs/ops/root-cause-patterns.md` - Known patterns
- If issue ID provided: `docs/ops/issues/ops-{id}.md`

## 2. Generate Hypotheses

Based on the symptom, generate **3 most likely hypotheses** using the pattern library.

For "X not appearing" symptoms, the top 3 are usually:

1. **Frontend**: Component not fetching/rendering data
2. **API**: Resolver not returning data / field mismatch
3. **Backend**: Data missing from DB / link table empty

For "X fails in production" symptoms:

1. **Env**: Missing environment variable
2. **Build**: Dependencies or migration not applied
3. **Runtime**: Different behavior in Docker vs Node

## 3. Spawn Parallel Agents

Launch 3 Explore agents simultaneously, one per hypothesis:

```
Agent 1 - Frontend Investigation:
"Investigate if [symptom] is caused by frontend issues.
Check: component fetches data, no hardcoded arrays, state updates correctly.
Files to check: apps/web/src/app/[relevant-path], components, hooks.
Report: Does frontend properly request and render the data?"

Agent 2 - API Investigation:
"Investigate if [symptom] is caused by API layer issues.
Check: resolver registered, schema matches, field names correct.
Files to check: services/gateway/src/graphql/resolvers, schema files.
Report: Does GraphQL return the expected data?"

Agent 3 - Backend Investigation:
"Investigate if [symptom] is caused by backend/data issues.
Check: data exists in DB, link tables populated, migrations applied.
Files to check: services/gateway/src/services, Prisma schema.
Report: Does the data exist and is it properly linked?"
```

Use the Task tool with `subagent_type=Explore` for each agent.
Run all 3 in a **single message** (parallel execution).

## 4. Synthesize Results

Wait for all agents to complete, then summarize:

```markdown
## Investigation Results

### Hypothesis 1: Frontend

**Verdict**: ✅ Clear / ⚠️ Suspicious / ❌ Root cause found
**Findings**: [agent 1 summary]
**Key files**: [files examined]

### Hypothesis 2: API

**Verdict**: ✅ Clear / ⚠️ Suspicious / ❌ Root cause found
**Findings**: [agent 2 summary]
**Key files**: [files examined]

### Hypothesis 3: Backend

**Verdict**: ✅ Clear / ⚠️ Suspicious / ❌ Root cause found
**Findings**: [agent 3 summary]
**Key files**: [files examined]

## Recommendation

**Most likely root cause**: [hypothesis with ❌]
**Next step**: [specific action to verify/fix]
```

## 5. Update Issue

If issue ID was provided, update the ops log with findings:

- Add investigation results to Session Log
- Update status to "Root Cause Found" if identified
- Document which layer has the bug

## Example Usage

User runs: `/ops-investigate documents not appearing after import`
