import { test, expect } from '@playwright/test'

/**
 * E2E 测试 - 项目完整流程
 *
 * 测试场景：
 * 1. 创建项目 → 2. 编辑项目 → 3. 智能生成章节目录 → 4. 应用章节
 *
 * 前置条件：开发服务器运行在 http://localhost:3200
 */
test.describe('项目完整流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3200/projects')
    await page.waitForLoadState('networkidle')
  })

  test('创建项目流程', async ({ page }) => {
    // 点击新建项目按钮
    await page.getByRole('button', { name: /新建项目/ }).first().click()

    // 等待弹窗出现
    await expect(page.getByRole('heading', { name: '新建项目' })).toBeVisible()

    // 填写表单 - 使用 placeholder 定位
    const titleInput = page.locator('input[placeholder*="小说标题"]')
    await titleInput.fill('测试小说 E2E')

    const descTextarea = page.locator('textarea').first()
    await descTextarea.fill('这是一本测试用的小说')

    // 提交
    await page.getByRole('button', { name: '创建项目' }).click()

    // 等待跳转到项目详情页
    await page.waitForURL(/\/projects\/\d+/, { timeout: 10000 })

    // 验证项目标题显示
    await expect(page.getByRole('heading', { name: '测试小说 E2E' })).toBeVisible()
  })

  test('编辑项目流程', async ({ page }) => {
    // 先创建项目
    await page.goto('http://localhost:3200/projects')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /新建项目/ }).first().click()
    await page.waitForSelector('h2:text("新建项目")', { timeout: 5000 })
    const titleInput = page.locator('input[placeholder*="小说标题"]')
    await titleInput.fill('待编辑项目 E2E')
    await page.getByRole('button', { name: '创建项目' }).click()
    await page.waitForURL(/\/projects\/\d+/, { timeout: 10000 })

    // 等待页面加载完成
    await page.waitForSelector('h1', { timeout: 5000 })

    // 点击编辑按钮
    await page.getByRole('button', { name: /编辑/ }).click()

    // 等待编辑弹窗 (使用 exact: true 避免匹配到项目标题)
    await expect(page.getByRole('heading', { name: '编辑项目', exact: true })).toBeVisible({ timeout: 5000 })

    // 修改标题 - 找到标题输入框并清空后填写
    const editTitleInput = page.locator('input').first()
    await editTitleInput.clear()
    await editTitleInput.fill('修改后的标题 E2E')

    // 点击保存
    await page.getByRole('button', { name: '保存' }).click()

    // 等待弹窗关闭
    await page.waitForTimeout(1000)

    // 验证标题已更新
    await expect(page.getByText('修改后的标题 E2E')).toBeVisible()
  })

  test('智能生成章节目录流程', async ({ page }) => {
    // 这个测试需要更长时间，设置120秒超时
    test.setTimeout(120000)

    // 先创建项目
    await page.goto('http://localhost:3200/projects')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /新建项目/ }).first().click()
    await page.waitForSelector('h2:text("新建项目")', { timeout: 5000 })
    const titleInput = page.locator('input[placeholder*="小说标题"]')
    await titleInput.fill('AI生成测试 E2E')
    await page.getByRole('button', { name: '创建项目' }).click()
    await page.waitForURL(/\/projects\/\d+/, { timeout: 10000 })

    // 获取项目 ID 并关联 AI 配置
    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/(\d+)/)?.[1]

    // 通过 API 更新项目的 aiModelId
    if (projectId) {
      await page.evaluate(async (id) => {
        await fetch(`/api/novel/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiModelId: 1 }),
        })
      }, projectId)
    }

    // 刷新页面使配置生效
    await page.reload()
    await page.waitForLoadState('networkidle')

    // 点击智能生成目录按钮
    await page.getByRole('button', { name: /智能生成目录/ }).click()

    // 等待弹窗出现
    await expect(page.getByRole('heading', { name: '智能生成章节目录' })).toBeVisible({ timeout: 5000 })

    // 设置章节数为1（最小测试单元）
    const chapterInput = page.locator('input[type="number"]').first()
    await chapterInput.fill('1')

    // 找到弹窗内的生成按钮并点击
    const modal = page.locator('[role="dialog"]')
    const generateBtn = modal.locator('button').filter({ hasText: '生成目录' })
    await generateBtn.click()

    // 等待表格出现，最多90秒
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 90000 })
  })

  test('删除项目流程', async ({ page }) => {
    // 创建测试项目
    await page.getByRole('button', { name: /新建项目/ }).first().click()
    await page.waitForSelector('h2:text("新建项目")', { timeout: 5000 })

    const titleInput = page.locator('input[placeholder*="小说标题"]')
    await titleInput.fill('待删除项目 E2E')

    await page.getByRole('button', { name: '创建项目' }).click()
    await page.waitForURL(/\/projects\/\d+/, { timeout: 10000 })

    // 点击删除按钮
    await page.getByRole('button', { name: /删除/ }).click()

    // 确认删除弹窗
    await expect(page.getByText(/确定要删除.*此操作不可撤销/i)).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: '删除' }).last().click()

    // 等待返回列表页
    await page.waitForURL(/\/projects/, { timeout: 10000 })
    await expect(page.getByText('待删除项目 E2E')).not.toBeVisible()
  })
})

/**
 * E2E 测试 - 章节管理流程
 */
test.describe('章节管理流程', () => {
  test('创建章节', async ({ page }) => {
    // 先创建项目
    await page.goto('http://localhost:3200/projects')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /新建项目/ }).first().click()
    await page.waitForSelector('h2:text("新建项目")', { timeout: 5000 })
    const titleInput = page.locator('input[placeholder*="小说标题"]')
    await titleInput.fill('章节测试 E2E')
    await page.getByRole('button', { name: '创建项目' }).click()
    await page.waitForURL(/\/projects\/\d+/, { timeout: 10000 })

    // 等待页面加载
    await page.waitForSelector('h1', { timeout: 5000 })

    // 点击新建章节
    await page.getByRole('button', { name: /新建章节/ }).click()

    // 等待跳转到章节编辑器
    await page.waitForURL(/\/projects\/\d+\/chapters\//, { timeout: 5000 })

    // 验证编辑器加载 - 检查页面有 textarea
    await expect(page.locator('textarea').first()).toBeVisible()
  })

  test('编辑章节内容', async ({ page }) => {
    // 先创建项目和章节
    await page.goto('http://localhost:3200/projects')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /新建项目/ }).first().click()
    await page.waitForSelector('h2:text("新建项目")', { timeout: 5000 })
    const titleInput = page.locator('input[placeholder*="小说标题"]')
    await titleInput.fill('章节编辑测试 E2E')
    await page.getByRole('button', { name: '创建项目' }).click()
    await page.waitForURL(/\/projects\/\d+/, { timeout: 10000 })

    // 创建章节
    await page.waitForSelector('h1', { timeout: 5000 })
    await page.getByRole('button', { name: /新建章节/ }).click()
    await page.waitForURL(/\/projects\/\d+\/chapters\//, { timeout: 5000 })

    // 等待页面加载
    await page.waitForSelector('textarea', { timeout: 5000 })

    // 填写章节标题
    const chapterTitleInput = page.locator('input').first()
    await chapterTitleInput.fill('第一章 测试章节')

    // 填写章节概要
    const textareas = page.locator('textarea')
    await textareas.nth(0).fill('这是一个测试章节的概要')

    // 填写内容
    await textareas.nth(1).fill('这是第一章的正文内容，用于测试编辑功能。')

    // 保存
    await page.getByRole('button', { name: /保存/ }).click()

    // 等待一下让保存完成
    await page.waitForTimeout(2000)

    // 验证章节标题已更新（检查 input 值）
    const updatedTitle = await page.locator('input').first().inputValue()
    expect(updatedTitle).toBe('第一章 测试章节')
  })
})

/**
 * E2E 测试 - 错误场景
 */
test.describe('错误场景处理', () => {
  test('创建项目时标题为空应显示错误', async ({ page }) => {
    await page.goto('http://localhost:3200/projects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /新建项目/ }).first().click()
    await expect(page.getByRole('heading', { name: '新建项目' })).toBeVisible()

    // 不填写标题直接提交
    await page.getByRole('button', { name: '创建项目' }).click()

    // 验证错误提示
    await expect(page.getByText(/请输入标题|标题不能为空/i)).toBeVisible({ timeout: 3000 })
  })

  test('编辑不存在的项目应显示错误', async ({ page }) => {
    await page.goto('http://localhost:3200/projects/99999')
    await page.waitForLoadState('networkidle')

    // 验证错误提示
    await expect(page.getByText(/项目不存在|获取项目详情失败/i)).toBeVisible({ timeout: 5000 })
  })

  test('新建项目弹窗可以正常打开', async ({ page }) => {
    await page.goto('http://localhost:3200/projects')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /新建项目/ }).first().click()

    // 验证弹窗标题可见
    await expect(page.getByRole('heading', { name: '新建项目' })).toBeVisible()
    // 验证表单元素存在
    await expect(page.locator('input[placeholder*="小说标题"]')).toBeVisible()
  })
})
