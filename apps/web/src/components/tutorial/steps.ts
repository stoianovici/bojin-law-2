// ============================================================================
// Tutorial Step Definitions
// ============================================================================
// Defines all 11 tutorial steps with their targets, triggers, and configuration.
// Each step guides the user through creating their first case and document.

// ============================================================================
// Types
// ============================================================================

/**
 * Defines how a tutorial step advances to the next step.
 */
export type TutorialTrigger =
  | { type: 'click'; selector: string } // User clicks the target
  | { type: 'fill'; selectors: string[] } // User fills all specified fields
  | { type: 'choice'; choices: string[] } // User picks one of these buttons
  | { type: 'save' } // User saves/submits
  | { type: 'auto' }; // Automatic after navigation

/**
 * Configuration for a single tutorial step.
 */
export interface TutorialStep {
  id: number;
  /** Elements to highlight (data-tutorial attribute values) */
  targets: string[];
  /** How to advance to next step */
  nextTrigger: TutorialTrigger;
  /** Router path to navigate to before this step */
  navigate?: string;
  /** data-tutorial selectors for fields that must be filled before proceeding */
  mandatoryFields?: string[];
  /** Whether clicking dimmed areas reveals them (progressive reveal) */
  progressiveReveal?: boolean;
  /** Whether this step shows a choice dialog */
  showChoiceDialog?: boolean;
  /** Whether to force scroll the target into view */
  forceScroll?: boolean;
  /** Whether this step involves animated navigation */
  animatedNavigation?: boolean;
  /** Whether the mask should extend to include additional elements */
  extendMask?: boolean;
  /** Whether to skip internal masking (for full modal visibility) */
  noInternalMask?: boolean;
}

// ============================================================================
// Step Definitions
// ============================================================================

export const TUTORIAL_STEPS: TutorialStep[] = [
  // Step 1: Click "Cazuri" in sidebar
  {
    id: 1,
    targets: ['sidebar-cazuri'],
    nextTrigger: { type: 'click', selector: 'sidebar-cazuri' },
  },

  // Step 2: Click "+ Caz nou" button
  {
    id: 2,
    targets: ['btn-caz-nou'],
    nextTrigger: { type: 'click', selector: 'btn-caz-nou' },
  },

  // Step 3: Click "Creează client nou" button to reveal the client form
  {
    id: 3,
    targets: ['btn-creaza-client'],
    nextTrigger: { type: 'click', selector: 'btn-creaza-client' },
  },

  // Step 4: Click "Nume client" field - progressive reveal shows more fields
  {
    id: 4,
    targets: ['field-nume-client'],
    nextTrigger: { type: 'click', selector: 'field-nume-client' },
    progressiveReveal: true,
  },

  // Step 5: Fill both Email and Nume client - mandatory gate
  {
    id: 5,
    targets: ['field-email', 'field-nume-client'],
    nextTrigger: { type: 'fill', selectors: ['field-email', 'field-nume-client'] },
    mandatoryFields: ['field-email', 'field-nume-client'],
  },

  // Step 6: Click "Salvează client" - forced scroll to ensure button is visible
  {
    id: 6,
    targets: ['btn-salveaza-client'],
    nextTrigger: { type: 'click', selector: 'btn-salveaza-client' },
    forceScroll: true,
  },

  // Step 7: Focus on "Titlu" field in case details - animated navigation
  {
    id: 7,
    targets: ['field-titlu'],
    nextTrigger: { type: 'click', selector: 'field-titlu' },
    animatedNavigation: true,
  },

  // Step 8: Show "Clasificare email" field - mask extends to include it
  {
    id: 8,
    targets: ['field-titlu', 'field-clasificare-email'],
    nextTrigger: { type: 'click', selector: 'field-clasificare-email' },
    extendMask: true,
  },

  // Step 9: Click "Document nou" button - smooth navigation
  {
    id: 9,
    targets: ['btn-document-nou'],
    nextTrigger: { type: 'click', selector: 'btn-document-nou' },
  },

  // Step 10: Word Online choice dialog - "Sari peste" or "Continuă"
  {
    id: 10,
    targets: ['choice-word-online'],
    nextTrigger: { type: 'choice', choices: ['skip', 'continue'] },
    showChoiceDialog: true,
  },

  // Step 11: Select template in mapa modal
  {
    id: 11,
    targets: ['select-sablon'],
    nextTrigger: { type: 'click', selector: 'select-sablon' },
  },

  // Step 12: Full mapa modal visible - user saves to complete
  {
    id: 12,
    targets: ['mapa-modal'],
    nextTrigger: { type: 'save' },
    noInternalMask: true,
  },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get a tutorial step by its ID.
 */
export function getStepById(id: number): TutorialStep | undefined {
  return TUTORIAL_STEPS.find((s) => s.id === id);
}

/**
 * Get the next step after the given step ID.
 */
export function getNextStep(currentId: number): TutorialStep | undefined {
  const currentIndex = TUTORIAL_STEPS.findIndex((s) => s.id === currentId);
  if (currentIndex === -1 || currentIndex >= TUTORIAL_STEPS.length - 1) {
    return undefined;
  }
  return TUTORIAL_STEPS[currentIndex + 1];
}

/**
 * Check if a step ID is the last step.
 */
export function isLastStep(id: number): boolean {
  return id === TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1]?.id;
}

/** Total number of tutorial steps */
export const TOTAL_STEPS = 12;
