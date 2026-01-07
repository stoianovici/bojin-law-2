# /commit - Verified Commit

**Purpose**: Ensure all checks pass before committing. Fix issues automatically.
**Mode**: Autonomous (Claude handles everything, reports result)

## Auto-load Context (first step, parallel)

```bash
git status                    → What's changed
git diff --stat               → Summary of changes
git log --oneline -3          → Recent commits for message style
```

---

## Execution Steps

### 1. Pre-commit Checks (parallel)

Run simultaneously:

```bash
pnpm type-check    # TypeScript compilation
pnpm lint          # ESLint
pnpm build         # Build succeeds
```

### 2. Handle Failures

If any check fails:

1. Analyze the error
2. Fix it automatically
3. Re-run the failed check
4. Repeat until passing (max 3 attempts per issue)

If unfixable after 3 attempts:

- Report the issue
- Ask user for guidance
- DO NOT commit

### 3. Stage Changes

```bash
git add -A                    # Stage all changes
git status                    # Show what will be committed
```

Review staged files:

- Warn if .env or secrets detected
- Confirm no unintended files

### 4. Generate Commit Message

Based on changes, create message:

```
<type>(<scope>): <description>

[optional body with details]

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

Types: feat, fix, refactor, docs, style, test, chore

### 5. Commit

```bash
git commit -m "<message>"
```

## Output

```markdown
## Commit Complete

### Checks

- [x] Type-check: passed
- [x] Lint: passed
- [x] Build: passed

### Committed

- **Hash**: abc1234
- **Message**: feat(auth): add login form validation
- **Files**: 5 changed

### Issues Fixed

- [Fixed] Type error in src/components/Button.tsx:23
- [Fixed] Lint warning in src/hooks/useAuth.ts:45

### Next

Run /deploy when ready for production.
```

## Rules

- NEVER commit with failing checks
- NEVER commit secrets (.env, credentials)
- ALWAYS show what's being committed
- AUTO-FIX when possible
- ASK user if stuck

## Related

- For deployment: use /deploy
- bojin-law-2 has more comprehensive test suites if needed
