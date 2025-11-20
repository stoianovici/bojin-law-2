/**
 * Discovery System Types
 * Story 2.12.1 - Database Type Definitions
 *
 * Provides TypeScript type safety for document discovery tables
 * Based on packages/database/migrations/002_add_discovery_tables.sql
 */

/**
 * Document Type Registry
 * Tracks discovered document types from legacy imports
 */
export interface DocumentTypeRegistry {
  id: string; // UUID
  discovered_type_original: string;
  discovered_type_normalized: string;
  discovered_type_english: string | null;
  primary_language: string;
  mapped_skill_id: string | null;
  total_occurrences: number;
  priority_score: number; // DECIMAL(3,2)
  confidence_score: number | null; // DECIMAL(3,2)
  decision: 'pending' | 'auto_mapped' | 'review_queue' | 'template_trigger' | 'manual_override' | null;
  legal_category: string | null;
  complexity_estimate: 'low' | 'medium' | 'high' | null;
  average_page_length: number | null;
  business_value_score: number | null; // DECIMAL(3,2)
  sample_document_ids: string[]; // TEXT[]
  first_discovered_at: Date;
  last_occurrence_at: Date;
  auto_mapped_at: Date | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  decision_basis: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Document Type Instances
 * Links individual documents to their discovered type
 */
export interface DocumentTypeInstance {
  id: string; // UUID
  type_id: string; // UUID foreign key
  document_id: string;
  document_name: string;
  document_path: string | null;
  confidence_score: number; // DECIMAL(3,2)
  detected_at: Date;
  metadata: Record<string, any>; // JSONB
}

/**
 * Romanian Templates
 * Stores Romanian legal document templates
 */
export interface RomanianTemplate {
  id: string; // UUID
  template_name_ro: string;
  template_name_en: string;
  template_slug: string;
  legal_category: string;
  civil_code_references: string[]; // TEXT[]
  standard_clauses: Record<string, any>; // JSONB
  variable_mappings: Record<string, any>; // JSONB
  created_from_pattern: boolean;
  usage_count: number;
  avg_time_savings_minutes: number | null;
  source_type_id: string | null; // UUID foreign key
  created_at: Date;
  updated_at: Date;
}

/**
 * Document Patterns
 * Extracted patterns from document analysis
 */
export interface DocumentPattern {
  id: string; // UUID
  type_id: string; // UUID foreign key
  pattern_type: 'common_phrase' | 'clause_structure' | 'section_header' | 'legal_reference' | 'custom';
  pattern_text_ro: string;
  pattern_text_en: string | null;
  occurrence_count: number;
  occurrence_percentage: number; // DECIMAL(5,2)
  min_word_count: number;
  source_document_ids: string[]; // TEXT[]
  confidence_score: number; // DECIMAL(3,2)
  extracted_at: Date;
  metadata: Record<string, any>; // JSONB
}

/**
 * Template Usage Logs
 * Tracks template usage and effectiveness
 */
export interface TemplateUsageLog {
  id: string; // UUID
  template_id: string; // UUID foreign key
  user_id: string | null;
  execution_time_ms: number | null;
  time_saved_minutes: number | null;
  variables_provided: Record<string, any>; // JSONB
  output_format: 'markdown' | 'html' | 'plain' | null;
  success: boolean;
  error_message: string | null;
  used_at: Date;
}

/**
 * Discovery Status Summary (View)
 * Pre-calculated statistics for admin dashboard
 */
export interface DiscoveryStatusSummary {
  total_types_discovered: number;
  pending_review_count: number;
  auto_mapped_count: number;
  templates_created: number;
  total_occurrences: number;
  avg_confidence_score: number; // DECIMAL(5,2)
  last_discovery_date: Date | null;
}

/**
 * Template Effectiveness Summary (View)
 * Pre-calculated template metrics
 */
export interface TemplateEffectivenessSummary {
  template_id: string;
  template_name_ro: string;
  template_name_en: string;
  total_uses: number;
  success_rate: number; // DECIMAL(5,2)
  avg_time_saved_minutes: number; // DECIMAL(6,2)
  total_time_saved_hours: number; // DECIMAL(8,2)
  last_used_at: Date | null;
}

/**
 * Query result types for common database operations
 */
export interface DocumentTypeWithInstances extends DocumentTypeRegistry {
  instances: DocumentTypeInstance[];
}

export interface TemplateWithUsage extends RomanianTemplate {
  recent_usage: TemplateUsageLog[];
  effectiveness: TemplateEffectivenessSummary | null;
}

/**
 * Input types for creating new records
 */
export interface CreateDocumentTypeRegistry {
  discovered_type_original: string;
  discovered_type_normalized: string;
  discovered_type_english?: string;
  primary_language: string;
  mapped_skill_id?: string;
  priority_score?: number;
  legal_category?: string;
  complexity_estimate?: 'low' | 'medium' | 'high';
  sample_document_ids?: string[];
}

export interface CreateRomanianTemplate {
  template_name_ro: string;
  template_name_en: string;
  template_slug: string;
  legal_category: string;
  civil_code_references?: string[];
  standard_clauses: Record<string, any>;
  variable_mappings: Record<string, any>;
  created_from_pattern?: boolean;
  source_type_id?: string;
}

export interface CreateTemplateUsageLog {
  template_id: string;
  user_id?: string;
  execution_time_ms?: number;
  time_saved_minutes?: number;
  variables_provided: Record<string, any>;
  output_format?: 'markdown' | 'html' | 'plain';
  success: boolean;
  error_message?: string;
}

/**
 * Filter and search types
 */
export interface DocumentTypeFilter {
  primary_language?: string;
  legal_category?: string;
  complexity_estimate?: 'low' | 'medium' | 'high';
  decision?: DocumentTypeRegistry['decision'];
  min_occurrences?: number;
  min_priority_score?: number;
}

export interface TemplateFilter {
  legal_category?: string;
  created_from_pattern?: boolean;
  min_usage_count?: number;
}
