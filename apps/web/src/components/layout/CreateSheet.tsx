'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Briefcase, CheckSquare, Calendar, FileText } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

const allActions = [
  {
    id: 'case',
    label: 'Dosar Nou',
    icon: Briefcase,
    color: 'bg-blue-500/10 text-blue-500',
    activeColor: 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30',
    href: '/m/cases/new',
    contexts: ['/m/cases', '/m'],
  },
  {
    id: 'task',
    label: 'Task Nou',
    icon: CheckSquare,
    color: 'bg-green-500/10 text-green-500',
    activeColor: 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30',
    href: '/m/tasks/new',
    contexts: ['/m'],
  },
  {
    id: 'event',
    label: 'Eveniment',
    icon: Calendar,
    color: 'bg-purple-500/10 text-purple-500',
    activeColor: 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30',
    href: '/m/calendar/new',
    contexts: ['/m/calendar'],
  },
  {
    id: 'note',
    label: 'Notă',
    icon: FileText,
    color: 'bg-orange-500/10 text-orange-500',
    activeColor: 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30',
    href: '/m/notes/new',
    contexts: ['/m/cases/'],
  },
];

// Get context-aware actions with the most relevant one first
function getContextActions(pathname: string) {
  // Find the best matching action for current context
  const contextAction = allActions.find((action) =>
    action.contexts.some((ctx) =>
      ctx.endsWith('/')
        ? pathname.startsWith(ctx)
        : pathname === ctx || pathname.startsWith(ctx + '/')
    )
  );

  if (!contextAction) return { actions: allActions, activeId: null };

  // Put the context action first, then the rest
  const otherActions = allActions.filter((a) => a.id !== contextAction.id);
  return {
    actions: [contextAction, ...otherActions],
    activeId: contextAction.id,
  };
}

export function CreateSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const { showCreateSheet, setShowCreateSheet, createSheetDefaultType } = useUIStore();

  const { actions, activeId: contextActiveId } = getContextActions(pathname);

  // Use pre-selected type if provided, otherwise fall back to context-based selection
  const activeId = createSheetDefaultType ?? contextActiveId;

  const handleAction = (href: string) => {
    setShowCreateSheet(false);
    router.push(href);
  };

  return (
    <BottomSheet open={showCreateSheet} onClose={() => setShowCreateSheet(false)} title="CREAZA">
      <div className="space-y-2 pb-4">
        {actions.map(({ id, label, icon: Icon, color, activeColor, href }) => {
          const isActive = id === activeId;
          return (
            <button
              key={id}
              onClick={() => handleAction(href)}
              className={cn(
                'flex items-center gap-4 w-full p-3 rounded-xl',
                'transition-colors duration-150',
                'hover:bg-mobile-bg-hover active:bg-mobile-bg-hover',
                isActive && 'bg-mobile-bg-elevated'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-11 h-11 rounded-xl',
                  isActive ? activeColor : color
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <span className="text-[15px] font-normal text-mobile-text-primary">{label}</span>
                {isActive && (
                  <p className="text-[12px] text-mobile-text-secondary">
                    Sugerat pentru pagina curentă
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
