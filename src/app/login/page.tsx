'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    router.push('/projects')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">SoulKey</h1>
        <p className="text-gray-600 mt-2">正在跳转...</p>
      </div>
    </div>
  )
}
