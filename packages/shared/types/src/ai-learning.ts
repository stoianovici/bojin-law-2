/**
 * AI Learning and Personalization Types (Story 5.6)
 * Types for learning user preferences and personalizing AI responses
 */

// ============================================================================
// Writing Style Profile Types (AC: 1)
// ============================================================================

/**
 * Common phrase entry in writing style profile
 */
export interface CommonPhrase {
  phrase: string;
  frequency: number;
  context: 'greeting' | 'closing' | 'body' | 'legal_term';
}

/**
 * Punctuation style preferences
 */
export interface PunctuationStyle {
  useOxfordComma: boolean;
  preferSemicolons: boolean;
  useDashes: 'em-dash' | 'en-dash' | 'hyphen';
  colonBeforeLists: boolean;
}

/**
 * Language-specific writing patterns
 */
export interface LanguagePatterns {
  primaryLanguage: 'romanian' | 'english';
  formalityByLanguage: Record<string, number>;
  preferredGreetingsByLanguage: Record<string, string[]>;
  legalTermsPreference: 'romanian' | 'latin' | 'mixed';
}

/**
 * Writing style profile learned from user edits
 */
export interface WritingStyleProfile {
  id: string;
  firmId: string;
  userId: string;
  formalityLevel: number; // 0-1 scale
  averageSentenceLength: number;
  vocabularyComplexity: number; // 0-1 scale
  preferredTone: string;
  commonPhrases: CommonPhrase[];
  punctuationStyle: PunctuationStyle;
  languagePatterns: LanguagePatterns;
  sampleCount: number;
  lastAnalyzedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating/updating writing style profile
 */
export interface WritingStyleProfileInput {
  formalityLevel?: number;
  averageSentenceLength?: number;
  vocabularyComplexity?: number;
  preferredTone?: string;
  commonPhrases?: CommonPhrase[];
  punctuationStyle?: Partial<PunctuationStyle>;
  languagePatterns?: Partial<LanguagePatterns>;
}

/**
 * Style analysis result from AI
 */
export interface StyleAnalysisResult {
  formalityScore: number;
  averageSentenceLength: number;
  vocabularyLevel: number;
  detectedTone: string;
  newPhrases: CommonPhrase[];
  punctuationPatterns: Partial<PunctuationStyle>;
  confidence: number;
}

// ============================================================================
// Personal Snippet Types (AC: 2)
// ============================================================================

/**
 * Snippet category enum
 */
export type SnippetCategory =
  | 'Greeting'
  | 'Closing'
  | 'LegalPhrase'
  | 'ClientResponse'
  | 'InternalNote'
  | 'Custom';

/**
 * Source context for auto-detected snippets
 */
export interface SnippetSourceContext {
  documentType?: string;
  emailType?: string;
  caseType?: string;
  detectedAt: Date;
}

/**
 * Personal snippet - frequently used phrases saved as shortcuts
 */
export interface PersonalSnippet {
  id: string;
  firmId: string;
  userId: string;
  shortcut: string;
  title: string;
  content: string;
  category: SnippetCategory;
  usageCount: number;
  lastUsedAt: Date | null;
  isAutoDetected: boolean;
  sourceContext: SnippetSourceContext | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a personal snippet
 */
export interface PersonalSnippetInput {
  shortcut: string;
  title: string;
  content: string;
  category: SnippetCategory;
}

/**
 * Auto-detected snippet suggestion
 */
export interface SnippetSuggestion {
  content: string;
  suggestedTitle: string;
  suggestedShortcut: string;
  category: SnippetCategory;
  occurrenceCount: number;
  sourceContext: SnippetSourceContext;
  confidence: number;
}

// ============================================================================
// Task Creation Pattern Types (AC: 3)
// ============================================================================

/**
 * Trigger type for task creation patterns
 */
export type TaskTriggerType =
  | 'case_type'
  | 'document_type'
  | 'email_keyword'
  | 'calendar_event'
  | 'deadline_proximity'
  | 'case_status_change';

/**
 * Trigger context for task creation
 */
export interface TaskTriggerContext {
  triggerType: TaskTriggerType;
  matchValue: string;
  additionalFilters?: Record<string, unknown>;
}

/**
 * Task template stored in patterns
 */
export interface TaskPatternTemplate {
  type: string;
  title: string;
  description?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  estimatedHours?: number;
  defaultAssignee?: 'self' | 'supervisor' | 'paralegal';
}

/**
 * Task creation pattern learned from user behavior
 */
export interface TaskCreationPattern {
  id: string;
  firmId: string;
  userId: string;
  patternName: string;
  triggerType: string;
  triggerContext: TaskTriggerContext;
  taskTemplate: TaskPatternTemplate;
  occurrenceCount: number;
  confidence: number;
  isActive: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a task creation pattern
 */
export interface TaskCreationPatternInput {
  patternName: string;
  triggerType: string;
  triggerContext: TaskTriggerContext;
  taskTemplate: TaskPatternTemplate;
}

/**
 * Task suggestion based on learned patterns
 */
export interface TaskSuggestionFromPattern {
  patternId: string;
  patternName: string;
  suggestedTask: TaskPatternTemplate;
  triggerContext: TaskTriggerContext;
  confidence: number;
  occurrenceCount: number;
}

// ============================================================================
// Document Structure Preference Types (AC: 4)
// ============================================================================

/**
 * Document section preference
 */
export interface SectionPreference {
  name: string;
  order: number;
  required: boolean;
  defaultContent?: string;
}

/**
 * Header style preferences
 */
export interface HeaderStylePreference {
  format: 'numbered' | 'lettered' | 'roman' | 'none';
  numbering: 'decimal' | 'hierarchical';
  capitalization: 'uppercase' | 'titlecase' | 'normal';
  bold: boolean;
  underline: boolean;
}

/**
 * Margin preferences (in cm or inches)
 */
export interface MarginPreferences {
  top: number;
  bottom: number;
  left: number;
  right: number;
  unit: 'cm' | 'in';
}

/**
 * Font preferences
 */
export interface FontPreferences {
  family: string;
  size: number;
  lineHeight: number;
  paragraphSpacing: number;
}

/**
 * Document structure preference per document type
 */
export interface DocumentStructurePreference {
  id: string;
  firmId: string;
  userId: string;
  documentType: string;
  preferredSections: SectionPreference[];
  headerStyle: HeaderStylePreference;
  footerContent: string | null;
  marginPreferences: MarginPreferences | null;
  fontPreferences: FontPreferences | null;
  usageCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating document structure preference
 */
export interface DocumentStructurePreferenceInput {
  documentType: string;
  preferredSections: SectionPreference[];
  headerStyle: HeaderStylePreference;
  footerContent?: string;
  marginPreferences?: MarginPreferences;
  fontPreferences?: FontPreferences;
}

// ============================================================================
// Response Time Pattern Types (AC: 5)
// ============================================================================

/**
 * Day of week pattern for response times
 */
export interface DayOfWeekPattern {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday?: number;
  sunday?: number;
}

/**
 * Time of day pattern for response times
 */
export interface TimeOfDayPattern {
  earlyMorning: number; // 6-9
  morning: number; // 9-12
  afternoon: number; // 12-17
  evening: number; // 17-21
  night?: number; // 21-6
}

/**
 * Response time pattern - tracks user's task completion timing
 */
export interface ResponseTimePattern {
  id: string;
  firmId: string;
  userId: string;
  taskType: string;
  caseType: string | null;
  averageResponseHours: number;
  medianResponseHours: number;
  minResponseHours: number;
  maxResponseHours: number;
  sampleCount: number;
  stdDeviation: number | null;
  dayOfWeekPattern: DayOfWeekPattern | null;
  timeOfDayPattern: TimeOfDayPattern | null;
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Predicted completion time based on patterns
 */
export interface CompletionTimePrediction {
  estimatedHours: number;
  confidenceLevel: number;
  basedOnSamples: number;
  adjustedForDayOfWeek: boolean;
  adjustedForTimeOfDay: boolean;
  factors: string[];
}

// ============================================================================
// Draft Edit History Types (AC: 1)
// ============================================================================

/**
 * Edit type enum
 */
export type EditType = 'Addition' | 'Deletion' | 'Replacement' | 'Reorder' | 'StyleChange';

/**
 * Edit location in draft
 */
export type EditLocation = 'greeting' | 'body' | 'closing' | 'full' | 'subject';

/**
 * Draft edit history - tracks edits to learn writing style
 */
export interface DraftEditHistory {
  id: string;
  firmId: string;
  userId: string;
  draftId: string;
  originalText: string;
  editedText: string;
  editType: EditType;
  editLocation: string;
  isStyleAnalyzed: boolean;
  createdAt: Date;
}

/**
 * Edit analysis result
 */
export interface EditAnalysisResult {
  editType: EditType;
  editLocation: EditLocation;
  insertedWords: string[];
  deletedWords: string[];
  styleChanges: Partial<WritingStyleProfileInput>;
  detectedPhrases: CommonPhrase[];
}

// ============================================================================
// Learning Service Types
// ============================================================================

/**
 * Learning event to trigger analysis
 */
export interface LearningEvent {
  eventType: 'draft_edit' | 'task_created' | 'snippet_used' | 'document_created';
  userId: string;
  firmId: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Learning analysis job
 */
export interface LearningAnalysisJob {
  id: string;
  userId: string;
  firmId: string;
  analysisType: 'style' | 'patterns' | 'snippets' | 'response_times';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  samplesProcessed: number;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

/**
 * User personalization settings
 */
export interface PersonalizationSettings {
  userId: string;
  styleAdaptationEnabled: boolean;
  snippetSuggestionsEnabled: boolean;
  taskPatternSuggestionsEnabled: boolean;
  responseTimePredictionsEnabled: boolean;
  documentPreferencesEnabled: boolean;
  learningFromEditsEnabled: boolean;
  privacyLevel: 'full' | 'limited' | 'minimal';
}

/**
 * Personalization context for AI requests
 */
export interface PersonalizationContext {
  writingStyle?: Partial<WritingStyleProfile>;
  recentSnippets?: PersonalSnippet[];
  documentPreferences?: DocumentStructurePreference;
  responseTimeEstimate?: CompletionTimePrediction;
  taskPatterns?: TaskCreationPattern[];
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Learning status response
 */
export interface LearningStatus {
  userId: string;
  writingStyleSamples: number;
  snippetsCount: number;
  taskPatternsCount: number;
  documentPreferencesCount: number;
  responseTimePatternCount: number;
  lastAnalysisAt: Date | null;
  nextScheduledAnalysis: Date | null;
}

/**
 * Personalization suggestions response
 */
export interface PersonalizationSuggestions {
  snippetSuggestions: SnippetSuggestion[];
  taskSuggestions: TaskSuggestionFromPattern[];
  styleImprovements: string[];
}
