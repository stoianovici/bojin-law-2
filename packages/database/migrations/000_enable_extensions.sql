-- Migration 000: Enable Required PostgreSQL Extensions
-- Description: Enables pgvector, uuid-ossp, and pg_trgm extensions
-- Author: Dev Agent (Story 2.2)
-- Date: 2025-11-20
--
-- This migration must be run FIRST before any other migrations, as they depend on these extensions.
--
-- Run this migration:
--   psql $DATABASE_URL -f packages/database/migrations/000_enable_extensions.sql
--
-- Verify extensions:
--   psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp', 'pg_trgm');"

-- Enable UUID generation extension
-- Required for: UUID primary keys across all tables
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector extension for vector similarity search
-- Required for: AI embeddings and semantic search (Story 2.10)
-- Vector dimension: 1536 (OpenAI text-embedding-3-small and Claude embeddings)
CREATE EXTENSION IF NOT EXISTS "vector";

-- Enable trigram extension for full-text search
-- Required for: Fast text search on case names, document titles, legal entity names
-- Enables GIN/GIST indexes for pattern matching and fuzzy search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Verify all extensions are installed
DO $$
DECLARE
    ext_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO ext_count
    FROM pg_extension
    WHERE extname IN ('uuid-ossp', 'vector', 'pg_trgm');

    IF ext_count = 3 THEN
        RAISE NOTICE 'SUCCESS: All 3 required extensions are installed';
        RAISE NOTICE '  ✓ uuid-ossp: UUID generation';
        RAISE NOTICE '  ✓ vector: pgvector for embeddings';
        RAISE NOTICE '  ✓ pg_trgm: Trigram search';
    ELSE
        RAISE EXCEPTION 'FAILED: Only % of 3 required extensions installed', ext_count;
    END IF;
END $$;
