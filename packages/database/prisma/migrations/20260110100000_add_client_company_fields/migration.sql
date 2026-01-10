-- Add client company detail columns
-- These columns were added to schema but migration was missing

ALTER TABLE "clients" ADD COLUMN "client_type" VARCHAR(20) DEFAULT 'company';
ALTER TABLE "clients" ADD COLUMN "company_type" VARCHAR(20);
ALTER TABLE "clients" ADD COLUMN "cui" VARCHAR(20);
ALTER TABLE "clients" ADD COLUMN "registration_number" VARCHAR(50);
ALTER TABLE "clients" ADD COLUMN "administrators" JSONB DEFAULT '[]';
ALTER TABLE "clients" ADD COLUMN "contacts" JSONB DEFAULT '[]';
