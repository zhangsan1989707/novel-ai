import { cn } from '@/lib/utils'
import { Button } from './Button'
import { FileText, Sparkles, BookOpen, Search, FolderOpen, Plus } from 'lucide-react'

type EmptyStateVariant = 'chapters' | 'projects' | 'search' | 'content' | 'custom'

interface EmptyStateAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'outline'
  icon?: React.ReactNode
}

interface EmptyStateProps {
  title: string
  description?: string
  variant?: EmptyStateVariant
  actions?: EmptyStateAction[]
  className?: string
}

const variantConfig: Record<
  EmptyStateVariant,
  { icon: React.ReactNode; gradient: string }
> = {
  chapters: {
    icon: <FileText className="w-12 h-12" />,
    gradient: 'from-blue-500/10 to-purple-500/10',
  },
  projects: {
    icon: <BookOpen className="w-12 h-12" />,
    gradient: 'from-green-500/10 to-teal-500/10',
  },
  search: {
    icon: <Search className="w-12 h-12" />,
    gradient: 'from-orange-500/10 to-red-500/10',
  },
  content: {
    icon: <FolderOpen className="w-12 h-12" />,
    gradient: 'from-gray-500/10 to-gray-600/10',
  },
  custom: {
    icon: <Sparkles className="w-12 h-12" />,
    gradient: 'from-primary/10 to-secondary/10',
  },
}

export function EmptyState({
  title,
  description,
  variant = 'custom',
  actions = [],
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant]

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center',
        className
      )}
    >
      {/* Icon with gradient background */}
      <div
        className={cn(
          'relative mb-6 p-6 rounded-2xl bg-gradient-to-br',
          config.gradient,
          'dark:from-white/5 dark:to-white/10'
        )}
      >
        <div className="text-muted-foreground/50">{config.icon}</div>
        {/* Decorative elements */}
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary/20 animate-pulse" />
        <div className="absolute -bottom-2 -left-2 w-2 h-2 rounded-full bg-secondary/20 animate-pulse delay-100" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'primary'}
              onClick={action.onClick}
              className="gap-2"
            >
              {action.icon || <Plus className="w-4 h-4" />}
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Tips for chapters */}
      {variant === 'chapters' && actions.length > 0 && (
        <div className="mt-8 p-4 bg-muted/50 rounded-lg max-w-md">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">💡 提示：</span>
            先规划章节目录可以让 AI 更好地理解故事结构，生成更连贯的内容。
          </p>
        </div>
      )}
    </div>
  )
}

// Quick empty state presets
export function ChaptersEmptyState({ onCreate, onGenerate }: { onCreate: () => void; onGenerate: () => void }) {
  return (
    <EmptyState
      variant="chapters"
      title="还没有章节"
      description="开始创作你的第一章，或让 AI 帮你规划章节结构"
      actions={[
        { label: '创建第一章', onClick: onCreate, variant: 'primary', icon: <Plus className="w-4 h-4" /> },
        { label: '智能生成目录', onClick: onGenerate, variant: 'outline', icon: <Sparkles className="w-4 h-4" /> },
      ]}
    />
  )
}

export function ProjectsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      variant="projects"
      title="还没有小说"
      description="创建一部新小说，开始你的小说创作之旅"
      actions={[
        { label: '创建新小说', onClick: onCreate, variant: 'primary', icon: <Plus className="w-4 h-4" /> },
      ]}
    />
  )
}

export function SearchEmptyState({ query }: { query: string }) {
  return (
    <EmptyState
      variant="search"
      title={`没有找到"${query}"相关结果`}
      description="尝试使用不同的关键词或筛选条件"
    />
  )
}
