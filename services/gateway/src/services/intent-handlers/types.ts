/**
 * Shared Types for Intent Handlers
 * OPS-072: Task & Calendar Intent Handler
 *
 * Common interfaces used across all intent handlers (Task, Case, Email, Document).
 */

// ============================================================================
// Context Types
// ============================================================================

/**
 * Context about the user's current UI state.
 * Passed from frontend to help with implicit context resolution.
 */
export interface AssistantContext {
  /** Current screen/route (e.g., '/cases/123/documents') */
  currentScreen?: string;
  /** Currently viewed case ID */
  currentCaseId?: string;
  /** Currently viewed document ID */
  currentDocumentId?: string;
  /** Currently selected email ID */
  selectedEmailId?: string;
  /** Currently selected text (for context-aware actions) */
  selectedText?: string;
}

/**
 * Authenticated user context for authorization and firm isolation.
 */
export interface UserContext {
  userId: string;
  firmId: string;
  role?: string;
  email?: string;
}

// ============================================================================
// Action Types
// ============================================================================

/**
 * A proposed action that requires user confirmation before execution.
 */
export interface ProposedAction {
  /** Action type identifier (e.g., 'CreateTask', 'ScheduleEvent') */
  type: string;
  /** Human-readable description of the action (Romanian) */
  displayText: string;
  /** Parameters to pass to the action executor */
  payload: Record<string, unknown>;
  /** Whether this action requires explicit user confirmation (default: true) */
  requiresConfirmation?: boolean;
  /** Romanian prompt shown in confirmation dialog */
  confirmationPrompt?: string;
  /** Preview data to display in the action card */
  entityPreview?: Record<string, unknown>;
}

/**
 * Result returned by intent handlers.
 */
export interface HandlerResult {
  /** Whether the handler processed successfully */
  success: boolean;
  /** Data returned for query-type intents */
  data?: unknown;
  /** Proposed action for action-type intents (requires confirmation) */
  proposedAction?: ProposedAction;
  /** Human-readable message (Romanian) */
  message?: string;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * AI conversation message with optional intent and action metadata.
 */
export interface AIMessage {
  id: string;
  role: 'User' | 'Assistant' | 'System';
  content: string;
  intent?: string;
  confidence?: number;
  proposedAction?: ProposedAction & { status: string };
  createdAt: string;
}

// ============================================================================
// Intent Handler Interface
// ============================================================================

/**
 * Base interface for all intent handlers.
 * Each handler implements specific methods for its domain.
 */
export interface IntentHandler {
  /** Human-readable name for logging */
  readonly name: string;
}
