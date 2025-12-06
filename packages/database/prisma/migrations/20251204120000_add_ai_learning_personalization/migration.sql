-- Story 5.6: AI Learning and Personalization
-- This migration adds models for learning user preferences

-- CreateEnum
CREATE TYPE "SnippetCategory" AS ENUM ('Greeting', 'Closing', 'LegalPhrase', 'ClientResponse', 'InternalNote', 'Custom');

-- CreateEnum
CREATE TYPE "EditType" AS ENUM ('Addition', 'Deletion', 'Replacement', 'Reorder', 'StyleChange');

-- CreateTable
CREATE TABLE "writing_style_profiles" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "formality_level" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "average_sentence_length" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "vocabulary_complexity" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "preferred_tone" VARCHAR(50) NOT NULL DEFAULT 'Professional',
    "common_phrases" JSONB NOT NULL DEFAULT '[]',
    "punctuation_style" JSONB NOT NULL DEFAULT '{}',
    "language_patterns" JSONB NOT NULL DEFAULT '{}',
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "last_analyzed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "writing_style_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_snippets" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "shortcut" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "category" "SnippetCategory" NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMPTZ,
    "is_auto_detected" BOOLEAN NOT NULL DEFAULT false,
    "source_context" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "personal_snippets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_creation_patterns" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pattern_name" VARCHAR(200) NOT NULL,
    "trigger_type" VARCHAR(100) NOT NULL,
    "trigger_context" JSONB NOT NULL,
    "task_template" JSONB NOT NULL,
    "occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "task_creation_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_structure_preferences" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_type" VARCHAR(100) NOT NULL,
    "preferred_sections" JSONB NOT NULL,
    "header_style" JSONB NOT NULL,
    "footer_content" TEXT,
    "margin_preferences" JSONB,
    "font_preferences" JSONB,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "document_structure_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response_time_patterns" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_type" VARCHAR(100) NOT NULL,
    "case_type" VARCHAR(100),
    "average_response_hours" DOUBLE PRECISION NOT NULL,
    "median_response_hours" DOUBLE PRECISION NOT NULL,
    "min_response_hours" DOUBLE PRECISION NOT NULL,
    "max_response_hours" DOUBLE PRECISION NOT NULL,
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "std_deviation" DOUBLE PRECISION,
    "day_of_week_pattern" JSONB,
    "time_of_day_pattern" JSONB,
    "last_calculated_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "response_time_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_edit_history" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "original_text" TEXT NOT NULL,
    "edited_text" TEXT NOT NULL,
    "edit_type" "EditType" NOT NULL,
    "edit_location" VARCHAR(100) NOT NULL,
    "is_style_analyzed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_edit_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "writing_style_profiles_user_id_key" ON "writing_style_profiles"("user_id");

-- CreateIndex
CREATE INDEX "writing_style_profiles_firm_id_idx" ON "writing_style_profiles"("firm_id");

-- CreateIndex
CREATE UNIQUE INDEX "personal_snippets_user_id_shortcut_key" ON "personal_snippets"("user_id", "shortcut");

-- CreateIndex
CREATE INDEX "personal_snippets_firm_id_idx" ON "personal_snippets"("firm_id");

-- CreateIndex
CREATE INDEX "personal_snippets_user_id_idx" ON "personal_snippets"("user_id");

-- CreateIndex
CREATE INDEX "personal_snippets_category_idx" ON "personal_snippets"("category");

-- CreateIndex
CREATE UNIQUE INDEX "task_creation_patterns_user_id_pattern_name_key" ON "task_creation_patterns"("user_id", "pattern_name");

-- CreateIndex
CREATE INDEX "task_creation_patterns_firm_id_idx" ON "task_creation_patterns"("firm_id");

-- CreateIndex
CREATE INDEX "task_creation_patterns_user_id_idx" ON "task_creation_patterns"("user_id");

-- CreateIndex
CREATE INDEX "task_creation_patterns_confidence_idx" ON "task_creation_patterns"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "document_structure_preferences_user_id_document_type_key" ON "document_structure_preferences"("user_id", "document_type");

-- CreateIndex
CREATE INDEX "document_structure_preferences_firm_id_idx" ON "document_structure_preferences"("firm_id");

-- CreateIndex
CREATE INDEX "document_structure_preferences_user_id_idx" ON "document_structure_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "response_time_patterns_user_id_task_type_case_type_key" ON "response_time_patterns"("user_id", "task_type", "case_type");

-- CreateIndex
CREATE INDEX "response_time_patterns_firm_id_idx" ON "response_time_patterns"("firm_id");

-- CreateIndex
CREATE INDEX "response_time_patterns_user_id_idx" ON "response_time_patterns"("user_id");

-- CreateIndex
CREATE INDEX "draft_edit_history_user_id_idx" ON "draft_edit_history"("user_id");

-- CreateIndex
CREATE INDEX "draft_edit_history_firm_id_idx" ON "draft_edit_history"("firm_id");

-- CreateIndex
CREATE INDEX "draft_edit_history_is_style_analyzed_idx" ON "draft_edit_history"("is_style_analyzed");

-- AddForeignKey
ALTER TABLE "writing_style_profiles" ADD CONSTRAINT "writing_style_profiles_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_style_profiles" ADD CONSTRAINT "writing_style_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_snippets" ADD CONSTRAINT "personal_snippets_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_snippets" ADD CONSTRAINT "personal_snippets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_creation_patterns" ADD CONSTRAINT "task_creation_patterns_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_creation_patterns" ADD CONSTRAINT "task_creation_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_structure_preferences" ADD CONSTRAINT "document_structure_preferences_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_structure_preferences" ADD CONSTRAINT "document_structure_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_time_patterns" ADD CONSTRAINT "response_time_patterns_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_time_patterns" ADD CONSTRAINT "response_time_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_edit_history" ADD CONSTRAINT "draft_edit_history_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_edit_history" ADD CONSTRAINT "draft_edit_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_edit_history" ADD CONSTRAINT "draft_edit_history_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "email_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
