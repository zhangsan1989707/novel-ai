'use client'

import { Wrench, X } from 'lucide-react'

interface ToolItem {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  onClick: () => void
}

interface ToolboxProps {
  open: boolean
  onClose: () => void
  tools: ToolItem[]
}

export function Toolbox({ open, onClose, tools }: ToolboxProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">工具箱</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => { tool.onClick(); onClose() }}
              className="flex flex-col items-start gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-blue-600">{tool.icon}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{tool.label}</span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{tool.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}