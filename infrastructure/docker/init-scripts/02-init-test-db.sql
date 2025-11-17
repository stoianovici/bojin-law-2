-- Initialize test database for Legal Platform
-- This script runs automatically when the PostgreSQL container first starts

-- Create test database if it doesn't exist
SELECT 'CREATE DATABASE legal_platform_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'legal_platform_test')\gexec

-- Connect to test database and create pgvector extension
\c legal_platform_test

CREATE EXTENSION IF NOT EXISTS vector;

-- Create basic schema (will be managed by migrations in practice)
-- This is just for initial setup

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Test database initialized successfully';
END$$;
