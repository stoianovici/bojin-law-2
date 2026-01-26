'use client';

import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

interface SafeAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  as?: 'div' | 'main' | 'section' | 'article';
}

// ============================================
// Component
// ============================================

export function SafeArea({
  top = true,
  bottom = true,
  left = true,
  right = true,
  as: Component = 'div',
  className,
  children,
  style,
  ...props
}: SafeAreaProps) {
  return (
    <Component
      className={clsx('min-h-screen', className)}
      style={{
        paddingTop: top ? 'env(safe-area-inset-top)' : undefined,
        paddingBottom: bottom ? 'env(safe-area-inset-bottom)' : undefined,
        paddingLeft: left ? 'env(safe-area-inset-left)' : undefined,
        paddingRight: right ? 'env(safe-area-inset-right)' : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  );
}

// ============================================
// SafeAreaView - For scrollable content
// ============================================

interface SafeAreaViewProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Padding edges to apply safe area insets */
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function SafeAreaView({
  edges = ['top', 'bottom', 'left', 'right'],
  className,
  children,
  style,
  ...props
}: SafeAreaViewProps) {
  const hasEdge = (edge: string) => edges.includes(edge as any);

  return (
    <div
      className={clsx('flex flex-col min-h-screen', className)}
      style={{
        paddingTop: hasEdge('top') ? 'env(safe-area-inset-top)' : undefined,
        paddingBottom: hasEdge('bottom') ? 'env(safe-area-inset-bottom)' : undefined,
        paddingLeft: hasEdge('left') ? 'env(safe-area-inset-left)' : undefined,
        paddingRight: hasEdge('right') ? 'env(safe-area-inset-right)' : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================
// SafeAreaSpacer - Invisible spacer
// ============================================

interface SafeAreaSpacerProps {
  position: 'top' | 'bottom';
  className?: string;
}

export function SafeAreaSpacer({ position, className }: SafeAreaSpacerProps) {
  return (
    <div
      className={className}
      style={{
        height: position === 'top' ? 'env(safe-area-inset-top)' : 'env(safe-area-inset-bottom)',
      }}
      aria-hidden="true"
    />
  );
}
