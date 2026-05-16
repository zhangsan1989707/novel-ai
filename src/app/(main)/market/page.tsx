'use client'

import { MarketScanPanel } from '@/components/ai/MarketScanPanel'
import { TrendingUp } from 'lucide-react'

export default function MarketPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">扫榜选材</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">分析市场趋势，获取选题建议</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <MarketScanPanel />
      </main>
    </div>
  )
}
