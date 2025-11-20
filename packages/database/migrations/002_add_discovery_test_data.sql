-- Test Data: Document Type Discovery Infrastructure
-- Description: Sample data for testing the document type discovery system
-- Story: 2.12.1
-- Date: 2025-11-19
-- NOTE: This file should ONLY be run in development/test environments

-- =====================================================
-- Sample Document Type Registry Entries
-- =====================================================

-- Romanian Contract Types (High Priority)
INSERT INTO document_type_registry (
    discovered_type_original,
    discovered_type_normalized,
    discovered_type_english,
    primary_language,
    document_category,
    mapped_skill_id,
    mapping_status,
    total_occurrences,
    unique_variations,
    avg_document_length,
    frequency_score,
    complexity_score,
    business_value_score,
    priority_score,
    sample_document_ids,
    common_clauses,
    typical_structure
) VALUES
(
    'Notificare Avocateasca',
    'notificare_avocateasca',
    'Legal Notice',
    'ro',
    'correspondence',
    'document-drafting',
    'pending',
    89,
    12,
    2500,
    0.85,
    0.65,
    0.80,
    0.82,
    ARRAY[]::UUID[],
    '{"standard_clauses": ["payment_demand", "legal_consequence", "response_deadline"]}',
    '{"sections": ["header", "addressee", "statement_of_facts", "legal_basis", "demand", "warning"]}'
),
(
    'Contract de Vanzare-Cumparare',
    'contract_vanzare_cumparare',
    'Sales Purchase Agreement',
    'ro',
    'contract',
    'contract-analysis',
    'auto_mapped',
    67,
    8,
    4200,
    0.78,
    0.75,
    0.85,
    0.80,
    ARRAY[]::UUID[],
    '{"standard_clauses": ["price", "payment_terms", "delivery", "warranties", "dispute_resolution"]}',
    '{"sections": ["parties", "object", "price", "payment", "obligations", "guarantees", "final_provisions"]}'
),
(
    'Intampinare',
    'intampinare',
    'Statement of Defense',
    'ro',
    'court_filing',
    'document-drafting',
    'pending',
    54,
    15,
    5800,
    0.72,
    0.85,
    0.75,
    0.78,
    ARRAY[]::UUID[],
    '{"standard_clauses": ["procedural_defense", "material_defense", "evidence_list", "conclusions"]}',
    '{"sections": ["header", "procedural_issues", "factual_response", "legal_arguments", "evidence", "conclusions"]}'
),
(
    'Somatie de Plata',
    'somatie_plata',
    'Payment Notice',
    'ro',
    'correspondence',
    'document-drafting',
    'pending',
    48,
    6,
    1800,
    0.70,
    0.55,
    0.78,
    0.74,
    ARRAY[]::UUID[],
    '{"standard_clauses": ["debt_identification", "payment_demand", "deadline", "legal_consequences"]}',
    '{"sections": ["header", "debt_details", "payment_demand", "deadline", "consequences"]}'
),
(
    'Cerere de Chemare in Judecata',
    'cerere_chemare_judecata',
    'Lawsuit Petition',
    'ro',
    'court_filing',
    'document-drafting',
    'pending',
    42,
    18,
    6500,
    0.68,
    0.90,
    0.80,
    0.77,
    ARRAY[]::UUID[],
    '{"standard_clauses": ["competence", "legal_interest", "facts", "legal_basis", "claims", "evidence"]}',
    '{"sections": ["court_header", "parties", "object", "facts", "legal_grounds", "evidence", "claims", "annexes"]}'
);

-- Romanian Contract Types (Medium Priority)
INSERT INTO document_type_registry (
    discovered_type_original,
    discovered_type_normalized,
    discovered_type_english,
    primary_language,
    document_category,
    mapped_skill_id,
    mapping_status,
    total_occurrences,
    unique_variations,
    avg_document_length,
    frequency_score,
    complexity_score,
    business_value_score,
    priority_score
) VALUES
(
    'Contract de Prestari Servicii',
    'contract_prestari_servicii',
    'Service Agreement',
    'ro',
    'contract',
    'contract-analysis',
    'auto_mapped',
    35,
    5,
    3800,
    0.62,
    0.70,
    0.75,
    0.70
),
(
    'Contract de Inchiriere',
    'contract_inchiriere',
    'Lease Agreement',
    'ro',
    'contract',
    'contract-analysis',
    'auto_mapped',
    28,
    7,
    3200,
    0.58,
    0.65,
    0.70,
    0.66
),
(
    'Imputernicire Avocatiala',
    'imputernicire_avocatiala',
    'Power of Attorney for Legal Representation',
    'ro',
    'authorization',
    'document-drafting',
    'pending',
    24,
    4,
    1200,
    0.55,
    0.45,
    0.65,
    0.62
);

