# Unified Project Structure

```plaintext
legal-platform/
├── .github/                           # CI/CD workflows
├── apps/                              # Deployable applications
│   ├── web/                          # Next.js frontend
│   └── admin/                        # Admin portal
├── services/                          # Backend microservices
│   ├── gateway/                      # GraphQL API Gateway
│   ├── document-service/
│   ├── task-service/
│   ├── ai-service/
│   ├── integration-service/
│   └── notification-service/
├── packages/                          # Shared packages
│   ├── shared/                       # Types & utilities
│   ├── ui/                           # UI components
│   ├── database/                     # Database config
│   ├── config/                       # Shared config
│   └── logger/                       # Logging
├── infrastructure/                   # Infrastructure as Code
│   ├── terraform/
│   ├── kubernetes/
│   └── docker/
├── scripts/                          # Build & deployment
├── docs/                            # Documentation
├── tests/                           # E2E tests
└── turbo.json                       # Turborepo config
```
