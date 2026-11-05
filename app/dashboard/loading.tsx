export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="animate-pulse space-y-6">
        {/* Header Skeleton */}
        <div className="h-8 w-48 bg-gray-700 rounded-lg"></div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 sm:p-6 h-24 sm:h-28"></div>
          ))}
        </div>

        {/* Tabs Skeleton */}
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6 space-y-4">
          <div className="flex gap-4 border-b border-gray-700">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 w-20 bg-gray-700 rounded"></div>
            ))}
          </div>

          {/* Table Skeleton */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 flex-1 bg-gray-700 rounded"></div>
                <div className="h-4 w-24 bg-gray-700 rounded"></div>
                <div className="h-4 w-20 bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
