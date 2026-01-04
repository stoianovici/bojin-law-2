'use client';

export function CalendarDaySkeleton() {
  return (
    <div className="bg-mobile-bg-card rounded-xl p-4">
      <div className="animate-pulse flex gap-4">
        {/* Date column */}
        <div className="flex flex-col items-center flex-shrink-0 w-12">
          <div className="h-3 bg-mobile-border rounded w-8 mb-1"></div>
          <div className="h-8 bg-mobile-border rounded w-8"></div>
        </div>

        {/* Events content */}
        <div className="flex-1 space-y-3">
          {/* Event item 1 */}
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 bg-mobile-border rounded-full flex-shrink-0"></div>
            <div className="flex-1 space-y-1">
              <div className="h-4 bg-mobile-border rounded w-3/4"></div>
              <div className="h-3 bg-mobile-border rounded w-1/2"></div>
            </div>
          </div>

          {/* Event item 2 */}
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 bg-mobile-border rounded-full flex-shrink-0"></div>
            <div className="flex-1 space-y-1">
              <div className="h-4 bg-mobile-border rounded w-2/3"></div>
              <div className="h-3 bg-mobile-border rounded w-2/5"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
