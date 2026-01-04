'use client';

export function CaseCardSkeleton() {
  return (
    <div className="bg-mobile-bg-card rounded-xl p-4 space-y-3">
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-mobile-border rounded w-3/4"></div>
        <div className="h-3 bg-mobile-border rounded w-1/2"></div>
        <div className="flex gap-2">
          <div className="h-6 bg-mobile-border rounded-full w-16"></div>
          <div className="h-6 bg-mobile-border rounded-full w-20"></div>
        </div>
      </div>
    </div>
  );
}
