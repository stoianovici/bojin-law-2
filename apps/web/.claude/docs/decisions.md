# Decisions Log

This file records significant architectural and design decisions for future reference.

---

## 2024-12-29 - Claude Workflow System

### Context

Setting up a command system to help Claude work more effectively on this project, with better context retention across sessions and parallel task execution.

### Options Considered

1. **Skills (Claude Code native)** - Use built-in skill system
2. **Markdown command files** - Claude reads instruction files
3. **Hybrid** - Markdown for state, recognize commands in chat

### Decision

Hybrid approach with markdown files in `.claude/` directory.

### Rationale

- Simpler setup (no config changes needed)
- State persists in files (decisions, work log)
- Commands are just file reads
- Can migrate to native skills later if beneficial

### Consequences

- Claude must read command files when invoked
- State lives in `.claude/docs/` and `.claude/work/`
- Commands: /context, /brainstorm, /research, /plan, /implement, /commit, /deploy, /document, /checkpoint

---

## 2024-12-29 - Parallel Execution Strategy

### Context

Need to leverage Claude's sub-agent capability for faster work.

### Options Considered

1. **Manual instances** - User spawns multiple Claude terminals
2. **Sub-agents only** - Claude manages all parallelization
3. **Hybrid** - Sub-agents for research, user choice for implementation

### Decision

Sub-agents for both research and implementation.

### Rationale

- Less manual work for user
- Claude can coordinate file ownership
- Up to 5 parallel agents per group
- Exclusive file ownership prevents conflicts

### Consequences

- /research spawns 3-5 agents
- /implement spawns up to 5 agents per parallel group
- No two parallel tasks touch same file
- Verification runs after each parallel group

---

## 2024-12-29 - Task Doc Workflow

### Context

Need a way to hand off work between Claude sessions without losing context. Previous approach used checkpoint.md but required context to persist within a session.

### Options Considered

1. **Checkpoint files** - Save state to checkpoint.md, resume with /context
2. **Task docs** - Each step outputs a self-contained doc, next step reads it
3. **Conversation export** - Save entire conversation history

### Decision

Task docs approach. Each workflow step outputs to `.claude/work/tasks/{step}-{slug}.md`.

### Rationale

- Each doc is self-contained (project context + decisions + next steps)
- Fresh sessions can start with just `/research brainstorm-linear-ui`
- No need to reconstruct context from multiple sources
- Natural handoff points between steps
- Docs serve as documentation of decisions made

### Consequences

- `/brainstorm [topic]` → outputs `brainstorm-{slug}.md`
- `/research brainstorm-{slug}` → reads brainstorm doc, outputs `research-{slug}.md`
- `/plan research-{slug}` → reads research doc, outputs `plan-{slug}.md`
- `/implement plan-{slug}` → reads plan doc, outputs `implement-{slug}.md`
- `/checkpoint` only needed for mid-step pauses (appends to current task doc)

---

_Add new decisions using /document when significant choices are made._
