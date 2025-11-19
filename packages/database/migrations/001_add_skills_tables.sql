-- Migration: Add Claude Skills Infrastructure Tables
-- Description: Creates tables for managing Claude Skills, their versions, and usage tracking
-- Date: 2025-11-19

-- =====================================================
-- Table: skills
-- Purpose: Store Claude skills metadata and configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL,
    type VARCHAR(100) NOT NULL, -- e.g., 'document_analysis', 'legal_research', 'template_generation'
    category VARCHAR(100) NOT NULL, -- e.g., 'legal', 'administrative', 'automation'
    effectiveness_score DECIMAL(5,2) DEFAULT 0.00, -- 0.00 to 100.00
    token_savings_avg INTEGER DEFAULT 0, -- Average tokens saved per execution
    usage_count INTEGER DEFAULT 0, -- Total number of times this skill has been used
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, -- User ID who created the skill
    metadata JSONB DEFAULT '{}', -- Additional skill configuration and parameters

    CONSTRAINT skills_effectiveness_score_range CHECK (effectiveness_score >= 0 AND effectiveness_score <= 100)
);

-- =====================================================
-- Table: skill_versions
-- Purpose: Track different versions of skills for rollback and comparison
-- =====================================================
CREATE TABLE IF NOT EXISTS skill_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    content TEXT NOT NULL, -- Skill definition/configuration
    changelog TEXT,
    is_current BOOLEAN DEFAULT false,
    deployed_at TIMESTAMP WITH TIME ZONE,
    deprecated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,

    UNIQUE(skill_id, version)
);

-- =====================================================
-- Table: skill_usage_logs
-- Purpose: Track individual skill executions for metrics and optimization
-- =====================================================
CREATE TABLE IF NOT EXISTS skill_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    user_id UUID,
    workspace_id UUID,
    execution_time_ms INTEGER NOT NULL, -- Execution duration in milliseconds
    tokens_used INTEGER NOT NULL, -- Total tokens used in this execution
    tokens_saved INTEGER DEFAULT 0, -- Estimated tokens saved vs non-skill approach
    cost_usd DECIMAL(10,6) DEFAULT 0.000000, -- Cost in USD for this execution
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    input_data JSONB DEFAULT '{}', -- Sanitized input parameters
    output_data JSONB DEFAULT '{}', -- Sanitized output/result
    metadata JSONB DEFAULT '{}', -- Additional execution context
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT skill_usage_logs_tokens_used_positive CHECK (tokens_used >= 0),
    CONSTRAINT skill_usage_logs_execution_time_positive CHECK (execution_time_ms >= 0)
);

-- =====================================================
-- Indexes for Performance Optimization
-- =====================================================

-- Skills table indexes
CREATE INDEX IF NOT EXISTS idx_skills_skill_id ON skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_type ON skills(type);
CREATE INDEX IF NOT EXISTS idx_skills_effectiveness_score ON skills(effectiveness_score DESC);
CREATE INDEX IF NOT EXISTS idx_skills_is_active ON skills(is_active);
CREATE INDEX IF NOT EXISTS idx_skills_created_at ON skills(created_at DESC);

-- Skill versions table indexes
CREATE INDEX IF NOT EXISTS idx_skill_versions_skill_id ON skill_versions(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_versions_is_current ON skill_versions(is_current);
CREATE INDEX IF NOT EXISTS idx_skill_versions_created_at ON skill_versions(created_at DESC);

-- Skill usage logs table indexes
CREATE INDEX IF NOT EXISTS idx_skill_usage_logs_skill_id ON skill_usage_logs(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_usage_logs_user_id ON skill_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_usage_logs_workspace_id ON skill_usage_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_skill_usage_logs_executed_at ON skill_usage_logs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_usage_logs_success ON skill_usage_logs(success);
CREATE INDEX IF NOT EXISTS idx_skill_usage_logs_cost_usd ON skill_usage_logs(cost_usd DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_skill_usage_logs_skill_user ON skill_usage_logs(skill_id, user_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_usage_logs_workspace_date ON skill_usage_logs(workspace_id, executed_at DESC);

-- =====================================================
-- Triggers for Automatic Timestamp Updates
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for skills table
CREATE TRIGGER update_skills_updated_at
    BEFORE UPDATE ON skills
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Function to Update Skill Statistics
-- =====================================================

CREATE OR REPLACE FUNCTION update_skill_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update usage count and average token savings in skills table
    UPDATE skills
    SET
        usage_count = usage_count + 1,
        token_savings_avg = (
            SELECT COALESCE(AVG(tokens_saved), 0)::INTEGER
            FROM skill_usage_logs
            WHERE skill_id = NEW.skill_id AND success = true
        ),
        effectiveness_score = LEAST(100, (
            SELECT
                CASE
                    WHEN COUNT(*) = 0 THEN 0
                    ELSE (COUNT(*) FILTER (WHERE success = true)::DECIMAL / COUNT(*)) * 100
                END
            FROM skill_usage_logs
            WHERE skill_id = NEW.skill_id
        ))
    WHERE id = NEW.skill_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update skill statistics
CREATE TRIGGER update_skill_stats_on_usage
    AFTER INSERT ON skill_usage_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_skill_statistics();

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE skills IS 'Stores Claude Skills metadata, configuration, and effectiveness metrics';
COMMENT ON TABLE skill_versions IS 'Tracks version history of skills for rollback and comparison';
COMMENT ON TABLE skill_usage_logs IS 'Logs individual skill executions for analytics and cost tracking';

COMMENT ON COLUMN skills.effectiveness_score IS 'Calculated score (0-100) based on success rate and token savings';
COMMENT ON COLUMN skills.token_savings_avg IS 'Average tokens saved per successful execution';
COMMENT ON COLUMN skill_usage_logs.tokens_saved IS 'Estimated tokens saved vs traditional prompt approach';
COMMENT ON COLUMN skill_usage_logs.cost_usd IS 'Execution cost in USD based on Anthropic pricing';

-- =====================================================
-- Sample Data for Testing (Optional - Remove in production)
-- =====================================================

-- INSERT INTO skills (skill_id, display_name, description, version, type, category) VALUES
-- ('legal-contract-analysis-v1', 'Legal Contract Analysis', 'Analyzes contracts for key clauses and risks', '1.0.0', 'document_analysis', 'legal'),
-- ('legal-research-assistant-v1', 'Legal Research Assistant', 'Performs legal research and citation finding', '1.0.0', 'legal_research', 'legal'),
-- ('document-template-generator-v1', 'Document Template Generator', 'Generates legal document templates', '1.0.0', 'template_generation', 'legal');
