-- OPS-178: SharePoint Edit Session Schema
-- Add fields to track SharePoint document state for automatic version detection

-- Add SharePoint tracking fields to documents table
ALTER TABLE "documents" ADD COLUMN "share_point_last_modified" TIMESTAMPTZ;
ALTER TABLE "documents" ADD COLUMN "share_point_etag" VARCHAR(255);

-- Create document edit sessions table for tracking active edits
CREATE TABLE "document_edit_sessions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "share_point_last_modified" TIMESTAMPTZ,
    "share_point_etag" VARCHAR(255),
    "lock_token" VARCHAR(255) NOT NULL,

    CONSTRAINT "document_edit_sessions_pkey" PRIMARY KEY ("id")
);

-- Each document can only have one active edit session
CREATE UNIQUE INDEX "document_edit_sessions_document_id_key" ON "document_edit_sessions"("document_id");

-- Index for user's active sessions
CREATE INDEX "document_edit_sessions_user_id_idx" ON "document_edit_sessions"("user_id");

-- Index for finding stale sessions
CREATE INDEX "document_edit_sessions_started_at_idx" ON "document_edit_sessions"("started_at");

-- Foreign key constraints
ALTER TABLE "document_edit_sessions" ADD CONSTRAINT "document_edit_sessions_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_edit_sessions" ADD CONSTRAINT "document_edit_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
