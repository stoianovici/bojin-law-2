# Data Models

## User

**Purpose:** Represents legal professionals using the system with role-based access control

**Key Attributes:**

- id: UUID - Unique identifier (system-generated)
- email: string - Primary email address
- firstName: string - User's first name
- lastName: string - User's last name
- role: UserRole - Partner | Associate | Paralegal
- firmId: UUID - Associated law firm
- azureAdId: string - Microsoft 365/Azure AD identity for SSO authentication
- preferences: UserPreferences - AI behavior, UI settings
- createdAt: DateTime - Account creation timestamp
- lastActive: DateTime - Last activity timestamp

### TypeScript Interface

```typescript
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'Partner' | 'Associate' | 'Paralegal';
  firmId: string;
  azureAdId: string;
  preferences: UserPreferences;
  createdAt: Date;
  lastActive: Date;
}

export interface UserPreferences {
  language: 'ro' | 'en';
  aiSuggestionLevel: 'aggressive' | 'moderate' | 'minimal';
  emailDigestFrequency: 'realtime' | 'hourly' | 'daily';
  dashboardLayout: Record<string, any>;
  timeZone: string;
}
```

### Relationships

- Has many Cases (through CaseTeam)
- Has many Tasks (as assignee)
- Has many TimeEntries
- Has many Documents (as author)
- Belongs to one Firm

## Case

**Purpose:** Core legal matter entity containing all related information and documents

**Key Attributes:**

- id: UUID - Unique case identifier
- caseNumber: string - Human-readable case number
- title: string - Case title/name
- clientId: UUID - Associated client
- status: CaseStatus - Active | OnHold | Closed | Archived
- type: CaseType - Litigation | Contract | Advisory | Criminal | Other
- description: Text - Detailed case description
- openedDate: Date - Case start date
- closedDate: Date? - Case closure date (nullable)
- value: Decimal? - Monetary value if applicable
- metadata: JSONB - Flexible additional data

### TypeScript Interface

```typescript
export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  clientId: string;
  status: 'Active' | 'OnHold' | 'Closed' | 'Archived';
  type: 'Litigation' | 'Contract' | 'Advisory' | 'Criminal' | 'Other';
  description: string;
  openedDate: Date;
  closedDate?: Date;
  value?: number;
  metadata?: Record<string, any>;
  // Computed fields from relations
  teamMembers?: User[];
  client?: Client;
  documents?: Document[];
  tasks?: Task[];
}
```

### Relationships

- Belongs to one Client
- Has many Users (through CaseTeam)
- Has many Documents
- Has many Tasks
- Has many Communications
- Has many TimeEntries

## Document

**Purpose:** Legal documents with AI-powered versioning and semantic change tracking

**Key Attributes:**

- id: UUID - Unique document identifier
- caseId: UUID - Associated case
- title: string - Document title
- type: DocumentType - Contract | Motion | Letter | Memo | Other
- currentVersion: number - Latest version number
- status: DocumentStatus - Draft | Review | Approved | Filed
- oneDriveId: string? - Microsoft OneDrive file ID
- storageUrl: string - Document storage URL (Cloudflare R2 or Render Disk)
- aiGenerated: boolean - Whether AI created initial draft
- templateId: UUID? - Source template if applicable
- createdBy: UUID - Author user ID
- documentEmbedding: vector - Semantic search embedding

### TypeScript Interface

```typescript
export interface Document {
  id: string;
  caseId: string;
  title: string;
  type: 'Contract' | 'Motion' | 'Letter' | 'Memo' | 'Pleading' | 'Other';
  currentVersion: number;
  status: 'Draft' | 'Review' | 'Approved' | 'Filed';
  oneDriveId?: string;
  storageUrl: string;
  aiGenerated: boolean;
  templateId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  versions?: DocumentVersion[];
  case?: Case;
  author?: User;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  content: string;
  semanticChanges?: SemanticChange[];
  createdBy: string;
  createdAt: Date;
  changesSummary: string;
  riskLevel: 'Low' | 'Medium' | 'High';
}
```

### Relationships

- Belongs to one Case
- Has many DocumentVersions
- Belongs to one User (author)
- May belong to one Template

[Additional data models continue with Task, Communication, TimeEntry, and Client following the same pattern...]
