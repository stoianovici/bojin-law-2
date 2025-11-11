# Coding Standards

## Critical Fullstack Rules
- **Type Sharing:** Always define types in packages/shared/types
- **API Calls:** Never make direct HTTP calls - use service layers
- **Environment Variables:** Access only through config objects
- **Error Handling:** All API routes must use standard error handler
- **State Updates:** Never mutate state directly
- **Database Access:** Only through repository pattern
- **AI Token Usage:** Always track token usage
- **Authentication:** Never trust client-provided user IDs

## Naming Conventions
| Element | Frontend | Backend | Example |
|---------|----------|---------|---------|
| Components | PascalCase | - | `UserProfile.tsx` |
| API Routes | - | kebab-case | `/api/user-profile` |
| Database Tables | - | snake_case | `user_profiles` |
