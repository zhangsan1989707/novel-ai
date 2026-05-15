import { test, expect } from '@playwright/test'

test.describe('拆解小说功能', () => {
  test('文件上传 API - TXT 文件', async ({ request }) => {
    // 创建一个测试文件内容
    const content = '这是一个测试小说内容，用于验证文件上传功能。'.repeat(100)

    const formData = new FormData()
    const blob = new Blob([content], { type: 'text/plain' })
    const file = new File([blob], 'test.txt')
    formData.append('file', file)

    const response = await request.post('/api/novel/projects/analyze-mode/upload', {
      multipart: formData,
    })

    const body = await response.json()
    console.log('Response:', JSON.stringify(body, null, 2))
    expect(response.ok()).toBeTruthy()
    expect(body.success).toBe(true)
    expect(body.data.wordCount).toBeGreaterThan(0)
  })

  test('AnalyzeWizard 组件渲染', async ({ page }) => {
    await page.goto('/projects')

    // 点击拆解小说按钮
    await page.click('button:has-text("拆解小说")')

    // 验证弹窗出现 - 使用标题元素
    await expect(page.locator('#modal-title')).toBeVisible()
    await expect(page.locator('text=基本信息')).toBeVisible()

    // 验证有项目标题输入框（第一步显示基本信息）
    await expect(page.locator('input[placeholder="给这个拆解项目起个名字"]')).toBeVisible()
  })

  test('创建项目流程', async ({ page }) => {
    await page.goto('/projects')

    // 点击创作小说按钮
    await page.click('button:has-text("创作小说")')

    // 等待弹窗出现
    await page.waitForSelector('#modal-title', { state: 'visible' })

    // 填写标题
    await page.fill('input[placeholder="请输入小说标题"]', '测试创建项目')

    // 点击创建项目按钮
    await page.click('button[type="submit"]:has-text("创建项目")')

    // 等待跳转（验证成功）
    await page.waitForURL(/\/projects\/\d+/, { timeout: 10000 })

    // 验证跳转到了项目详情页
    await expect(page.locator('h1:has-text("测试创建项目")')).toBeVisible()
  })
})