-- CreateEnum
CREATE TYPE "TeamChatMessageType" AS ENUM ('User', 'System');

-- AlterTable
ALTER TABLE "team_chat_messages" ADD COLUMN "activity_ref" TEXT;
ALTER TABLE "team_chat_messages" ADD COLUMN "activity_type" TEXT;
ALTER TABLE "team_chat_messages" ADD COLUMN "attachments" JSONB;
ALTER TABLE "team_chat_messages" ADD COLUMN "type" "TeamChatMessageType" NOT NULL DEFAULT 'User';
