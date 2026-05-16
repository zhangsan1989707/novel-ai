import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './DropdownMenu'
import { MoreHorizontal, Pencil, Trash2, Download, FileText, Settings, Edit3, Archive } from 'lucide-react'
import { Button } from './Button'

interface MoreActionsMenuProps {
  onEdit?: () => void
  onDelete?: () => void
  onExport?: () => void
  onSettings?: () => void
  children?: React.ReactNode
  className?: string
}

export function MoreActionsMenu({
  onEdit,
  onDelete,
  onExport,
  onSettings,
  children,
  className,
}: MoreActionsMenuProps) {
  const hasActions = onEdit || onDelete || onExport || onSettings

  if (!hasActions) return <>{children}</>

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline" size="sm" className={cn('gap-1.5', className)}>
          {children || (
            <>
              <MoreHorizontal className="h-4 w-4" />
              更多
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit3 className="w-4 h-4 mr-2" />
            编辑项目
          </DropdownMenuItem>
        )}
        {onSettings && (
          <DropdownMenuItem onClick={onSettings}>
            <Settings className="w-4 h-4 mr-2" />
            项目设置
          </DropdownMenuItem>
        )}
        {onExport && (
          <DropdownMenuItem onClick={onExport}>
            <Download className="w-4 h-4 mr-2" />
            导出内容
          </DropdownMenuItem>
        )}
        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1.5 -mx-1.5" />
        {onDelete && (
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            删除项目
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// 快速操作按钮组（用于卡片内）
interface QuickAction {
  icon: React.ReactNode
  label: string
  onClick: () => void
  variant?: 'default' | 'danger'
}

interface QuickActionsProps {
  actions: QuickAction[]
  className?: string
}

export function QuickActions({ actions, className }: QuickActionsProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={action.onClick}
          className={cn(
            'p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors',
            action.variant === 'danger' && 'hover:text-red-600 dark:hover:text-red-400'
          )}
          title={action.label}
        >
          {action.icon}
        </button>
      ))}
    </div>
  )
}
