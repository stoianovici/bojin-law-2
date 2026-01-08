-- CreateTable
CREATE TABLE "personal_threads" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_threads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_threads_user_id_idx" ON "personal_threads"("user_id");

-- CreateIndex
CREATE INDEX "personal_threads_firm_id_idx" ON "personal_threads"("firm_id");

-- CreateIndex
CREATE UNIQUE INDEX "personal_threads_conversation_id_firm_id_key" ON "personal_threads"("conversation_id", "firm_id");

-- AddForeignKey
ALTER TABLE "personal_threads" ADD CONSTRAINT "personal_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_threads" ADD CONSTRAINT "personal_threads_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
