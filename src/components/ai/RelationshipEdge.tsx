'use client'

import { memo } from 'react'
import { getBezierPath } from '@xyflow/react'
import { cn } from '@/lib/utils'

interface RelationshipEdgeData {
  strength?: 'strong' | 'medium' | 'weak'
  type?: string
}

interface RelationshipEdgeProps {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  data?: RelationshipEdgeData
  label?: string
}

const strengthStyles = {
  strong: { strokeWidth: 3, opacity: 1 },
  medium: { strokeWidth: 2, opacity: 0.8 },
  weak: { strokeWidth: 1, opacity: 0.5 },
}

const roleColors = {
  PROTAGONIST: '#3b82f6',
  ANTAGONIST: '#ef4444',
  SUPPORTING: '#22c55e',
  MINOR: '#9ca3af',
}

function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  label,
}: RelationshipEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  })

  const strength = data?.strength || 'medium'
  const style = strengthStyles[strength as keyof typeof strengthStyles]

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path stroke-gray-400"
        d={edgePath}
        strokeWidth={style.strokeWidth}
        strokeOpacity={style.opacity}
        fill="none"
      />
      {label && (
        <div
          className={cn(
            'absolute pointer-events-all bg-white dark:bg-gray-900 px-2 py-1 rounded text-xs shadow-sm',
            'border border-gray-200 dark:border-gray-700',
            strength === 'strong' && 'font-semibold'
          )}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <span className="text-gray-600 dark:text-gray-400">{label}</span>
        </div>
      )}
    </>
  )
}

export const RelationshipEdge = memo(RelationshipEdgeComponent)