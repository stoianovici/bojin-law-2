-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'BusinessOwner';

-- DropIndex
DROP INDEX "idx_cases_embedding_hnsw";

-- DropIndex
DROP INDEX "idx_documents_embedding_hnsw";
