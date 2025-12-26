-- Add model column to ai_feature_configs table
-- Allows per-feature Claude model selection (e.g., claude-3-haiku for cost savings)

ALTER TABLE "ai_feature_configs" ADD COLUMN "model" VARCHAR(100);
