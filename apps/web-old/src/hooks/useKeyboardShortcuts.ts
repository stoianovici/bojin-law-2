/**
 * useKeyboardShortcuts Hook
 * Global keyboard shortcut system with scope-based priority
 * Scope priority: component > page > global
 */

'use client';

import { useEffect, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ModifierKey = 'meta' | 'ctrl' | 'shift' | 'alt';
export type ShortcutScope = 'global' | 'page' | 'component';

export interface Shortcut {
  /** Key to trigger (e.g., 'k', 'ArrowDown', 'Escape') */
  key: string;
  /** Modifier keys required (e.g., ['meta'], ['ctrl', 'shift']) */
  modifiers?: ModifierKey[];
  /** Action to execute when triggered */
  action: () => void;
  /** Human-readable description for reference display */
  description: string;
  /** Scope determines priority: component > page > global */
  scope?: ShortcutScope;
  /** Whether the shortcut is currently enabled */
  enabled?: boolean;
}

interface ShortcutRegistry {
  shortcuts: Map<string, Shortcut & { id: string }>;
  scopePriority: Record<ShortcutScope, number>;
}

// ============================================================================
// Constants
// ============================================================================

const SCOPE_PRIORITY: Record<ShortcutScope, number> = {
  component: 3,
  page: 2,
  global: 1,
};

// Keys that shouldn't trigger shortcuts when focused on inputs
const INPUT_ELEMENTS = ['INPUT', 'TEXTAREA', 'SELECT'];

// Keys that are allowed even when focused on input elements
const ALLOWED_IN_INPUT = ['Escape'];

// ============================================================================
// Global Registry
// ============================================================================

// Global registry for all shortcuts (singleton pattern)
const registry: ShortcutRegistry = {
  shortcuts: new Map(),
  scopePriority: SCOPE_PRIORITY,
};

let idCounter = 0;

function checkModifiers(event: KeyboardEvent, modifiers?: ModifierKey[]): boolean {
  const required = {
    meta: modifiers?.includes('meta') ?? false,
    ctrl: modifiers?.includes('ctrl') ?? false,
    shift: modifiers?.includes('shift') ?? false,
    alt: modifiers?.includes('alt') ?? false,
  };

  return (
    event.metaKey === required.meta &&
    event.ctrlKey === required.ctrl &&
    event.shiftKey === required.shift &&
    event.altKey === required.alt
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to register keyboard shortcuts with scope-based priority
 *
 * @example
 * // Global shortcut
 * useKeyboardShortcuts([
 *   { key: 'k', modifiers: ['meta'], action: openPalette, description: 'Open command palette' }
 * ]);
 *
 * @example
 * // Component-level shortcut (overrides global)
 * useKeyboardShortcuts([
 *   { key: 'ArrowDown', action: nextItem, description: 'Next item', scope: 'component' }
 * ]);
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const shortcutIdsRef = useRef<string[]>([]);

  // Register shortcuts on mount
  useEffect(() => {
    const ids: string[] = [];

    shortcuts.forEach((shortcut) => {
      if (shortcut.enabled === false) return;

      const id = `shortcut-${++idCounter}`;

      registry.shortcuts.set(id, {
        ...shortcut,
        id,
        scope: shortcut.scope || 'global',
      });

      ids.push(id);
    });

    shortcutIdsRef.current = ids;

    // Cleanup on unmount
    return () => {
      ids.forEach((id) => registry.shortcuts.delete(id));
    };
  }, [shortcuts]);

  return null;
}

// ============================================================================
// Global Listener
// ============================================================================

// Single global keydown listener (initialized once)
let listenerInitialized = false;

function initGlobalListener() {
  if (listenerInitialized || typeof window === 'undefined') return;

  const handleKeyDown = (event: KeyboardEvent) => {
    // Check if focused on input element
    const target = event.target as HTMLElement;
    const isInputFocused = INPUT_ELEMENTS.includes(target.tagName) || target.isContentEditable;

    // Find matching shortcuts
    const matchingShortcuts: (Shortcut & { id: string })[] = [];

    registry.shortcuts.forEach((shortcut) => {
      // Check if key matches
      if (shortcut.key.toLowerCase() !== event.key.toLowerCase()) return;

      // Check modifiers
      if (!checkModifiers(event, shortcut.modifiers)) return;

      // Skip if on input and not allowed
      if (isInputFocused && !ALLOWED_IN_INPUT.includes(shortcut.key)) {
        // Allow shortcuts with modifiers even on inputs
        if (!shortcut.modifiers?.length) return;
      }

      matchingShortcuts.push(shortcut);
    });

    if (matchingShortcuts.length === 0) return;

    // Sort by scope priority (highest first)
    matchingShortcuts.sort(
      (a, b) => SCOPE_PRIORITY[b.scope || 'global'] - SCOPE_PRIORITY[a.scope || 'global']
    );

    // Execute the highest priority shortcut
    const shortcut = matchingShortcuts[0];
    event.preventDefault();
    shortcut.action();
  };

  document.addEventListener('keydown', handleKeyDown);
  listenerInitialized = true;
}

// Initialize on module load (client-side only)
if (typeof window !== 'undefined') {
  initGlobalListener();
}

// ============================================================================
// Utility: Get All Registered Shortcuts
// ============================================================================

/**
 * Get all currently registered shortcuts
 * Useful for displaying a shortcut reference panel
 */
export function getAllShortcuts(): Shortcut[] {
  return Array.from(registry.shortcuts.values());
}

/**
 * Format a shortcut for display
 * Returns platform-appropriate key symbols
 */
export function formatShortcut(shortcut: Shortcut): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

  const modifierSymbols: Record<ModifierKey, string> = {
    meta: isMac ? '⌘' : 'Ctrl',
    ctrl: isMac ? '⌃' : 'Ctrl',
    shift: '⇧',
    alt: isMac ? '⌥' : 'Alt',
  };

  const parts: string[] = [];

  // Add modifiers in consistent order
  if (shortcut.modifiers?.includes('ctrl')) parts.push(modifierSymbols.ctrl);
  if (shortcut.modifiers?.includes('alt')) parts.push(modifierSymbols.alt);
  if (shortcut.modifiers?.includes('shift')) parts.push(modifierSymbols.shift);
  if (shortcut.modifiers?.includes('meta')) parts.push(modifierSymbols.meta);

  // Format special keys
  const keyMap: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Enter: '↵',
    Escape: 'Esc',
    Backspace: '⌫',
    Delete: '⌦',
    Tab: '⇥',
    ' ': 'Space',
  };

  const displayKey = keyMap[shortcut.key] || shortcut.key.toUpperCase();
  parts.push(displayKey);

  return parts.join('');
}

/**
 * Get keys array for ShortcutHint component
 */
export function getShortcutKeys(shortcut: Shortcut): string[] {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');

  const modifierSymbols: Record<ModifierKey, string> = {
    meta: isMac ? '⌘' : 'Ctrl',
    ctrl: isMac ? '⌃' : 'Ctrl',
    shift: '⇧',
    alt: isMac ? '⌥' : 'Alt',
  };

  const keys: string[] = [];

  // Add modifiers in consistent order
  if (shortcut.modifiers?.includes('ctrl')) keys.push(modifierSymbols.ctrl);
  if (shortcut.modifiers?.includes('alt')) keys.push(modifierSymbols.alt);
  if (shortcut.modifiers?.includes('shift')) keys.push(modifierSymbols.shift);
  if (shortcut.modifiers?.includes('meta')) keys.push(modifierSymbols.meta);

  // Format special keys
  const keyMap: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Enter: '↵',
    Escape: 'Esc',
    Backspace: '⌫',
    Delete: '⌦',
    Tab: '⇥',
    ' ': 'Space',
  };

  const displayKey = keyMap[shortcut.key] || shortcut.key.toUpperCase();
  keys.push(displayKey);

  return keys;
}
