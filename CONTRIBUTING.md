# Contributing to Legal Platform

Thank you for contributing to the Legal Platform project! This document outlines our development workflow and standards.

## Table of Contents

- [Git Workflow](#git-workflow)
- [Commit Conventions](#commit-conventions)
- [Branch Naming](#branch-naming)
- [Pull Request Process](#pull-request-process)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)

## Git Workflow

We follow a **feature branch workflow** with the following principles:

1. **Main Branch Protection**: The `main` branch is protected and requires:
   - Pull request reviews before merging
   - All CI/CD checks to pass
   - Up-to-date branch with main

2. **Development Flow**:
   - Create a feature branch from `main`
   - Make your changes with clear, atomic commits
   - Push to your branch and create a pull request
   - Address review feedback
   - Merge after approval

## Commit Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for clear and semantic commit messages.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature
  - Example: `feat(auth): add Azure AD authentication`
- **fix**: A bug fix
  - Example: `fix(document): resolve version comparison error`
- **docs**: Documentation changes
  - Example: `docs(readme): update setup instructions`
- **style**: Code style changes (formatting, missing semicolons, etc.)
  - Example: `style(ui): format button component`
- **refactor**: Code refactoring without changing functionality
  - Example: `refactor(api): simplify GraphQL resolver logic`
- **perf**: Performance improvements
  - Example: `perf(search): optimize vector search query`
- **test**: Adding or updating tests
  - Example: `test(task): add unit tests for task service`
- **chore**: Maintenance tasks, dependency updates
  - Example: `chore(deps): upgrade Next.js to 14.2.1`
- **build**: Build system or external dependency changes
  - Example: `build(turbo): configure build pipeline`
- **ci**: CI/CD configuration changes
  - Example: `ci(actions): add automated testing workflow`

### Scope

The scope is optional and should reference the affected package or service:
- `auth`, `document`, `task`, `ai`, `integration`, `notification`
- `ui`, `shared`, `database`, `config`, `logger`
- `web`, `admin`, `gateway`

### Subject

- Use imperative, present tense: "add" not "added" nor "adds"
- Don't capitalize the first letter
- No period (.) at the end
- Keep under 72 characters

### Body

- Explain **what** and **why**, not **how**
- Wrap at 72 characters
- Separate from subject with a blank line

### Footer

- Reference related stories or issues
  - `Story: 1.2`
  - `Closes #123`
  - `Fixes #456`
- Document breaking changes
  - `BREAKING CHANGE: description`

### Examples

#### Simple Commit
```
feat(document): add version comparison feature

Implements semantic version comparison for legal documents
with highlight diff visualization.

Story: 2.3
```

#### Bug Fix
```
fix(auth): prevent token expiration during active session

Adds token refresh logic before expiration when user is active.
Fixes session timeout issues reported by QA team.

Fixes #789
Story: 1.4
```

#### Breaking Change
```
refactor(api)!: change GraphQL schema for documents

BREAKING CHANGE: Document.versions field now returns
DocumentVersion[] instead of string[]. Clients must update
queries to access version.id and version.content.

Story: 3.1
```

## Branch Naming

Use descriptive branch names with the following prefixes:

- **feature/**: New features
  - Example: `feature/document-version-control`
- **bugfix/**: Bug fixes
  - Example: `bugfix/auth-token-expiration`
- **hotfix/**: Critical production fixes
  - Example: `hotfix/security-vulnerability-patch`
- **docs/**: Documentation updates
  - Example: `docs/api-documentation-update`
- **refactor/**: Code refactoring
  - Example: `refactor/simplify-graphql-resolvers`
- **test/**: Test additions or updates
  - Example: `test/add-integration-tests-task-service`
- **chore/**: Maintenance tasks
  - Example: `chore/upgrade-dependencies`

## Pull Request Process

1. **Before Creating PR**:
   - Ensure all tests pass: `pnpm test`
   - Run linting: `pnpm lint`
   - Verify build succeeds: `pnpm build`
   - Update documentation if needed
   - Self-review your code

2. **Creating the PR**:
   - Use the pull request template
   - Provide clear description and context
   - Link related story/issue
   - Add screenshots for UI changes
   - Mark as draft if work in progress

3. **Review Process**:
   - At least one approval required
   - Address all review comments
   - Keep PR scope focused and reasonable
   - Respond to feedback promptly

4. **After Approval**:
   - Ensure branch is up-to-date with main
   - Squash commits if requested
   - Merge using "Squash and Merge" strategy

## Code Standards

Please follow our coding standards documented in [docs/architecture/coding-standards.md](docs/architecture/coding-standards.md):

- **Type Sharing**: All types in `packages/shared/types`
- **No Direct HTTP Calls**: Use service layers
- **Environment Variables**: Access through config objects
- **Error Handling**: Use standard error handlers
- **Naming Conventions**:
  - Components: PascalCase (`UserProfile.tsx`)
  - API Routes: kebab-case (`/api/user-profile`)
  - Database Tables: snake_case (`user_profiles`)

## Testing Requirements

All code changes must include appropriate tests:

- **Unit Tests**: For individual functions and components
- **Integration Tests**: For service interactions
- **E2E Tests**: For critical user workflows (when applicable)

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm test --filter=@legal-platform/document-service

# Run tests in watch mode
pnpm test -- --watch

# Generate coverage report
pnpm test -- --coverage
```

## Questions or Issues?

If you have questions or encounter issues:

1. Check existing documentation in `docs/`
2. Review related stories in `docs/stories/`
3. Ask in pull request comments
4. Contact the development team

---

Thank you for contributing to Legal Platform! Your efforts help build better tools for legal professionals.
