'use client';

export function SearchResultSkeleton() {
  return (
    <div className="bg-mobile-bg-card rounded-xl p-3">
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-mobile-border rounded w-4/5"></div>
        <div className="h-3 bg-mobile-border rounded w-3/5"></div>
      </div>
    </div>
  );
}
