import { NextResponse } from 'next/server'
import { hookRegistry } from '@/lib/hooks/registry'

export async function GET() {
  try {
    const hooks = hookRegistry.getAllHooks()
    const history = hookRegistry.getExecutionHistory()

    return NextResponse.json({
      success: true,
      data: {
        hooks,
        history,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'GET_HOOKS_ERROR', message: '获取 Hooks 列表失败' } },
      { status: 500 }
    )
  }
}
