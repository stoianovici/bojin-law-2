/**
 * Loading state for Cases List Page
 * Story 2.8: Case CRUD Operations UI - Task 15
 * Provides loading skeleton during page transitions
 */

export default function CasesLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 animate-pulse">
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="mb-6 flex items-center justify-between">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-10 bg-gray-200 rounded w-32" />
        </div>

        {/* Filters skeleton */}
        <div className="mb-6 flex gap-4">
          <div className="h-10 bg-gray-200 rounded w-40" />
          <div className="h-10 bg-gray-200 rounded w-40" />
          <div className="h-10 bg-gray-200 rounded w-40" />
        </div>

        {/* Search bar skeleton */}
        <div className="mb-6">
          <div className="h-10 bg-gray-200 rounded w-full max-w-md" />
        </div>

        {/* Table skeleton */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Table header */}
          <div className="border-b border-gray-200 px-6 py-4 flex gap-4">
            <div className="h-5 bg-gray-200 rounded w-24" />
            <div className="h-5 bg-gray-200 rounded w-32" />
            <div className="h-5 bg-gray-200 rounded w-32" />
            <div className="h-5 bg-gray-200 rounded w-20" />
            <div className="h-5 bg-gray-200 rounded w-24" />
          </div>

          {/* Table rows */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border-b border-gray-200 px-6 py-4 flex gap-4 items-center">
              <div className="h-5 bg-gray-200 rounded w-24" />
              <div className="h-5 bg-gray-200 rounded w-48" />
              <div className="h-5 bg-gray-200 rounded w-32" />
              <div className="h-6 bg-gray-200 rounded-full w-20" />
              <div className="h-5 bg-gray-200 rounded w-24" />
              <div className="flex gap-2">
                <div className="h-8 w-8 bg-gray-200 rounded-full" />
                <div className="h-8 w-8 bg-gray-200 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
