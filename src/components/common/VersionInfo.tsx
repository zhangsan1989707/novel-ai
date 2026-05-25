'use client'

import version from '@/lib/version.json'
import { formatDisplayDateTime } from '@/lib/helpers'

export function VersionInfo() {
  return (
    <div className="fixed bottom-2 left-2 z-40 pointer-events-none max-w-[220px] rounded-md border border-gray-200 bg-white/70 px-2 py-1 text-[10px] text-gray-500 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/70">
      <div className="font-mono leading-tight">
        v{version.commitHash} @ {version.branch}
      </div>
      <div className="leading-tight">
        Build: {formatDisplayDateTime(version.buildDate)}
      </div>
    </div>
  )
}
