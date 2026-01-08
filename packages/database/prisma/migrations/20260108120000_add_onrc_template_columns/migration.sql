-- Add ONRC-specific columns to mapa_templates
-- These columns support storing scraped ONRC procedure templates

-- Make firm_id nullable (ONRC templates don't belong to a firm)
ALTER TABLE "mapa_templates" ALTER COLUMN "firm_id" DROP NOT NULL;

-- Make created_by_id nullable (ONRC templates are system-generated)
ALTER TABLE "mapa_templates" ALTER COLUMN "created_by_id" DROP NOT NULL;

-- Add new columns for ONRC template support
ALTER TABLE "mapa_templates" ADD COLUMN IF NOT EXISTS "ai_metadata" JSONB;
ALTER TABLE "mapa_templates" ADD COLUMN IF NOT EXISTS "content_hash" VARCHAR(64);
ALTER TABLE "mapa_templates" ADD COLUMN IF NOT EXISTS "is_locked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "mapa_templates" ADD COLUMN IF NOT EXISTS "is_onrc" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "mapa_templates" ADD COLUMN IF NOT EXISTS "last_synced" TIMESTAMPTZ(6);
ALTER TABLE "mapa_templates" ADD COLUMN IF NOT EXISTS "procedure_id" VARCHAR(100);
ALTER TABLE "mapa_templates" ADD COLUMN IF NOT EXISTS "source_url" VARCHAR(500);

-- Add unique constraint on procedure_id for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS "mapa_templates_procedure_id_key" ON "mapa_templates"("procedure_id");

-- Add index for ONRC template queries
CREATE INDEX IF NOT EXISTS "mapa_templates_is_onrc_idx" ON "mapa_templates"("is_onrc");
