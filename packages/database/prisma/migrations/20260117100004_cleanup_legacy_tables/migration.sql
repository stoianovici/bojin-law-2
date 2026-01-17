-- ============================================================================
-- Cleanup Migration: Remove legacy tables and columns no longer in schema
-- ============================================================================

-- ============================================================================
-- 1. Drop foreign key constraints on legacy tables
-- ============================================================================
ALTER TABLE "ai_processing_logs" DROP CONSTRAINT IF EXISTS "ai_processing_logs_session_id_fkey";
ALTER TABLE "document_batches" DROP CONSTRAINT IF EXISTS "document_batches_session_id_fkey";
ALTER TABLE "document_completeness_checks" DROP CONSTRAINT IF EXISTS "document_completeness_checks_document_id_fkey";
ALTER TABLE "document_embeddings" DROP CONSTRAINT IF EXISTS "document_embeddings_document_id_fkey";
ALTER TABLE "draft_refinements" DROP CONSTRAINT IF EXISTS "draft_refinements_draft_id_fkey";
ALTER TABLE "extracted_documents" DROP CONSTRAINT IF EXISTS "extracted_documents_batch_id_fkey";
ALTER TABLE "extracted_documents" DROP CONSTRAINT IF EXISTS "extracted_documents_category_id_fkey";
ALTER TABLE "extracted_documents" DROP CONSTRAINT IF EXISTS "extracted_documents_session_id_fkey";
ALTER TABLE "import_categories" DROP CONSTRAINT IF EXISTS "import_categories_session_id_fkey";
ALTER TABLE "response_suggestions" DROP CONSTRAINT IF EXISTS "response_suggestions_change_id_fkey";
ALTER TABLE "retainer_period_usage" DROP CONSTRAINT IF EXISTS "retainer_period_usage_case_id_fkey";
ALTER TABLE "retainer_period_usage" DROP CONSTRAINT IF EXISTS "retainer_period_usage_firm_id_fkey";
ALTER TABLE "semantic_changes" DROP CONSTRAINT IF EXISTS "semantic_changes_document_id_fkey";
ALTER TABLE "semantic_changes" DROP CONSTRAINT IF EXISTS "semantic_changes_from_version_id_fkey";
ALTER TABLE "semantic_changes" DROP CONSTRAINT IF EXISTS "semantic_changes_to_version_id_fkey";
ALTER TABLE "suggestion_feedback" DROP CONSTRAINT IF EXISTS "suggestion_feedback_suggestion_id_fkey";
ALTER TABLE "task_template_steps" DROP CONSTRAINT IF EXISTS "task_template_steps_template_id_fkey";
ALTER TABLE "task_template_usages" DROP CONSTRAINT IF EXISTS "task_template_usages_case_id_fkey";
ALTER TABLE "task_template_usages" DROP CONSTRAINT IF EXISTS "task_template_usages_template_id_fkey";
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_parse_history_id_fkey";
ALTER TABLE "template_library" DROP CONSTRAINT IF EXISTS "template_library_base_document_id_fkey";
ALTER TABLE "template_step_dependencies" DROP CONSTRAINT IF EXISTS "template_step_dependencies_source_step_id_fkey";
ALTER TABLE "template_step_dependencies" DROP CONSTRAINT IF EXISTS "template_step_dependencies_target_step_id_fkey";
ALTER TABLE "version_comparison_cache" DROP CONSTRAINT IF EXISTS "version_comparison_cache_from_version_id_fkey";
ALTER TABLE "version_comparison_cache" DROP CONSTRAINT IF EXISTS "version_comparison_cache_to_version_id_fkey";

-- ============================================================================
-- 2. Drop indexes on columns being removed
-- ============================================================================
DROP INDEX IF EXISTS "tasks_parse_history_id_key";

-- ============================================================================
-- 3. Drop columns from existing tables
-- ============================================================================
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "parse_history_id";

-- ============================================================================
-- 4. Drop legacy tables (in dependency order)
-- ============================================================================
DROP TABLE IF EXISTS "ai_budget_settings";
DROP TABLE IF EXISTS "ai_processing_logs";
DROP TABLE IF EXISTS "ai_response_cache";
DROP TABLE IF EXISTS "ai_token_usage";
DROP TABLE IF EXISTS "automation_roi_metrics";
DROP TABLE IF EXISTS "database_health";
DROP TABLE IF EXISTS "delegation_analytics";
DROP TABLE IF EXISTS "document_completeness_checks";
DROP TABLE IF EXISTS "document_draft_metrics";
DROP TABLE IF EXISTS "document_embeddings";
DROP TABLE IF EXISTS "document_locks";
DROP TABLE IF EXISTS "document_patterns";
DROP TABLE IF EXISTS "draft_refinements";
DROP TABLE IF EXISTS "legacy_import_audit_logs";
DROP TABLE IF EXISTS "performance_metrics";
DROP TABLE IF EXISTS "response_suggestions";
DROP TABLE IF EXISTS "retainer_period_usage";
DROP TABLE IF EXISTS "search_history";
DROP TABLE IF EXISTS "semantic_changes";
DROP TABLE IF EXISTS "suggestion_feedback";
DROP TABLE IF EXISTS "task_analytics_snapshots";
DROP TABLE IF EXISTS "task_parse_history";
DROP TABLE IF EXISTS "task_parse_patterns";
DROP TABLE IF EXISTS "task_pattern_analyses";
DROP TABLE IF EXISTS "template_step_dependencies";
DROP TABLE IF EXISTS "task_template_steps";
DROP TABLE IF EXISTS "task_template_usages";
DROP TABLE IF EXISTS "template_library";
DROP TABLE IF EXISTS "training_documents";
DROP TABLE IF EXISTS "training_pipeline_runs";
DROP TABLE IF EXISTS "version_comparison_cache";
-- Tables with data (legacy import system)
DROP TABLE IF EXISTS "extracted_documents";
DROP TABLE IF EXISTS "document_batches";
DROP TABLE IF EXISTS "import_categories";

-- ============================================================================
-- 5. Fix columns that use legacy enums as defaults
-- ============================================================================
-- Remove the default that uses BulkLogStatus enum
ALTER TABLE "bulk_communication_logs" ALTER COLUMN "status" DROP DEFAULT;

-- ============================================================================
-- 6. Drop orphaned enum types
-- ============================================================================
DROP TYPE IF EXISTS "BulkLogStatus";
DROP TYPE IF EXISTS "SnapshotType";
