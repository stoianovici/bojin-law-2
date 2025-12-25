-- OPS-187: Personal Contacts Blocklist + Email Privacy Fields

-- AlterTable: Add email privacy fields
ALTER TABLE "emails" ADD COLUMN     "is_private" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marked_private_at" TIMESTAMPTZ,
ADD COLUMN     "marked_private_by" TEXT;

-- CreateTable: Personal contacts blocklist
CREATE TABLE "personal_contacts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Personal contacts indexes
CREATE INDEX "personal_contacts_user_id_idx" ON "personal_contacts"("user_id");
CREATE UNIQUE INDEX "personal_contacts_user_id_email_key" ON "personal_contacts"("user_id", "email");

-- CreateIndex: Email privacy index
CREATE INDEX "emails_is_private_idx" ON "emails"("is_private");

-- AddForeignKey: Personal contacts -> users
ALTER TABLE "personal_contacts" ADD CONSTRAINT "personal_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
