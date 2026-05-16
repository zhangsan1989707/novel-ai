import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Check, Circle, Settings } from 'lucide-react'
import { useState } from 'react'

interface CollapsibleSectionProps {
  title: string
  description?: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
  showStatus?: boolean
  isComplete?: boolean
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
  className,
  showStatus = true,
  isComplete = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {showStatus && (
            <div className={cn(
              'flex items-center justify-center w-5 h-5 rounded-full',
              isComplete ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'
            )}>
              {isComplete ? (
                <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
              ) : (
                <Circle className="w-2 h-2 text-gray-400" />
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{title}</span>
            {description && (
              <span className="text-sm text-muted-foreground">{description}</span>
            )}
          </div>
          {isComplete && !isOpen && (
            <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
              已完善
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      <div className={cn('px-4 pb-4', !isOpen && 'hidden')}>
        {children}
      </div>
    </div>
  )
}

// 步骤指示器（用于表单流程）
interface StepIndicatorProps {
  steps: {
    title: string
    description?: string
    isActive?: boolean
    isComplete?: boolean
  }[]
  currentStep?: number
  className?: string
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {steps.map((step, index) => (
        <div key={index} className="flex items-center">
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-colors',
              step.isComplete
                ? 'bg-green-500 text-white'
                : step.isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
            )}>
              {step.isComplete ? (
                <Check className="w-3 h-3" />
              ) : (
                index + 1
              )}
            </div>
            <span className={cn(
              'text-sm',
              step.isActive || step.isComplete
                ? 'text-foreground font-medium'
                : 'text-muted-foreground'
            )}>
              {step.title}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={cn(
              'w-8 h-0.5 mx-2',
              step.isComplete ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
            )} />
          )}
        </div>
      ))}
    </div>
  )
}

// 进度指示器（用于显示完成度）
interface ProgressIndicatorProps {
  label: string
  total: number
  completed: number
  className?: string
}

export function ProgressIndicator({ label, total, completed, className }: ProgressIndicatorProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{completed}/{total}</span>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            percentage === 100 ? 'bg-green-500' : 'bg-primary'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
