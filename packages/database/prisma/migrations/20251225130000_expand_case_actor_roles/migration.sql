-- OPS-219: Expand CaseActorRole Enum
-- Add 7 new actor roles for Romanian legal practice

-- Add new enum values (using IF NOT EXISTS for idempotency)
ALTER TYPE "CaseActorRole" ADD VALUE IF NOT EXISTS 'Intervenient';
ALTER TYPE "CaseActorRole" ADD VALUE IF NOT EXISTS 'Mandatar';
ALTER TYPE "CaseActorRole" ADD VALUE IF NOT EXISTS 'Court';
ALTER TYPE "CaseActorRole" ADD VALUE IF NOT EXISTS 'Prosecutor';
ALTER TYPE "CaseActorRole" ADD VALUE IF NOT EXISTS 'Bailiff';
ALTER TYPE "CaseActorRole" ADD VALUE IF NOT EXISTS 'Notary';
ALTER TYPE "CaseActorRole" ADD VALUE IF NOT EXISTS 'LegalRepresentative';
