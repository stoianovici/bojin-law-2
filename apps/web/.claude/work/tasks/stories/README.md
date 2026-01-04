# Implementation Stories

Run each story with `/implement [story-name]` (without `.md` extension).

## Execution Order & Parallelization

```
PHASE 1: UI Components (can run ALL in parallel)
├── story-01-design-tokens    ─┐
├── story-02-ui-button        │
├── story-03-ui-input         │
├── story-04-ui-card          │
├── story-05-ui-badge         ├── Parallel batch
├── story-06-ui-avatar        │
├── story-07-ui-dialog        │
├── story-08-ui-dropdown      │
├── story-09-ui-tooltip       │
├── story-10-ui-toast         │
├── story-11-ui-select        │
├── story-12-ui-tabs          │
├── story-13-ui-scroll        │
├── story-14-ui-separator     │
└── story-15-ui-popover       ─┘
         │
         ▼
    story-16-ui-finish  ←── Sequential (deps + exports)
         │
═════════╪═════════════════════════════════════════
         │
PHASE 2: Authentication
         │
         ▼
    story-20-auth  ←── Has internal parallel groups
         │
═════════╪═════════════════════════════════════════
         │
PHASE 3: Layout
         │
         ▼
    story-30-layout  ←── Has internal parallel groups
         │
═════════╪═════════════════════════════════════════
         │
PHASE 4: Pages
         │
         ▼
    story-40-pages  ←── Has internal parallel groups
```

## Story List

| Story                    | Description              | Parallel With  |
| ------------------------ | ------------------------ | -------------- |
| `story-01-design-tokens` | Extend CSS design tokens | All Phase 1    |
| `story-02-ui-button`     | Button component         | All Phase 1    |
| `story-03-ui-input`      | Input & TextArea         | All Phase 1    |
| `story-04-ui-card`       | Card composables         | All Phase 1    |
| `story-05-ui-badge`      | Status badges            | All Phase 1    |
| `story-06-ui-avatar`     | Avatar + group           | All Phase 1    |
| `story-07-ui-dialog`     | Modal dialog             | All Phase 1    |
| `story-08-ui-dropdown`   | Dropdown menu            | All Phase 1    |
| `story-09-ui-tooltip`    | Tooltips                 | All Phase 1    |
| `story-10-ui-toast`      | Toast notifications      | All Phase 1    |
| `story-11-ui-select`     | Select dropdown          | All Phase 1    |
| `story-12-ui-tabs`       | Tab navigation           | All Phase 1    |
| `story-13-ui-scroll`     | Custom scrollbars        | All Phase 1    |
| `story-14-ui-separator`  | Divider lines            | All Phase 1    |
| `story-15-ui-popover`    | Floating popover         | All Phase 1    |
| `story-16-ui-finish`     | Install deps, exports    | After Phase 1  |
| `story-20-auth`          | Full auth system         | After story-16 |
| `story-30-layout`        | AppShell, Sidebar, etc.  | After story-20 |
| `story-40-pages`         | Dashboard page shells    | After story-30 |

## Quick Start

```bash
# Run Phase 1 components in parallel (multiple terminals):
/implement story-01-design-tokens
/implement story-02-ui-button
/implement story-03-ui-input
# ... etc

# After all Phase 1 complete:
/implement story-16-ui-finish

# Then sequential phases:
/implement story-20-auth
/implement story-30-layout
/implement story-40-pages
```

## Session Checkpoints

If you need to pause:

- After `story-16-ui-finish` → All UI components done
- After `story-20-auth` → App has authentication
- After `story-30-layout` → Core experience complete
- After `story-40-pages` → All page shells ready
