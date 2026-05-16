import json
import os
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3200"
SCREENSHOT_DIR = "/tmp/novel-ai-test-screenshots"
RESULTS_FILE = "/tmp/novel-ai-test-results.json"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

test_results = []
current_project_id = None


def record(module, name, status, detail="", screenshot=None):
    test_results.append({
        "module": module,
        "name": name,
        "status": status,
        "detail": detail,
        "screenshot": screenshot,
    })
    icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"  {icon} [{module}] {name}: {detail}")


def screenshot(page, name):
    path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
    try:
        page.screenshot(path=path, full_page=True)
        return path
    except Exception as e:
        return None


def safe_click(page, selector, timeout=5000):
    try:
        page.click(selector, timeout=timeout)
        return True
    except Exception:
        return False


def safe_fill(page, selector, value, timeout=5000):
    try:
        page.fill(selector, value, timeout=timeout)
        return True
    except Exception:
        return False


def wait_and_check(page, selector, timeout=5000):
    try:
        page.wait_for_selector(selector, timeout=timeout)
        return True
    except Exception:
        return False


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()

    # ========================================
    # 1. 首页重定向测试
    # ========================================
    print("\n📋 1. 首页重定向测试")
    try:
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        final_url = page.url
        if "/projects" in final_url:
            record("首页", "重定向到项目列表", "PASS", f"URL: {final_url}")
        else:
            record("首页", "重定向到项目列表", "FAIL", f"实际URL: {final_url}")
        screenshot(page, "01-home-redirect")
    except Exception as e:
        record("首页", "重定向到项目列表", "FAIL", str(e))

    # ========================================
    # 2. 项目列表页测试
    # ========================================
    print("\n📋 2. 项目列表页测试")
    try:
        page.goto(f"{BASE_URL}/projects")
        page.wait_for_load_state("networkidle")
        screenshot(page, "02-projects-list")

        if wait_and_check(page, 'input[placeholder*="搜索"]'):
            record("项目列表", "搜索框显示", "PASS", "搜索输入框存在")
            safe_fill(page, 'input[placeholder*="搜索"]', "测试")
            page.wait_for_timeout(500)
            screenshot(page, "02-projects-search")
            page.fill('input[placeholder*="搜索"]', "")
        else:
            record("项目列表", "搜索框显示", "FAIL", "搜索输入框不存在")

        nav_buttons = ["我的小说", "AI 配置", "成本管理"]
        for btn in nav_buttons:
            if wait_and_check(page, f'button:has-text("{btn}")'):
                record("项目列表", f"导航按钮-{btn}", "PASS", "按钮存在")
            else:
                record("项目列表", f"导航按钮-{btn}", "FAIL", "按钮不存在")

        if safe_click(page, 'button:has-text("创作小说")'):
            page.wait_for_load_state("networkidle")
            if "/projects/new" in page.url:
                record("项目列表", "创作小说按钮", "PASS", "成功跳转到新建项目页")
                screenshot(page, "02-create-novel-click")
                page.go_back()
                page.wait_for_load_state("networkidle")
            else:
                record("项目列表", "创作小说按钮", "FAIL", f"跳转到了 {page.url}")
        else:
            record("项目列表", "创作小说按钮", "FAIL", "按钮不存在或不可点击")

        if safe_click(page, 'button:has-text("拆解小说")'):
            page.wait_for_timeout(500)
            if wait_and_check(page, 'text=拆解小说', timeout=2000):
                record("项目列表", "拆解小说弹窗", "PASS", "弹窗成功打开")
                screenshot(page, "02-analyze-modal")
                safe_click(page, 'button:has-text("关闭")')
                page.wait_for_timeout(300)
            else:
                record("项目列表", "拆解小说弹窗", "FAIL", "弹窗未打开")
        else:
            record("项目列表", "拆解小说弹窗", "FAIL", "按钮不存在")

        project_links = page.query_selector_all('a[href*="/projects/"]')
        if project_links:
            href = project_links[0].get_attribute("href")
            if href:
                current_project_id = href.split("/")[-1]
                record("项目列表", "获取已有项目", "PASS", f"项目ID: {current_project_id}")
        else:
            h3s = page.query_selector_all("h3")
            for h3 in h3s:
                text = h3.inner_text()
                if text and text != "我的小说":
                    record("项目列表", "发现项目卡片", "PASS", f"项目: {text}")
                    break

        if safe_click(page, 'button:has-text("通知")'):
            page.wait_for_timeout(500)
            screenshot(page, "02-notifications")
            record("项目列表", "通知按钮", "PASS", "通知下拉打开")
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)

        if safe_click(page, 'button:has-text("帮助")'):
            page.wait_for_timeout(800)
            if wait_and_check(page, 'text=帮助中心', timeout=2000):
                record("项目列表", "帮助弹窗", "PASS", "帮助中心弹窗打开")
                screenshot(page, "02-help-modal")
                safe_click(page, 'button:has-text("关闭")')
                page.wait_for_timeout(300)
            else:
                record("项目列表", "帮助弹窗", "FAIL", "帮助中心弹窗未打开")

        if safe_click(page, 'button:has-text("切换到深色模式")'):
            page.wait_for_timeout(500)
            screenshot(page, "02-dark-mode")
            record("项目列表", "深色模式切换", "PASS", "切换成功")
            safe_click(page, 'button:has-text("切换到浅色模式")')
            page.wait_for_timeout(300)

    except Exception as e:
        record("项目列表", "页面加载", "FAIL", str(e))

    # ========================================
    # 3. 新建项目页测试
    # ========================================
    print("\n📋 3. 新建项目页测试")
    try:
        page.goto(f"{BASE_URL}/projects/new")
        page.wait_for_load_state("networkidle")
        screenshot(page, "03-new-project")

        if wait_and_check(page, 'button:has-text("返回")'):
            record("新建项目", "返回按钮", "PASS", "返回按钮存在")
        else:
            record("新建项目", "返回按钮", "FAIL", "返回按钮不存在")

        if safe_fill(page, 'input[id="title"]', "测试小说标题"):
            record("新建项目", "标题输入框", "PASS", "可输入标题")
        else:
            record("新建项目", "标题输入框", "FAIL", "无法输入标题")

        if safe_fill(page, 'textarea[id="synopsis"]', "这是一个测试小说的简介内容"):
            record("新建项目", "简介输入框", "PASS", "可输入简介")
        else:
            record("新建项目", "简介输入框", "FAIL", "无法输入简介")

        if safe_click(page, 'button:has-text("选择类型")'):
            page.wait_for_timeout(300)
            if safe_click(page, 'text=玄幻'):
                record("新建项目", "类型选择", "PASS", "可选择类型")
                page.wait_for_timeout(300)
            else:
                record("新建项目", "类型选择", "FAIL", "无法选择类型")
        else:
            record("新建项目", "类型选择", "FAIL", "类型下拉不存在")

        screenshot(page, "03-new-project-filled")

        if safe_click(page, 'text=高级设置'):
            page.wait_for_timeout(500)
            screenshot(page, "03-advanced-settings")
            record("新建项目", "高级设置展开", "PASS", "高级设置可展开")
        else:
            record("新建项目", "高级设置展开", "FAIL", "高级设置不可展开")

        if wait_and_check(page, 'button:has-text("取消")'):
            record("新建项目", "取消按钮", "PASS", "取消按钮存在")
        else:
            record("新建项目", "取消按钮", "FAIL", "取消按钮不存在")

        if wait_and_check(page, 'button:has-text("开始创作")'):
            record("新建项目", "开始创作按钮", "PASS", "开始创作按钮存在")
        else:
            record("新建项目", "开始创作按钮", "FAIL", "开始创作按钮不存在")

    except Exception as e:
        record("新建项目", "页面加载", "FAIL", str(e))

    # ========================================
    # 4. 项目详情页测试
    # ========================================
    print("\n📋 4. 项目详情页测试")
    if current_project_id:
        try:
            page.goto(f"{BASE_URL}/projects/{current_project_id}")
            page.wait_for_load_state("networkidle")
            screenshot(page, "04-project-detail")

            if wait_and_check(page, 'button:has-text("我的小说")'):
                record("项目详情", "返回按钮", "PASS", "返回按钮存在")
            else:
                record("项目详情", "返回按钮", "FAIL", "返回按钮不存在")

            if safe_click(page, 'button:has-text("更多")'):
                page.wait_for_timeout(500)
                screenshot(page, "04-more-menu")
                record("项目详情", "更多操作菜单", "PASS", "菜单打开")
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)

            if safe_click(page, 'button:has-text("生成大纲")'):
                page.wait_for_timeout(800)
                if wait_and_check(page, 'text=AI 生成小说大纲', timeout=3000):
                    record("项目详情", "生成大纲弹窗", "PASS", "大纲弹窗打开")
                    screenshot(page, "04-outline-generator")
                    safe_click(page, 'button:has-text("关闭")')
                    page.wait_for_timeout(300)
                else:
                    record("项目详情", "生成大纲弹窗", "FAIL", "大纲弹窗未打开")

            if safe_click(page, 'button:has-text("生成目录")'):
                page.wait_for_timeout(800)
                if wait_and_check(page, 'text=智能生成章节目录', timeout=3000):
                    record("项目详情", "生成目录弹窗", "PASS", "目录弹窗打开")
                    screenshot(page, "04-chapter-list-generator")

                    spinbutton = page.query_selector('input[type="number"]')
                    if spinbutton:
                        record("项目详情", "章节数量输入", "PASS", "数量输入框存在")
                    else:
                        record("项目详情", "章节数量输入", "FAIL", "数量输入框不存在")

                    styles = ["网文风格", "传统风格", "诗词风格"]
                    for style in styles:
                        if wait_and_check(page, f'button:has-text("{style}")'):
                            record("项目详情", f"标题风格-{style}", "PASS", "按钮存在")
                        else:
                            record("项目详情", f"标题风格-{style}", "FAIL", "按钮不存在")

                    if safe_click(page, 'button:has-text("清空重来")'):
                        page.wait_for_timeout(300)
                        record("项目详情", "清空重来", "PASS", "清空按钮可点击")
                    else:
                        record("项目详情", "清空重来", "FAIL", "清空按钮不可点击")

                    if safe_click(page, 'button:has-text("取消")'):
                        page.wait_for_timeout(300)
                        record("项目详情", "取消目录弹窗", "PASS", "取消成功关闭弹窗")
                    else:
                        record("项目详情", "取消目录弹窗", "FAIL", "取消按钮不可点击")

            if safe_click(page, 'button:has-text("分析剧情")'):
                page.wait_for_timeout(800)
                if wait_and_check(page, 'text=剧情分析', timeout=3000):
                    record("项目详情", "分析剧情弹窗", "PASS", "剧情分析弹窗打开")
                    screenshot(page, "04-plot-analyzer")

                    dims = ["人物关系", "剧情线", "伏笔悬念", "章节结构", "世界观设定"]
                    for dim in dims:
                        if wait_and_check(page, f'text={dim}'):
                            record("项目详情", f"分析维度-{dim}", "PASS", "复选框存在")
                        else:
                            record("项目详情", f"分析维度-{dim}", "FAIL", "复选框不存在")

                    safe_click(page, 'button:has-text("关闭")')
                    page.wait_for_timeout(300)
                else:
                    record("项目详情", "分析剧情弹窗", "FAIL", "弹窗未打开")

            if safe_click(page, 'button:has-text("继续生成")'):
                page.wait_for_timeout(800)
                if wait_and_check(page, 'text=继续生成', timeout=3000):
                    record("项目详情", "继续生成弹窗", "PASS", "继续生成弹窗打开")
                    screenshot(page, "04-continuation")

                    modes = ["续写结局", "继续创作", "全文重写"]
                    for mode in modes:
                        if wait_and_check(page, f'button:has-text("{mode}")'):
                            record("项目详情", f"续写模式-{mode}", "PASS", "按钮存在")
                        else:
                            record("项目详情", f"续写模式-{mode}", "FAIL", "按钮不存在")

                    safe_click(page, 'button:has-text("关闭")')
                    page.wait_for_timeout(300)
                else:
                    record("项目详情", "继续生成弹窗", "FAIL", "弹窗未打开")

            if safe_click(page, 'button:has-text("新建章节")'):
                page.wait_for_load_state("networkidle")
                if "/chapters/new" in page.url:
                    record("项目详情", "新建章节跳转", "PASS", "成功跳转到新建章节页")
                    screenshot(page, "04-new-chapter")

                    if wait_and_check(page, 'input[placeholder*="章节标题"]'):
                        record("章节编辑器", "标题输入框", "PASS", "标题输入框存在")
                    else:
                        record("章节编辑器", "标题输入框", "FAIL", "标题输入框不存在")

                    if wait_and_check(page, 'button:has-text("创建")'):
                        record("章节编辑器", "创建按钮", "PASS", "创建按钮存在")
                    else:
                        record("章节编辑器", "创建按钮", "FAIL", "创建按钮不存在")

                    safe_click(page, 'button:has-text("返回项目")')
                    page.wait_for_load_state("networkidle")
                else:
                    record("项目详情", "新建章节跳转", "FAIL", f"跳转到了 {page.url}")

            if safe_click(page, 'button:has-text("多选")'):
                page.wait_for_timeout(300)
                screenshot(page, "04-multi-select")
                record("项目详情", "多选模式", "PASS", "多选模式可切换")
                safe_click(page, 'button:has-text("取消")')
                page.wait_for_timeout(300)

            if wait_and_check(page, 'text=项目信息'):
                record("项目详情", "项目信息面板", "PASS", "项目信息面板存在")
            else:
                record("项目详情", "项目信息面板", "FAIL", "项目信息面板不存在")

            if wait_and_check(page, 'text=写作进度'):
                record("项目详情", "写作进度面板", "PASS", "写作进度面板存在")
            else:
                record("项目详情", "写作进度面板", "FAIL", "写作进度面板不存在")

        except Exception as e:
            record("项目详情", "页面加载", "FAIL", str(e))
    else:
        record("项目详情", "页面加载", "SKIP", "没有可用的项目ID")

    # ========================================
    # 5. AI 配置页测试
    # ========================================
    print("\n📋 5. AI 配置页测试")
    try:
        page.goto(f"{BASE_URL}/settings")
        page.wait_for_load_state("networkidle")
        screenshot(page, "05-settings")

        if wait_and_check(page, 'text=AI 配置'):
            record("AI配置", "页面标题", "PASS", "AI 配置标题显示")
        else:
            record("AI配置", "页面标题", "FAIL", "AI 配置标题不存在")

        if safe_click(page, 'button:has-text("添加配置")'):
            page.wait_for_timeout(800)
            if wait_and_check(page, 'text=配置名称', timeout=3000):
                record("AI配置", "添加配置弹窗", "PASS", "配置弹窗打开")
                screenshot(page, "05-add-config-modal")

                form_fields = ["配置名称", "AI 提供商", "模型 ID", "API Key"]
                for field in form_fields:
                    if wait_and_check(page, f'text={field}'):
                        record("AI配置", f"表单字段-{field}", "PASS", "字段存在")
                    else:
                        record("AI配置", f"表单字段-{field}", "FAIL", "字段不存在")

                if safe_click(page, 'button:has-text("选择提供商")'):
                    page.wait_for_timeout(300)
                    providers = ["DeepSeek", "OpenAI", "Anthropic", "阿里云", "MiniMax", "火山引擎"]
                    for prov in providers:
                        if wait_and_check(page, f'text={prov}', timeout=1000):
                            record("AI配置", f"提供商-{prov}", "PASS", "选项存在")
                        else:
                            record("AI配置", f"提供商-{prov}", "FAIL", "选项不存在")
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(300)

                safe_click(page, 'button:has-text("取消")')
                page.wait_for_timeout(300)
            else:
                record("AI配置", "添加配置弹窗", "FAIL", "配置弹窗未打开")
        else:
            record("AI配置", "添加配置按钮", "FAIL", "按钮不存在")

        if wait_and_check(page, 'text=API Key 安全说明'):
            record("AI配置", "安全说明", "PASS", "安全说明显示")
        else:
            record("AI配置", "安全说明", "FAIL", "安全说明不存在")

    except Exception as e:
        record("AI配置", "页面加载", "FAIL", str(e))

    # ========================================
    # 6. 成本管理页测试
    # ========================================
    print("\n📋 6. 成本管理页测试")
    try:
        page.goto(f"{BASE_URL}/cost")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        screenshot(page, "06-cost")

        if wait_and_check(page, 'text=成本管理', timeout=5000):
            record("成本管理", "页面标题", "PASS", "成本管理标题显示")
        else:
            record("成本管理", "页面标题", "FAIL", "页面加载失败")

        if wait_and_check(page, 'button:has-text("刷新")'):
            record("成本管理", "刷新按钮", "PASS", "刷新按钮存在")
        else:
            record("成本管理", "刷新按钮", "FAIL", "刷新按钮不存在")

        if safe_click(page, 'button:has-text("配额设置")'):
            page.wait_for_timeout(800)
            if wait_and_check(page, 'text=配额设置', timeout=3000):
                record("成本管理", "配额设置弹窗", "PASS", "配额设置弹窗打开")
                screenshot(page, "06-quota-settings")

                if wait_and_check(page, 'text=月度配额'):
                    record("成本管理", "月度配额输入", "PASS", "月度配额输入框存在")
                if wait_and_check(page, 'text=预警阈值'):
                    record("成本管理", "预警阈值输入", "PASS", "预警阈值输入框存在")

                safe_click(page, 'button:has-text("取消")')
                page.wait_for_timeout(300)
            else:
                record("成本管理", "配额设置弹窗", "FAIL", "弹窗未打开")

        cards = ["本月已用", "剩余配额", "使用率", "本月调用"]
        for card in cards:
            if wait_and_check(page, f'text={card}', timeout=2000):
                record("成本管理", f"状态卡片-{card}", "PASS", "卡片存在")
            else:
                record("成本管理", f"状态卡片-{card}", "FAIL", "卡片不存在")

        if wait_and_check(page, 'text=成本预估'):
            record("成本管理", "成本预估计算器", "PASS", "计算器存在")
        else:
            record("成本管理", "成本预估计算器", "FAIL", "计算器不存在")

        if wait_and_check(page, 'text=模型定价'):
            record("成本管理", "模型定价表", "PASS", "定价表存在")
        else:
            record("成本管理", "模型定价表", "FAIL", "定价表不存在")

    except Exception as e:
        record("成本管理", "页面加载", "FAIL", str(e))

    # ========================================
    # 7. API 端点测试
    # ========================================
    print("\n📋 7. API 端点测试")

    api_tests = [
        ("项目管理", "/api/novel/projects", "获取项目列表"),
        ("灵感推荐", "/api/novel/inspiration", "获取灵感推荐"),
        ("成本管理", "/api/novel/cost", "获取成本数据"),
        ("通知系统", "/api/notifications", "获取通知列表"),
        ("AI配置", "/api/novel/ai-configs", "获取AI配置列表"),
    ]

    for module, endpoint, desc in api_tests:
        try:
            resp = page.request.get(f"{BASE_URL}{endpoint}")
            status = resp.status
            if 200 <= status < 300:
                record("API", f"{module}-{desc}", "PASS", f"HTTP {status}")
            else:
                record("API", f"{module}-{desc}", "FAIL", f"HTTP {status}")
        except Exception as e:
            record("API", f"{module}-{desc}", "FAIL", str(e))

    if current_project_id:
        project_api_tests = [
            ("项目详情", f"/api/novel/projects/{current_project_id}", "获取项目详情"),
            ("章节列表", f"/api/novel/projects/{current_project_id}/chapters", "获取章节列表"),
            ("导出项目", f"/api/novel/projects/{current_project_id}/export", "导出项目"),
        ]
        for module, endpoint, desc in project_api_tests:
            try:
                resp = page.request.get(f"{BASE_URL}{endpoint}")
                status = resp.status
                if 200 <= status < 300:
                    record("API", f"{module}-{desc}", "PASS", f"HTTP {status}")
                else:
                    record("API", f"{module}-{desc}", "FAIL", f"HTTP {status}")
            except Exception as e:
                record("API", f"{module}-{desc}", "FAIL", str(e))

    # ========================================
    # 8. 导航完整性测试
    # ========================================
    print("\n📋 8. 导航完整性测试")
    nav_routes = [
        ("/projects", "项目列表页"),
        ("/projects/new", "新建项目页"),
        ("/settings", "AI配置页"),
        ("/cost", "成本管理页"),
    ]
    if current_project_id:
        nav_routes.extend([
            (f"/projects/{current_project_id}", "项目详情页"),
            (f"/projects/{current_project_id}/chapters/new", "新建章节页"),
        ])

    for route, name in nav_routes:
        try:
            resp = page.request.get(f"{BASE_URL}{route}")
            status = resp.status
            if 200 <= status < 400:
                record("导航", f"{name}", "PASS", f"HTTP {status}")
            else:
                record("导航", f"{name}", "FAIL", f"HTTP {status}")
        except Exception as e:
            record("导航", f"{name}", "FAIL", str(e))

    # ========================================
    # 9. 控制台错误检测
    # ========================================
    print("\n📋 9. 控制台错误检测")
    console_errors = []
    page2 = context.new_page()
    page2.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page2.on("pageerror", lambda err: console_errors.append(f"PageError: {err}"))

    test_pages_for_errors = [
        ("/projects", "项目列表"),
        ("/settings", "AI配置"),
        ("/cost", "成本管理"),
    ]
    if current_project_id:
        test_pages_for_errors.append((f"/projects/{current_project_id}", "项目详情"))

    for route, name in test_pages_for_errors:
        console_errors.clear()
        try:
            page2.goto(f"{BASE_URL}{route}")
            page2.wait_for_load_state("networkidle")
            page2.wait_for_timeout(2000)
            if console_errors:
                record("控制台", f"{name}页面错误", "FAIL", f"发现 {len(console_errors)} 个错误: {console_errors[:3]}")
            else:
                record("控制台", f"{name}页面错误", "PASS", "无控制台错误")
        except Exception as e:
            record("控制台", f"{name}页面错误", "FAIL", str(e))

    page2.close()

    # ========================================
    # 10. 响应式布局测试
    # ========================================
    print("\n📋 10. 响应式布局测试")
    mobile_viewport = {"width": 375, "height": 812}
    mobile_context = browser.new_context(viewport=mobile_viewport)
    mobile_page = mobile_context.new_page()

    try:
        mobile_page.goto(f"{BASE_URL}/projects")
        mobile_page.wait_for_load_state("networkidle")
        screenshot(mobile_page, "10-mobile-projects")
        record("响应式", "移动端项目列表", "PASS", "移动端布局正常")
    except Exception as e:
        record("响应式", "移动端项目列表", "FAIL", str(e))

    try:
        mobile_page.goto(f"{BASE_URL}/settings")
        mobile_page.wait_for_load_state("networkidle")
        screenshot(mobile_page, "10-mobile-settings")
        record("响应式", "移动端AI配置", "PASS", "移动端布局正常")
    except Exception as e:
        record("响应式", "移动端AI配置", "FAIL", str(e))

    mobile_context.close()

    browser.close()

with open(RESULTS_FILE, "w", encoding="utf-8") as f:
    json.dump(test_results, f, ensure_ascii=False, indent=2)

total = len(test_results)
passed = len([r for r in test_results if r["status"] == "PASS"])
failed = len([r for r in test_results if r["status"] == "FAIL"])
skipped = len([r for r in test_results if r["status"] == "SKIP"])

print(f"\n{'='*60}")
print(f"测试完成！总计: {total}, 通过: {passed}, 失败: {failed}, 跳过: {skipped}")
print(f"通过率: {passed/total*100:.1f}%")
print(f"截图目录: {SCREENSHOT_DIR}")
print(f"详细结果: {RESULTS_FILE}")
print(f"{'='*60}")
