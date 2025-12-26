-- OPS-237: AI-generated search terms for fuzzy search
-- Add searchTerms and searchTermsUpdatedAt fields to Document and Case tables

-- Add search terms fields to documents table
ALTER TABLE "documents" ADD COLUMN "search_terms" TEXT;
ALTER TABLE "documents" ADD COLUMN "search_terms_updated_at" TIMESTAMPTZ;

-- Add search terms fields to cases table
ALTER TABLE "cases" ADD COLUMN "search_terms" TEXT;
ALTER TABLE "cases" ADD COLUMN "search_terms_updated_at" TIMESTAMPTZ;
