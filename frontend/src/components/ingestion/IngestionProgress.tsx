interface IngestionProgressProps {
  current: number
  total: number
  className?: string
}

/**
 * Progress bar component for repository ingestion.
 * 
 * Displays:
 * - Progress bar visualization
 * - "Processing X/Y files" text
 * - Percentage calculation
 * - Loading animation
 * 
 * Requirements: 4.4
 */
export function IngestionProgress({ current, total, className = '' }: IngestionProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0
  
  return (
    <div className={`space-y-5 ${className}`}>
      {/* Progress text */}
      <div className="flex items-center justify-between">
        <span className="text-gray-300 font-medium text-base">
          {current} / {total} files processed
        </span>
        <span className="text-blue-400 font-semibold text-base">
          {percentage}%
        </span>
      </div>
      
      {/* Progress bar - 8px thick with rounded corners */}
      <div className="relative w-full h-1.5 bg-gray-700 rounded-sm overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-accent rounded-sm transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        >
        </div>
      </div>
    </div>
  )
}
