-- Add embedding configuration fields to AI model configs
ALTER TABLE "ai_model_configs"
ADD COLUMN IF NOT EXISTS "embeddingModelId" TEXT,
ADD COLUMN IF NOT EXISTS "embeddingDimensions" INTEGER;
