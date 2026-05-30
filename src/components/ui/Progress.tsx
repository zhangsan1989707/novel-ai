import * as React from 'react'
import { cn, formatLargeNumber } from '@/lib/utils'

interface ProgressProps {
  value: number
  max?: number
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'secondary' | 'success' | 'danger'
}

const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  className,
  showLabel = false,
  size = 'md',
  color = 'primary',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  }

  const colors = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    success: 'bg-success',
    danger: 'bg-danger',
  }

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn('w-full overflow-hidden rounded-full bg-muted', sizes[size])}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', colors[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="mt-1 block text-xs text-muted-foreground">
          {formatLargeNumber(value)} / {formatLargeNumber(max)} ({percentage.toFixed(1)}%)
        </span>
      )}
    </div>
  )
}

export { Progress }