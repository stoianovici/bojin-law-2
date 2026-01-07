'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const tabsListVariants = cva('inline-flex items-center', {
  variants: {
    variant: {
      underline: 'h-9 gap-1 border-b border-linear-border-subtle',
      pills: 'h-9 gap-1 rounded-lg bg-linear-bg-tertiary p-1',
    },
  },
  defaultVariants: {
    variant: 'underline',
  },
});

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        underline: [
          'relative px-3 py-1.5 text-sm text-linear-text-secondary',
          'hover:text-linear-text-primary',
          'data-[state=active]:text-linear-text-primary',
          'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-linear-accent after:scale-x-0 after:transition-transform',
          'data-[state=active]:after:scale-x-100',
        ],
        pills: [
          'rounded-md px-3 py-1 text-sm text-linear-text-secondary',
          'data-[state=active]:bg-linear-bg-elevated data-[state=active]:text-linear-text-primary data-[state=active]:shadow-sm',
        ],
      },
    },
    defaultVariants: {
      variant: 'underline',
    },
  }
);

export interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(tabsListVariants({ variant, className }))}
      {...props}
    />
  )
);
TabsList.displayName = TabsPrimitive.List.displayName;

interface TabsTriggerContextValue {
  variant?: 'underline' | 'pills';
}

const TabsTriggerContext = React.createContext<TabsTriggerContextValue>({});

const TabsListWithContext = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, children, ...props }, ref) => (
  <TabsTriggerContext.Provider value={{ variant: variant ?? 'underline' }}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(tabsListVariants({ variant, className }))}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  </TabsTriggerContext.Provider>
));
TabsListWithContext.displayName = TabsPrimitive.List.displayName;

export type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, ...props }, ref) => {
  const { variant } = React.useContext(TabsTriggerContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(tabsTriggerVariants({ variant, className }))}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export type TabsProps = React.ComponentPropsWithoutRef<typeof Tabs>;

export {
  Tabs,
  TabsListWithContext as TabsList,
  TabsTrigger,
  TabsContent,
  tabsListVariants,
  tabsTriggerVariants,
};
