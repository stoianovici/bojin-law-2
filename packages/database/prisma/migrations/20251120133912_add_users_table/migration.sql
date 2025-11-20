-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Partner', 'Associate', 'Paralegal');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('Pending', 'Active', 'Inactive');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT,
    "email" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'Paralegal',
    "status" "UserStatus" NOT NULL DEFAULT 'Pending',
    "azure_ad_id" VARCHAR(255) NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_azure_ad_id_key" ON "users"("azure_ad_id");
