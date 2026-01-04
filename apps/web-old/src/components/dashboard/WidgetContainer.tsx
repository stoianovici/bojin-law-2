/**
 * WidgetContainer Component
 * Base wrapper for all dashboard widgets with header, actions, and loading states
 * Migrated to Linear design system (OPS-333)
 */

'use client';

import React, {
  type ReactNode,
  useState,
  useRef,
  useEffect,
  createContext,
  useContext,
} from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Context for widget expansion control
 * Allows child components to trigger expansion/collapse
 */
interface WidgetExpansionContextType {
  isExpanded: boolean;
  toggleExpansion: () => void;
  isAnimating: boolean;
}

const WidgetExpansionContext = createContext<WidgetExpansionContextType | null>(null);

/**
 * Hook to access widget expansion controls from child components
 * Usage: const { isExpanded, toggleExpansion } = useWidgetExpansion();
 */
export function useWidgetExpansion() {
  const context = useContext(WidgetExpansionContext);
  if (!context) {
    throw new Error(
      'useWidgetExpansion must be used within a WidgetContainer with enableExpansion=true'
    );
  }
  return context;
}

export interface WidgetContainerProps {
  id: string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Enable smooth expansion/collapse for widget content */
  enableExpansion?: boolean;
  /** Current expansion state (for controlled expansion) */
  isExpanded?: boolean;
  /** Callback when expansion state changes (for controlled expansion) */
  onExpansionChange?: (expanded: boolean) => void;
}

/**
 * Loading Skeleton Component for widgets
 */
function WidgetSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

/**
 * Widget Action Menu (three-dot dropdown)
 */
function WidgetActionMenu({
  onRefresh,
  onConfigure,
  onRemove,
}: {
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-linear-bg-hover transition-colors focus:outline-none focus:ring-2 focus:ring-linear-accent"
          aria-label="Widget actions"
        >
          <svg
            className="w-5 h-5 text-linear-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[180px] bg-linear-bg-elevated rounded-lg shadow-lg border border-linear-border-subtle py-1 z-50"
          sideOffset={5}
        >
          {onRefresh && (
            <DropdownMenu.Item
              className="flex items-center px-3 py-2 text-sm text-linear-text-secondary hover:bg-linear-bg-hover cursor-pointer outline-none transition-colors"
              onSelect={onRefresh}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Reîmprospătează
            </DropdownMenu.Item>
          )}

          {onConfigure && (
            <DropdownMenu.Item
              className="flex items-center px-3 py-2 text-sm text-linear-text-secondary hover:bg-linear-bg-hover cursor-pointer outline-none transition-colors"
              onSelect={onConfigure}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Configurează
            </DropdownMenu.Item>
          )}

          {onRemove && (
            <>
              <DropdownMenu.Separator className="h-px bg-linear-border-subtle my-1" />
              <DropdownMenu.Item
                className="flex items-center px-3 py-2 text-sm text-linear-error hover:bg-linear-error/10 cursor-pointer outline-none transition-colors"
                onSelect={onRemove}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Elimină
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * WidgetContainer - Base wrapper for all dashboard widgets
 *
 * @param id - Unique widget identifier (used for drag-and-drop)
 * @param title - Widget title displayed in header
 * @param icon - Optional icon displayed next to title
 * @param children - Widget content
 * @param isLoading - Show loading skeleton state
 * @param onRefresh - Refresh action handler
 * @param onConfigure - Configure action handler
 * @param onRemove - Remove action handler
 * @param className - Additional CSS classes
 * @param collapsed - Whether widget is collapsed
 * @param onToggleCollapse - Toggle collapse handler
 * @param enableExpansion - Enable smooth expansion/collapse for widget content
 * @param isExpanded - Current expansion state (for controlled expansion)
 * @param onExpansionChange - Callback when expansion state changes
 */
export function WidgetContainer({
  id,
  title,
  icon,
  children,
  isLoading = false,
  onRefresh,
  onConfigure,
  onRemove,
  className,
  collapsed = false,
  onToggleCollapse,
  enableExpansion = false,
  isExpanded: controlledExpanded,
  onExpansionChange,
}: WidgetContainerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Use controlled expansion if provided, otherwise use internal state
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  // Handle expansion toggle with animation
  const handleExpansionToggle = () => {
    if (isAnimating) return; // Prevent rapid clicks during animation

    setIsAnimating(true);
    const newExpanded = !isExpanded;

    if (onExpansionChange) {
      onExpansionChange(newExpanded);
    } else {
      setInternalExpanded(newExpanded);
    }

    // Reset animating state after animation completes (300ms)
    setTimeout(() => setIsAnimating(false), 300);
  };

  // Apply smooth transition class during expansion
  useEffect(() => {
    if (enableExpansion && contentRef.current) {
      if (isAnimating) {
        contentRef.current.classList.add('expanding');
      } else {
        contentRef.current.classList.remove('expanding');
      }
    }
  }, [isAnimating, enableExpansion]);

  const handleClick = () => {
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 150);
  };

  const widgetHeader = (
    <div className="flex items-center justify-between widget-drag-handle">
      <div className="flex items-center gap-2">
        {icon && <div className="text-linear-text-secondary">{icon}</div>}
        <h3 className="text-base font-semibold text-linear-text-primary">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {onToggleCollapse && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-linear-bg-hover transition-colors focus:outline-none focus:ring-2 focus:ring-linear-accent"
            aria-label={collapsed ? 'Extinde' : 'Restrânge'}
          >
            <svg
              className={cn(
                'w-4 h-4 text-linear-text-secondary transition-transform',
                collapsed && 'rotate-180'
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
              />
            </svg>
          </button>
        )}
        {(onRefresh || onConfigure || onRemove) && (
          <WidgetActionMenu onRefresh={onRefresh} onConfigure={onConfigure} onRemove={onRemove} />
        )}
      </div>
    </div>
  );

  const content = (
    <div
      ref={contentRef}
      className={cn(enableExpansion && 'transition-all duration-300 ease-in-out')}
    >
      {isLoading ? <WidgetSkeleton /> : children}
    </div>
  );

  const wrappedContent = enableExpansion ? (
    <WidgetExpansionContext.Provider
      value={{ isExpanded, toggleExpansion: handleExpansionToggle, isAnimating }}
    >
      {content}
    </WidgetExpansionContext.Provider>
  ) : (
    content
  );

  return (
    <div
      key={id}
      data-widget-id={id}
      className={cn('widget-container', className)}
      data-expanded={enableExpansion ? isExpanded : undefined}
    >
      {/* Linear-styled widget card */}
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-linear-border-subtle bg-linear-bg-secondary',
          'transition-all duration-200',
          'hover:border-linear-border hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)]',
          isClicked && 'scale-[0.98]'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
        {/* Widget header */}
        <div className="border-b border-linear-border-subtle bg-linear-bg-tertiary px-5 py-3">
          {widgetHeader}
        </div>

        {/* Widget body */}
        <div className={cn('px-5 py-4', collapsed && 'hidden')}>{wrappedContent}</div>
      </div>
    </div>
  );
}

WidgetContainer.displayName = 'WidgetContainer';
