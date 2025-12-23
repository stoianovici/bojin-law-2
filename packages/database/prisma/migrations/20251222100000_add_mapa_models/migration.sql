-- CreateTable
CREATE TABLE "mape" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "template_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "mape_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapa_slots" (
    "id" TEXT NOT NULL,
    "mapa_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "case_document_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "assigned_at" TIMESTAMPTZ,
    "assigned_by_id" TEXT,

    CONSTRAINT "mapa_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapa_templates" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "case_type" VARCHAR(50),
    "slot_definitions" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "mapa_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mape_case_id_idx" ON "mape"("case_id");

-- CreateIndex
CREATE INDEX "mape_template_id_idx" ON "mape"("template_id");

-- CreateIndex
CREATE INDEX "mapa_slots_mapa_id_idx" ON "mapa_slots"("mapa_id");

-- CreateIndex
CREATE INDEX "mapa_slots_case_document_id_idx" ON "mapa_slots"("case_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "mapa_slots_mapa_id_order_key" ON "mapa_slots"("mapa_id", "order");

-- CreateIndex
CREATE INDEX "mapa_templates_firm_id_idx" ON "mapa_templates"("firm_id");

-- CreateIndex
CREATE INDEX "mapa_templates_case_type_idx" ON "mapa_templates"("case_type");

-- AddForeignKey
ALTER TABLE "mape" ADD CONSTRAINT "mape_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mape" ADD CONSTRAINT "mape_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "mapa_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mape" ADD CONSTRAINT "mape_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapa_slots" ADD CONSTRAINT "mapa_slots_mapa_id_fkey" FOREIGN KEY ("mapa_id") REFERENCES "mape"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapa_slots" ADD CONSTRAINT "mapa_slots_case_document_id_fkey" FOREIGN KEY ("case_document_id") REFERENCES "case_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapa_slots" ADD CONSTRAINT "mapa_slots_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapa_templates" ADD CONSTRAINT "mapa_templates_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapa_templates" ADD CONSTRAINT "mapa_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
