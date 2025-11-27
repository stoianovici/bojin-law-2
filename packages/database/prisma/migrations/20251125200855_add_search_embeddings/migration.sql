-- CreateEnum
CREATE TYPE "SearchType" AS ENUM ('FullText', 'Semantic', 'Hybrid');

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "content_embedding" vector(1536),
ADD COLUMN     "search_text" TEXT;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "metadata_embedding" vector(1536);

-- CreateTable
CREATE TABLE "search_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "query" VARCHAR(500) NOT NULL,
    "search_type" "SearchType" NOT NULL,
    "filters" JSONB DEFAULT '{}',
    "result_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_history_user_id_created_at_idx" ON "search_history"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "search_history_firm_id_idx" ON "search_history"("firm_id");

-- CreateIndex
CREATE INDEX "search_history_query_idx" ON "search_history"("query");

-- ============================================================================
-- Story 2.10: Full-Text Search Indexes (GIN)
-- ============================================================================

-- GIN index for full-text search on cases (title, description, case_number, search_text)
-- Using 'simple' configuration for now; can switch to 'romanian' for Romanian language support
CREATE INDEX "idx_cases_fulltext" ON "cases" USING GIN (
  to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(case_number, '') || ' ' || COALESCE(search_text, ''))
);

-- GIN index for full-text search on documents (file_name, metadata->>'description')
CREATE INDEX "idx_documents_fulltext" ON "documents" USING GIN (
  to_tsvector('simple', COALESCE(file_name, '') || ' ' || COALESCE(metadata->>'description', '') || ' ' || COALESCE(metadata->>'tags', ''))
);

-- ============================================================================
-- Story 2.10: Vector Similarity Search Indexes (HNSW)
-- ============================================================================

-- HNSW index for fast approximate nearest neighbor search on case embeddings
-- Using cosine distance operator for similarity search
-- Parameters: m=16 (connections per layer), ef_construction=64 (build-time accuracy)
CREATE INDEX "idx_cases_embedding_hnsw" ON "cases" USING hnsw (content_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- HNSW index for fast approximate nearest neighbor search on document embeddings
CREATE INDEX "idx_documents_embedding_hnsw" ON "documents" USING hnsw (metadata_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
