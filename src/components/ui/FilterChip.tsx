import { cn } from '@/lib/utils'

interface FilterChipProps {
  label: string
  active?: boolean
  onClick?: () => void
}

export function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
        active
          ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400'
          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
      )}
    >
      {label}
    </button>
  )
}

interface FilterChipGroupProps {
  children: React.ReactNode
  className?: string
}

export function FilterChipGroup({ children, className }: FilterChipGroupProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {children}
    </div>
  )
}
