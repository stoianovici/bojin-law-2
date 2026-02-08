-- CreateEnum
CREATE TYPE "ShareAccessLevel" AS ENUM ('Read', 'ReadWrite');

-- CreateTable
CREATE TABLE "email_thread_shares" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "shared_by" TEXT NOT NULL,
    "shared_with" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "access_level" "ShareAccessLevel" NOT NULL DEFAULT 'Read',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_thread_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_thread_shares_shared_with_firm_id_idx" ON "email_thread_shares"("shared_with", "firm_id");

-- CreateIndex
CREATE INDEX "email_thread_shares_conversation_id_idx" ON "email_thread_shares"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_thread_shares_conversation_id_shared_with_firm_id_key" ON "email_thread_shares"("conversation_id", "shared_with", "firm_id");
