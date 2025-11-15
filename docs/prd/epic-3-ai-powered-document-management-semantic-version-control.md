# Epic 3: AI-Powered Document Management & Semantic Version Control

**Goal:** Build a comprehensive document management system that leverages AI for intelligent drafting, semantic version control that understands legal changes rather than just text differences, and automatic template learning from firm's existing documents. This epic delivers the core differentiating feature that will save lawyers hours daily and reduce document errors by 75% through context-aware AI assistance and intelligent change tracking.

## Story 3.1: AI Service Infrastructure

**As a** platform developer,
**I want** a robust AI service architecture,
**so that** all AI features have consistent, performant infrastructure.

**Acceptance Criteria:**
1. AI service created with LangChain for prompt management and chaining
2. Multi-model routing: Haiku for simple, Sonnet for standard, Opus for complex tasks
3. Token tracking implemented per user, case, and operation type
4. Response caching with semantic similarity to reduce duplicate API calls
5. Fallback from Claude to GPT-4 on service unavailability
6. Monitoring dashboard shows token usage, costs, and response times

**Rollback Plan:** Feature flags allow disabling AI features if issues arise.

## Story 3.2: Document Template Learning System

**As a** law firm,
**I want** the AI to learn from our existing document templates,
**so that** new documents match our firm's style and standards.

**Acceptance Criteria:**
1. Bulk import accepts documents via Outlook mailbox attachment scanning (select folders/date ranges)
2. AI extracts and categorizes document sections and standard clauses
3. Template patterns identified across similar documents (>80% similarity)
4. Firm-specific language patterns stored in vector database
5. Template library UI shows learned templates with usage statistics
6. Manual template refinement allows editing AI-identified patterns

**Note:** This story is implemented through two sub-stories that were added after the original PRD:
- **Story 3.2.5** handles the user-facing document import and categorization workflow
- **Story 3.2.6** implements the backend AI training pipeline that processes categorized documents

## Story 3.2.5: Legacy Document Import & Categorization for AI Training

**As a** law firm partner migrating to the platform,
**I want** to import and categorize legacy documents from my email archives,
**so that** the AI can learn from our firm's historical documents to provide better suggestions.

**Acceptance Criteria:**
1. PST file upload (up to 10GB) with secure server-side processing via Azure Blob Storage (encrypted)
2. Document extraction preserving original Outlook folder hierarchy (collapsible tree view)
3. Categorization interface with document preview (PDF/DOCX viewer) and folder navigation
4. On-the-fly category creation with Romanian names (e.g., "Contract", "Notificare Avocateasca")
5. Session persistence via IndexedDB for multi-session workflows (can resume after closing browser)
6. Bulk folder operations (categorize all/skip all documents in a folder)
7. OneDrive export to `/AI-Training/{CategoryName}/` with metadata JSON files
8. Automatic cleanup: PST and temp files deleted from Azure Blob after export completes
9. Audit logging for uploads, extractions, exports, and deletions
10. Only Partners can access the standalone import app at `import.yourapp.com`

**Rollback Plan:** Standalone app can be disabled via feature flag; OneDrive files can be manually deleted.

## Story 3.2.6: AI Training Pipeline for Legacy Document Processing

**As an** AI service,
**I want** to automatically process categorized legacy documents from OneDrive,
**so that** I can learn firm-specific language patterns and templates to improve document generation.

**Acceptance Criteria:**
1. OneDrive discovery scans `/AI-Training/` folders and identifies unprocessed documents
2. Text extraction from PDFs and DOCX files with language detection (Romanian vs English)
3. Embedding generation using OpenAI text-embedding-3-small model, stored in PostgreSQL with pgvector
4. Pattern identification: repeated phrases (5+ words, 3+ docs), common document structures, standard clauses
5. Template extraction from high-similarity documents (>85% similar) with structure analysis
6. Knowledge base storage in PostgreSQL tables: TrainingDocuments, DocumentEmbeddings, DocumentPatterns, TemplateLibrary
7. BullMQ job queue with batch processing (10 documents at a time) and retry logic
8. Scheduled daily runs (2 AM) plus manual trigger via admin API endpoint
9. Monitoring dashboard showing processing stats, token usage, and errors
10. Semantic search API endpoint for AI service to query relevant documents and patterns

**Rollback Plan:** Feature flags allow disabling pipeline; failed runs logged for debugging; can reprocess by deleting from training_documents table.

## Story 3.3: Intelligent Document Drafting

**As a** lawyer creating documents,
**I want** AI to draft documents based on case context,
**so that** I can create accurate documents in less time.

**Acceptance Criteria:**
1. Natural language prompt generates complete first draft
2. AI incorporates case facts, client information, and relevant dates
3. Clause suggestions appear as user types with Tab to accept
4. Similar document finder shows relevant precedents from firm library
5. AI explains reasoning for specific language choices when asked
6. Draft quality requires <30% manual editing on average

## Story 3.4: Word Integration with Live AI Assistance

**As a** user preferring Microsoft Word,
**I want** to edit documents in Word with AI assistance,
**so that** I can work in my familiar environment.

**Acceptance Criteria:**
1. "Edit in Word" opens document in desktop Word via OneDrive
2. Changes in Word sync back to platform within 30 seconds
3. AI suggestions panel accessible via Word add-in or web sidebar
4. Track changes in Word preserved in platform version history
5. Comments in Word synchronized with platform review system
6. Platform locks document during Word editing to prevent conflicts

## Story 3.5: Semantic Version Control System

**As a** lawyer reviewing document changes,
**I want** to understand the legal implications of edits,
**so that** I can quickly identify substantive changes.

**Acceptance Criteria:**
1. Version comparison highlights legally significant changes in different color
2. AI summarizes changes in plain language: "Payment terms extended from 30 to 60 days"
3. Change impact assessment: "Low", "Medium", "High" risk rating
4. Version timeline shows who made changes and when with rollback option
5. Semantic diff ignores formatting and focuses on meaning changes
6. Suggested responses generated for opposing counsel's modifications

## Story 3.6: Document Review and Approval Workflow

**As a** partner reviewing documents,
**I want** an efficient review and approval process,
**so that** I can ensure quality while maintaining speed.

**Acceptance Criteria:**
1. Review request notification sent to designated approver
2. Review interface shows document with AI-flagged areas of concern
3. Inline comments and suggestions tracked with author attribution
4. Approval/rejection includes mandatory feedback field
5. Revision tracking shows complete history of review cycles
6. Batch review mode for multiple similar documents

## Story 3.7: AI Document Intelligence Dashboard

**As a** firm manager,
**I want** insights into document creation patterns,
**so that** I can identify efficiency opportunities.

**Acceptance Criteria:**
1. Dashboard shows document creation velocity by user and type
2. AI assistance utilization rate per user with adoption trends
3. Error detection rate showing problems caught before filing
4. Time savings calculated based on drafting speed improvements
5. Most-used templates and clauses ranked by frequency
6. Document quality score trends based on revision counts

## Story 3.8: Document System Testing and Performance

**As a** platform operator,
**I want** comprehensive testing of the document system,
**so that** we can ensure reliability and performance.

**Acceptance Criteria:**
1. Load testing for concurrent document operations
2. Performance benchmarks for generation, search, and version comparison
3. Stress testing with large documents (100+ pages)
4. Integration tests for Word synchronization
5. Failover testing for AI service switching
6. Token usage monitoring and alerting
7. Performance dashboard in Application Insights

**Rollback Plan:** Feature flags allow disabling of problematic features.
