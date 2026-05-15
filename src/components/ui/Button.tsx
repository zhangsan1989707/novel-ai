import * as React from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg disabled:pointer-events-none disabled:opacity-50'

    const variantClasses: Record<string, string> = {
      default: 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 hover:shadow-sm active:bg-gray-100 active:scale-[0.97] transition-all duration-200 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 dark:active:bg-gray-600',
      primary: 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/30 active:bg-blue-800 active:scale-[0.97] transition-all duration-200',
      secondary: 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md hover:shadow-purple-500/30 active:bg-purple-800 active:scale-[0.97] transition-all duration-200',
      outline: 'border-2 border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 active:scale-[0.97] transition-all duration-200 dark:border-gray-500 dark:text-gray-200 dark:hover:border-blue-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 dark:active:bg-blue-900/30',
      ghost: 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 active:bg-gray-300 active:scale-[0.97] transition-all duration-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:active:bg-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 hover:shadow-md hover:shadow-red-500/30 active:bg-red-800 active:scale-[0.97] transition-all duration-200',
    }

    const sizeClasses: Record<string, string> = {
      sm: 'h-8 px-3 text-sm gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2',
    }

    const classes = clsx(baseStyles, variantClasses[variant], sizeClasses[size], className)

    return (
      <button
        className={classes}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button }