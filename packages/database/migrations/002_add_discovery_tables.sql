-- Migration: Add Document Type Discovery Infrastructure
-- Description: Creates tables for discovering and tracking document types from legacy imports
-- Story: 2.12.1 - Adaptive Skills & Romanian Legal Templates from Discovery
-- Date: 2025-11-19

-- =====================================================
-- Table: document_type_registry
-- Purpose: Core discovery tracking table for document types
-- =====================================================
CREATE TABLE IF NOT EXISTS document_type_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Discovery Information
    discovered_type_original VARCHAR(500) NOT NULL, -- e.g., "Contract de Vanzare-Cumparare"
    discovered_type_normalized VARCHAR(255) NOT NULL, -- e.g., "contract_vanzare_cumparare"
    discovered_type_english VARCHAR(500), -- e.g., "Sales Purchase Agreement"

    -- Language & Classification
    primary_language VARCHAR(10) NOT NULL, -- 'ro', 'en', 'mixed'
    document_category VARCHAR(100), -- 'contract', 'notice', 'filing', 'correspondence'

    -- Mapping Information
    mapped_skill_id VARCHAR(100), -- e.g., 'contract-analysis' (references skills table)
    mapped_template_id UUID, -- Will be constrained when template_library table is created
    mapping_confidence DECIMAL(3,2), -- 0.00 to 1.00
    mapping_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'auto_mapped', 'manual_mapped', 'template_created'

    -- Usage Metrics
    first_seen_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_occurrences INTEGER DEFAULT 1,
    unique_variations INTEGER DEFAULT 1,
    avg_document_length INTEGER,

    -- Decision Metrics
    frequency_score DECIMAL(3,2), -- Based on occurrence rate
    complexity_score DECIMAL(3,2), -- From AI analysis
    business_value_score DECIMAL(3,2), -- Manual or calculated
    priority_score DECIMAL(3,2), -- Composite score for action priority

    -- Metadata
    sample_document_ids UUID[], -- Keep 3-5 examples
    common_clauses JSONB DEFAULT '{}', -- Most frequent clause types found
    typical_structure JSONB DEFAULT '{}', -- Common sections/headers

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,

    UNIQUE(discovered_type_normalized, primary_language),

    -- Constraints
    CONSTRAINT registry_mapping_confidence_range CHECK (mapping_confidence >= 0 AND mapping_confidence <= 1),
    CONSTRAINT registry_frequency_score_range CHECK (frequency_score >= 0 AND frequency_score <= 1),
    CONSTRAINT registry_complexity_score_range CHECK (complexity_score >= 0 AND complexity_score <= 1),
    CONSTRAINT registry_business_value_range CHECK (business_value_score >= 0 AND business_value_score <= 1),
    CONSTRAINT registry_priority_score_range CHECK (priority_score >= 0 AND priority_score <= 1)
);

-- =====================================================
-- Table: document_type_instances
-- Purpose: Track individual document mappings to registry entries
-- =====================================================
CREATE TABLE IF NOT EXISTS document_type_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL, -- Will be constrained when training_documents table is created
    registry_id UUID NOT NULL REFERENCES document_type_registry(id) ON DELETE CASCADE,
    confidence_score DECIMAL(3,2),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT instances_confidence_range CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

-- =====================================================
-- Table: romanian_templates
-- Purpose: Store Romanian-specific legal document templates
-- =====================================================
CREATE TABLE IF NOT EXISTS romanian_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Template Identity
    template_name_ro VARCHAR(255) NOT NULL,
    template_name_en VARCHAR(255) NOT NULL,
    template_slug VARCHAR(255) NOT NULL UNIQUE, -- URL-friendly identifier

    -- Classification
    legal_category VARCHAR(100), -- 'notice', 'contract', 'court_filing', 'correspondence'
    document_type_id UUID REFERENCES document_type_registry(id), -- Link to discovered type

    -- Legal Context
    civil_code_references TEXT[], -- Array of relevant Civil Code articles
    jurisdiction VARCHAR(50) DEFAULT 'RO', -- ISO country code

    -- Template Structure
    template_structure JSONB NOT NULL, -- Full template definition (sections, fields, variables)
    standard_clauses JSONB DEFAULT '{}', -- Common Romanian legal clauses
    variable_mappings JSONB DEFAULT '{}', -- {"romanian": "english"} pairs

    -- Metadata
    created_from_pattern BOOLEAN DEFAULT true, -- Auto-generated vs manually created
    source_document_ids UUID[], -- Sample documents used to create template
    usage_count INTEGER DEFAULT 0,
    effectiveness_score DECIMAL(5,2) DEFAULT 0.00, -- 0.00 to 100.00

    -- Version Control
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT true,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    last_modified_by VARCHAR(255),

    CONSTRAINT romanian_templates_effectiveness_range CHECK (effectiveness_score >= 0 AND effectiveness_score <= 100)
);

