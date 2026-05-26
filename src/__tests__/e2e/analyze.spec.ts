import { test, expect } from '@playwright/test'

test.describe('拆解小说功能', () => {
  test('AnalyzeWizard 组件渲染', async ({ page }) => {
    await page.goto('/projects')

    // 点击拆解小说按钮
    await page.click('button:has-text("拆解小说")')

    // 验证弹窗出现并停留在当前上传步骤
    await expect(page.locator('#modal-title')).toBeVisible()
    await expect(page.getByText('导入小说')).toBeVisible()
    await expect(page.getByText('拖拽文件到此处，或点击选择文件')).toBeVisible()
    await expect(page.getByRole('button', { name: '上传并识别' })).toBeDisabled()
  })

  test('创作小说入口跳转到当前 /projects/new 页面', async ({ page }) => {
    await page.goto('/projects')

    // 点击创作小说按钮
    await page.click('button:has-text("创作小说")')

    // 当前主流程已经改为独立页面，而不是旧 modal
    await page.waitForURL(/\/projects\/new$/, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: '新建小说' })).toBeVisible()
    await expect(page.getByPlaceholder('例：社畜穿越成赘婿，靠996卷死修仙界；也可以直接从上面的灵感卡里选')).toBeVisible()
  })
})
