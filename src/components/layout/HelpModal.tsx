'use client'

import { useState } from 'react'
import { X, Book, Sparkles, Settings, HelpCircle, ChevronDown, ExternalLink } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

interface HelpModalProps {
  trigger?: React.ReactNode
}

interface HelpSection {
  id: string
  title: string
  icon: React.ReactNode
  items: {
    q: string
    a: string
  }[]
}

const helpSections: HelpSection[] = [
  {
    id: 'getting-started',
    title: '快速入门',
    icon: <Sparkles className="h-5 w-5" />,
    items: [
      {
        q: '如何创建第一部小说？',
        a: '点击"新建小说"按钮，填写作品标题和基本设定（如题材、风格、目标字数等），系统会为您生成完整的大纲和首章内容。',
      },
      {
        q: '创作模式和拆解模式有什么区别？',
        a: '创作模式：从零开始生成小说内容。拆解模式：上传现有小说文本，AI 会分析其结构、人物、伏笔等元素，供您学习参考。',
      },
      {
        q: '每章目标字数如何设置？',
        a: '在创建小说时可在"章节字数"输入目标值，默认 3000 字/章。您也可以在小说设置中随时修改。',
      },
    ],
  },
  {
    id: 'writing',
    title: '写作技巧',
    icon: <Book className="h-5 w-5" />,
    items: [
      {
        q: '如何生成新章节？',
        a: '在小说详情页，点击"生成章节"按钮，选择续写或大纲生成模式，AI 会根据上下文自动生成下一章内容。',
      },
      {
        q: '生成的章节不满意怎么办？',
        a: '您可以点击"重新生成"获得新版本，或使用"局部重写"功能对特定段落进行修改。也可以切换 AI 模型尝试不同风格。',
      },
      {
        q: '如何保持人物设定一致？',
        a: '系统会自动追踪人物关系、性格特征和剧情发展。您可以在"人物图谱"中查看和编辑角色信息，AI 会参考这些设定。',
      },
      {
        q: '如何管理伏笔和支线？',
        a: '在"伏笔追踪"面板中可以看到所有埋下的伏笔及其状态。系统会提示合适的回收时机，帮助您保持故事完整性。',
      },
    ],
  },
  {
    id: 'ai-config',
    title: 'AI 配置',
    icon: <Settings className="h-5 w-5" />,
    items: [
      {
        q: '如何切换 AI 模型？',
        a: '在"AI 配置"页面可以添加和管理不同的 AI 服务商（如 OpenAI、DeepSeek 等），为不同任务选择合适的模型。',
      },
      {
        q: 'API Key 如何设置？',
        a: '在"AI 配置"页面点击"添加配置"，输入服务商提供的 API Key 和模型 ID。您的密钥会被加密存储。',
      },
      {
        q: '如何控制生成内容的风格？',
        a: '您可以在小说设定中调整"写作风格"（如轻松幽默、热血激昂等），也可以为 AI 添加自定义提示词来微调输出。',
      },
    ],
  },
  {
    id: 'cost',
    title: '成本管理',
    icon: <span className="text-sm font-bold">¥</span>,
    items: [
      {
        q: 'AI 生成小说需要付费吗？',
        a: '系统本身免费，但调用 AI 服务会产生费用。您需要在 AI 配置中提供自己的 API Key，费用由 AI 服务商收取。',
      },
      {
        q: '如何查看已消耗的费用？',
        a: '在"成本管理"页面可以查看月度用量、明细统计和费用预估。您也可以设置额度预警，避免意外超支。',
      },
      {
        q: '如何控制 AI 调用的成本？',
        a: '您可以设置月度额度上限，系统会在接近限额时提醒您。您也可以选择更经济的 AI 模型来降低单次调用成本。',
      },
    ],
  },
]

export function HelpModal({ trigger }: HelpModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<string[]>(['getting-started'])

  const toggleSection = (id: string) => {
    setExpandedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  return (
    <>
      {/* 触发器 */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 hover:bg-muted rounded-lg transition-colors"
        aria-label="帮助"
      >
        <HelpCircle className="h-5 w-5 text-foreground" />
      </button>

      {/* 帮助 Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="帮助中心"
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {helpSections.map(section => (
            <div key={section.id} className="border border-border rounded-lg overflow-hidden">
              {/* 标题行 */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-foreground">
                  {section.icon}
                  <span className="font-medium">{section.title}</span>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${
                    expandedSections.includes(section.id) ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* 内容 */}
              {expandedSections.includes(section.id) && (
                <div className="divide-y divide-border">
                  {section.items.map((item, index) => (
                    <div key={index} className="px-4 py-3">
                      <h4 className="text-sm font-medium text-foreground mb-1">
                        Q: {item.q}
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        A: {item.a}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* 外部链接 */}
          <div className="pt-4 border-t border-border">
            <a
              href="https://github.com/your-repo/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              查看完整文档
            </a>
          </div>
        </div>
      </Modal>
    </>
  )
}
