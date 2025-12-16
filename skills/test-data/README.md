# Test Data for Legal Skills Validation

This directory contains test data for validating the performance and accuracy of legal skills.

## Directory Structure

- `contracts/` - Sample contracts for Contract Analysis skill testing
- `scenarios/` - Document drafting scenarios
- `research/` - Legal research queries
- `compliance/` - Compliance check test cases

## Test Data Inventory

### Contract Analysis (5 Sample Contracts)

1. `contracts/nda_sample.md` - NDA with standard clauses
2. `contracts/service_agreement_sample.md` - Professional services agreement
3. `contracts/employment_sample.md` - Employment contract with non-compete
4. `contracts/complex_merger.md` - Complex M&A agreement (high risk)
5. `contracts/simple_rental.md` - Residential lease agreement (low complexity)

### Document Drafting (3 Scenarios)

1. `scenarios/startup_nda.yml` - Startup needs mutual NDA for investor discussions
2. `scenarios/consulting_engagement.yml` - Consultant engagement for software project
3. `scenarios/saas_terms.yml` - SaaS company needs ToS and Privacy Policy

### Legal Research (5 Queries)

1. `research/contract_enforceability.yml` - Non-compete enforceability in California
2. `research/liability_cap.yml` - Limitation of liability in service agreements
3. `research/ip_ownership.yml` - Work-for-hire doctrine applicability
4. `research/data_breach.yml` - Data breach notification requirements
5. `research/termination_rights.yml` - At-will employment exceptions

### Compliance Check (3 Cases)

1. `compliance/gdpr_website.yml` - Website GDPR compliance review
2. `compliance/ccpa_app.yml` - Mobile app CCPA/CPRA compliance
3. `compliance/hipaa_platform.yml` - Healthcare platform HIPAA compliance

## Usage

Each test file includes:

- **Input:** The content/scenario to process
- **Expected Output:** What the skill should produce
- **Success Criteria:** How to evaluate accuracy
- **Performance Target:** Token count and execution time goals

## Validation Metrics

- **Accuracy:** Compare skill output to expected output (target: 95%+ match)
- **Token Reduction:** Compare token usage to baseline prompts (target: 70% reduction)
- **Execution Time:** Measure response time (target: <5 seconds)
- **Completeness:** Verify all required sections are generated
