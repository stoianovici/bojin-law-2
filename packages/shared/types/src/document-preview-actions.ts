/**
 * Document Preview Actions Types
 * Part of Context-Aware Document Preview Actions epic (OPS-134)
 *
 * Defines types and default configurations for preview modal action toolbars
 * that appear in different contexts throughout the application.
 */

import type { UserRole } from './entities';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Context in which the document preview modal is opened.
 * Determines which actions are available in the toolbar.
 */
export type PreviewContext =
  | 'case-documents' // /cases/[id]/documents tab
  | 'email-attachment' // Email attachment preview in communications
  | 'mapa' // Mapa dosarului document viewer
  | 'chronology'; // Case chronology document links

/**
 * Visual style variant for action buttons.
 * - primary: Main action (blue/accent color)
 * - secondary: Supporting action (gray/muted)
 * - danger: Destructive action (red)
 */
export type ActionVariant = 'primary' | 'secondary' | 'danger';

/**
 * Grouping for action toolbar layout.
 * - primary: Displayed prominently (left side or top)
 * - secondary: Displayed in overflow/dropdown or less prominent position
 */
export type ActionGroup = 'primary' | 'secondary';

// ============================================================================
// Action Interfaces
// ============================================================================

/**
 * Definition of a single preview action.
 * Actions are rendered as buttons in the preview modal toolbar.
 */
export interface PreviewAction {
  /** Unique identifier for the action (e.g., 'save-to-documents', 'download') */
  id: string;

  /** Display label in Romanian (e.g., 'Descarcă', 'Salvează în documente') */
  label: string;

  /** Lucide icon name (e.g., 'Download', 'Save', 'Trash2') */
  icon: string;

  /** Visual style variant */
  variant: ActionVariant;

  /** Toolbar grouping */
  group: ActionGroup;

  /**
   * Roles allowed to see/use this action.
   * If undefined, action is available to all authenticated users.
   */
  roles?: UserRole[];
}

/**
 * Configuration mapping a context to its available actions.
 */
export interface PreviewActionConfig {
  context: PreviewContext;
  actions: PreviewAction[];
}

// ============================================================================
// Default Action Definitions
// ============================================================================

/**
 * Common actions used across multiple contexts.
 * Defined separately for reuse and consistency.
 */
const COMMON_ACTIONS = {
  download: {
    id: 'download',
    label: 'Descarcă',
    icon: 'Download',
    variant: 'primary' as ActionVariant,
    group: 'primary' as ActionGroup,
  },
  addToMapa: {
    id: 'add-to-mapa',
    label: 'Adaugă în mapă',
    icon: 'FolderPlus',
    variant: 'primary' as ActionVariant,
    group: 'primary' as ActionGroup,
  },
  openInDocuments: {
    id: 'open-in-documents',
    label: 'Deschide în documente',
    icon: 'FileText',
    variant: 'primary' as ActionVariant,
    group: 'primary' as ActionGroup,
  },
} as const;

/**
 * Default action sets per preview context.
 * These can be overridden or extended at the component level if needed.
 */
export const DEFAULT_PREVIEW_ACTIONS: Record<PreviewContext, PreviewAction[]> = {
  /**
   * Case Documents Tab (/cases/[id]/documents)
   * Full document management capabilities
   */
  'case-documents': [
    // Primary actions
    { ...COMMON_ACTIONS.addToMapa },
    { ...COMMON_ACTIONS.download },
    // Secondary actions
    {
      id: 'rename',
      label: 'Redenumește',
      icon: 'Pencil',
      variant: 'secondary',
      group: 'secondary',
    },
    {
      id: 'move',
      label: 'Mută',
      icon: 'FolderInput',
      variant: 'secondary',
      group: 'secondary',
    },
    {
      id: 'link-to-case',
      label: 'Leagă de alt dosar',
      icon: 'Link',
      variant: 'secondary',
      group: 'secondary',
      roles: ['Partner', 'Associate'],
    },
    {
      id: 'delete',
      label: 'Șterge',
      icon: 'Trash2',
      variant: 'danger',
      group: 'secondary',
      roles: ['Partner'],
    },
  ],

  /**
   * Email Attachment Preview (Communications)
   * Focus on saving attachments to case documents or dismissing
   */
  'email-attachment': [
    // Primary actions
    {
      id: 'save-to-documents',
      label: 'Salvează în documente',
      icon: 'Save',
      variant: 'primary',
      group: 'primary',
    },
    { ...COMMON_ACTIONS.addToMapa },
    { ...COMMON_ACTIONS.download },
    // Secondary actions
    {
      id: 'mark-irrelevant',
      label: 'Marchează irelevant',
      icon: 'EyeOff',
      variant: 'secondary',
      group: 'secondary',
    },
  ],

  /**
   * Mapa Dosarului (Case Folder/Binder)
   * Document management within the mapa context
   */
  mapa: [
    // Primary actions
    { ...COMMON_ACTIONS.download },
    {
      id: 'replace',
      label: 'Înlocuiește',
      icon: 'RefreshCw',
      variant: 'primary',
      group: 'primary',
    },
    {
      id: 'remove-from-mapa',
      label: 'Elimină din mapă',
      icon: 'FolderMinus',
      variant: 'danger',
      group: 'primary',
    },
    // Secondary actions
    {
      id: 'open-in-case',
      label: 'Deschide în dosar',
      icon: 'ExternalLink',
      variant: 'secondary',
      group: 'secondary',
    },
  ],

  /**
   * Case Chronology Tab
   * Quick access to documents referenced in timeline events
   */
  chronology: [
    // Primary actions
    { ...COMMON_ACTIONS.openInDocuments },
    { ...COMMON_ACTIONS.download },
    // Secondary actions
    { ...COMMON_ACTIONS.addToMapa, group: 'secondary' as ActionGroup },
  ],
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get actions for a specific context, optionally filtered by user role.
 *
 * @param context - The preview context
 * @param userRole - Optional user role for filtering role-restricted actions
 * @returns Array of actions available to the user in this context
 */
export function getActionsForContext(
  context: PreviewContext,
  userRole?: UserRole
): PreviewAction[] {
  const actions = DEFAULT_PREVIEW_ACTIONS[context];

  if (!userRole) {
    // Return only actions without role restrictions
    return actions.filter((action) => !action.roles);
  }

  // Return actions that either have no role restrictions or include user's role
  return actions.filter((action) => !action.roles || action.roles.includes(userRole));
}

/**
 * Get actions grouped by their group property.
 *
 * @param actions - Array of actions to group
 * @returns Object with 'primary' and 'secondary' action arrays
 */
export function groupActions(actions: PreviewAction[]): {
  primary: PreviewAction[];
  secondary: PreviewAction[];
} {
  return {
    primary: actions.filter((action) => action.group === 'primary'),
    secondary: actions.filter((action) => action.group === 'secondary'),
  };
}

/**
 * Check if a user role can perform a specific action.
 *
 * @param action - The action to check
 * @param userRole - The user's role
 * @returns true if the user can perform the action
 */
export function canPerformAction(action: PreviewAction, userRole: UserRole): boolean {
  if (!action.roles) return true;
  return action.roles.includes(userRole);
}
