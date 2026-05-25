-- Add independent embedding backend fields for AI configs
ALTER TABLE "ai_model_configs"
ADD COLUMN IF NOT EXISTS "embeddingVendor" "AIVendor",
ADD COLUMN IF NOT EXISTS "embeddingApiKey" TEXT,
ADD COLUMN IF NOT EXISTS "embeddingApiEndpoint" TEXT;
