# Rollback Procedures by Epic

## Epic 1 Rollback Procedures

- **UI Components:** Revert to previous component version via git
- **Design System:** Style changes can be rolled back via CSS variables
- **Prototype:** Previous versions maintained in Figma/design tool

## Epic 2 Rollback Procedures

- **Infrastructure:** Terraform state allows infrastructure rollback
- **Database:** Point-in-time recovery for data restoration
- **Authentication:** Azure AD app registration can be reconfigured
- **API:** GraphQL schema versioning allows rollback

## Epic 3 Rollback Procedures

- **AI Service:** Fallback to GPT-4 if Claude unavailable
- **Document Storage:** Blob storage versioning enables recovery
- **Templates:** Previous versions maintained in database

## Epic 4 Rollback Procedures

- **Task System:** Feature flags for gradual rollout
- **Time Tracking:** Manual entry fallback available
- **Workflows:** Previous workflow definitions preserved

## Epic 5 Rollback Procedures

- **Email Sync:** Can disable sync and use manual process
- **AI Features:** Graceful degradation to manual operations
- **Communications:** Fallback to direct Outlook access
