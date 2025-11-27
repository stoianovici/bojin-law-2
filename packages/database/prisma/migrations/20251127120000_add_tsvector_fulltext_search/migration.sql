-- Story 3.2.6: Add tsvector full-text search support for training documents
-- Enables efficient text-based search across training documents

-- Add tsvector column for full-text search
ALTER TABLE training_documents
ADD COLUMN text_search_vector tsvector;

-- Create function to generate tsvector with language-specific configuration
CREATE OR REPLACE FUNCTION generate_training_doc_tsvector()
RETURNS trigger AS $$
BEGIN
    -- Use Romanian config for 'ro' language, English for others
    IF NEW.language = 'ro' THEN
        NEW.text_search_vector := to_tsvector('simple', COALESCE(NEW.original_filename, '')) ||
                                  to_tsvector('simple', COALESCE(NEW.text_content, '')) ||
                                  to_tsvector('simple', COALESCE(NEW.category, ''));
    ELSE
        NEW.text_search_vector := to_tsvector('english', COALESCE(NEW.original_filename, '')) ||
                                  to_tsvector('english', COALESCE(NEW.text_content, '')) ||
                                  to_tsvector('english', COALESCE(NEW.category, ''));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update tsvector on insert/update
CREATE TRIGGER training_docs_tsvector_update
    BEFORE INSERT OR UPDATE OF original_filename, text_content, category, language
    ON training_documents
    FOR EACH ROW
    EXECUTE FUNCTION generate_training_doc_tsvector();

-- Create GIN index for fast full-text search
CREATE INDEX idx_training_docs_text_search
ON training_documents
USING GIN (text_search_vector);

-- Update existing rows to populate tsvector
UPDATE training_documents
SET text_search_vector =
    CASE
        WHEN language = 'ro' THEN
            to_tsvector('simple', COALESCE(original_filename, '')) ||
            to_tsvector('simple', COALESCE(text_content, '')) ||
            to_tsvector('simple', COALESCE(category, ''))
        ELSE
            to_tsvector('english', COALESCE(original_filename, '')) ||
            to_tsvector('english', COALESCE(text_content, '')) ||
            to_tsvector('english', COALESCE(category, ''))
    END;

-- Add comment for documentation
COMMENT ON COLUMN training_documents.text_search_vector IS 'Full-text search vector combining filename, content, and category. Updated automatically via trigger.';
