# Plan: Linear-Style Legal Platform UI

**Status**: Ready for Implementation
**Date**: 2024-12-29
**Input**: [research-linear-ui.md](./research-linear-ui.md)
**Stories**: [stories/](./stories/)

---

## Approach Summary

Build a Linear-inspired UI using component-first, bottom-up approach:

1. **Phase 1**: UI primitives (Button, Input, Card, etc.)
2. **Phase 2**: Authentication with MSAL
3. **Phase 3**: Layout system (AppShell, Sidebar, Header, CommandPalette)
4. **Phase 4**: Dashboard page shells

All stories optimized for parallel `/implement` execution.

---

## Story Files

### Phase 1: UI Components (15 parallel + 1 sequential)

| Story         | File                                | Can Parallel    |
| ------------- | ----------------------------------- | --------------- |
| Design Tokens | `stories/story-01-design-tokens.md` | Yes             |
| Button        | `stories/story-02-ui-button.md`     | Yes             |
| Input         | `stories/story-03-ui-input.md`      | Yes             |
| Card          | `stories/story-04-ui-card.md`       | Yes             |
| Badge         | `stories/story-05-ui-badge.md`      | Yes             |
| Avatar        | `stories/story-06-ui-avatar.md`     | Yes             |
| Dialog        | `stories/story-07-ui-dialog.md`     | Yes             |
| DropdownMenu  | `stories/story-08-ui-dropdown.md`   | Yes             |
| Tooltip       | `stories/story-09-ui-tooltip.md`    | Yes             |
| Toast         | `stories/story-10-ui-toast.md`      | Yes             |
| Select        | `stories/story-11-ui-select.md`     | Yes             |
| Tabs          | `stories/story-12-ui-tabs.md`       | Yes             |
| ScrollArea    | `stories/story-13-ui-scroll.md`     | Yes             |
| Separator     | `stories/story-14-ui-separator.md`  | Yes             |
| Popover       | `stories/story-15-ui-popover.md`    | Yes             |
| **Finish**    | `stories/story-16-ui-finish.md`     | **After above** |

### Phase 2: Authentication

| Story       | File                       | Depends On |
| ----------- | -------------------------- | ---------- |
| Auth System | `stories/story-20-auth.md` | Phase 1    |

### Phase 3: Layout

| Story         | File                         | Depends On |
| ------------- | ---------------------------- | ---------- |
| Layout System | `stories/story-30-layout.md` | Phase 2    |

### Phase 4: Pages

| Story           | File                        | Depends On |
| --------------- | --------------------------- | ---------- |
| Dashboard Pages | `stories/story-40-pages.md` | Phase 3    |

---

## Execution

See [stories/README.md](./stories/README.md) for execution order and parallelization guide.

### Quick Start

```bash
# Phase 1 - run in parallel (multiple terminals/agents):
/implement story-01-design-tokens
/implement story-02-ui-button
/implement story-03-ui-input
/implement story-04-ui-card
/implement story-05-ui-badge
# ... continue with stories 06-15

# After all Phase 1 parallel stories complete:
/implement story-16-ui-finish

# Then sequential:
/implement story-20-auth
/implement story-30-layout
/implement story-40-pages
```

---

## Total Scope

- **19 story files** total
- **15 parallel** Phase 1 stories
- **4 sequential** milestone stories
- Each story is self-contained with clear done criteria

---

## Next Step

Run `/implement story-XX-name` for any story, or run multiple in parallel for Phase 1 components.
