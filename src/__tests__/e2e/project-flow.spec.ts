import { test, expect, type Page } from '@playwright/test'

const corePitchPlaceholder = '例：社畜穿越成赘婿，靠996卷死修仙界；也可以直接从上面的灵感卡里选'
const titlePlaceholder = '留空则自动生成，不会用灵感代替'
const worldPlaceholder = '可选，补充更多设定信息'

async function openAdvancedTuning(page: Page) {
  await page.getByRole('button', { name: /AI 高级调校/ }).click()
  await expect(page.getByPlaceholder(titlePlaceholder)).toBeVisible()
}

async function createProjectFromNewPage(page: Page, title: string) {
  await page.goto('/projects/new')
  await expect(page).toHaveURL(/\/projects\/new$/)
  await expect(page.getByRole('heading', { name: '新建小说' })).toBeVisible()

  await page.getByRole('button', { name: '起点' }).click()
  await page.getByLabel('题材').selectOption('玄幻')
  await page.getByPlaceholder(corePitchPlaceholder).fill('废柴外门弟子靠重开面板，一路卷成仙门最强长老。')

  await openAdvancedTuning(page)
  await page.getByPlaceholder(titlePlaceholder).fill(title)

  await page.getByRole('button', { name: '开始创作' }).click()
  await page.waitForURL(/\/projects\/\d+$/, { timeout: 15000 })
}

test.describe('当前创作主流程', () => {
  test('项目列表入口跳转到 /projects/new', async ({ page }) => {
    await page.goto('/projects')

    await expect(page.getByRole('heading', { name: '我的小说' })).toBeVisible()
    await page.getByRole('button', { name: '创作小说' }).click()

    await expect(page).toHaveURL(/\/projects\/new$/)
    await expect(page.getByRole('heading', { name: '新建小说' })).toBeVisible()
    await expect(page.getByText('只提供方向，创建后即可开始 AI 生成，并自动维护全书设定')).toBeVisible()
  })

  test('`/projects/new` 展示当前创建表单而不是旧 modal', async ({ page }) => {
    await page.goto('/projects/new')

    await expect(page.getByRole('heading', { name: '新建小说' })).toBeVisible()
    await expect(page.getByRole('button', { name: '起点' })).toBeVisible()
    await expect(page.getByRole('button', { name: '番茄' })).toBeVisible()
    await expect(page.getByLabel('题材')).toBeVisible()
    await expect(page.getByPlaceholder(corePitchPlaceholder)).toBeVisible()
    await expect(page.getByRole('button', { name: '开始创作' })).toBeVisible()

    await openAdvancedTuning(page)
    await expect(page.getByPlaceholder(worldPlaceholder)).toBeVisible()
    await expect(page.getByPlaceholder('例如 300000')).toBeVisible()
    await expect(page.getByRole('spinbutton', { name: '每章字数' })).toHaveValue('3000')
  })

  test('创建项目后进入详情页，并显示当前主流程门禁状态', async ({ page, request }) => {
    let projectApiReady = false
    try {
      const response = await request.get('/api/novel/projects?page=1&pageSize=1')
      const body = await response.json()
      projectApiReady = response.ok() && body?.success === true
    } catch {
      projectApiReady = false
    }
    test.skip(!projectApiReady, 'requires local Postgres-backed project API on localhost:5433')

    const title = `E2E 当前主流程 ${Date.now()}`

    await createProjectFromNewPage(page, title)

    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByRole('heading', { name: '主流程' })).toBeVisible()
    await expect(page.getByText('蓝图确认')).toBeVisible()
    await expect(page.getByText('故事路线图')).toBeVisible()
    await expect(page.getByText('开始生成')).toBeVisible()

    await expect(page.getByText('先绑定 AI 模型，再开始生成')).toBeVisible()
    await expect(page.getByRole('button', { name: '编辑小说' })).toBeVisible()
    await expect(page.getByRole('button', { name: '去系统设置' })).toBeVisible()

    await expect(page.getByText('编辑并确认 BookBlueprint。')).toBeVisible()
    await expect(page.getByText('查看 AI 规划的全书发展路线，并做轻量确认。')).toBeVisible()
    await expect(page.getByText('当前还没有故事路线图。先确认蓝图并等待 AI 自动生成路线。')).toBeVisible()

    const gatedStartCard = page.locator('div').filter({
      hasText: '只有当 Blueprint 和 ArcPlan 都确认后，系统才允许生成章节目录和正文。',
    }).first()
    await expect(gatedStartCard).toBeVisible()
    await expect(gatedStartCard.getByLabel('生成速度模式')).toHaveValue('balanced')
    await expect(gatedStartCard.getByRole('button', { name: '开始生成' })).toBeDisabled()

    await expect(page.getByText('暂无章节，开始 AI 生成后会自动生成')).toBeVisible()
  })
})
