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
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        active
          ? 'border-primary text-primary bg-primary/10 dark:bg-primary/20'
          : 'border-border text-muted-foreground bg-card hover:border-muted-foreground'
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
