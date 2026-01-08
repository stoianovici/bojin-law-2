'use client';

import * as React from 'react';
import { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/uiStore';
import { TeamActivityFeed, type Activity } from '@/components/tasks/TeamActivityFeed';
import { TeamChat } from '@/components/chat/TeamChat';

// Mock activities for now - in a real app this would come from API/store
const mockActivities: Activity[] = [
  {
    id: '1',
    type: 'task_created',
    author: { id: '1', firstName: 'Alexandru', lastName: 'Bojin' },
    timestamp: 'Acum 5 min',
    task: { id: 't1', title: 'Pregatire documente pentru termen' },
  },
  {
    id: '2',
    type: 'status_changed',
    author: { id: '2', firstName: 'Maria', lastName: 'Pop' },
    timestamp: 'Acum 30 min',
    task: { id: 't2', title: 'Revizie contract' },
    change: { from: 'In Progress', to: 'Done' },
  },
  {
    id: '3',
    type: 'comment_added',
    author: { id: '3', firstName: 'Elena', lastName: 'Dinu' },
    timestamp: 'Acum 1 ora',
    task: { id: 't3', title: 'Analiza jurisprudenta' },
    comment: 'Am gasit precedent relevant pentru cazul nostru.',
  },
  {
    id: '4',
    type: 'subtask_completed',
    author: { id: '1', firstName: 'Alexandru', lastName: 'Bojin' },
    timestamp: 'Acum 2 ore',
    task: { id: 't4', title: 'Depunere intampinare' },
  },
];

interface CollapsibleSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

function CollapsibleSection({
  title,
  isExpanded,
  onToggle,
  children,
  className,
}: CollapsibleSectionProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {/* Section header */}
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center justify-between px-4 py-2.5',
          'text-[13px] font-medium text-linear-text-secondary',
          'hover:bg-linear-bg-hover transition-colors',
          'border-b border-linear-border-subtle'
        )}
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-linear-text-tertiary transition-transform duration-200 ease-spring',
            isExpanded ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>

      {/* Section content */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-spring',
          isExpanded ? 'flex-1 opacity-100' : 'h-0 opacity-0'
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ContextPanel() {
  const setContextPanelVisible = useUIStore((state) => state.setContextPanelVisible);
  const [activityExpanded, setActivityExpanded] = useState(true);
  const [chatExpanded, setChatExpanded] = useState(true);

  const handleClose = () => {
    setContextPanelVisible(false);
  };

  const handleTaskClick = (taskId: string) => {
    // TODO: Navigate to task or open task drawer
    console.log('Task clicked:', taskId);
  };

  return (
    <div className="flex flex-col h-full bg-linear-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-linear-border-subtle animate-fadeIn">
        <h2 className="text-sm font-normal text-linear-text-primary">Activitate</h2>
        <button
          onClick={handleClose}
          className="p-1.5 rounded-md text-linear-text-tertiary hover:text-linear-text-secondary hover:bg-linear-bg-hover transition-all duration-150"
          aria-label="Inchide panoul"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content - Stacked sections */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Activity Feed Section */}
        <CollapsibleSection
          title="Activitate Echipa"
          isExpanded={activityExpanded}
          onToggle={() => setActivityExpanded(!activityExpanded)}
          className={cn(
            'animate-slideInRight [animation-delay:50ms]',
            activityExpanded && chatExpanded ? 'flex-1' : '',
            activityExpanded && !chatExpanded ? 'flex-1' : ''
          )}
        >
          <div className="h-full overflow-y-auto p-4">
            <TeamActivityFeed activities={mockActivities} onTaskClick={handleTaskClick} />
          </div>
        </CollapsibleSection>

        {/* Chat Section */}
        <CollapsibleSection
          title="Chat Echipa"
          isExpanded={chatExpanded}
          onToggle={() => setChatExpanded(!chatExpanded)}
          className={cn(
            'animate-slideInRight [animation-delay:100ms]',
            chatExpanded && activityExpanded ? 'flex-1' : '',
            chatExpanded && !activityExpanded ? 'flex-1' : ''
          )}
        >
          <TeamChat className="h-full" />
        </CollapsibleSection>
      </div>
    </div>
  );
}

export default ContextPanel;