-- English Document Types (Mapped)
INSERT INTO document_type_registry (
    discovered_type_original,
    discovered_type_normalized,
    discovered_type_english,
    primary_language,
    document_category,
    mapped_skill_id,
    mapping_status,
    mapping_confidence,
    total_occurrences,
    unique_variations,
    avg_document_length,
    frequency_score,
    complexity_score,
    business_value_score,
    priority_score
) VALUES
(
    'Non-Disclosure Agreement',
    'non_disclosure_agreement',
    'Non-Disclosure Agreement',
    'en',
    'contract',
    'contract-analysis',
    'auto_mapped',
    0.95,
    156,
    8,
    2800,
    0.92,
    0.60,
    0.85,
    0.88
),
(
    'Employment Contract',
    'employment_contract',
    'Employment Contract',
    'en',
    'contract',
    'contract-analysis',
    'template_created',
    0.98,
    112,
    12,
    4500,
    0.88,
    0.75,
    0.90,
    0.86
);

-- =====================================================
-- Sample Romanian Templates
-- =====================================================

-- Template 1: Notificare Avocateasca
INSERT INTO romanian_templates (
    template_name_ro,
    template_name_en,
    template_slug,
    legal_category,
    civil_code_references,
    jurisdiction,
    template_structure,
    standard_clauses,
    variable_mappings,
    created_from_pattern,
    version
) VALUES (
    'Notificare Avocateasca',
    'Legal Notice',
    'notificare-avocateasca',
    'correspondence',
    ARRAY['Art. 1350 Cod Civil', 'Art. 1516 Cod Civil'],
    'RO',
    '{
      "header": {
        "label_ro": "NOTIFICARE AVOCATEASCA",
        "label_en": "LEGAL NOTICE"
      },
      "sections": [
        {
          "id": "destinatar",
          "label_ro": "Către",
          "label_en": "To",
          "variables": ["{{DESTINATAR_NUME}}", "{{DESTINATAR_ADRESA}}"]
        },
        {
          "id": "referinta",
          "label_ro": "Referitor la",
          "label_en": "Regarding",
          "variables": ["{{OBIECT_NOTIFICARE}}"]
        },
        {
          "id": "preambul",
          "label_ro": "Stimată Doamnă/Stimate Domn",
          "label_en": "Dear Sir/Madam",
          "template": "Subscrisa {{FIRMA_NUME}}, prin avocat {{AVOCAT_NUME}}..."
        },
        {
          "id": "expunere",
          "label_ro": "Expunerea situației de fapt",
          "label_en": "Statement of Facts",
          "variables": ["{{DESCRIERE_FAPT}}"]
        },
        {
          "id": "temei_legal",
          "label_ro": "Temeiul legal",
          "label_en": "Legal Basis",
          "references": ["Art. 1350 Cod Civil", "Art. 1516 Cod Civil"]
        },
        {
          "id": "solicitare",
          "label_ro": "Solicităm",
          "label_en": "We Request",
          "variables": ["{{ACTIUNE_SOLICITATA}}", "{{TERMEN_CONFORMARE}}"]
        }
      ]
    }',
    '{
      "ro": [
        "în termen de 15 zile de la primirea prezentei",
        "sub sancțiunea decăderii din drepturi",
        "vom fi nevoiți să ne adresăm instanței competente"
      ],
      "en": [
        "within 15 days from receipt of this notice",
        "under penalty of forfeiture of rights",
        "we will be forced to address the competent court"
      ]
    }',
    '{
      "DESTINATAR_NUME": "Recipient Name",
      "DESTINATAR_ADRESA": "Recipient Address",
      "OBIECT_NOTIFICARE": "Notice Subject",
      "FIRMA_NUME": "Law Firm Name",
      "AVOCAT_NUME": "Lawyer Name",
      "DESCRIERE_FAPT": "Factual Description",
      "ACTIUNE_SOLICITATA": "Requested Action",
      "TERMEN_CONFORMARE": "Compliance Deadline"
    }',
    true,
    '1.0.0'
);

