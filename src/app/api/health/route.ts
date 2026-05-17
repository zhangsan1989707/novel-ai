import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const startedAt = Date.now()
  const checks: Record<string, { ok: boolean; detail?: string }> = {}

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { ok: true }
  } catch (err) {
    checks.database = {
      ok: false,
      detail: err instanceof Error ? err.message : 'database check failed',
    }
  }

  try {
    const defaultConfig = await prisma.aIModelConfig.findFirst({
      where: { isDefault: true },
      select: { vendor: true, modelId: true, apiKey: true },
    })
    checks.aiConfig = {
      ok: Boolean(defaultConfig?.apiKey),
      detail: defaultConfig
        ? `${defaultConfig.vendor}/${defaultConfig.modelId}`
        : 'no default model',
    }
  } catch (err) {
    checks.aiConfig = {
      ok: false,
      detail: err instanceof Error ? err.message : 'ai config check failed',
    }
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
