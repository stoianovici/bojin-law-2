-- OPS-220: ActorTypeConfig Data Model
-- Enables firms to create custom actor types beyond the built-in CaseActorRole enum

-- CreateTable: ActorTypeConfig
CREATE TABLE "actor_type_configs" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "actor_type_configs_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add customRoleCode to CaseActor
ALTER TABLE "case_actors" ADD COLUMN "custom_role_code" VARCHAR(50);

-- CreateIndex: Unique constraint on firm + code
CREATE UNIQUE INDEX "actor_type_configs_firm_id_code_key" ON "actor_type_configs"("firm_id", "code");

-- CreateIndex: Firm lookup index
CREATE INDEX "actor_type_configs_firm_id_idx" ON "actor_type_configs"("firm_id");

-- AddForeignKey: Link to Firm
ALTER TABLE "actor_type_configs" ADD CONSTRAINT "actor_type_configs_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Link to User (creator)
ALTER TABLE "actor_type_configs" ADD CONSTRAINT "actor_type_configs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
