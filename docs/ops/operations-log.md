# Operations Log

> Persistent tracking of post-deployment issues, debugging sessions, and feature work.
> Individual issue details are in `issues/` (active) and `archive/` (resolved).

## Quick Reference

| ID      | Title                                           | Type        | Priority    | Status    | File                                     |
| ------- | ----------------------------------------------- | ----------- | ----------- | --------- | ---------------------------------------- |
| OPS-001 | Communications page not loading emails          | Bug         | P0-Critical | Verifying | [issues/ops-001.md](issues/ops-001.md)   |
| OPS-002 | Legacy import stuck at 8k docs                  | Performance | P1-High     | Resolved  | [archive/ops-002.md](archive/ops-002.md) |
| OPS-003 | Restrict partner dashboard to partners          | Feature     | P2-Medium   | Verifying | [issues/ops-003.md](issues/ops-003.md)   |
| OPS-004 | Add categorization backup before export         | Feature     | P1-High     | Fixing    | [issues/ops-004.md](issues/ops-004.md)   |
| OPS-005 | AI extraction and drafting not working          | Bug         | P0-Critical | Fixing    | [issues/ops-005.md](issues/ops-005.md)   |
| OPS-006 | Connect AI capabilities to application UI       | Feature     | P1-High     | Fixing    | [issues/ops-006.md](issues/ops-006.md)   |
| OPS-007 | AI email drafts ignore user language pref       | Bug         | P2-Medium   | Fixing    | [issues/ops-007.md](issues/ops-007.md)   |
| OPS-008 | Communications section comprehensive overhaul   | Feature     | P1-High     | Fixing    | [issues/ops-008.md](issues/ops-008.md)   |
| OPS-009 | Multiple re-login prompts for email/attachments | Bug         | P1-High     | Verifying | [issues/ops-009.md](issues/ops-009.md)   |
| OPS-010 | Emails synced but not displayed (1049 emails)   | Bug         | P0-Critical | Resolved  | [archive/ops-010.md](archive/ops-010.md) |
| OPS-011 | Refocus /communications on received emails only | Feature     | P1-High     | Resolved  | [archive/ops-011.md](archive/ops-011.md) |
| OPS-012 | Legacy import can't advance past first 100 docs | Bug         | P1-High     | Fixing    | [issues/ops-012.md](issues/ops-012.md)   |
| OPS-013 | New logins don't show up in user management     | Bug         | P1-High     | Verifying | [issues/ops-013.md](issues/ops-013.md)   |

---

## Active Issues Summary

### P0-Critical

- **OPS-001** (Verifying) - Email sync/display issues, 9 sessions of fixes
- **OPS-005** (Fixing) - AI extraction/drafting in communications

### P1-High

- **OPS-004** (Fixing) - Categorization backup before export
- **OPS-006** (Fixing) - AI capabilities UI integration
- **OPS-008** (Fixing) - Communications section overhaul
- **OPS-009** (Verifying) - Re-login prompts for MS Graph operations
- **OPS-012** (Fixing) - Legacy import pagination
- **OPS-013** (Verifying) - User management not showing new logins

### P2-Medium

- **OPS-003** (Verifying) - Partner dashboard authorization
- **OPS-007** (Fixing) - AI draft language matching

---

## Standard Procedures

- **[Deployment Flows](deployment-flows.md)** - Preflight checks, smoke tests, avoiding "works locally breaks in prod"

---

## Folder Structure

```
docs/ops/
├── operations-log.md    # This index file
├── deployment-flows.md  # Deployment procedures and scripts
├── issues/              # Active issues
│   ├── ops-001.md
│   ├── ops-003.md
│   ├── ops-004.md
│   ├── ops-005.md
│   ├── ops-006.md
│   ├── ops-007.md
│   ├── ops-008.md
│   ├── ops-009.md
│   ├── ops-012.md
│   └── ops-013.md
└── archive/             # Resolved issues
    ├── ops-002.md
    ├── ops-010.md
    └── ops-011.md
```

---

## How to Use

**For new sessions:**

1. Read this index to understand current state
2. Open the specific issue file(s) you're working on
3. Update the issue file with session progress
4. Update status in this index if it changes

**When resolving issues:**

1. Move file from `issues/` to `archive/`
2. Update status in this index to "Resolved"

**When creating new issues:**

1. Create file in `issues/` using next OPS-XXX number
2. Add row to Quick Reference table above
