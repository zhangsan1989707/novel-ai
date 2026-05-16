import { NextRequest, NextResponse } from 'next/server'
import { hookRegistry } from '@/lib/hooks/registry'
import type { HookContext } from '@/lib/hooks/types'

interface RouteParams {
  params: Promise<{ hookId: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { hookId } = await params
    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'enabled 必须为布尔值' } },
        { status: 400 }
      )
    }

    const success = hookRegistry.setEnabled(hookId, enabled)
    if (!success) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Hook 不存在' } },
        { status: 404 }
      )
    }

    const hook = hookRegistry.getHook(hookId)
    return NextResponse.json({
      success: true,
      data: hook,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'UPDATE_HOOK_ERROR', message: '更新 Hook 状态失败' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { hookId } = await params
    const body = await request.json()
    const { context } = body as { context: HookContext }

    const hook = hookRegistry.getHook(hookId)
    if (!hook) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Hook 不存在' } },
        { status: 404 }
      )
    }

    const results = await hookRegistry.execute(hook.trigger, context || {})

    return NextResponse.json({
      success: true,
      data: {
        hookId,
        trigger: hook.trigger,
        results,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'TRIGGER_HOOK_ERROR', message: '触发 Hook 失败' } },
      { status: 500 }
    )
  }
}
