'use client'

import { Sparkles, BookOpen, PenTool, MessageSquare, Compass, Target } from 'lucide-react'
import { formatDisplayDateTime } from '@/lib/helpers'

interface StylePreviewProps {
  styleFeatures?: string | null
  vocabularyFeatures?: string | null
  sentenceFeatures?: string | null
  rhetoricFeatures?: string | null
  themeFeatures?: string | null
  trainedAt?: string | null
}

interface FeatureItemProps {
  icon: typeof Sparkles
  label: string
  value?: string | null
  color: string
}

function FeatureItem({ icon: Icon, label, value, color }: FeatureItemProps) {
  if (!value) return null

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        <Icon className="h-4 w-4" />
        <span className="font-medium text-sm">{label}</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">{value}</p>
    </div>
  )
}

export function StylePreview({
  styleFeatures,
  vocabularyFeatures,
  sentenceFeatures,
  rhetoricFeatures,
  themeFeatures,
  trainedAt,
}: StylePreviewProps) {
  const hasFeatures = styleFeatures || vocabularyFeatures || sentenceFeatures || rhetoricFeatures || themeFeatures

  if (!hasFeatures) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Sparkles className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p>暂无风格特征，请先训练</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {trainedAt && (
        <div className="text-xs text-gray-500 text-right">
          训练时间: {formatDisplayDateTime(trainedAt)}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FeatureItem
          icon={BookOpen}
          label="整体风格"
          value={styleFeatures}
          color="text-blue-600"
        />
        <FeatureItem
          icon={PenTool}
          label="词汇特征"
          value={vocabularyFeatures}
          color="text-green-600"
        />
        <FeatureItem
          icon={MessageSquare}
          label="句式特征"
          value={sentenceFeatures}
          color="text-purple-600"
        />
        <FeatureItem
          icon={Compass}
          label="修辞特征"
          value={rhetoricFeatures}
          color="text-orange-600"
        />
      </div>

      <FeatureItem
        icon={Target}
        label="主题特征"
        value={themeFeatures}
        color="text-red-600"
      />
    </div>
  )
}
