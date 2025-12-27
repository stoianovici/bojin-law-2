-- Initialize dual databases for Legal Platform
-- Creates separate databases for seed data and production imports
-- This script runs automatically when the PostgreSQL container first starts

-- Create seed database (primary development with clean seed data)
SELECT 'CREATE DATABASE legal_platform_seed'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'legal_platform_seed')\gexec

-- Create prod database (for production data imports)
SELECT 'CREATE DATABASE legal_platform_prod'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'legal_platform_prod')\gexec

-- Connect to seed database and create pgvector extension
\c legal_platform_seed
CREATE EXTENSION IF NOT EXISTS vector;

-- Connect to prod database and create pgvector extension
\c legal_platform_prod
CREATE EXTENSION IF NOT EXISTS vector;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Dual databases initialized: legal_platform_seed, legal_platform_prod';
END$$;
