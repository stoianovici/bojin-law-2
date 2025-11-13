/**
 * WidgetContainer Component
 * Base wrapper for all dashboard widgets with header, actions, and loading states
 */

'use client';

import React, { type ReactNode, useState } from 'react';
import { Card } from '@legal-platform/ui';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { clsx } from 'clsx';

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
}

/**
 * Loading Skeleton Component for widgets
 */
function WidgetSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-full"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
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
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Widget actions"
        >
          <svg
            className="w-5 h-5 text-gray-600"
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
          className="min-w-[180px] bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
          sideOffset={5}
        >
          {onRefresh && (
            <DropdownMenu.Item
              className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer outline-none transition-colors"
              onSelect={onRefresh}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
              className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer outline-none transition-colors"
              onSelect={onConfigure}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
              <DropdownMenu.Separator className="h-px bg-gray-200 my-1" />
              <DropdownMenu.Item
                className="flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer outline-none transition-colors"
                onSelect={onRemove}
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
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
}: WidgetContainerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 150);
  };

  const widgetHeader = (
    <div className="flex items-center justify-between widget-drag-handle">
      <div className="flex items-center gap-2">
        {icon && <div className="text-gray-600">{icon}</div>}
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {onToggleCollapse && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={collapsed ? 'Extinde' : 'Restrânge'}
          >
            <svg
              className={clsx(
                'w-4 h-4 text-gray-600 transition-transform',
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
          <WidgetActionMenu
            onRefresh={onRefresh}
            onConfigure={onConfigure}
            onRemove={onRemove}
          />
        )}
      </div>
    </div>
  );

  return (
    <div key={id} data-widget-id={id} className={clsx('widget-container h-full', className)}>
      <Card
        variant="elevated"
        header={widgetHeader}
        headerClassName="bg-gray-50"
        bodyClassName={collapsed ? 'hidden' : 'flex-1 overflow-auto'}
        className={clsx(
          'h-full flex flex-col transition-all duration-200',
          isHovered && 'shadow-lg',
          isClicked && 'scale-[0.98]'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
        {isLoading ? <WidgetSkeleton /> : children}
      </Card>
    </div>
  );
}

WidgetContainer.displayName = 'WidgetContainer';
