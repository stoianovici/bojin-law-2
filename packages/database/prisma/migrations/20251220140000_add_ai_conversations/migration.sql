-- OPS-063: AI Conversation Data Model
-- Creates tables for multi-turn AI assistant conversations

-- CreateEnum: ConversationStatus
CREATE TYPE "ConversationStatus" AS ENUM ('Active', 'AwaitingConfirmation', 'Completed', 'Expired');

-- CreateEnum: AIMessageRole
CREATE TYPE "AIMessageRole" AS ENUM ('User', 'Assistant', 'System');

-- CreateEnum: AIActionStatus
CREATE TYPE "AIActionStatus" AS ENUM ('Proposed', 'Confirmed', 'Executed', 'Rejected', 'Failed');

-- CreateTable: ai_conversations
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "case_id" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'Active',
    "context" JSONB NOT NULL DEFAULT '{}',
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ai_messages
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "conversation_id" TEXT NOT NULL,
    "role" "AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "intent" VARCHAR(100),
    "confidence" DOUBLE PRECISION,
    "action_type" VARCHAR(100),
    "action_payload" JSONB,
    "action_status" "AIActionStatus",
    "tokens_used" INTEGER,
    "model_used" VARCHAR(50),
    "latency_ms" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: ai_conversations indexes
CREATE INDEX "ai_conversations_firm_id_idx" ON "ai_conversations"("firm_id");
CREATE INDEX "ai_conversations_user_id_status_idx" ON "ai_conversations"("user_id", "status");
CREATE INDEX "ai_conversations_case_id_idx" ON "ai_conversations"("case_id");

-- CreateIndex: ai_messages indexes
CREATE INDEX "ai_messages_conversation_id_created_at_idx" ON "ai_messages"("conversation_id", "created_at");

-- AddForeignKey: ai_conversations -> firms
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ai_conversations -> users
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ai_conversations -> cases
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: ai_messages -> ai_conversations
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