-- =====================================================
-- Table: document_patterns
-- Purpose: Store extracted patterns from Romanian legal documents
-- =====================================================
CREATE TABLE IF NOT EXISTS document_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Pattern Identity
    pattern_type VARCHAR(100) NOT NULL, -- 'clause', 'phrase', 'structure', 'header'
    pattern_text_ro TEXT NOT NULL, -- Romanian text of the pattern
    pattern_text_en TEXT, -- English translation

    -- Discovery
    document_type_id UUID REFERENCES document_type_registry(id),
    occurrence_count INTEGER DEFAULT 1,
    document_sources UUID[], -- Documents where this pattern was found

    -- Classification
    category VARCHAR(100), -- 'standard_clause', 'legal_reference', 'formulaic_phrase'
    confidence_score DECIMAL(3,2), -- How confident we are this is a meaningful pattern

    -- Usage
    used_in_templates UUID[], -- Templates that include this pattern

    -- Audit
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT patterns_confidence_range CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

-- =====================================================
-- Table: template_usage_logs
-- Purpose: Track usage and effectiveness of Romanian templates
-- =====================================================
CREATE TABLE IF NOT EXISTS template_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    template_id UUID NOT NULL REFERENCES romanian_templates(id) ON DELETE CASCADE,
    user_id UUID, -- User who used the template

    -- Usage Metrics
    generation_time_ms INTEGER, -- Time to generate document
    variables_filled INTEGER, -- Number of variables populated
    manual_edits_count INTEGER DEFAULT 0, -- Edits made after generation

    -- Quality Metrics
    user_satisfaction_score INTEGER, -- 1-5 rating
    time_saved_minutes INTEGER, -- Estimated time saved

    -- Context
    use_case TEXT, -- Description of how template was used
    metadata JSONB DEFAULT '{}',

    -- Audit
    used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT usage_logs_satisfaction_range CHECK (user_satisfaction_score >= 1 AND user_satisfaction_score <= 5),
    CONSTRAINT usage_logs_time_positive CHECK (generation_time_ms >= 0)
);

-- =====================================================
-- Indexes for Performance Optimization
-- =====================================================

