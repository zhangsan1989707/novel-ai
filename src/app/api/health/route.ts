import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDefaultAIConfig } from '@/lib/ai/factory'

export async function GET() {
  const startedAt = Date.now()
  const checks: Record<string, { ok: boolean }> = {}

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { ok: true }
  } catch {
    checks.database = { ok: false }
  }

  try {
    const defaultConfig = getDefaultAIConfig()
    checks.aiConfig = { ok: Boolean(defaultConfig.apiKey?.trim()) }
  } catch {
    checks.aiConfig = { ok: false }
  }

  const ok = Object.values(checks).every(check => check.ok)

  return NextResponse.json(
    {
      ok,
      service: 'novel-ai',
      checks,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  )
}
