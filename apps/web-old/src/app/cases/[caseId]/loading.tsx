/**
 * Loading state for Case Detail Page
 * Story 2.8: Case CRUD Operations UI - Task 15
 * Provides loading skeleton during page transitions
 */

export default function CaseDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 animate-pulse">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumb skeleton */}
        <div className="mb-4 flex items-center gap-2">
          <div className="h-4 bg-gray-200 rounded w-12" />
          <div className="h-4 bg-gray-200 rounded w-1" />
          <div className="h-4 bg-gray-200 rounded w-16" />
          <div className="h-4 bg-gray-200 rounded w-1" />
          <div className="h-4 bg-gray-200 rounded w-24" />
        </div>

        {/* Back button skeleton */}
        <div className="h-4 bg-gray-200 rounded w-24 mb-6" />

        {/* Header skeleton */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 bg-gray-200 rounded w-64" />
              <div className="h-6 bg-gray-200 rounded-full w-20" />
            </div>
            <div className="h-6 bg-gray-200 rounded w-32" />
          </div>
          <div className="h-10 bg-gray-200 rounded w-32" />
        </div>

        {/* Main content skeleton */}
        <div className="bg-white rounded-lg shadow">
          {/* Case information section */}
          <div className="p-6 border-b border-gray-200 space-y-4">
            <div className="h-6 bg-gray-200 rounded w-40 mb-4" />
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="py-3 border-b border-gray-200">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                <div className="h-5 bg-gray-200 rounded w-full" />
              </div>
            ))}
          </div>

          {/* Accordion sections skeleton */}
          <div className="border-b border-gray-200 p-6">
            <div className="h-6 bg-gray-200 rounded w-48" />
          </div>
          <div className="p-6">
            <div className="h-6 bg-gray-200 rounded w-48" />
          </div>
        </div>

        {/* Timestamps skeleton */}
        <div className="mt-6 text-center">
          <div className="h-4 bg-gray-200 rounded w-96 mx-auto" />
        </div>
      </div>
    </div>
  );
}
