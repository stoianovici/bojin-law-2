# Database Schema

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Custom types
CREATE TYPE user_role AS ENUM ('Partner', 'Associate', 'Paralegal');
CREATE TYPE case_status AS ENUM ('Active', 'OnHold', 'Closed', 'Archived');
CREATE TYPE document_status AS ENUM ('Draft', 'Review', 'Approved', 'Filed');
CREATE TYPE task_type AS ENUM ('Research', 'DocumentCreation', 'DocumentRetrieval', 'CourtDate', 'Meeting', 'BusinessTrip');

-- Tables
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    azure_ad_id VARCHAR(255) UNIQUE NOT NULL,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id UUID NOT NULL,
    case_number VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    client_id UUID NOT NULL,
    status case_status NOT NULL DEFAULT 'Active',
    type case_type NOT NULL,
    description TEXT,
    opened_date DATE NOT NULL DEFAULT CURRENT_DATE,
    closed_date DATE,
    UNIQUE(firm_id, case_number)
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id),
    title VARCHAR(500) NOT NULL,
    type document_type NOT NULL,
    current_version INTEGER NOT NULL DEFAULT 1,
    status document_status NOT NULL DEFAULT 'Draft',
    blob_storage_url TEXT NOT NULL,
    ai_generated BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id),
    content_embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

[Additional schema continues...]
```
