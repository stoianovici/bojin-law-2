/**
 * Jurisprudence Agent Types
 *
 * Types for the jurisprudence research agent that produces
 * properly formatted Romanian court citations.
 */

// ============================================================================
// Citation Types
// ============================================================================

/**
 * Type of court decision.
 * - decizie: Appellate decision (ÎCCJ, CA, CCR)
 * - sentință: First instance judgment (Tribunale, Judecătorii)
 * - încheiere: Interlocutory ruling (procedural matters)
 */
export type DecisionType = 'decizie' | 'sentință' | 'încheiere';

/**
 * Court level in Romanian judicial hierarchy.
 */
export type CourtLevel = 'ÎCCJ' | 'CCR' | 'CA' | 'Tribunal' | 'Judecătorie';

/**
 * A properly formatted Romanian jurisprudence citation.
 */
export interface JurisprudenceCitation {
  /** Internal reference ID (e.g., "src1", "src2") */
  id: string;

  /** Type of decision */
  decisionType: DecisionType;

  /** Decision number with year (e.g., "30/2020") */
  decisionNumber: string;

  /** Court abbreviation (e.g., "ÎCCJ", "CCR", "CA București") */
  court: string;

  /** Full court name (e.g., "Înalta Curte de Casație și Justiție") */
  courtFull: string;

  /** Court section if applicable (e.g., "Secția I civilă", "Completul RIL") */
  section?: string;

  /** Decision date in ISO format (YYYY-MM-DD) */
  date: string;

  /** Decision date formatted for display (DD.MM.YYYY) */
  dateFormatted: string;

  /** URL to the source (rejust.ro, scj.ro, ccr.ro, etc.) */
  url: string;

  /** Case file number if known (e.g., "Dosar nr. 1234/1/2020") */
  caseNumber?: string;

  /** 2-3 sentence summary of the holding */
  summary: string;

  /** Why this decision is relevant to the research topic */
  relevance: string;

  /** Official Gazette publication for CCR decisions */
  officialGazette?: string;

  /** Whether the URL was found in search results (provenance verified) */
  verified?: boolean;
}

// ============================================================================
// Research Output Types
// ============================================================================

/**
 * Complete output from the jurisprudence research agent.
 */
export interface JurisprudenceResearchOutput {
  /** Research topic/question */
  topic: string;

  /** When the research was generated (ISO timestamp) */
  generatedAt: string;

  /** Executive summary of findings (2-3 paragraphs) */
  summary: string;

  /** List of citations found */
  citations: JurisprudenceCitation[];

  /** Synthesis narrative analyzing the jurisprudence */
  analysis: string;

  /** What couldn't be found or verified */
  gaps: string[];

  /** Metadata about the research process */
  metadata: {
    /** Number of searches performed */
    searchCount: number;
    /** Databases/sources searched */
    sourcesSearched: string[];
    /** Total duration in milliseconds */
    durationMs: number;
    /** Estimated cost in EUR */
    costEur: number;
  };
}

// ============================================================================
// Tool Input Types
// ============================================================================

/**
 * Input for the search_jurisprudence tool.
 */
export interface SearchJurisprudenceInput {
  /** Search query (legal terms, concepts) */
  query: string;

  /** Filter by court (ÎCCJ, CCR, CA, Tribunal, Judecătorie) */
  courts?: CourtLevel[];

  /** Filter by year range */
  yearRange?: {
    from: number;
    to: number;
  };

  /** Maximum results to return (default: 10) */
  maxResults?: number;
}

/**
 * Input for the submit_jurisprudence_notes tool.
 */
export interface SubmitJurisprudenceNotesInput {
  /** Research topic/question */
  topic: string;

  /** Executive summary of findings */
  summary: string;

  /** List of citations with full details */
  citations: JurisprudenceCitation[];

  /** Analysis synthesizing the jurisprudence */
  analysis: string;

