-- Story 3.2.6: AI Training Pipeline for Legacy Document Processing
-- Creates tables for training document storage, embeddings, patterns, and templates

-- Training Documents Table
CREATE TABLE training_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(255) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    original_folder_path TEXT,
    one_drive_file_id VARCHAR(255) UNIQUE NOT NULL,
    text_content TEXT NOT NULL,
    language VARCHAR(10) NOT NULL, -- 'ro' or 'en'
    word_count INTEGER,
    metadata JSONB, -- email subject, sender, date, etc.
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processing_duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_training_docs_category ON training_documents(category);
CREATE INDEX idx_training_docs_onedrive ON training_documents(one_drive_file_id);
CREATE INDEX idx_training_docs_processed ON training_documents(processed_at);

-- Document Embeddings Table
CREATE TABLE document_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES training_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536) NOT NULL, -- pgvector type
    token_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, chunk_index)
);

CREATE INDEX idx_embeddings_document ON document_embeddings(document_id);
CREATE INDEX idx_embeddings_vector ON document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Document Patterns Table
CREATE TABLE document_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(50) NOT NULL, -- 'phrase', 'clause', 'structure'
    pattern_text TEXT NOT NULL,
    frequency INTEGER DEFAULT 1,
    document_ids UUID[] NOT NULL, -- Array of document IDs containing this pattern
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_patterns_category ON document_patterns(category);
CREATE INDEX idx_patterns_type ON document_patterns(pattern_type);
CREATE INDEX idx_patterns_frequency ON document_patterns(frequency DESC);

-- Template Library Table
CREATE TABLE template_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(255) NOT NULL,
    name VARCHAR(500),
    base_document_id UUID REFERENCES training_documents(id),
    structure JSONB NOT NULL, -- Sections, headings, clause order
    similar_document_ids UUID[], -- Documents used to build this template
    usage_count INTEGER DEFAULT 0,
    quality_score DECIMAL(3,2), -- AI-assessed quality 0.00 to 1.00
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_templates_category ON template_library(category);
CREATE INDEX idx_templates_usage ON template_library(usage_count DESC);
CREATE INDEX idx_templates_quality ON template_library(quality_score DESC);

-- Training Pipeline Runs Table
CREATE TABLE training_pipeline_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_type VARCHAR(50) NOT NULL, -- 'scheduled', 'manual'
    status VARCHAR(50) NOT NULL, -- 'running', 'completed', 'failed'
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    documents_discovered INTEGER DEFAULT 0,
    documents_processed INTEGER DEFAULT 0,
    documents_failed INTEGER DEFAULT 0,
    patterns_identified INTEGER DEFAULT 0,
    templates_created INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    error_log JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pipeline_runs_status ON training_pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_started ON training_pipeline_runs(started_at DESC);
