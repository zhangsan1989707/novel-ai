'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

// Toast container component
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id)
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    warning: AlertCircle,
  }

  const styles = {
    success: 'bg-success/10 border-success/20 text-success',
    error: 'bg-danger/10 border-danger/20 text-danger',
    info: 'bg-primary/10 border-primary/20 text-primary',
    warning: 'bg-warning/10 border-warning/20 text-warning',
  }

  const Icon = icons[toast.type]

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border shadow-md animate-slide-in-from-right',
        styles[toast.type]
      )}
      role="alert"
    >
      <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <p className="text-sm flex-1">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 hover:opacity-70 transition-opacity"
        aria-label="关闭"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// Global toast state management
let toastListeners: ((toasts: Toast[]) => void)[] = []
let toasts: Toast[] = []

function notifyListeners() {
  toastListeners.forEach((listener) => listener([...toasts]))
}

// Toast API
export const toast = {
  success: (message: string) => {
    const id = Math.random().toString(36).slice(2)
    toasts.push({ id, message, type: 'success' })
    notifyListeners()
  },
  error: (message: string) => {
    const id = Math.random().toString(36).slice(2)
    toasts.push({ id, message, type: 'error' })
    notifyListeners()
  },
  info: (message: string) => {
    const id = Math.random().toString(36).slice(2)
    toasts.push({ id, message, type: 'info' })
    notifyListeners()
  },
  warning: (message: string) => {
    const id = Math.random().toString(36).slice(2)
    toasts.push({ id, message, type: 'warning' })
    notifyListeners()
  },
}

// Hook for using toast
export function useToast() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([])

  useEffect(() => {
    const listener = (newToasts: Toast[]) => setCurrentToasts(newToasts)
    toastListeners.push(listener)
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener)
    }
  }, [])

  const handleRemove = useCallback((id: string) => {
    toasts = toasts.filter((t) => t.id !== id)
    notifyListeners()
  }, [])

  return {
    toasts: currentToasts,
    toast,
    dismiss: handleRemove,
  }
}

// Toast Container Component - place this in your root layout
export function ToastContainer() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-toast flex flex-col gap-2 max-w-sm" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={dismiss} />
      ))}
    </div>
  )
}