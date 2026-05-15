'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import type { CharacterProfile } from '@/lib/engine/types'

type CharacterNodeData = CharacterProfile

const roleColors = {
  PROTAGONIST: {
    border: 'border-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
  },
  ANTAGONIST: {
    border: 'border-red-500',
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
  },
  SUPPORTING: {
    border: 'border-green-500',
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
  },
  MINOR: {
    border: 'border-gray-400',
    bg: 'bg-gray-50 dark:bg-gray-800/20',
    text: 'text-gray-600 dark:text-gray-400',
  },
}

function CharacterNodeComponent({ data }: { data: CharacterNodeData }) {
  const colors = roleColors[data.role] || roleColors.MINOR

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 min-w-[160px] transition-shadow hover:shadow-lg',
        colors.border,
        colors.bg
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />

      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-2 h-2 rounded-full', colors.border.replace('border-', 'bg-'))} />
        <span className="text-xs uppercase tracking-wide opacity-60">
          {data.role.toLowerCase()}
        </span>
      </div>

      <div className="font-semibold text-foreground mb-1">{data.name}</div>

      {data.firstChapter && (
        <div className="text-xs text-muted-foreground mb-1">
          出场: 第{data.firstChapter}章
        </div>
      )}

      {data.personality && (
        <div className={cn('text-xs mt-2 line-clamp-2', colors.text)}>
          {data.personality}
        </div>
      )}

      {data.catchphrases && data.catchphrases.length > 0 && (
        <div className="text-xs italic text-muted-foreground mt-2 border-t pt-2">
          &ldquo;{data.catchphrases[0]}&rdquo;
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  )
}

export const CharacterNode = memo(CharacterNodeComponent)