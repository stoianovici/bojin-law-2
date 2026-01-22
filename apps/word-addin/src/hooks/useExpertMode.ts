/**
 * useExpertMode Hook
 * Provides session-based expert mode state for privileged users.
 *
 * Features:
 * - Session-based state (resets on page reload)
 * - Role-based access control (Partner, BusinessOwner only)
 * - React context for app-wide state sharing
 *
 * Usage:
 * 1. Wrap your app with ExpertModeProvider
 * 2. Use useExpertMode() hook to access state
 * 3. Call setUserRole() when user authenticates
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  createElement,
  type ReactNode,
} from 'react';

// ============================================================================
// Types
// ============================================================================

export type UserRole = 'Partner' | 'BusinessOwner' | 'Associate' | 'AssociateJr' | 'Paralegal';

export interface ExpertModeContextValue {
  /** Whether expert mode is currently enabled */
  isExpertMode: boolean;
  /** Toggle expert mode on/off (only works if canUseExpertMode is true) */
  toggleExpertMode: () => void;
  /** Whether the current user's role allows expert mode */
  canUseExpertMode: boolean;
  /** Set the user's role (call this after authentication) */
  setUserRole: (role: string) => void;
}

// ============================================================================
// Context
// ============================================================================

const ExpertModeContext = createContext<ExpertModeContextValue | null>(null);

// Roles that can use expert mode
const EXPERT_MODE_ROLES: UserRole[] = ['Partner', 'BusinessOwner'];

// ============================================================================
// Provider
// ============================================================================

export interface ExpertModeProviderProps {
  children: ReactNode;
}

export function ExpertModeProvider({ children }: ExpertModeProviderProps) {
  // Session-based state - resets on page reload
  const [isExpertMode, setIsExpertMode] = useState(false);
  const [userRole, setUserRoleState] = useState<string | null>(null);

  // Check if the current role allows expert mode
  const canUseExpertMode = useMemo(() => {
    if (!userRole) return false;
    return EXPERT_MODE_ROLES.includes(userRole as UserRole);
  }, [userRole]);

  // Toggle expert mode (only if allowed)
  const toggleExpertMode = useCallback(() => {
    if (canUseExpertMode) {
      setIsExpertMode((prev) => !prev);
    }
  }, [canUseExpertMode]);

  // Set user role
  const setUserRole = useCallback((role: string) => {
    setUserRoleState(role);
    // Reset expert mode when role changes to a non-expert role
    if (!EXPERT_MODE_ROLES.includes(role as UserRole)) {
      setIsExpertMode(false);
    }
  }, []);

  const value = useMemo<ExpertModeContextValue>(
    () => ({
      isExpertMode,
      toggleExpertMode,
      canUseExpertMode,
      setUserRole,
    }),
    [isExpertMode, toggleExpertMode, canUseExpertMode, setUserRole]
  );

  return createElement(ExpertModeContext.Provider, { value }, children);
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Access expert mode state and controls.
 * Must be used within an ExpertModeProvider.
 *
 * @throws Error if used outside of ExpertModeProvider
 */
export function useExpertMode(): ExpertModeContextValue {
  const context = useContext(ExpertModeContext);

  if (!context) {
    throw new Error('useExpertMode must be used within an ExpertModeProvider');
  }

  return context;
}
