# Draft Operations Issues

Break down work into parallelizable issues. Uses a specialized agent.

## Input

$ARGUMENTS - Description or reference to ideation session.

## Process

Launch a drafting agent to analyze and decompose:

```
Analyze this work and break it into discrete issues:

{user input or ideation summary}

Consider:
1. What can be done in parallel? (bias toward parallelization)
2. What has hard dependencies?
3. What's the smallest shippable unit?
4. Where are the natural boundaries? (data model, service, UI, etc.)

Output:
- Dependency graph showing parallel vs sequential
- Individual issue drafts
```

## Output Format

```markdown
## Work Breakdown: {epic title}

### Execution Plan
```

Phase 1 (parallel):
├── OPS-A: {title}
├── OPS-B: {title}
└── OPS-C: {title}

Phase 2 (after A):
├── OPS-D: {title} [blocked by: A]
└── OPS-E: {title} [blocked by: A]

Phase 3 (after B, D):
└── OPS-F: {title} [blocked by: B, D]

```

### Why this breakdown?

{reasoning for the split - what enables parallelization}

---

### OPS-A: {title}

**Type**: {type} | **Complexity**: S/M/L
**Parallel**: Yes / Blocked by: X

#### Problem
{concise problem statement}

#### Approach
{solution}

#### Done when
- [ ] {criterion}
- [ ] {criterion}

#### Files
- `path/to/file.ts`

---

### OPS-B: {title}
{same structure}

---

{repeat for each issue}
```

## Breakdown Heuristics

**Split by layer** (often parallel):

- Data model changes
- Service/backend logic
- GraphQL schema/resolvers
- UI components

**Split by independence**:

- Can this ship without the others?
- Does this have its own value?

**Keep together**:

- Tightly coupled changes
- Would break if partially deployed

## After Draft

```
Breakdown ready: {n} issues across {m} phases

Options:
1. Create all issues
2. Create Phase 1 only (start parallel work)
3. Adjust breakdown
4. Discard
```

## Integration with Ideation

When called after `/ops-ideate`:

- Use chosen angle as the work to break down
- Reference trade-offs in technical notes
- Note rejected angles as "not doing"