-- document_type_registry indexes
CREATE INDEX IF NOT EXISTS idx_registry_type ON document_type_registry(discovered_type_normalized);
CREATE INDEX IF NOT EXISTS idx_registry_status ON document_type_registry(mapping_status);
CREATE INDEX IF NOT EXISTS idx_registry_priority ON document_type_registry(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_registry_occurrences ON document_type_registry(total_occurrences DESC);
CREATE INDEX IF NOT EXISTS idx_registry_language ON document_type_registry(primary_language);
CREATE INDEX IF NOT EXISTS idx_registry_category ON document_type_registry(document_category);
CREATE INDEX IF NOT EXISTS idx_registry_first_seen ON document_type_registry(first_seen_date DESC);
CREATE INDEX IF NOT EXISTS idx_registry_last_seen ON document_type_registry(last_seen_date DESC);

-- document_type_instances indexes
CREATE INDEX IF NOT EXISTS idx_instances_document ON document_type_instances(document_id);
CREATE INDEX IF NOT EXISTS idx_instances_registry ON document_type_instances(registry_id);
CREATE INDEX IF NOT EXISTS idx_instances_detected_at ON document_type_instances(detected_at DESC);

-- romanian_templates indexes
CREATE INDEX IF NOT EXISTS idx_templates_slug ON romanian_templates(template_slug);
CREATE INDEX IF NOT EXISTS idx_templates_category ON romanian_templates(legal_category);
CREATE INDEX IF NOT EXISTS idx_templates_active ON romanian_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_effectiveness ON romanian_templates(effectiveness_score DESC);
CREATE INDEX IF NOT EXISTS idx_templates_usage ON romanian_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_document_type ON romanian_templates(document_type_id);

-- document_patterns indexes
CREATE INDEX IF NOT EXISTS idx_patterns_type ON document_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_document_type ON document_patterns(document_type_id);
CREATE INDEX IF NOT EXISTS idx_patterns_occurrence ON document_patterns(occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_category ON document_patterns(category);

-- template_usage_logs indexes
CREATE INDEX IF NOT EXISTS idx_usage_logs_template ON template_usage_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON template_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_used_at ON template_usage_logs(used_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_registry_status_priority ON document_type_registry(mapping_status, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_templates_active_category ON romanian_templates(is_active, legal_category);

-- =====================================================
-- Triggers for Automatic Timestamp Updates
-- =====================================================

-- Trigger for document_type_registry
CREATE TRIGGER update_registry_updated_at
    BEFORE UPDATE ON document_type_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for romanian_templates
CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON romanian_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Function: Update Template Statistics
-- =====================================================

CREATE OR REPLACE FUNCTION update_template_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update usage count and effectiveness in romanian_templates table
    UPDATE romanian_templates
    SET
        usage_count = usage_count + 1,
        effectiveness_score = (
            SELECT
                CASE
                    WHEN COUNT(*) = 0 THEN 0
                    WHEN AVG(user_satisfaction_score) IS NULL THEN 0
                    ELSE (AVG(user_satisfaction_score) / 5.0) * 100
                END
            FROM template_usage_logs
            WHERE template_id = NEW.template_id
        )
    WHERE id = NEW.template_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update template statistics
CREATE TRIGGER update_template_stats_on_usage
    AFTER INSERT ON template_usage_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_template_statistics();

-- =====================================================
-- Views for Admin Dashboard
-- =====================================================

-- Discovery metrics view
CREATE OR REPLACE VIEW document_discovery_metrics AS
SELECT
    DATE_TRUNC('week', first_seen_date) as week,
    COUNT(*) as new_types_discovered,
    SUM(total_occurrences) as total_documents,
    AVG(mapping_confidence) as avg_confidence,
    COUNT(CASE WHEN mapping_status = 'template_created' THEN 1 END) as templates_created,
    COUNT(CASE WHEN mapping_status = 'pending' THEN 1 END) as pending_review,
    COUNT(CASE WHEN mapping_status = 'auto_mapped' THEN 1 END) as auto_mapped,
    COUNT(CASE WHEN mapping_status = 'manual_mapped' THEN 1 END) as manual_mapped
FROM document_type_registry
GROUP BY DATE_TRUNC('week', first_seen_date)
ORDER BY week DESC;

-- Template effectiveness view
CREATE OR REPLACE VIEW template_effectiveness_report AS
SELECT
    rt.id,
    rt.template_name_ro,
    rt.template_name_en,
    rt.legal_category,
    rt.usage_count,
    rt.effectiveness_score,
    COUNT(tul.id) as total_uses,
    AVG(tul.user_satisfaction_score) as avg_satisfaction,
    AVG(tul.time_saved_minutes) as avg_time_saved,
    SUM(tul.time_saved_minutes) as total_time_saved
FROM romanian_templates rt
LEFT JOIN template_usage_logs tul ON rt.id = tul.template_id
WHERE rt.is_active = true
GROUP BY rt.id, rt.template_name_ro, rt.template_name_en, rt.legal_category,
         rt.usage_count, rt.effectiveness_score
ORDER BY rt.usage_count DESC;

-- Top priority document types for template creation
CREATE OR REPLACE VIEW template_creation_candidates AS
SELECT
    dtr.id,
    dtr.discovered_type_original,
    dtr.discovered_type_english,
    dtr.total_occurrences,
    dtr.priority_score,
    dtr.mapping_status,
    dtr.first_seen_date,
    dtr.last_seen_date,
    DATE_PART('day', CURRENT_TIMESTAMP - dtr.first_seen_date) as days_since_discovery
FROM document_type_registry dtr
WHERE dtr.mapping_status IN ('pending', 'queue_review')
    AND dtr.total_occurrences >= 20
ORDER BY dtr.priority_score DESC, dtr.total_occurrences DESC
LIMIT 50;

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE document_type_registry IS 'Core discovery tracking table for document types identified during import';
COMMENT ON TABLE document_type_instances IS 'Individual document mappings to registry entries for tracking';
COMMENT ON TABLE romanian_templates IS 'Romanian-specific legal document templates created from discovered patterns';
COMMENT ON TABLE document_patterns IS 'Extracted patterns from Romanian legal documents for template creation';
COMMENT ON TABLE template_usage_logs IS 'Track usage and effectiveness of Romanian templates';

COMMENT ON COLUMN document_type_registry.priority_score IS 'Composite score for action priority (0-1)';
COMMENT ON COLUMN document_type_registry.mapping_confidence IS 'Confidence score for automated mappings (0-1)';
COMMENT ON COLUMN romanian_templates.effectiveness_score IS 'Template effectiveness based on user satisfaction (0-100)';
COMMENT ON COLUMN document_patterns.confidence_score IS 'Confidence that this is a meaningful pattern (0-1)';

-- =====================================================
-- Sample Data for Testing (Optional - Remove in production)
-- =====================================================

-- Note: Foreign key references to training_documents and template_library tables
-- will need to be added via ALTER TABLE once those tables are created.
-- Example:
-- ALTER TABLE document_type_instances
--   ADD CONSTRAINT fk_document_id
--   FOREIGN KEY (document_id) REFERENCES training_documents(id) ON DELETE CASCADE;
