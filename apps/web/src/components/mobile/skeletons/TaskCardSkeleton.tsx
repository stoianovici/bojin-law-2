'use client';

export function TaskCardSkeleton() {
  return (
    <div className="bg-mobile-bg-card rounded-xl p-4">
      <div className="animate-pulse flex items-start gap-3">
        {/* Icon placeholder */}
        <div className="h-10 w-10 bg-mobile-border rounded-lg flex-shrink-0"></div>

        {/* Content */}
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-mobile-border rounded w-4/5"></div>
          <div className="h-3 bg-mobile-border rounded w-2/3"></div>
          <div className="flex items-center gap-2 pt-1">
            <div className="h-5 bg-mobile-border rounded-full w-14"></div>
            <div className="h-3 bg-mobile-border rounded w-20"></div>
          </div>
        </div>

        {/* Checkbox placeholder */}
        <div className="h-5 w-5 bg-mobile-border rounded flex-shrink-0"></div>
      </div>
    </div>
  );
}
