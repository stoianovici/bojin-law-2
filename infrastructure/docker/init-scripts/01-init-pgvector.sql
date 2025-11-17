-- Initialize pgvector extension for Legal Platform
-- This script runs automatically when the PostgreSQL container first starts

-- Create pgvector extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension installation
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'pgvector extension initialized successfully';
END$$;
