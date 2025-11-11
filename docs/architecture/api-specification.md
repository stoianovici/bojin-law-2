# API Specification

## GraphQL Schema

```graphql
# Scalar types for custom data
scalar DateTime
scalar UUID
scalar JSON
scalar Vector

# Enums
enum UserRole {
  PARTNER
  ASSOCIATE
  PARALEGAL
}

enum CaseStatus {
  ACTIVE
  ON_HOLD
  CLOSED
  ARCHIVED
}

enum DocumentType {
  CONTRACT
  MOTION
  LETTER
  MEMO
  PLEADING
  OTHER
}

enum TaskType {
  RESEARCH
  DOCUMENT_CREATION
  DOCUMENT_RETRIEVAL
  COURT_DATE
  MEETING
  BUSINESS_TRIP
}

# Input Types
input CreateCaseInput {
  title: String!
  clientId: UUID!
  type: CaseType!
  description: String!
  value: Float
  metadata: JSON
}

input CreateDocumentInput {
  caseId: UUID!
  title: String!
  type: DocumentType!
  content: String
  templateId: UUID
  aiPrompt: String
}

input NaturalLanguageTaskInput {
  text: String!
  caseId: UUID
  suggestedAssignee: UUID
}

# Types
type User {
  id: UUID!
  email: String!
  firstName: String!
  lastName: String!
  role: UserRole!
  firmId: UUID!
  preferences: UserPreferences!
  createdAt: DateTime!
  lastActive: DateTime!
  # Relations
  assignedTasks: [Task!]!
  timeEntries(from: DateTime, to: DateTime): [TimeEntry!]!
}

type Case {
  id: UUID!
  caseNumber: String!
  title: String!
  clientId: UUID!
  status: CaseStatus!
  type: CaseType!
  description: String!
  openedDate: DateTime!
  closedDate: DateTime
  value: Float
  metadata: JSON
  # Relations
  client: Client!
  teamMembers: [User!]!
  documents(type: DocumentType, status: DocumentStatus): [Document!]!
  tasks(status: TaskStatus, assigneeId: UUID): [Task!]!
  communications(limit: Int): [Communication!]!
  timeEntries(from: DateTime, to: DateTime): [TimeEntry!]!
}

# Mutations
type Mutation {
  # Cases
  createCase(input: CreateCaseInput!): Case!
  updateCase(id: UUID!, input: UpdateCaseInput!): Case!
  archiveCase(id: UUID!): Case!

  # Documents
  createDocument(input: CreateDocumentInput!): Document!
  generateDocumentWithAI(input: AIDocumentGenerationInput!): Document!
  updateDocument(id: UUID!, content: String!, createVersion: Boolean!): Document!
  approveDocument(id: UUID!, comments: String): Document!

  # Tasks
  createTask(input: CreateTaskInput!): Task!
  createTaskFromNaturalLanguage(input: NaturalLanguageTaskInput!): Task!
  updateTaskStatus(id: UUID!, status: TaskStatus!): Task!

  # Time Tracking
  createTimeEntry(input: TimeEntryInput!): TimeEntry!
  confirmAISuggestedTime(entryId: UUID!): TimeEntry!

  # Communications
  sendEmail(caseId: UUID!, draft: String!, to: [String!]!): Communication!
  processIncomingEmail(outlookMessageId: String!): Communication!
}

# Queries
type Query {
  # Current User
  me: User!

  # Dashboard
  dashboard(role: UserRole): DashboardMetrics!

  # Cases
  cases(status: CaseStatus, clientId: UUID, assignedToMe: Boolean): [Case!]!
  case(id: UUID!): Case
  searchCases(query: String!, limit: Int): [Case!]!

  # Documents
  document(id: UUID!): Document
  searchDocuments(input: DocumentSearchInput!): [Document!]!

  # Tasks
  tasks(status: TaskStatus, assigneeId: UUID, caseId: UUID): [Task!]!
  myTasks(includeCompleted: Boolean): [Task!]!

  # Time Tracking
  timeEntries(userId: UUID, caseId: UUID, from: DateTime!, to: DateTime!): [TimeEntry!]!
  suggestedTimeEntries: [TimeEntry!]!
}

# Subscriptions for real-time updates
type Subscription {
  # Real-time case updates
  caseUpdated(caseId: UUID!): Case!

  # Document collaboration
  documentUpdated(documentId: UUID!): Document!

  # Task notifications
  taskAssigned(userId: UUID!): Task!

  # AI suggestions
  aiSuggestionGenerated(userId: UUID!): AISuggestion!
}
```
