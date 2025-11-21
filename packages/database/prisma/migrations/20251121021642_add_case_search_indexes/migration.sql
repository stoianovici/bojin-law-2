-- Enable pg_trgm extension if not already enabled (should already be enabled from Story 2.2)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes for full-text search using pg_trgm
-- These indexes enable fast similarity searching on text fields

-- Index for case title search
CREATE INDEX IF NOT EXISTS idx_cases_title_trgm ON cases USING gin(title gin_trgm_ops);

-- Index for case description search
CREATE INDEX IF NOT EXISTS idx_cases_description_trgm ON cases USING gin(description gin_trgm_ops);

-- Index for client name search
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON clients USING gin(name gin_trgm_ops);

-- These indexes support the searchCases GraphQL query which uses the similarity() function
-- from pg_trgm to rank results by relevance
