-- CreateTable
CREATE TABLE "ai_model_configs" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "operation_type" VARCHAR(100) NOT NULL,
    "model" VARCHAR(50) NOT NULL,
    "updated_by_id" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_model_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_model_configs_firm_id_idx" ON "ai_model_configs"("firm_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_configs_operation_type_firm_id_key" ON "ai_model_configs"("operation_type", "firm_id");

-- AddForeignKey
ALTER TABLE "ai_model_configs" ADD CONSTRAINT "ai_model_configs_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_configs" ADD CONSTRAINT "ai_model_configs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
