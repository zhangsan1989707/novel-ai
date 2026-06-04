import { Info, Clock, AlertCircle, AlertTriangle, type LucideIcon } from 'lucide-react'

export const NOTIFICATION_TYPE_ICONS: Record<string, LucideIcon> = {
  SYSTEM: Info,
  TASK: Clock,
  QUOTA: AlertCircle,
  ERROR: AlertTriangle,
}

export const NOTIFICATION_TYPE_COLORS: Record<string, string> = {
  SYSTEM: 'text-blue-500',
  TASK: 'text-purple-500',
  QUOTA: 'text-yellow-500',
  ERROR: 'text-red-500',
}

export const NOTIFICATION_PRIORITY_COLORS: Record<string, string> = {
  LOW: 'border-l-gray-400',
  NORMAL: 'border-l-blue-500',
  HIGH: 'border-l-red-500',
}

export function formatNotificationTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  if (diffHour < 24) return `${diffHour}小时前`
  if (diffDay < 30) return `${diffDay}天前`
  return date.toLocaleDateString('zh-CN')
}
