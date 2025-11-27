-- Migration: Change embedding dimensions from 1536 (OpenAI/Voyage) to 768 (multilingual-e5-base)
-- This migration is required when switching to local multilingual-e5-base model
--
-- IMPORTANT: This migration will TRUNCATE embedding data.
-- Run the training pipeline CLI after this migration to regenerate embeddings.

-- ============================================================================
-- 1. Document Embeddings table (Story 3.2.6)
-- ============================================================================

-- Drop the existing index
DROP INDEX IF EXISTS idx_embeddings_vector;

-- Truncate existing embeddings (they're incompatible with new dimensions)
TRUNCATE TABLE document_embeddings;

-- Alter the column type to use 768 dimensions
ALTER TABLE document_embeddings
ALTER COLUMN embedding TYPE vector(768);

-- Recreate the index
CREATE INDEX idx_embeddings_vector ON document_embeddings
USING ivfflat (embedding vector_cosine_ops);

COMMENT ON COLUMN document_embeddings.embedding IS 'Vector embedding from multilingual-e5-base model (768 dimensions)';

-- ============================================================================
-- 2. Cases table - content_embedding column (Story 2.10)
-- ============================================================================

-- Drop old index if exists
DROP INDEX IF EXISTS idx_cases_content_embedding;

-- Clear existing embeddings (need to regenerate with new model)
UPDATE cases SET content_embedding = NULL WHERE content_embedding IS NOT NULL;

-- Alter column type
ALTER TABLE cases
ALTER COLUMN content_embedding TYPE vector(768);

-- ============================================================================
-- 3. Documents table - metadata_embedding column (Story 2.10)
-- ============================================================================

-- Drop old index if exists
DROP INDEX IF EXISTS idx_documents_metadata_embedding;

-- Clear existing embeddings
UPDATE documents SET metadata_embedding = NULL WHERE metadata_embedding IS NOT NULL;

-- Alter column type
ALTER TABLE documents
ALTER COLUMN metadata_embedding TYPE vector(768);

-- ============================================================================
-- 4. AI Response Cache table - prompt_embedding column (Story 3.1)
-- ============================================================================

-- Drop old index if exists
DROP INDEX IF EXISTS idx_ai_response_cache_prompt_embedding;

-- Clear existing embeddings
UPDATE ai_response_cache SET prompt_embedding = NULL WHERE prompt_embedding IS NOT NULL;

-- Alter column type
ALTER TABLE ai_response_cache
ALTER COLUMN prompt_embedding TYPE vector(768);

-- ============================================================================
-- Add comments documenting the model used
-- ============================================================================

COMMENT ON COLUMN cases.content_embedding IS 'Vector embedding from multilingual-e5-base model (768 dimensions)';
COMMENT ON COLUMN documents.metadata_embedding IS 'Vector embedding from multilingual-e5-base model (768 dimensions)';
COMMENT ON COLUMN ai_response_cache.prompt_embedding IS 'Vector embedding from multilingual-e5-base model (768 dimensions)';
