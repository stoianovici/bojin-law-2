-- AlterTable: Add outlookDraftId field to email_drafts
ALTER TABLE "email_drafts" ADD COLUMN "outlook_draft_id" TEXT;

-- CreateEnum: Source types for sent email drafts
CREATE TYPE "SentEmailSource" AS ENUM ('NEW_EMAIL', 'REPLY', 'TASK_REMINDER', 'OVERDUE_NOTIFICATION');

-- CreateTable: sent_email_drafts
CREATE TABLE "sent_email_drafts" (
    "id" TEXT NOT NULL,
    "outlook_draft_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "case_id" TEXT,
    "source" "SentEmailSource" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_email_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sent_email_drafts_user_id_idx" ON "sent_email_drafts"("user_id");

-- CreateIndex
CREATE INDEX "sent_email_drafts_firm_id_idx" ON "sent_email_drafts"("firm_id");

-- CreateIndex
CREATE INDEX "sent_email_drafts_outlook_draft_id_idx" ON "sent_email_drafts"("outlook_draft_id");

-- CreateIndex
CREATE INDEX "sent_email_drafts_created_at_idx" ON "sent_email_drafts"("created_at");

-- AddForeignKey
ALTER TABLE "sent_email_drafts" ADD CONSTRAINT "sent_email_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_email_drafts" ADD CONSTRAINT "sent_email_drafts_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_email_drafts" ADD CONSTRAINT "sent_email_drafts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
