/**
 * AI Assistant Context
 * Provides global context for the AI assistant bar across the app
 * Tracks current section and provides context-specific suggestions
 */

'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

// ============================================================================
// Types
// ============================================================================

export type AIAssistantSection =
  | 'dashboard'
  | 'case'
  | 'communications'
  | 'documents'
  | 'tasks'
  | 'clients'
  | 'calendar'
  | 'analytics'
  | 'admin'
  | 'settings';

export type CommandIntent =
  | 'CREATE_TASK'
  | 'ADD_DOCUMENT'
  | 'SCHEDULE_DEADLINE'
  | 'EMAIL_CLIENT'
  | 'LOG_TIME'
  | 'SEARCH'
  | 'GENERATE_DOCUMENT'
  | 'SUMMARIZE'
  | 'FILTER'
  | 'CREATE_REMINDER';

export interface QuickSuggestion {
  label: string;
  intent: CommandIntent;
  icon: React.ReactNode;
}

export interface SectionContext {
  section: AIAssistantSection;
  entityId?: string; // e.g., caseId, clientId
  entityName?: string; // e.g., case title for display
}

interface AIAssistantContextValue {
  // Current context
  context: SectionContext;

  // Actions
  setContext: (context: SectionContext) => void;
  setCaseContext: (caseId: string, caseName?: string) => void;
  clearEntityContext: () => void;

  // Computed
  suggestions: QuickSuggestion[];
  placeholder: string;
}

// ============================================================================
// Icons
// ============================================================================

const TaskIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

const DocumentIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const CalendarIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const EmailIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const TimeIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const SearchIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const GenerateIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

const SummarizeIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
  </svg>
);

const FilterIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
    />
  </svg>
);

const ReminderIcon = (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

// ============================================================================
// Suggestions per Section
// ============================================================================

const SECTION_SUGGESTIONS: Record<AIAssistantSection, QuickSuggestion[]> = {
  dashboard: [
    { label: 'Caută dosar', intent: 'SEARCH', icon: SearchIcon },
    { label: 'Sarcini azi', intent: 'FILTER', icon: TaskIcon },
    { label: 'Termene', intent: 'SCHEDULE_DEADLINE', icon: CalendarIcon },
  ],
  case: [
    { label: 'Sarcină', intent: 'CREATE_TASK', icon: TaskIcon },
    { label: 'Document', intent: 'ADD_DOCUMENT', icon: DocumentIcon },
    { label: 'Termen', intent: 'SCHEDULE_DEADLINE', icon: CalendarIcon },
    { label: 'Email', intent: 'EMAIL_CLIENT', icon: EmailIcon },
    { label: 'Timp', intent: 'LOG_TIME', icon: TimeIcon },
  ],
  communications: [
    { label: 'Răspunde', intent: 'EMAIL_CLIENT', icon: EmailIcon },
    { label: 'Caută', intent: 'SEARCH', icon: SearchIcon },
    { label: 'Rezumă', intent: 'SUMMARIZE', icon: SummarizeIcon },
  ],
  documents: [
    { label: 'Încarcă', intent: 'ADD_DOCUMENT', icon: DocumentIcon },
    { label: 'Generează', intent: 'GENERATE_DOCUMENT', icon: GenerateIcon },
    { label: 'Caută', intent: 'SEARCH', icon: SearchIcon },
  ],
  tasks: [
    { label: 'Creează', intent: 'CREATE_TASK', icon: TaskIcon },
    { label: 'Filtrează', intent: 'FILTER', icon: FilterIcon },
    { label: 'Reminder', intent: 'CREATE_REMINDER', icon: ReminderIcon },
  ],
  clients: [
    { label: 'Caută', intent: 'SEARCH', icon: SearchIcon },
    { label: 'Email', intent: 'EMAIL_CLIENT', icon: EmailIcon },
    { label: 'Sarcină', intent: 'CREATE_TASK', icon: TaskIcon },
  ],
  calendar: [
    { label: 'Programează', intent: 'SCHEDULE_DEADLINE', icon: CalendarIcon },
    { label: 'Reminder', intent: 'CREATE_REMINDER', icon: ReminderIcon },
    { label: 'Caută', intent: 'SEARCH', icon: SearchIcon },
  ],
  analytics: [
    { label: 'Raport', intent: 'GENERATE_DOCUMENT', icon: GenerateIcon },
    { label: 'Filtrează', intent: 'FILTER', icon: FilterIcon },
  ],
  admin: [
    { label: 'Caută', intent: 'SEARCH', icon: SearchIcon },
    { label: 'Raport', intent: 'GENERATE_DOCUMENT', icon: GenerateIcon },
  ],
  settings: [{ label: 'Caută', intent: 'SEARCH', icon: SearchIcon }],
};

const SECTION_PLACEHOLDERS: Record<AIAssistantSection, string> = {
  dashboard: 'Ce vrei să faci?',
  case: 'Acțiune pentru acest dosar...',
  communications: 'Caută sau răspunde la emailuri...',
  documents: 'Încarcă, generează sau caută documente...',
  tasks: 'Creează sau filtrează sarcini...',
  clients: 'Caută sau contactează clienți...',
  calendar: 'Programează sau caută termene...',
  analytics: 'Generează rapoarte sau filtrează...',
  admin: 'Administrare...',
  settings: 'Caută setări...',
};

// ============================================================================
// Context
// ============================================================================

const AIAssistantContext = createContext<AIAssistantContextValue | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

interface AIAssistantProviderProps {
  children: ReactNode;
}

export function AIAssistantProvider({ children }: AIAssistantProviderProps) {
  const [context, setContextState] = useState<SectionContext>({
    section: 'dashboard',
  });

  const setContext = useCallback((newContext: SectionContext) => {
    setContextState(newContext);
  }, []);

  const setCaseContext = useCallback((caseId: string, caseName?: string) => {
    setContextState({
      section: 'case',
      entityId: caseId,
      entityName: caseName,
    });
  }, []);

  const clearEntityContext = useCallback(() => {
    setContextState((prev) => ({
      section: prev.section,
    }));
  }, []);

  const suggestions = useMemo(
    () => SECTION_SUGGESTIONS[context.section] || SECTION_SUGGESTIONS.dashboard,
    [context.section]
  );

  const placeholder = useMemo(
    () => SECTION_PLACEHOLDERS[context.section] || SECTION_PLACEHOLDERS.dashboard,
    [context.section]
  );

  const value = useMemo(
    () => ({
      context,
      setContext,
      setCaseContext,
      clearEntityContext,
      suggestions,
      placeholder,
    }),
    [context, setContext, setCaseContext, clearEntityContext, suggestions, placeholder]
  );

  return <AIAssistantContext.Provider value={value}>{children}</AIAssistantContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useAIAssistant() {
  const context = useContext(AIAssistantContext);
  if (context === undefined) {
    throw new Error('useAIAssistant must be used within an AIAssistantProvider');
  }
  return context;
}

// ============================================================================
// Helper Hook for Setting Context on Mount
// ============================================================================

export function useSetAIContext(
  section: AIAssistantSection,
  entityId?: string,
  entityName?: string
) {
  const { setContext } = useAIAssistant();

  React.useEffect(() => {
    setContext({ section, entityId, entityName });
  }, [section, entityId, entityName, setContext]);
}
