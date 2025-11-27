-- CreateTable
CREATE TABLE "ai_token_usage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "case_id" TEXT,
    "firm_id" TEXT NOT NULL,
    "operation_type" VARCHAR(100) NOT NULL,
    "model_used" VARCHAR(100) NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "cost_cents" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_token_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_response_cache" (
    "id" TEXT NOT NULL,
    "prompt_hash" VARCHAR(64) NOT NULL,
    "prompt_embedding" vector(1536),
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "model_used" VARCHAR(100) NOT NULL,
    "operation_type" VARCHAR(100) NOT NULL,
    "firm_id" TEXT NOT NULL,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_response_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_token_usage_user_id_created_at_idx" ON "ai_token_usage"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_token_usage_case_id_idx" ON "ai_token_usage"("case_id");

-- CreateIndex
CREATE INDEX "ai_token_usage_firm_id_created_at_idx" ON "ai_token_usage"("firm_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_token_usage_operation_type_idx" ON "ai_token_usage"("operation_type");

-- CreateIndex
CREATE UNIQUE INDEX "ai_response_cache_prompt_hash_key" ON "ai_response_cache"("prompt_hash");

-- CreateIndex
CREATE INDEX "ai_response_cache_firm_id_idx" ON "ai_response_cache"("firm_id");

-- CreateIndex
CREATE INDEX "ai_response_cache_operation_type_idx" ON "ai_response_cache"("operation_type");

-- CreateIndex
CREATE INDEX "ai_response_cache_expires_at_idx" ON "ai_response_cache"("expires_at");

-- CreateIndex for vector similarity search (using ivfflat for performance)
CREATE INDEX "ai_response_cache_prompt_embedding_idx" ON "ai_response_cache" USING ivfflat ("prompt_embedding" vector_cosine_ops) WITH (lists = 100);
