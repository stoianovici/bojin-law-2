-- CreateTable
CREATE TABLE "team_chat_messages" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parent_id" TEXT,
    "mentions" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "team_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_chat_messages_firm_id_created_at_idx" ON "team_chat_messages"("firm_id", "created_at");

-- CreateIndex
CREATE INDEX "team_chat_messages_author_id_idx" ON "team_chat_messages"("author_id");

-- CreateIndex
CREATE INDEX "team_chat_messages_parent_id_idx" ON "team_chat_messages"("parent_id");

-- CreateIndex
CREATE INDEX "team_chat_messages_expires_at_idx" ON "team_chat_messages"("expires_at");

-- AddForeignKey
ALTER TABLE "team_chat_messages" ADD CONSTRAINT "team_chat_messages_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_chat_messages" ADD CONSTRAINT "team_chat_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_chat_messages" ADD CONSTRAINT "team_chat_messages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "team_chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
