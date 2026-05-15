import { NextRequest, NextResponse } from 'next/server'
import {
  getMonthlyUsage,
  checkQuotaStatus,
  getUserQuota,
  initializeDefaultPricings,
} from '@/lib/cost-tracker'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/novel/cost
 * 获取成本统计和配额状态
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const userId = 1 // TODO: 后续接入认证后修改

    // 初始化默认定价（首次运行时）
    await initializeDefaultPricings()

    if (action === 'quota') {
      // 获取配额状态
      const status = await checkQuotaStatus(userId)
      return NextResponse.json({
        success: true,
        data: status,
      })
    } else if (action === 'usage') {
      // 获取使用统计
      const usage = await getMonthlyUsage(userId)
      return NextResponse.json({
        success: true,
        data: usage,
      })
    } else if (action === 'pricings') {
      // 获取所有模型定价
      const pricings = await prisma.modelPricing.findMany()
      return NextResponse.json({
        success: true,
        data: pricings,
      })
    }

    // 默认返回完整信息
    const [quotaStatus, monthlyUsage, pricings] = await Promise.all([
      checkQuotaStatus(userId),
      getMonthlyUsage(userId),
      prisma.modelPricing.findMany(),
    ])

    return NextResponse.json({
      success: true,
      data: {
        quota: quotaStatus,
        usage: monthlyUsage,
        pricings,
      },
    })
  } catch (error) {
    console.error('获取成本信息失败:', error)
    return NextResponse.json(
      { success: false, error: { message: '获取成本信息失败' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/novel/cost
 * 更新用户配额配置
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = 1 // TODO: 后续接入认证后修改

    const { monthlyLimit, alertThreshold } = body

    // 获取或创建用户配额
    let quota = await prisma.userQuota.findUnique({ where: { userId } })

    if (!quota) {
      quota = await prisma.userQuota.create({
        data: {
          userId,
          monthlyLimit: monthlyLimit ?? 50.0,
          alertThreshold: alertThreshold ?? 0.8,
          isLocked: false,
        },
      })
    } else {
      quota = await prisma.userQuota.update({
        where: { userId },
        data: {
          ...(monthlyLimit !== undefined && { monthlyLimit }),
          ...(alertThreshold !== undefined && { alertThreshold }),
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: quota,
    })
  } catch (error) {
    console.error('更新配额失败:', error)
    return NextResponse.json(
      { success: false, error: { message: '更新配额失败' } },
      { status: 500 }
    )
  }
}