  /** What couldn't be found */
  gaps: string[];
}

// ============================================================================
// Agent Context Types
// ============================================================================

/**
 * Context passed to the jurisprudence agent.
 */
export interface JurisprudenceAgentContext {
  /** User ID requesting the research */
  userId: string;

  /** Firm ID */
  firmId: string;

  /** Correlation ID for tracing */
  correlationId: string;

  /** Case ID if researching for a specific case */
  caseId?: string;
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * Options for running jurisprudence research.
 */
export interface JurisprudenceResearchOptions {
  /** Progress callback for streaming updates */
  onProgress?: (event: JurisprudenceProgressEvent) => void;
}

/**
 * Progress event during jurisprudence research.
 */
export interface JurisprudenceProgressEvent {
  type:
    | 'search_start'
    | 'search_complete'
    | 'search_retry'
    | 'citation_found'
    | 'analysis_start'
    | 'complete'
    | 'error'
    | 'rate_limited'
    | 'cache_hit';
  message: string;
  data?: {
    searchQuery?: string;
    resultCount?: number;
    citationCount?: number;
    error?: string;
    retryAttempt?: number;
    maxRetries?: number;
    cachedAt?: string;
    citationId?: string;
    court?: string;
  };
}

/**
 * Result from jurisprudence research.
 */
export interface JurisprudenceResearchResult {
  success: boolean;
  output: JurisprudenceResearchOutput | null;
  error?: string;
  durationMs: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  costEur: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Constraints for jurisprudence research.
 */
export const JURISPRUDENCE_CONSTRAINTS = {
  /** Maximum number of search rounds */
  MAX_SEARCH_ROUNDS: 15,

  /** Maximum citations to include */
  MAX_CITATIONS: 20,

  /** Maximum summary length per citation */
  MAX_SUMMARY_LENGTH: 500,

  /** Maximum analysis length */
  MAX_ANALYSIS_LENGTH: 3000,

  /** Maximum executive summary length */
  MAX_EXECUTIVE_SUMMARY_LENGTH: 2000,

  /** Maximum topic length to prevent token explosion */
  MAX_TOPIC_LENGTH: 2000,

  /** Maximum context length to prevent memory exhaustion */
  MAX_CONTEXT_LENGTH: 5000,

  /** Rate limit: requests per user per hour */
  RATE_LIMIT_REQUESTS: 10,

  /** Rate limit window in seconds (1 hour) */
  RATE_LIMIT_WINDOW_SECONDS: 3600,

  /** Search cache TTL in seconds (15 minutes) */
  SEARCH_CACHE_TTL_SECONDS: 900,

  /** Maximum retry attempts for failed searches */
  MAX_RETRY_ATTEMPTS: 3,

  /** Retry backoff base delay in ms */
  RETRY_BACKOFF_BASE_MS: 1000,

  /**
   * Maximum URLs to track for provenance verification.
   * 15 search rounds × 15 results = 225 max, so 500 provides buffer.
   * URLs are now stored in Redis with auto-expiry.
   */
  MAX_TRACKED_URLS: 500,

  /**
   * Search timeout in milliseconds.
   * Prevents hanging requests that tie up resources.
   * 30 seconds is generous for web search API calls.
   */
  SEARCH_TIMEOUT_MS: 30000,
} as const;

/**
 * Romanian court hierarchy with full names.
 */
export const COURT_NAMES: Record<CourtLevel, string> = {
  ÎCCJ: 'Înalta Curte de Casație și Justiție',
  CCR: 'Curtea Constituțională a României',
  CA: 'Curtea de Apel',
  Tribunal: 'Tribunalul',
  Judecătorie: 'Judecătoria',
};

/**
 * Authoritative jurisprudence sources.
 */
export const JURISPRUDENCE_SOURCES = [
  'rejust.ro',
  'scj.ro',
  'ccr.ro',
  'rolii.ro',
  'portal.just.ro',
] as const;
