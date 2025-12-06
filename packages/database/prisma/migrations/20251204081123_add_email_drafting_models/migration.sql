/*
  Warnings:

  - The primary key for the `document_embeddings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `document_patterns` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `template_library` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `training_documents` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `training_pipeline_runs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `type` on the `cases` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `pattern_type` on the `document_patterns` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `frequency` on table `document_patterns` required. This step will fail if there are existing NULL values in that column.
  - Made the column `usage_count` on table `template_library` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `run_type` on the `training_pipeline_runs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `status` on the `training_pipeline_runs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `documents_discovered` on table `training_pipeline_runs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `documents_processed` on table `training_pipeline_runs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `documents_failed` on table `training_pipeline_runs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `patterns_identified` on table `training_pipeline_runs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `templates_created` on table `training_pipeline_runs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `total_tokens_used` on table `training_pipeline_runs` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "PatternType" AS ENUM ('phrase', 'clause', 'structure');

-- CreateEnum
CREATE TYPE "PipelineRunType" AS ENUM ('scheduled', 'manual');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('ADDED', 'REMOVED', 'MODIFIED', 'MOVED');

-- CreateEnum
CREATE TYPE "ChangeSignificance" AS ENUM ('FORMATTING', 'MINOR_WORDING', 'SUBSTANTIVE', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ResponseType" AS ENUM ('ACCEPT', 'REJECT', 'COUNTER_PROPOSAL', 'CLARIFICATION');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "ReviewPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ConcernType" AS ENUM ('LEGAL_INCONSISTENCY', 'AMBIGUOUS_LANGUAGE', 'MISSING_CLAUSE', 'OUTDATED_REFERENCE', 'COMPLIANCE_ISSUE', 'STYLE_VIOLATION', 'HIGH_RISK_CLAUSE');

-- CreateEnum
CREATE TYPE "ConcernSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "ReviewAction" AS ENUM ('SUBMITTED', 'ASSIGNED', 'COMMENT_ADDED', 'COMMENT_RESOLVED', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'RESUBMITTED');

-- CreateEnum
CREATE TYPE "BatchReviewStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskTypeEnum" AS ENUM ('Research', 'DocumentCreation', 'DocumentRetrieval', 'CourtDate', 'Meeting', 'BusinessTrip');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('Pending', 'InProgress', 'Completed', 'Cancelled');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('Low', 'Medium', 'High', 'Urgent');

-- CreateEnum
CREATE TYPE "AttendeeResponse" AS ENUM ('Pending', 'Accepted', 'Declined', 'Tentative');

-- CreateEnum
CREATE TYPE "TaskDocumentLinkType" AS ENUM ('Source', 'Output', 'Reference');

-- CreateEnum
CREATE TYPE "DelegationStatus" AS ENUM ('Pending', 'Accepted', 'Declined');

-- CreateEnum
CREATE TYPE "OffsetType" AS ENUM ('CaseStart', 'PreviousTask', 'CaseDeadline');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('FinishToStart', 'StartToStart', 'FinishToFinish', 'StartToFinish');

-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('OutOfOffice', 'ReducedHours', 'Vacation', 'SickLeave', 'Training');

-- CreateEnum
CREATE TYPE "SkillType" AS ENUM ('Litigation', 'ContractDrafting', 'LegalResearch', 'ClientCommunication', 'CourtProcedures', 'DocumentReview', 'Negotiation', 'DueDiligence', 'RegulatoryCompliance', 'IntellectualProperty');

-- CreateEnum
CREATE TYPE "TaskHistoryAction" AS ENUM ('Created', 'Updated', 'StatusChanged', 'AssigneeChanged', 'PriorityChanged', 'DueDateChanged', 'CommentAdded', 'CommentEdited', 'CommentDeleted', 'AttachmentAdded', 'AttachmentRemoved', 'SubtaskCreated', 'SubtaskCompleted', 'DependencyAdded', 'DependencyRemoved', 'Delegated');

-- CreateEnum
CREATE TYPE "CaseActivityType" AS ENUM ('TaskCreated', 'TaskStatusChanged', 'TaskCompleted', 'TaskAssigned', 'TaskCommented', 'DocumentUploaded', 'DocumentVersioned', 'CommunicationReceived', 'CommunicationSent', 'DeadlineApproaching', 'MilestoneReached');

-- CreateEnum
CREATE TYPE "SnapshotType" AS ENUM ('Daily', 'Weekly', 'Monthly');

-- CreateEnum
CREATE TYPE "TaskPatternType" AS ENUM ('CoOccurrence', 'Sequence', 'CaseTypeSpecific');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('Pending', 'Converted', 'Dismissed', 'Expired');

-- CreateEnum
CREATE TYPE "RiskType" AS ENUM ('ClientDissatisfaction', 'DeadlineRisk', 'ScopeCreep', 'PaymentRisk', 'RelationshipRisk');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('Low', 'Medium', 'High');

-- CreateEnum
CREATE TYPE "EmailTone" AS ENUM ('Formal', 'Professional', 'Brief', 'Detailed');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('Client', 'OpposingCounsel', 'Court', 'ThirdParty', 'Internal');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('Generated', 'Editing', 'Ready', 'Sent', 'Discarded');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DocumentReviewRequested';
ALTER TYPE "NotificationType" ADD VALUE 'DocumentReviewAssigned';
ALTER TYPE "NotificationType" ADD VALUE 'DocumentApproved';
ALTER TYPE "NotificationType" ADD VALUE 'DocumentRejected';
ALTER TYPE "NotificationType" ADD VALUE 'DocumentRevisionRequested';
ALTER TYPE "NotificationType" ADD VALUE 'DocumentCommentAdded';
ALTER TYPE "NotificationType" ADD VALUE 'DocumentCommentMentioned';
ALTER TYPE "NotificationType" ADD VALUE 'DelegationRequested';
ALTER TYPE "NotificationType" ADD VALUE 'DelegationAccepted';
ALTER TYPE "NotificationType" ADD VALUE 'DelegationDeclined';
ALTER TYPE "NotificationType" ADD VALUE 'TaskDeadlineReminder';
ALTER TYPE "NotificationType" ADD VALUE 'TaskOverdue';
ALTER TYPE "NotificationType" ADD VALUE 'DependencyBlocked';
ALTER TYPE "NotificationType" ADD VALUE 'DependencyUnblocked';
ALTER TYPE "NotificationType" ADD VALUE 'TaskCommentAdded';
ALTER TYPE "NotificationType" ADD VALUE 'TaskCommentMentioned';
ALTER TYPE "NotificationType" ADD VALUE 'TaskCommentReplied';
ALTER TYPE "NotificationType" ADD VALUE 'TaskStatusUpdated';
ALTER TYPE "NotificationType" ADD VALUE 'SubtaskCreated';
ALTER TYPE "NotificationType" ADD VALUE 'TaskAttachmentAdded';

-- DropForeignKey
ALTER TABLE "document_embeddings" DROP CONSTRAINT "document_embeddings_document_id_fkey";

-- DropForeignKey
ALTER TABLE "template_library" DROP CONSTRAINT "template_library_base_document_id_fkey";

-- DropIndex
DROP INDEX "idx_embeddings_vector";

-- DropIndex
DROP INDEX "idx_patterns_frequency";

-- DropIndex
DROP INDEX "idx_templates_quality";

-- DropIndex
DROP INDEX "idx_templates_usage";

-- DropIndex
DROP INDEX "idx_training_docs_text_search";

-- DropIndex
DROP INDEX "idx_pipeline_runs_started";

-- AlterTable
ALTER TABLE "cases" DROP COLUMN "type",
ADD COLUMN     "type" VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE "document_embeddings" DROP CONSTRAINT "document_embeddings_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "document_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "document_embeddings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "document_patterns" DROP CONSTRAINT "document_patterns_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
DROP COLUMN "pattern_type",
ADD COLUMN     "pattern_type" "PatternType" NOT NULL,
ALTER COLUMN "frequency" SET NOT NULL,
ALTER COLUMN "document_ids" SET DATA TYPE TEXT[],
ALTER COLUMN "updated_at" DROP DEFAULT,
ADD CONSTRAINT "document_patterns_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "task_id" TEXT;

-- AlterTable
ALTER TABLE "template_library" DROP CONSTRAINT "template_library_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "base_document_id" SET DATA TYPE TEXT,
ALTER COLUMN "similar_document_ids" SET DATA TYPE TEXT[],
ALTER COLUMN "usage_count" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT,
ADD CONSTRAINT "template_library_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "narrative" TEXT,
ADD COLUMN     "task_id" TEXT;

-- AlterTable
ALTER TABLE "training_documents" DROP CONSTRAINT "training_documents_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "training_documents_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "training_pipeline_runs" DROP CONSTRAINT "training_pipeline_runs_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
DROP COLUMN "run_type",
ADD COLUMN     "run_type" "PipelineRunType" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "PipelineStatus" NOT NULL,
ALTER COLUMN "documents_discovered" SET NOT NULL,
ALTER COLUMN "documents_processed" SET NOT NULL,
ALTER COLUMN "documents_failed" SET NOT NULL,
ALTER COLUMN "patterns_identified" SET NOT NULL,
ALTER COLUMN "templates_created" SET NOT NULL,
ALTER COLUMN "total_tokens_used" SET NOT NULL,
ADD CONSTRAINT "training_pipeline_runs_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "case_type_configs" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "case_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_draft_metrics" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "initial_word_count" INTEGER NOT NULL,
    "final_word_count" INTEGER,
    "characters_added" INTEGER NOT NULL DEFAULT 0,
    "characters_removed" INTEGER NOT NULL DEFAULT 0,
    "edit_percentage" DECIMAL(5,2) NOT NULL,
    "time_to_finalize_minutes" INTEGER,
    "user_rating" INTEGER,
    "generation_time_ms" INTEGER,
    "tokens_used" INTEGER,
    "model_used" VARCHAR(100),
    "template_id" TEXT,
    "precedent_ids" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "finalized_at" TIMESTAMPTZ,

    CONSTRAINT "document_draft_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_comments" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_id" TEXT,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "anchor_text" TEXT,
    "anchor_start" INTEGER,
    "anchor_end" INTEGER,
    "word_comment_id" VARCHAR(255),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_locks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lock_token" VARCHAR(64) NOT NULL,
    "locked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "session_type" VARCHAR(50) NOT NULL,

    CONSTRAINT "document_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semantic_changes" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "from_version_id" TEXT NOT NULL,
    "to_version_id" TEXT NOT NULL,
    "change_type" "ChangeType" NOT NULL,
    "significance" "ChangeSignificance" NOT NULL,
    "before_text" TEXT NOT NULL,
    "after_text" TEXT NOT NULL,
    "section_path" VARCHAR(500),
    "plain_summary" TEXT NOT NULL,
    "legal_classification" VARCHAR(100),
    "risk_level" "RiskLevel",
    "risk_explanation" TEXT,
    "ai_confidence" DECIMAL(3,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "semantic_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "version_comparison_cache" (
    "id" TEXT NOT NULL,
    "from_version_id" TEXT NOT NULL,
    "to_version_id" TEXT NOT NULL,
    "comparison_data" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "aggregate_risk" "RiskLevel" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "version_comparison_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response_suggestions" (
    "id" TEXT NOT NULL,
    "change_id" TEXT NOT NULL,
    "suggestion_type" "ResponseType" NOT NULL,
    "suggested_text" TEXT NOT NULL,
    "reasoning" TEXT,
    "language" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "response_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_reviews" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_to" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_at" TIMESTAMPTZ,
    "feedback" TEXT,
    "priority" "ReviewPriority" NOT NULL DEFAULT 'NORMAL',
    "due_date" DATE,
    "revision_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "document_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comments" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "anchor_text" TEXT,
    "anchor_start" INTEGER,
    "anchor_end" INTEGER,
    "section_path" VARCHAR(500),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMPTZ,
    "suggestion_text" TEXT,
    "is_ai_suggestion" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comment_replies" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_comment_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_review_concerns" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "concern_type" "ConcernType" NOT NULL,
    "severity" "ConcernSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "anchor_text" TEXT NOT NULL,
    "anchor_start" INTEGER NOT NULL,
    "anchor_end" INTEGER NOT NULL,
    "section_path" VARCHAR(500),
    "suggested_fix" TEXT,
    "ai_confidence" DECIMAL(3,2) NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissed_by" TEXT,
    "dismissed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_review_concerns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_history" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "action" "ReviewAction" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "previous_status" "ReviewStatus",
    "new_status" "ReviewStatus",
    "feedback" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_reviews" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "review_ids" TEXT[],
    "status" "BatchReviewStatus" NOT NULL,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "total_count" INTEGER NOT NULL,
    "common_feedback" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "batch_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_metrics" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DOUBLE PRECISION NOT NULL,
    "operation" VARCHAR(255) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_parse_patterns" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "input_pattern" TEXT NOT NULL,
    "task_type" "TaskTypeEnum" NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "last_used" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_parse_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_parse_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "input_text" TEXT NOT NULL,
    "detected_language" VARCHAR(10) NOT NULL,
    "parsed_result" JSONB NOT NULL,
    "was_accepted" BOOLEAN NOT NULL,
    "user_corrections" JSONB,
    "final_task_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_parse_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "type" "TaskTypeEnum" NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "assigned_to" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "due_time" VARCHAR(5),
    "status" "TaskStatus" NOT NULL DEFAULT 'Pending',
    "priority" "TaskPriority" NOT NULL DEFAULT 'Medium',
    "estimated_hours" DECIMAL(5,2),
    "type_metadata" JSONB,
    "parent_task_id" TEXT,
    "parse_history_id" TEXT,
    "template_step_id" TEXT,
    "template_usage_id" TEXT,
    "is_critical_path" BOOLEAN NOT NULL DEFAULT false,
    "blocked_reason" VARCHAR(500),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_attendees" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT,
    "external_name" VARCHAR(200),
    "external_email" VARCHAR(255),
    "is_organizer" BOOLEAN NOT NULL DEFAULT false,
    "response" "AttendeeResponse" NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_document_links" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "link_type" "TaskDocumentLinkType" NOT NULL,
    "notes" TEXT,
    "linked_by" TEXT NOT NULL,
    "linked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_document_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_delegations" (
    "id" TEXT NOT NULL,
    "source_task_id" TEXT NOT NULL,
    "delegated_task_id" TEXT,
    "delegated_to" TEXT NOT NULL,
    "delegated_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "DelegationStatus" NOT NULL DEFAULT 'Pending',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMPTZ,

    CONSTRAINT "task_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "case_type" "CaseType",
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_template_steps" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "task_type" "TaskTypeEnum" NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "estimated_hours" DECIMAL(5,2),
    "type_metadata" JSONB,
    "offset_days" INTEGER NOT NULL,
    "offset_from" "OffsetType" NOT NULL DEFAULT 'CaseStart',
    "is_parallel" BOOLEAN NOT NULL DEFAULT false,
    "is_critical_path" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_template_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_step_dependencies" (
    "id" TEXT NOT NULL,
    "source_step_id" TEXT NOT NULL,
    "target_step_id" TEXT NOT NULL,
    "dependency_type" "DependencyType" NOT NULL DEFAULT 'FinishToStart',
    "lag_days" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "template_step_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" TEXT NOT NULL,
    "predecessor_id" TEXT NOT NULL,
    "successor_id" TEXT NOT NULL,
    "dependency_type" "DependencyType" NOT NULL DEFAULT 'FinishToStart',
    "lag_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_template_usages" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "applied_by" TEXT NOT NULL,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "task_ids" TEXT[],

    CONSTRAINT "task_template_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_availabilities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "availability_type" "AvailabilityType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "hours_per_day" DECIMAL(4,2),
    "reason" VARCHAR(500),
    "auto_reassign" BOOLEAN NOT NULL DEFAULT true,
    "delegate_to" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_skills" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "skill_type" "SkillType" NOT NULL,
    "proficiency" INTEGER NOT NULL DEFAULT 3,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegation_handoffs" (
    "id" TEXT NOT NULL,
    "delegation_id" TEXT NOT NULL,
    "handoff_notes" TEXT NOT NULL,
    "context_summary" TEXT,
    "related_task_ids" TEXT[],
    "related_doc_ids" TEXT[],
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegation_handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_workload_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "daily_capacity_hours" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "weekly_capacity_hours" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "working_days" INTEGER[],
    "max_concurrent_tasks" INTEGER NOT NULL DEFAULT 10,
    "overload_threshold" DECIMAL(3,2) NOT NULL DEFAULT 1.2,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_workload_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parent_id" TEXT,
    "mentions" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "edited_at" TIMESTAMPTZ,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_history" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" "TaskHistoryAction" NOT NULL,
    "field" VARCHAR(100),
    "old_value" TEXT,
    "new_value" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_activity_entries" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "activity_type" "CaseActivityType" NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_activity_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_attachments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "document_id" TEXT,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "storage_url" VARCHAR(1000) NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previous_version_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_subscriptions" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "digest_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_task" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_document" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_comment" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "case_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_analytics_snapshots" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "snapshot_type" "SnapshotType" NOT NULL DEFAULT 'Daily',
    "total_tasks_created" INTEGER NOT NULL,
    "total_tasks_completed" INTEGER NOT NULL,
    "avg_completion_time_hours" DECIMAL(8,2) NOT NULL,
    "completion_by_type" JSONB NOT NULL,
    "completion_by_user" JSONB NOT NULL,
    "overdue_count" INTEGER NOT NULL,
    "overdue_by_type" JSONB NOT NULL,
    "overdue_by_user" JSONB NOT NULL,
    "bottleneck_tasks" JSONB NOT NULL,
    "velocity_score" DECIMAL(5,2) NOT NULL,
    "velocity_trend" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_pattern_analyses" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "pattern_type" "TaskPatternType" NOT NULL,
    "task_types" TEXT[],
    "case_types" "CaseType"[],
    "occurrence_count" INTEGER NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "suggested_name" VARCHAR(200),
    "avg_sequence_gap" DECIMAL(5,2),
    "common_assignees" TEXT[],
    "is_template_created" BOOLEAN NOT NULL DEFAULT false,
    "template_id" TEXT,
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "analyzed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "task_pattern_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegation_analytics" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "analysis_month" DATE NOT NULL,
    "delegations_received" INTEGER NOT NULL,
    "delegations_given" INTEGER NOT NULL,
    "delegations_by_type" JSONB NOT NULL,
    "success_rate" DECIMAL(3,2) NOT NULL,
    "avg_completion_time" DECIMAL(8,2),
    "struggle_areas" TEXT[],
    "strength_areas" TEXT[],
    "suggested_training" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegation_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_roi_metrics" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "metric_month" DATE NOT NULL,
    "template_tasks_created" INTEGER NOT NULL,
    "manual_tasks_created" INTEGER NOT NULL,
    "estimated_time_saved_min" INTEGER NOT NULL,
    "nlp_tasks_created" INTEGER NOT NULL,
    "avg_parse_time_ms" INTEGER NOT NULL,
    "estimated_form_time_saved_min" INTEGER NOT NULL,
    "auto_reminders_sent" INTEGER NOT NULL,
    "auto_dependency_triggers" INTEGER NOT NULL,
    "auto_reassignments" INTEGER NOT NULL,
    "avg_hourly_rate" DECIMAL(10,2) NOT NULL,
    "total_value_saved" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_roi_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "graph_message_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "internet_message_id" TEXT,
    "subject" VARCHAR(1000) NOT NULL,
    "body_preview" VARCHAR(500) NOT NULL,
    "body_content" TEXT NOT NULL,
    "body_content_type" VARCHAR(10) NOT NULL,
    "from" JSONB NOT NULL,
    "to_recipients" JSONB NOT NULL,
    "cc_recipients" JSONB NOT NULL,
    "bcc_recipients" JSONB NOT NULL,
    "received_date_time" TIMESTAMPTZ NOT NULL,
    "sent_date_time" TIMESTAMPTZ NOT NULL,
    "has_attachments" BOOLEAN NOT NULL,
    "importance" VARCHAR(10) NOT NULL,
    "is_read" BOOLEAN NOT NULL,
    "user_id" TEXT NOT NULL,
    "case_id" TEXT,
    "firm_id" TEXT NOT NULL,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_attachments" (
    "id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "graph_attachment_id" TEXT NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "content_type" VARCHAR(200) NOT NULL,
    "size" INTEGER NOT NULL,
    "storage_url" TEXT,
    "document_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sync_states" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "delta_token" TEXT,
    "subscription_id" VARCHAR(255),
    "subscription_expiry" TIMESTAMPTZ,
    "last_sync_at" TIMESTAMPTZ,
    "sync_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "email_sync_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_deadlines" (
    "id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "case_id" TEXT,
    "firm_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "due_date" TIMESTAMPTZ NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'Pending',
    "converted_task_id" TEXT,
    "dismissed_at" TIMESTAMPTZ,
    "dismiss_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "extracted_deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_commitments" (
    "id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "case_id" TEXT,
    "firm_id" TEXT NOT NULL,
    "party" VARCHAR(200) NOT NULL,
    "commitment_text" TEXT NOT NULL,
    "due_date" TIMESTAMPTZ,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'Pending',
    "converted_task_id" TEXT,
    "dismissed_at" TIMESTAMPTZ,
    "dismiss_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "extracted_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_action_items" (
    "id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "case_id" TEXT,
    "firm_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggested_assignee" VARCHAR(200),
    "priority" "TaskPriority" NOT NULL DEFAULT 'Medium',
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'Pending',
    "converted_task_id" TEXT,
    "dismissed_at" TIMESTAMPTZ,
    "dismiss_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "extracted_action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_questions" (
    "id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "case_id" TEXT,
    "firm_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "respond_by" TIMESTAMPTZ,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'Pending',
    "is_answered" BOOLEAN NOT NULL DEFAULT false,
    "answered_at" TIMESTAMPTZ,
    "dismissed_at" TIMESTAMPTZ,
    "dismiss_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "extracted_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_indicators" (
    "id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "case_id" TEXT,
    "firm_id" TEXT NOT NULL,
    "type" "RiskType" NOT NULL,
    "severity" "RiskSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "suggested_action" TEXT,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMPTZ,
    "resolved_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "risk_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thread_summaries" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "case_id" TEXT,
    "firm_id" TEXT NOT NULL,
    "opposing_counsel_position" TEXT,
    "key_arguments" JSONB,
    "position_changes" JSONB,
    "last_analyzed_at" TIMESTAMPTZ NOT NULL,
    "message_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "thread_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_drafts" (
    "id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "case_id" TEXT,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tone" "EmailTone" NOT NULL DEFAULT 'Professional',
    "recipientType" "RecipientType" NOT NULL DEFAULT 'Client',
    "subject" VARCHAR(500) NOT NULL,
    "body" TEXT NOT NULL,
    "html_body" TEXT,
    "suggested_attachments" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'Generated',
    "user_edits" JSONB,
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "email_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_refinements" (
    "id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "previous_body" TEXT NOT NULL,
    "refined_body" TEXT NOT NULL,
    "tokens_used" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_refinements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment_suggestions" (
    "id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "reason" TEXT NOT NULL,
    "relevance_score" DOUBLE PRECISION NOT NULL,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_type_configs_firm_id_idx" ON "case_type_configs"("firm_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_type_configs_firm_id_code_key" ON "case_type_configs"("firm_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "document_draft_metrics_document_id_key" ON "document_draft_metrics"("document_id");

-- CreateIndex
CREATE INDEX "document_draft_metrics_firm_id_idx" ON "document_draft_metrics"("firm_id");

-- CreateIndex
CREATE INDEX "document_draft_metrics_user_id_idx" ON "document_draft_metrics"("user_id");

-- CreateIndex
CREATE INDEX "document_draft_metrics_document_type_idx" ON "document_draft_metrics"("document_type");

-- CreateIndex
CREATE INDEX "document_draft_metrics_edit_percentage_idx" ON "document_draft_metrics"("edit_percentage");

-- CreateIndex
CREATE INDEX "document_draft_metrics_created_at_idx" ON "document_draft_metrics"("created_at");

-- CreateIndex
CREATE INDEX "document_draft_metrics_user_rating_idx" ON "document_draft_metrics"("user_rating");

-- CreateIndex
CREATE INDEX "document_comments_document_id_idx" ON "document_comments"("document_id");

-- CreateIndex
CREATE INDEX "document_comments_author_id_idx" ON "document_comments"("author_id");

-- CreateIndex
CREATE INDEX "document_comments_word_comment_id_idx" ON "document_comments"("word_comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_locks_document_id_key" ON "document_locks"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_locks_lock_token_key" ON "document_locks"("lock_token");

-- CreateIndex
CREATE INDEX "document_locks_user_id_idx" ON "document_locks"("user_id");

-- CreateIndex
CREATE INDEX "document_locks_expires_at_idx" ON "document_locks"("expires_at");

-- CreateIndex
CREATE INDEX "semantic_changes_document_id_idx" ON "semantic_changes"("document_id");

-- CreateIndex
CREATE INDEX "semantic_changes_from_version_id_idx" ON "semantic_changes"("from_version_id");

-- CreateIndex
CREATE INDEX "semantic_changes_to_version_id_idx" ON "semantic_changes"("to_version_id");

-- CreateIndex
CREATE INDEX "version_comparison_cache_expires_at_idx" ON "version_comparison_cache"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "version_comparison_cache_from_version_id_to_version_id_key" ON "version_comparison_cache"("from_version_id", "to_version_id");

-- CreateIndex
CREATE INDEX "response_suggestions_change_id_idx" ON "response_suggestions"("change_id");

-- CreateIndex
CREATE INDEX "document_reviews_document_id_idx" ON "document_reviews"("document_id");

-- CreateIndex
CREATE INDEX "document_reviews_firm_id_idx" ON "document_reviews"("firm_id");

-- CreateIndex
CREATE INDEX "document_reviews_submitted_by_idx" ON "document_reviews"("submitted_by");

-- CreateIndex
CREATE INDEX "document_reviews_assigned_to_idx" ON "document_reviews"("assigned_to");

-- CreateIndex
CREATE INDEX "document_reviews_status_idx" ON "document_reviews"("status");

-- CreateIndex
CREATE INDEX "review_comments_review_id_idx" ON "review_comments"("review_id");

-- CreateIndex
CREATE INDEX "review_comments_author_id_idx" ON "review_comments"("author_id");

-- CreateIndex
CREATE INDEX "review_comment_replies_comment_id_idx" ON "review_comment_replies"("comment_id");

-- CreateIndex
CREATE INDEX "ai_review_concerns_review_id_idx" ON "ai_review_concerns"("review_id");

-- CreateIndex
CREATE INDEX "review_history_review_id_idx" ON "review_history"("review_id");

-- CreateIndex
CREATE INDEX "review_history_timestamp_idx" ON "review_history"("timestamp");

-- CreateIndex
CREATE INDEX "batch_reviews_firm_id_idx" ON "batch_reviews"("firm_id");

-- CreateIndex
CREATE INDEX "batch_reviews_created_by_idx" ON "batch_reviews"("created_by");

-- CreateIndex
CREATE INDEX "performance_metrics_timestamp_idx" ON "performance_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "performance_metrics_operation_idx" ON "performance_metrics"("operation");

-- CreateIndex
CREATE INDEX "task_parse_patterns_firm_id_idx" ON "task_parse_patterns"("firm_id");

-- CreateIndex
CREATE INDEX "task_parse_patterns_task_type_idx" ON "task_parse_patterns"("task_type");

-- CreateIndex
CREATE INDEX "task_parse_patterns_frequency_idx" ON "task_parse_patterns"("frequency");

-- CreateIndex
CREATE INDEX "task_parse_history_firm_id_idx" ON "task_parse_history"("firm_id");

-- CreateIndex
CREATE INDEX "task_parse_history_user_id_idx" ON "task_parse_history"("user_id");

-- CreateIndex
CREATE INDEX "task_parse_history_created_at_idx" ON "task_parse_history"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_parse_history_id_key" ON "tasks"("parse_history_id");

-- CreateIndex
CREATE INDEX "tasks_firm_id_idx" ON "tasks"("firm_id");

-- CreateIndex
CREATE INDEX "tasks_case_id_idx" ON "tasks"("case_id");

-- CreateIndex
CREATE INDEX "tasks_assigned_to_idx" ON "tasks"("assigned_to");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");

-- CreateIndex
CREATE INDEX "tasks_type_idx" ON "tasks"("type");

-- CreateIndex
CREATE INDEX "tasks_parent_task_id_idx" ON "tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "task_attendees_task_id_idx" ON "task_attendees"("task_id");

-- CreateIndex
CREATE INDEX "task_document_links_task_id_idx" ON "task_document_links"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_document_links_task_id_document_id_key" ON "task_document_links"("task_id", "document_id");

-- CreateIndex
CREATE INDEX "task_delegations_source_task_id_idx" ON "task_delegations"("source_task_id");

-- CreateIndex
CREATE INDEX "task_delegations_delegated_to_idx" ON "task_delegations"("delegated_to");

-- CreateIndex
CREATE INDEX "task_delegations_start_date_end_date_idx" ON "task_delegations"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "task_templates_firm_id_idx" ON "task_templates"("firm_id");

-- CreateIndex
CREATE INDEX "task_templates_case_type_idx" ON "task_templates"("case_type");

-- CreateIndex
CREATE UNIQUE INDEX "task_templates_firm_id_name_key" ON "task_templates"("firm_id", "name");

-- CreateIndex
CREATE INDEX "task_template_steps_template_id_idx" ON "task_template_steps"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_template_steps_template_id_step_order_key" ON "task_template_steps"("template_id", "step_order");

-- CreateIndex
CREATE UNIQUE INDEX "template_step_dependencies_source_step_id_target_step_id_key" ON "template_step_dependencies"("source_step_id", "target_step_id");

-- CreateIndex
CREATE INDEX "task_dependencies_predecessor_id_idx" ON "task_dependencies"("predecessor_id");

-- CreateIndex
CREATE INDEX "task_dependencies_successor_id_idx" ON "task_dependencies"("successor_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_predecessor_id_successor_id_key" ON "task_dependencies"("predecessor_id", "successor_id");

-- CreateIndex
CREATE INDEX "task_template_usages_template_id_idx" ON "task_template_usages"("template_id");

-- CreateIndex
CREATE INDEX "task_template_usages_case_id_idx" ON "task_template_usages"("case_id");

-- CreateIndex
CREATE INDEX "user_availabilities_user_id_idx" ON "user_availabilities"("user_id");

-- CreateIndex
CREATE INDEX "user_availabilities_firm_id_idx" ON "user_availabilities"("firm_id");

-- CreateIndex
CREATE INDEX "user_availabilities_start_date_end_date_idx" ON "user_availabilities"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "user_skills_firm_id_idx" ON "user_skills"("firm_id");

-- CreateIndex
CREATE INDEX "user_skills_skill_type_idx" ON "user_skills"("skill_type");

-- CreateIndex
CREATE UNIQUE INDEX "user_skills_user_id_skill_type_key" ON "user_skills"("user_id", "skill_type");

-- CreateIndex
CREATE UNIQUE INDEX "delegation_handoffs_delegation_id_key" ON "delegation_handoffs"("delegation_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_workload_settings_user_id_key" ON "user_workload_settings"("user_id");

-- CreateIndex
CREATE INDEX "user_workload_settings_firm_id_idx" ON "user_workload_settings"("firm_id");

-- CreateIndex
CREATE INDEX "task_comments_task_id_idx" ON "task_comments"("task_id");

-- CreateIndex
CREATE INDEX "task_comments_author_id_idx" ON "task_comments"("author_id");

-- CreateIndex
CREATE INDEX "task_comments_created_at_idx" ON "task_comments"("created_at");

-- CreateIndex
CREATE INDEX "task_history_task_id_idx" ON "task_history"("task_id");

-- CreateIndex
CREATE INDEX "task_history_actor_id_idx" ON "task_history"("actor_id");

-- CreateIndex
CREATE INDEX "task_history_created_at_idx" ON "task_history"("created_at");

-- CreateIndex
CREATE INDEX "case_activity_entries_case_id_idx" ON "case_activity_entries"("case_id");

-- CreateIndex
CREATE INDEX "case_activity_entries_actor_id_idx" ON "case_activity_entries"("actor_id");

-- CreateIndex
CREATE INDEX "case_activity_entries_created_at_idx" ON "case_activity_entries"("created_at");

-- CreateIndex
CREATE INDEX "case_activity_entries_entity_type_entity_id_idx" ON "case_activity_entries"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "task_attachments_task_id_idx" ON "task_attachments"("task_id");

-- CreateIndex
CREATE INDEX "task_attachments_document_id_idx" ON "task_attachments"("document_id");

-- CreateIndex
CREATE INDEX "task_attachments_uploaded_by_idx" ON "task_attachments"("uploaded_by");

-- CreateIndex
CREATE INDEX "case_subscriptions_user_id_idx" ON "case_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "case_subscriptions_digest_enabled_idx" ON "case_subscriptions"("digest_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "case_subscriptions_case_id_user_id_key" ON "case_subscriptions"("case_id", "user_id");

-- CreateIndex
CREATE INDEX "task_analytics_snapshots_firm_id_idx" ON "task_analytics_snapshots"("firm_id");

-- CreateIndex
CREATE INDEX "task_analytics_snapshots_snapshot_date_idx" ON "task_analytics_snapshots"("snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "task_analytics_snapshots_firm_id_snapshot_date_snapshot_typ_key" ON "task_analytics_snapshots"("firm_id", "snapshot_date", "snapshot_type");

-- CreateIndex
CREATE INDEX "task_pattern_analyses_firm_id_idx" ON "task_pattern_analyses"("firm_id");

-- CreateIndex
CREATE INDEX "task_pattern_analyses_pattern_type_idx" ON "task_pattern_analyses"("pattern_type");

-- CreateIndex
CREATE INDEX "task_pattern_analyses_confidence_idx" ON "task_pattern_analyses"("confidence");

-- CreateIndex
CREATE INDEX "delegation_analytics_firm_id_idx" ON "delegation_analytics"("firm_id");

-- CreateIndex
CREATE INDEX "delegation_analytics_user_id_idx" ON "delegation_analytics"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "delegation_analytics_firm_id_user_id_analysis_month_key" ON "delegation_analytics"("firm_id", "user_id", "analysis_month");

-- CreateIndex
CREATE INDEX "automation_roi_metrics_firm_id_idx" ON "automation_roi_metrics"("firm_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_roi_metrics_firm_id_metric_month_key" ON "automation_roi_metrics"("firm_id", "metric_month");

-- CreateIndex
CREATE UNIQUE INDEX "emails_graph_message_id_key" ON "emails"("graph_message_id");

-- CreateIndex
CREATE INDEX "emails_user_id_idx" ON "emails"("user_id");

-- CreateIndex
CREATE INDEX "emails_case_id_idx" ON "emails"("case_id");

-- CreateIndex
CREATE INDEX "emails_conversation_id_idx" ON "emails"("conversation_id");

-- CreateIndex
CREATE INDEX "emails_received_date_time_idx" ON "emails"("received_date_time");

-- CreateIndex
CREATE INDEX "emails_firm_id_idx" ON "emails"("firm_id");

-- CreateIndex
CREATE INDEX "email_attachments_email_id_idx" ON "email_attachments"("email_id");

-- CreateIndex
CREATE INDEX "email_attachments_document_id_idx" ON "email_attachments"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_sync_states_user_id_key" ON "email_sync_states"("user_id");

-- CreateIndex
CREATE INDEX "extracted_deadlines_email_id_idx" ON "extracted_deadlines"("email_id");

-- CreateIndex
CREATE INDEX "extracted_deadlines_case_id_idx" ON "extracted_deadlines"("case_id");

-- CreateIndex
CREATE INDEX "extracted_deadlines_status_idx" ON "extracted_deadlines"("status");

-- CreateIndex
CREATE INDEX "extracted_commitments_email_id_idx" ON "extracted_commitments"("email_id");

-- CreateIndex
CREATE INDEX "extracted_commitments_case_id_idx" ON "extracted_commitments"("case_id");

-- CreateIndex
CREATE INDEX "extracted_action_items_email_id_idx" ON "extracted_action_items"("email_id");

-- CreateIndex
CREATE INDEX "extracted_action_items_case_id_idx" ON "extracted_action_items"("case_id");

-- CreateIndex
CREATE INDEX "extracted_questions_email_id_idx" ON "extracted_questions"("email_id");

-- CreateIndex
CREATE INDEX "extracted_questions_case_id_idx" ON "extracted_questions"("case_id");

-- CreateIndex
CREATE INDEX "extracted_questions_status_idx" ON "extracted_questions"("status");

-- CreateIndex
CREATE INDEX "risk_indicators_case_id_idx" ON "risk_indicators"("case_id");

-- CreateIndex
CREATE INDEX "risk_indicators_type_idx" ON "risk_indicators"("type");

-- CreateIndex
CREATE INDEX "risk_indicators_severity_idx" ON "risk_indicators"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "thread_summaries_conversation_id_key" ON "thread_summaries"("conversation_id");

-- CreateIndex
CREATE INDEX "thread_summaries_case_id_idx" ON "thread_summaries"("case_id");

-- CreateIndex
CREATE INDEX "email_drafts_email_id_idx" ON "email_drafts"("email_id");

-- CreateIndex
CREATE INDEX "email_drafts_case_id_idx" ON "email_drafts"("case_id");

-- CreateIndex
CREATE INDEX "email_drafts_user_id_idx" ON "email_drafts"("user_id");

-- CreateIndex
CREATE INDEX "email_drafts_status_idx" ON "email_drafts"("status");

-- CreateIndex
CREATE INDEX "draft_refinements_draft_id_idx" ON "draft_refinements"("draft_id");

-- CreateIndex
CREATE INDEX "attachment_suggestions_draft_id_idx" ON "attachment_suggestions"("draft_id");

-- CreateIndex
CREATE INDEX "document_patterns_pattern_type_idx" ON "document_patterns"("pattern_type");

-- CreateIndex
CREATE INDEX "document_patterns_frequency_idx" ON "document_patterns"("frequency");

-- CreateIndex
CREATE INDEX "template_library_usage_count_idx" ON "template_library"("usage_count");

-- CreateIndex
CREATE INDEX "template_library_quality_score_idx" ON "template_library"("quality_score");

-- CreateIndex
CREATE INDEX "time_entries_task_id_idx" ON "time_entries"("task_id");

-- CreateIndex
CREATE INDEX "training_pipeline_runs_status_idx" ON "training_pipeline_runs"("status");

-- CreateIndex
CREATE INDEX "training_pipeline_runs_started_at_idx" ON "training_pipeline_runs"("started_at");

-- AddForeignKey
ALTER TABLE "case_type_configs" ADD CONSTRAINT "case_type_configs_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_type_configs" ADD CONSTRAINT "case_type_configs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "training_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_library" ADD CONSTRAINT "template_library_base_document_id_fkey" FOREIGN KEY ("base_document_id") REFERENCES "training_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_changes" ADD CONSTRAINT "semantic_changes_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_changes" ADD CONSTRAINT "semantic_changes_from_version_id_fkey" FOREIGN KEY ("from_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_changes" ADD CONSTRAINT "semantic_changes_to_version_id_fkey" FOREIGN KEY ("to_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_comparison_cache" ADD CONSTRAINT "version_comparison_cache_from_version_id_fkey" FOREIGN KEY ("from_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_comparison_cache" ADD CONSTRAINT "version_comparison_cache_to_version_id_fkey" FOREIGN KEY ("to_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_suggestions" ADD CONSTRAINT "response_suggestions_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "semantic_changes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "document_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comment_replies" ADD CONSTRAINT "review_comment_replies_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "review_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comment_replies" ADD CONSTRAINT "review_comment_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_review_concerns" ADD CONSTRAINT "ai_review_concerns_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "document_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_history" ADD CONSTRAINT "review_history_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "document_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_history" ADD CONSTRAINT "review_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_reviews" ADD CONSTRAINT "batch_reviews_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_reviews" ADD CONSTRAINT "batch_reviews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parse_history_id_fkey" FOREIGN KEY ("parse_history_id") REFERENCES "task_parse_history"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attendees" ADD CONSTRAINT "task_attendees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attendees" ADD CONSTRAINT "task_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_document_links" ADD CONSTRAINT "task_document_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_document_links" ADD CONSTRAINT "task_document_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_document_links" ADD CONSTRAINT "task_document_links_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_delegations" ADD CONSTRAINT "task_delegations_source_task_id_fkey" FOREIGN KEY ("source_task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_delegations" ADD CONSTRAINT "task_delegations_delegated_task_id_fkey" FOREIGN KEY ("delegated_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_delegations" ADD CONSTRAINT "task_delegations_delegated_to_fkey" FOREIGN KEY ("delegated_to") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_delegations" ADD CONSTRAINT "task_delegations_delegated_by_fkey" FOREIGN KEY ("delegated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_template_steps" ADD CONSTRAINT "task_template_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "task_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_step_dependencies" ADD CONSTRAINT "template_step_dependencies_source_step_id_fkey" FOREIGN KEY ("source_step_id") REFERENCES "task_template_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_step_dependencies" ADD CONSTRAINT "template_step_dependencies_target_step_id_fkey" FOREIGN KEY ("target_step_id") REFERENCES "task_template_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_successor_id_fkey" FOREIGN KEY ("successor_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_template_usages" ADD CONSTRAINT "task_template_usages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "task_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_template_usages" ADD CONSTRAINT "task_template_usages_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_availabilities" ADD CONSTRAINT "user_availabilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_availabilities" ADD CONSTRAINT "user_availabilities_delegate_to_fkey" FOREIGN KEY ("delegate_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_handoffs" ADD CONSTRAINT "delegation_handoffs_delegation_id_fkey" FOREIGN KEY ("delegation_id") REFERENCES "task_delegations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_workload_settings" ADD CONSTRAINT "user_workload_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "task_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_history" ADD CONSTRAINT "task_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_activity_entries" ADD CONSTRAINT "case_activity_entries_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_activity_entries" ADD CONSTRAINT "case_activity_entries_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "task_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_subscriptions" ADD CONSTRAINT "case_subscriptions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_subscriptions" ADD CONSTRAINT "case_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sync_states" ADD CONSTRAINT "email_sync_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_deadlines" ADD CONSTRAINT "extracted_deadlines_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_deadlines" ADD CONSTRAINT "extracted_deadlines_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_deadlines" ADD CONSTRAINT "extracted_deadlines_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_deadlines" ADD CONSTRAINT "extracted_deadlines_converted_task_id_fkey" FOREIGN KEY ("converted_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_commitments" ADD CONSTRAINT "extracted_commitments_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_commitments" ADD CONSTRAINT "extracted_commitments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_commitments" ADD CONSTRAINT "extracted_commitments_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_commitments" ADD CONSTRAINT "extracted_commitments_converted_task_id_fkey" FOREIGN KEY ("converted_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_action_items" ADD CONSTRAINT "extracted_action_items_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_action_items" ADD CONSTRAINT "extracted_action_items_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_action_items" ADD CONSTRAINT "extracted_action_items_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_action_items" ADD CONSTRAINT "extracted_action_items_converted_task_id_fkey" FOREIGN KEY ("converted_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_questions" ADD CONSTRAINT "extracted_questions_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_questions" ADD CONSTRAINT "extracted_questions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_questions" ADD CONSTRAINT "extracted_questions_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_indicators" ADD CONSTRAINT "risk_indicators_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_indicators" ADD CONSTRAINT "risk_indicators_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_indicators" ADD CONSTRAINT "risk_indicators_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_summaries" ADD CONSTRAINT "thread_summaries_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_summaries" ADD CONSTRAINT "thread_summaries_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_refinements" ADD CONSTRAINT "draft_refinements_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "email_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment_suggestions" ADD CONSTRAINT "attachment_suggestions_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "email_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment_suggestions" ADD CONSTRAINT "attachment_suggestions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_embeddings_document" RENAME TO "document_embeddings_document_id_idx";

-- RenameIndex
ALTER INDEX "idx_patterns_category" RENAME TO "document_patterns_category_idx";

-- RenameIndex
ALTER INDEX "idx_patterns_type" RENAME TO "document_patterns_pattern_type_idx";

-- RenameIndex
ALTER INDEX "idx_templates_category" RENAME TO "template_library_category_idx";

-- RenameIndex
ALTER INDEX "idx_training_docs_category" RENAME TO "training_documents_category_idx";

-- RenameIndex
ALTER INDEX "idx_training_docs_onedrive" RENAME TO "training_documents_one_drive_file_id_idx";

-- RenameIndex
ALTER INDEX "idx_training_docs_processed" RENAME TO "training_documents_processed_at_idx";

-- RenameIndex
ALTER INDEX "idx_pipeline_runs_status" RENAME TO "training_pipeline_runs_status_idx";