-- Template 2: Somatie de Plata
INSERT INTO romanian_templates (
    template_name_ro,
    template_name_en,
    template_slug,
    legal_category,
    civil_code_references,
    jurisdiction,
    template_structure,
    standard_clauses,
    variable_mappings,
    created_from_pattern,
    version
) VALUES (
    'Somatie de Plata',
    'Payment Notice',
    'somatie-plata',
    'correspondence',
    ARRAY['Art. 1523 Cod Civil', 'Art. 1531 Cod Civil'],
    'RO',
    '{
      "header": {
        "label_ro": "SOMAȚIE DE PLATĂ",
        "label_en": "PAYMENT NOTICE"
      },
      "sections": [
        {
          "id": "creditor",
          "label_ro": "Creditor",
          "label_en": "Creditor",
          "variables": ["{{CREDITOR_NUME}}", "{{CREDITOR_ADRESA}}"]
        },
        {
          "id": "debitor",
          "label_ro": "Debitor",
          "label_en": "Debtor",
          "variables": ["{{DEBITOR_NUME}}", "{{DEBITOR_ADRESA}}"]
        },
        {
          "id": "datoria",
          "label_ro": "Obiectul datoriei",
          "label_en": "Debt Object",
          "variables": ["{{SUMA_DATORIE}}", "{{MONEDA}}", "{{DESCRIERE_DATORIE}}"]
        },
        {
          "id": "termen",
          "label_ro": "Termen de plată",
          "label_en": "Payment Deadline",
          "variables": ["{{NUMAR_ZILE}}", "{{DATA_LIMITA}}"]
        },
        {
          "id": "consecinte",
          "label_ro": "Consecințe în caz de neconformare",
          "label_en": "Consequences of Non-Compliance",
          "template": "În cazul în care nu veți onora obligația..."
        }
      ]
    }',
    '{
      "ro": [
        "suma totală de {{SUMA_DATORIE}} {{MONEDA}}",
        "în termen de {{NUMAR_ZILE}} zile de la primirea prezentei",
        "ne vom vedea nevoiți să formulăm cerere de chemare în judecată"
      ],
      "en": [
        "total amount of {{SUMA_DATORIE}} {{MONEDA}}",
        "within {{NUMAR_ZILE}} days from receipt hereof",
        "we will be forced to file a lawsuit"
      ]
    }',
    '{
      "CREDITOR_NUME": "Creditor Name",
      "CREDITOR_ADRESA": "Creditor Address",
      "DEBITOR_NUME": "Debtor Name",
      "DEBITOR_ADRESA": "Debtor Address",
      "SUMA_DATORIE": "Debt Amount",
      "MONEDA": "Currency",
      "DESCRIERE_DATORIE": "Debt Description",
      "NUMAR_ZILE": "Number of Days",
      "DATA_LIMITA": "Deadline Date"
    }',
    true,
    '1.0.0'
);

-- =====================================================
-- Sample Document Patterns
-- =====================================================

INSERT INTO document_patterns (
    pattern_type,
    pattern_text_ro,
    pattern_text_en,
    category,
    occurrence_count,
    confidence_score
) VALUES
(
    'clause',
    'în termen de 15 zile de la primirea prezentei',
    'within 15 days from receipt of this notice',
    'standard_clause',
    45,
    0.92
),
(
    'clause',
    'sub sancțiunea decăderii din drepturi',
    'under penalty of forfeiture of rights',
    'legal_reference',
    38,
    0.88
),
(
    'phrase',
    'vom fi nevoiți să ne adresăm instanței competente',
    'we will be forced to address the competent court',
    'formulaic_phrase',
    52,
    0.95
),
(
    'header',
    'NOTIFICARE AVOCATEASCA',
    'LEGAL NOTICE',
    'structure',
    89,
    0.98
),
(
    'clause',
    'în conformitate cu dispozițiile art. 1350 din Codul Civil',
    'in accordance with the provisions of art. 1350 of the Civil Code',
    'legal_reference',
    67,
    0.90
);

-- =====================================================
-- Sample Template Usage Logs
-- =====================================================

-- Note: These would normally be populated during actual template usage
-- Including a few samples for testing dashboard views

INSERT INTO template_usage_logs (
    template_id,
    generation_time_ms,
    variables_filled,
    manual_edits_count,
    user_satisfaction_score,
    time_saved_minutes,
    use_case
) VALUES
(
    (SELECT id FROM romanian_templates WHERE template_slug = 'notificare-avocateasca'),
    1250,
    8,
    2,
    5,
    25,
    'Client payment dispute - sent legal notice before litigation'
),
(
    (SELECT id FROM romanian_templates WHERE template_slug = 'notificare-avocateasca'),
    980,
    8,
    1,
    4,
    20,
    'Contract breach notification'
),
(
    (SELECT id FROM romanian_templates WHERE template_slug = 'somatie-plata'),
    850,
    9,
    0,
    5,
    30,
    'Debt collection - first notice'
);

-- =====================================================
-- Verification Queries
-- =====================================================

-- To verify test data was inserted correctly, run:
-- SELECT COUNT(*) FROM document_type_registry;
-- SELECT COUNT(*) FROM romanian_templates;
-- SELECT COUNT(*) FROM document_patterns;
-- SELECT * FROM document_discovery_metrics;
-- SELECT * FROM template_effectiveness_report;
-- SELECT * FROM template_creation_candidates;
