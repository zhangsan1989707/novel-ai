'use client'

import version from '@/lib/version.json'

export function VersionInfo() {
  const shortHash = version.commitHash.substring(0, 7)
  
  return (
    <div className="fixed bottom-2 right-2 text-xs text-gray-500 bg-white/80 backdrop-blur-sm px-2 py-1 rounded border border-gray-200 z-50">
      <div className="font-mono">
        v{version.commitHash} @ {version.branch}
      </div>
      <div className="text-[10px]">
        Build: {new Date(version.buildDate).toLocaleString('zh-CN')}
      </div>
    </div>
  )
}
