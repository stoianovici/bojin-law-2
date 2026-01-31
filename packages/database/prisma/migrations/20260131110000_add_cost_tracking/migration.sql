-- Add token breakdown and cost tracking to comprehension agent runs
ALTER TABLE "comprehension_agent_runs" ADD COLUMN "input_tokens" INTEGER;
ALTER TABLE "comprehension_agent_runs" ADD COLUMN "output_tokens" INTEGER;
ALTER TABLE "comprehension_agent_runs" ADD COLUMN "thinking_tokens" INTEGER;
ALTER TABLE "comprehension_agent_runs" ADD COLUMN "estimated_cost" DECIMAL(10, 6);

-- Add thinking content for debugging
ALTER TABLE "comprehension_agent_runs" ADD COLUMN "thinking_content" TEXT;
