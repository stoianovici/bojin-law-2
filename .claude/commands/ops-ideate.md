# Explore Ideas and Concepts

Brainstorm and explore conceptual questions, design challenges, and platform ideas without immediately committing to an implementation.

## Input

The user's input is: $ARGUMENTS

This can be:

- A conceptual question ("how should we handle X?")
- A design challenge ("what's the best way to organize Y?")
- A feature exploration ("what if we added Z?")
- An architectural concern ("should we refactor A to B?")
- An open-ended exploration ("ideas for improving W")

## 1. Load Context

Read in parallel to understand the platform:

- `docs/project-conventions.md` - Current patterns and architecture
- `docs/ops/operations-log.md` - Recent issues and ongoing work
- `CLAUDE.md` - Project overview

## 2. Understand the Idea Space

Before diving into solutions, clarify the scope:

**Ask (if needed):**

- What problem or opportunity prompted this?
- Are there constraints we should work within?
- What's the ideal outcome?
- Is this exploratory or are you leaning toward implementation?

**If the input is clear enough, proceed without asking.**

## 3. Gather Relevant Context

Use the Explore agent (Task tool with subagent_type=Explore) to investigate:

1. **Current state**: How does the platform handle this today?
2. **Related code**: What existing patterns or components are relevant?
3. **Similar solutions**: Any prior art in the codebase?

Focus on understanding, not judging.

## 4. Explore Multiple Angles

Present ideas in this format:

```markdown
## Exploring: {topic}

### Current State

{What exists today, if anything}

### The Question/Challenge

{Restate what we're exploring}

---

### Angle 1: {approach name}

**Idea**: {brief description}

**How it would work**:

- {key point}
- {key point}

**Strengths**:

- {benefit}
- {benefit}

**Trade-offs**:

- {consideration}
- {consideration}

**Affected areas**:

- {file or component}
- {file or component}

---

### Angle 2: {approach name}

{same structure}

---

### Angle 3: {approach name}

{same structure}

---

### Synthesis

**Key tensions**: {what trade-offs exist between approaches}

**Questions to resolve**: {what would inform the decision}

**My take**: {your honest assessment, if helpful}
```

## 5. Interactive Exploration

After presenting angles, offer to:

```
## What would you like to explore further?

1. **Dig deeper** into one of these angles
2. **Prototype** a quick sketch of an approach
3. **Compare** specific aspects across approaches
4. **Challenge** - play devil's advocate on an approach
5. **Scope** - break down an approach into phases
6. **Create issue** - turn this into a tracked OPS issue
```

## 6. If Creating an Issue

Only create an OPS issue if the user explicitly asks. When they do:

1. Ask which angle/approach to pursue
2. Use `/ops-new` pattern to create the issue
3. Reference this ideation session in the issue description

## Guidelines

**DO:**

- Present multiple perspectives, even if one seems obvious
- Acknowledge uncertainty and trade-offs honestly
- Reference relevant parts of the codebase
- Think about user impact, not just technical elegance
- Consider maintenance burden and complexity cost
- Build on existing patterns when sensible

**DON'T:**

- Rush to a single "correct" answer
- Create issues unless asked
- Start implementing without explicit request
- Dismiss ideas without explaining why
- Over-engineer or suggest unnecessary complexity

## Example Sessions

**Example 1: Design question**

```
User: /ops-ideate how should we structure notifications?

Claude: [Explores push vs pull, real-time vs batch, UI patterns,
        presents 3 approaches with trade-offs, asks what to explore further]
```

**Example 2: Architectural concern**

```
User: /ops-ideate should we move email processing to a queue?

Claude: [Analyzes current synchronous flow, explores queue options,
        discusses when queues help vs add complexity, presents angles]
```

**Example 3: Feature exploration**

```
User: /ops-ideate ideas for improving the case timeline

Claude: [Reviews current timeline, explores visualization options,
        considers data sources, presents multiple enhancement angles]
```

## Note

This command is for thinking and exploring. It's okay to not reach a conclusion. Sometimes the value is in mapping out the problem space, not solving it.

When ready to act, use `/ops-new` to create a tracked issue.
