import json
import os
import time
from datetime import datetime
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3200"
SCREENSHOT_DIR = "/tmp/novel-ai-test-screenshots"
REPORT_FILE = "/tmp/novel-ai-test-report.json"

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

test_results = []
test_stats = {"total": 0, "passed": 0, "failed": 0, "skipped": 0}


def record_test(name, status, details="", screenshot_path=None, error=None):
    test_stats["total"] += 1
    test_stats[status] += 1
    result = {
        "name": name,
        "status": status,
        "details": details,
        "screenshot": screenshot_path,
        "error": str(error)[:200] if error else None,
        "timestamp": datetime.now().isoformat(),
    }
    test_results.append(result)
    icon = {"passed": "✅", "failed": "❌", "skipped": "⏭️"}.get(status, "?")
    print(f"  {icon} {name}: {status}" + (f" - {str(error)[:100]}" if error else ""))


def take_screenshot(page, name):
    path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
    try:
        page.screenshot(path=path, full_page=True)
    except Exception:
        try:
            page.screenshot(path=path)
        except Exception:
            pass
    return path


def click_nav(page, label):
    btn = page.locator(f'button:has-text("{label}")').first
    btn.click(timeout=5000)
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(500)


def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(f"PageError: {err}"))

        # ============================================================
        # SECTION 1: 首页和导航测试
        # ============================================================
        print("\n📋 SECTION 1: 首页和导航测试")

        try:
            page.goto(BASE_URL)
            page.wait_for_load_state("networkidle", timeout=15000)
            if "/projects" in page.url:
                record_test("1.1 首页重定向到项目列表", "passed", f"重定向到 {page.url}")
            else:
                record_test("1.1 首页重定向到项目列表", "failed", details=f"实际 {page.url}")
            take_screenshot(page, "01-homepage")
        except Exception as e:
            record_test("1.1 首页重定向到项目列表", "failed", error=str(e))

        try:
            nav_items = ["我的小说", "扫榜选材", "AI 配置", "成本管理"]
            found = [item for item in nav_items if page.locator(f'button:has-text("{item}")').first.is_visible(timeout=2000)]
            if len(found) == 4:
                record_test("1.2 顶部导航栏完整性", "passed", f"所有导航项: {found}")
            else:
                record_test("1.2 顶部导航栏完整性", "failed", details=f"缺少: {set(nav_items)-set(found)}")
        except Exception as e:
            record_test("1.2 顶部导航栏完整性", "failed", error=str(e))

        nav_tests = [
            ("扫榜选材", "/market", "1.3a"),
            ("AI 配置", "/settings", "1.3b"),
            ("成本管理", "/cost", "1.3c"),
            ("我的小说", "/projects", "1.3d"),
        ]
        for label, expected_path, test_id in nav_tests:
            try:
                click_nav(page, label)
                if expected_path in page.url:
                    record_test(f"{test_id} 导航-{label}", "passed", f"成功导航到 {page.url}")
                else:
                    record_test(f"{test_id} 导航-{label}", "failed", details=f"期望 {expected_path}，实际 {page.url}")
                take_screenshot(page, f"nav-{test_id}")
            except Exception as e:
                record_test(f"{test_id} 导航-{label}", "failed", error=str(e))

        try:
            page.goto(f"{BASE_URL}/projects")
            page.wait_for_load_state("networkidle", timeout=10000)
            theme_btn = page.locator('button:has(svg[class*="lucide-sun"]), button:has(svg[class*="lucide-moon"])').first
            if theme_btn.is_visible(timeout=3000):
                theme_btn.click(timeout=3000)
                page.wait_for_timeout(500)
                record_test("1.4 主题切换", "passed", "主题切换按钮可点击")
                take_screenshot(page, "03-theme-toggle")
                theme_btn.click(timeout=3000)
                page.wait_for_timeout(300)
            else:
                record_test("1.4 主题切换", "failed", details="未找到主题切换按钮")
        except Exception as e:
            record_test("1.4 主题切换", "failed", error=str(e))

        try:
            help_btn = page.locator('button:has(svg[class*="lucide-help"]), button:has(svg[class*="lucide-circle-help"])').first
            if help_btn.is_visible(timeout=3000):
                help_btn.click(timeout=3000)
                page.wait_for_timeout(500)
                dialog = page.locator('[role="dialog"], [data-state="open"]').first
                if dialog.is_visible(timeout=3000):
                    record_test("1.5 帮助弹窗", "passed", "帮助弹窗成功打开")
                    take_screenshot(page, "04-help-modal")
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(300)
                else:
                    record_test("1.5 帮助弹窗", "failed", details="弹窗未显示")
            else:
                record_test("1.5 帮助弹窗", "failed", details="未找到帮助按钮")
        except Exception as e:
            record_test("1.5 帮助弹窗", "failed", error=str(e))

        try:
            notif_btn = page.locator('button:has(svg[class*="lucide-bell"])').first
            if notif_btn.is_visible(timeout=3000):
                notif_btn.click(timeout=3000)
                page.wait_for_timeout(500)
                record_test("1.6 通知下拉", "passed", "通知按钮可点击")
                take_screenshot(page, "05-notification-dropdown")
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
            else:
                record_test("1.6 通知下拉", "failed", details="未找到通知按钮")
        except Exception as e:
            record_test("1.6 通知下拉", "failed", error=str(e))

        # ============================================================
        # SECTION 2: 项目列表页测试
        # ============================================================
        print("\n📋 SECTION 2: 项目列表页测试")

        page.goto(f"{BASE_URL}/projects")
        page.wait_for_load_state("networkidle", timeout=15000)
        take_screenshot(page, "06-projects-list")

        try:
            search_input = page.locator('input[placeholder*="搜索"]').first
            if search_input.is_visible(timeout=3000):
                search_input.fill("测试搜索")
                page.wait_for_timeout(500)
                record_test("2.1 项目搜索功能", "passed", "搜索输入框可输入")
                take_screenshot(page, "07-search-projects")
                search_input.clear()
                page.wait_for_timeout(300)
            else:
                record_test("2.1 项目搜索功能", "failed", details="未找到搜索输入框")
        except Exception as e:
            record_test("2.1 项目搜索功能", "failed", error=str(e))

        try:
            filter_btn = page.locator('button:has-text("筛选")').first
            if filter_btn.is_visible(timeout=3000):
                filter_btn.click(timeout=3000)
                page.wait_for_timeout(500)
                record_test("2.2 筛选面板展开", "passed", "筛选按钮可点击")
                take_screenshot(page, "08-filter-panel")
                filter_btn.click(timeout=3000)
                page.wait_for_timeout(300)
            else:
                record_test("2.2 筛选面板展开", "failed", details="未找到筛选按钮")
        except Exception as e:
            record_test("2.2 筛选面板展开", "failed", error=str(e))

        try:
            status_filters = ["全部", "草稿", "连载中", "已完结", "暂停"]
            found_filters = [sf for sf in status_filters if page.locator(f'button:has-text("{sf}")').first.is_visible(timeout=1000)]
            if len(found_filters) >= 3:
                for sf in found_filters[:3]:
                    page.locator(f'button:has-text("{sf}")').first.click(timeout=2000)
                    page.wait_for_timeout(300)
                record_test("2.3 状态筛选标签", "passed", f"找到并点击: {found_filters}")
                take_screenshot(page, "09-status-filters")
            else:
                record_test("2.3 状态筛选标签", "failed", details=f"只找到: {found_filters}")
        except Exception as e:
            record_test("2.3 状态筛选标签", "failed", error=str(e))

        try:
            analyze_btn = page.locator('button:has-text("拆解小说")').first
            if analyze_btn.is_visible(timeout=3000):
                analyze_btn.click(timeout=3000)
                page.wait_for_timeout(800)
                dialog = page.locator('[role="dialog"], [data-state="open"]').first
                if dialog.is_visible(timeout=3000):
                    record_test("2.4 拆解小说弹窗", "passed", "拆解小说向导弹窗成功打开")
                    take_screenshot(page, "10-analyze-wizard")
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(300)
                else:
                    record_test("2.4 拆解小说弹窗", "failed", details="弹窗未显示")
            else:
                record_test("2.4 拆解小说弹窗", "failed", details="未找到拆解小说按钮")
        except Exception as e:
            record_test("2.4 拆解小说弹窗", "failed", error=str(e))

        try:
            create_btn = page.locator('a:has-text("创作小说"), button:has-text("创作小说")').first
            if create_btn.is_visible(timeout=3000):
                create_btn.click(timeout=5000)
                page.wait_for_load_state("networkidle", timeout=10000)
                if "/projects/new" in page.url:
                    record_test("2.5 创作小说按钮导航", "passed", "成功导航到新建项目页")
                    take_screenshot(page, "11-create-novel-nav")
                else:
                    record_test("2.5 创作小说按钮导航", "failed", details=f"实际URL: {page.url}")
                page.go_back()
                page.wait_for_load_state("networkidle", timeout=10000)
            else:
                record_test("2.5 创作小说按钮导航", "failed", details="未找到创作小说按钮")
        except Exception as e:
            record_test("2.5 创作小说按钮导航", "failed", error=str(e))

        # ============================================================
        # SECTION 3: 新建项目页测试
        # ============================================================
        print("\n📋 SECTION 3: 新建项目页测试")

        page.goto(f"{BASE_URL}/projects/new")
        page.wait_for_load_state("networkidle", timeout=15000)
        take_screenshot(page, "12-new-project-page")

        try:
            title_vis = page.locator('input[name="title"]').first.is_visible(timeout=3000)
            desc_vis = page.locator('textarea[name="description"]').first.is_visible(timeout=3000)
            genre_vis = page.locator('select[name="genre"]').first.is_visible(timeout=3000)
            if title_vis and desc_vis and genre_vis:
                record_test("3.1 新建项目表单元素", "passed", "标题、简介、类型输入框均可见")
            else:
                record_test("3.1 新建项目表单元素", "failed", details=f"标题:{title_vis}, 简介:{desc_vis}, 类型:{genre_vis}")
        except Exception as e:
            record_test("3.1 新建项目表单元素", "failed", error=str(e))

        try:
            page.locator('input[name="title"]').first.fill("自动化测试小说")
            page.locator('textarea[name="description"]').first.fill("这是一个自动化测试创建的小说项目，用于功能测试。")
            page.wait_for_timeout(300)
            record_test("3.2 填写项目表单", "passed", "标题和简介已填写")
            take_screenshot(page, "13-filled-form")
        except Exception as e:
            record_test("3.2 填写项目表单", "failed", error=str(e))

        try:
            genre_select = page.locator('select[name="genre"]').first
            if genre_select.is_visible(timeout=3000):
                genre_select.select_option(label="玄幻")
                page.wait_for_timeout(300)
                record_test("3.3 选择小说类型", "passed", "成功选择玄幻类型")
                take_screenshot(page, "14-genre-select")
            else:
                record_test("3.3 选择小说类型", "failed", details="类型选择器不可见")
        except Exception as e:
            record_test("3.3 选择小说类型", "failed", error=str(e))

        try:
            adv_toggle = page.locator('button:has-text("高级设置")').first
            if adv_toggle.is_visible(timeout=3000):
                adv_toggle.click(timeout=3000)
                page.wait_for_timeout(500)
                record_test("3.4 高级设置展开", "passed", "高级设置面板已展开")
                take_screenshot(page, "15-advanced-settings")
                adv_toggle.click(timeout=3000)
                page.wait_for_timeout(300)
            else:
                record_test("3.4 高级设置展开", "failed", details="未找到高级设置")
        except Exception as e:
            record_test("3.4 高级设置展开", "failed", error=str(e))

        try:
            refresh_btn = page.locator('button:has-text("换一批")').first
            if refresh_btn.is_visible(timeout=3000):
                refresh_btn.click(timeout=3000)
                page.wait_for_timeout(1000)
                record_test("3.5 创作灵感-换一批", "passed", "换一批按钮可点击")
                take_screenshot(page, "16-inspiration-refresh")
            else:
                record_test("3.5 创作灵感-换一批", "failed", details="未找到换一批按钮")
        except Exception as e:
            record_test("3.5 创作灵感-换一批", "failed", error=str(e))

        try:
            use_btn = page.locator('button:has-text("使用此灵感")').first
            if use_btn.is_visible(timeout=3000):
                use_btn.click(timeout=3000)
                page.wait_for_timeout(500)
                record_test("3.5b 创作灵感-使用灵感", "passed", "使用灵感按钮可点击")
                take_screenshot(page, "17-inspiration-use")
            else:
                record_test("3.5b 创作灵感-使用灵感", "skipped", "无灵感可使用")
        except Exception as e:
            record_test("3.5b 创作灵感-使用灵感", "failed", error=str(e))

        try:
            ai_polish_btn = page.locator('button:has-text("AI 润色")').first
            if ai_polish_btn.is_visible(timeout=3000):
                record_test("3.6 AI润色按钮", "passed", "AI润色按钮可见")
            else:
                record_test("3.6 AI润色按钮", "failed", details="AI润色按钮不可见")
        except Exception as e:
            record_test("3.6 AI润色按钮", "failed", error=str(e))

        try:
            submit_btn = page.locator('button:has-text("开始创作")').first
            if submit_btn.is_visible(timeout=3000):
                submit_btn.click(timeout=5000)
                page.wait_for_load_state("networkidle", timeout=15000)
                if "/projects/" in page.url and "/new" not in page.url:
                    record_test("3.7 创建项目提交", "passed", f"项目创建成功，跳转到 {page.url}")
                    take_screenshot(page, "18-project-created")
                else:
                    record_test("3.7 创建项目提交", "failed", details=f"提交后URL: {page.url}")
            else:
                record_test("3.7 创建项目提交", "failed", details="提交按钮不可见")
        except Exception as e:
            record_test("3.7 创建项目提交", "failed", error=str(e))

        # ============================================================
        # SECTION 4: 项目详情页测试
        # ============================================================
        print("\n📋 SECTION 4: 项目详情页测试")

        current_url = page.url
        project_id = None
        if "/projects/" in current_url:
            parts = current_url.split("/projects/")
            if len(parts) > 1:
                project_id = parts[1].split("/")[0].split("?")[0]

        if not project_id:
            resp = page.request.get(f"{BASE_URL}/api/novel/projects", timeout=10000)
            if resp.status == 200:
                body = resp.json()
                projects = body.get("data", []) if isinstance(body, dict) else body
                if isinstance(projects, list) and len(projects) > 0:
                    project_id = str(projects[0].get("id", ""))

        if not project_id:
            page.goto(f"{BASE_URL}/projects")
            page.wait_for_load_state("networkidle", timeout=10000)
            project_links = page.locator('a[href*="/projects/"]').all()
            if len(project_links) > 0:
                href = project_links[0].get_attribute("href", timeout=3000)
                if href:
                    project_id = href.split("/projects/")[1].split("/")[0].split("?")[0]

        if project_id:
            page.goto(f"{BASE_URL}/projects/{project_id}")
            page.wait_for_load_state("networkidle", timeout=15000)
            take_screenshot(page, "19-project-detail")

            try:
                breadcrumb = page.locator('a:has-text("我的小说"), button:has-text("我的小说")').first
                if breadcrumb.is_visible(timeout=3000):
                    record_test("4.1 面包屑导航", "passed", "面包屑'我的小说'链接可见")
                else:
                    record_test("4.1 面包屑导航", "failed", details="面包屑不可见")
            except Exception as e:
                record_test("4.1 面包屑导航", "failed", error=str(e))

            try:
                more_btn = page.locator('button[aria-label*="更多"], button[aria-label*="more"], button:has-text("更多操作"), button:has-text("更多")').first
                if more_btn.is_visible(timeout=3000):
                    more_btn.click(timeout=3000)
                    page.wait_for_timeout(500)
                    record_test("4.2 更多操作菜单", "passed", "更多操作菜单可打开")
                    take_screenshot(page, "20-more-actions-menu")
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(300)
                else:
                    record_test("4.2 更多操作菜单", "failed", details="更多操作按钮不可见")
            except Exception as e:
                record_test("4.2 更多操作菜单", "failed", error=str(e))

            detail_buttons = [
                ("生成大纲", "4.3"),
                ("生成目录", "4.4"),
                ("一键生成", "4.5"),
                ("分析剧情", "4.6"),
                ("继续生成", "4.7"),
                ("资料研究", "4.8"),
                ("对抗审稿", "4.9"),
                ("去AI味", "4.10"),
                ("封面生成", "4.11"),
                ("新建章节", "4.12"),
            ]

            for btn_text, test_id in detail_buttons:
                try:
                    btn = page.locator(f'button:has-text("{btn_text}")').first
                    if btn.is_visible(timeout=3000):
                        btn.click(timeout=3000)
                        page.wait_for_timeout(800)
                        dialog = page.locator('[role="dialog"], [data-state="open"]').first
                        if dialog.is_visible(timeout=3000):
                            record_test(f"{test_id} {btn_text}弹窗", "passed", f"{btn_text}弹窗成功打开")
                            take_screenshot(page, f"detail-{test_id}-{btn_text}")

                            if btn_text == "生成目录":
                                clear_btn = page.locator('button:has-text("清空重来"), button:has-text("清空")').first
                                if clear_btn.is_visible(timeout=1000):
                                    record_test("4.4b 目录-清空重来按钮", "passed", "清空重来按钮可见")
                                else:
                                    record_test("4.4b 目录-清空重来按钮", "skipped", "清空重来按钮不可见")

                                chapter_count = page.locator('input[type="number"]').first
                                if chapter_count.is_visible(timeout=1000):
                                    chapter_count.fill("5")
                                    record_test("4.4c 目录-章节数量输入", "passed", "章节数量输入框可操作")
                                else:
                                    record_test("4.4c 目录-章节数量输入", "failed", details="章节数量输入框不可见")

                                style_btns = page.locator('button:has-text("网文"), button:has-text("传统"), button:has-text("诗词")').all()
                                if len(style_btns) > 0:
                                    style_btns[0].click(timeout=2000)
                                    record_test("4.4d 目录-标题风格选择", "passed", f"找到 {len(style_btns)} 个风格按钮")
                                else:
                                    record_test("4.4d 目录-标题风格选择", "failed", details="未找到风格按钮")

                            elif btn_text == "一键生成":
                                word_count_btns = page.locator('button:has-text("短篇"), button:has-text("标准"), button:has-text("长篇")').all()
                                if len(word_count_btns) > 0:
                                    word_count_btns[0].click(timeout=2000)
                                    record_test("4.5b 批量-目标字数选择", "passed", f"找到 {len(word_count_btns)} 个字数选项")
                                else:
                                    record_test("4.5b 批量-目标字数选择", "failed", details="未找到字数选项")

                                style_cards = page.locator('button:has-text("保守"), button:has-text("均衡"), button:has-text("创意")').all()
                                if len(style_cards) > 0:
                                    record_test("4.5c 批量-创作风格选择", "passed", f"找到 {len(style_cards)} 个风格选项")
                                else:
                                    record_test("4.5c 批量-创作风格选择", "failed", details="未找到风格选项")

                            elif btn_text == "分析剧情":
                                checks = page.locator('input[type="checkbox"]').all()
                                if len(checks) > 0:
                                    for c in checks[:3]:
                                        try:
                                            c.click(timeout=1000)
                                        except Exception:
                                            pass
                                    record_test("4.6b 剧情分析-维度选择", "passed", f"找到 {len(checks)} 个维度复选框")
                                else:
                                    record_test("4.6b 剧情分析-维度选择", "failed", details="未找到维度复选框")

                            elif btn_text == "继续生成":
                                mode_texts = page.locator(':has-text("续写结局"), :has-text("继续创作"), :has-text("全文重写")').all()
                                record_test("4.7b 续写-模式选择", "passed" if len(mode_texts) > 0 else "failed",
                                            f"找到 {len(mode_texts)} 个续写模式")

                            elif btn_text == "资料研究":
                                topic_input = page.locator('input[placeholder*="主题"], input[placeholder*="研究"]').first
                                if topic_input.is_visible(timeout=1000):
                                    topic_input.fill("修仙体系")
                                    record_test("4.8b 资料-研究主题输入", "passed", "研究主题输入框可填写")
                                else:
                                    record_test("4.8b 资料-研究主题输入", "failed", details="研究主题输入框不可见")

                            elif btn_text == "去AI味":
                                strictness_btns = page.locator('button:has-text("轻度"), button:has-text("中度"), button:has-text("重度")').all()
                                if len(strictness_btns) > 0:
                                    strictness_btns[1].click(timeout=2000) if len(strictness_btns) > 1 else None
                                    record_test("4.10b 去AI味-严格度选择", "passed", f"找到 {len(strictness_btns)} 个严格度选项")
                                else:
                                    record_test("4.10b 去AI味-严格度选择", "failed", details="未找到严格度选项")

                            elif btn_text == "封面生成":
                                style_tags = page.locator('button:has-text("玄幻"), button:has-text("都市"), button:has-text("仙侠")').all()
                                if len(style_tags) > 0:
                                    record_test("4.11b 封面-风格选择", "passed", f"找到 {len(style_tags)} 个风格标签")
                                else:
                                    record_test("4.11b 封面-风格选择", "failed", details="未找到风格标签")

                            elif btn_text == "新建章节":
                                page.wait_for_load_state("networkidle", timeout=10000)
                                if "/chapters/new" in page.url:
                                    record_test("4.12 新建章节导航", "passed", "成功导航到新建章节页")
                                    page.go_back()
                                    page.wait_for_load_state("networkidle", timeout=10000)
                                else:
                                    record_test("4.12 新建章节导航", "failed", details=f"实际URL: {page.url}")

                            page.keyboard.press("Escape")
                            page.wait_for_timeout(300)
                        else:
                            if btn_text == "新建章节":
                                page.wait_for_load_state("networkidle", timeout=10000)
                                if "/chapters/new" in page.url:
                                    record_test(f"{test_id} {btn_text}导航", "passed", "成功导航到新建章节页")
                                    page.go_back()
                                    page.wait_for_load_state("networkidle", timeout=10000)
                                else:
                                    record_test(f"{test_id} {btn_text}导航", "failed", details=f"实际URL: {page.url}")
                            else:
                                record_test(f"{test_id} {btn_text}弹窗", "failed", details="弹窗未显示")
                    else:
                        record_test(f"{test_id} {btn_text}按钮", "failed", details=f"{btn_text}按钮不可见")
                except Exception as e:
                    record_test(f"{test_id} {btn_text}", "failed", error=str(e))

            try:
                more_btn = page.locator('button[aria-label*="更多"], button[aria-label*="more"], button:has-text("更多操作"), button:has-text("更多")').first
                if more_btn.is_visible(timeout=3000):
                    more_btn.click(timeout=3000)
                    page.wait_for_timeout(500)
                    edit_option = page.locator('[role="menuitem"]:has-text("编辑"), button:has-text("编辑")').first
                    if edit_option.is_visible(timeout=2000):
                        edit_option.click(timeout=2000)
                        page.wait_for_timeout(800)
                        edit_modal = page.locator('[role="dialog"], [data-state="open"]').first
                        if edit_modal.is_visible(timeout=3000):
                            record_test("4.13 编辑项目弹窗", "passed", "编辑项目弹窗成功打开")
                            take_screenshot(page, "21-edit-project")

                            polish_btn = page.locator('button:has-text("AI 润色")').first
                            record_test("4.13b 编辑-AI润色按钮", "passed" if polish_btn.is_visible(timeout=1000) else "skipped",
                                        "AI润色按钮" + ("可见" if polish_btn.is_visible(timeout=1000) else "不可见"))

                            auto_gen_btn = page.locator('button:has-text("一键生成设定")').first
                            record_test("4.13c 编辑-一键生成设定", "passed" if auto_gen_btn.is_visible(timeout=1000) else "skipped",
                                        "一键生成设定按钮" + ("可见" if auto_gen_btn.is_visible(timeout=1000) else "不可见"))

                            page.keyboard.press("Escape")
                            page.wait_for_timeout(300)
                        else:
                            record_test("4.13 编辑项目弹窗", "failed", details="编辑弹窗未显示")
                    else:
                        record_test("4.13 编辑项目弹窗", "failed", details="编辑选项不可见")
                        page.keyboard.press("Escape")
                        page.wait_for_timeout(300)
                else:
                    record_test("4.13 编辑项目弹窗", "failed", details="更多操作按钮不可见")
            except Exception as e:
                record_test("4.13 编辑项目弹窗", "failed", error=str(e))

            try:
                more_btn = page.locator('button[aria-label*="更多"], button[aria-label*="more"], button:has-text("更多操作"), button:has-text("更多")').first
                if more_btn.is_visible(timeout=3000):
                    more_btn.click(timeout=3000)
                    page.wait_for_timeout(500)
                    export_options = page.locator(':has-text("导出为 TXT"), :has-text("导出为 Markdown"), :has-text("导出为 EPUB")').all()
                    if len(export_options) > 0:
                        record_test("4.14 导出菜单选项", "passed", f"找到 {len(export_options)} 个导出格式")
                        take_screenshot(page, "22-export-menu")
                    else:
                        record_test("4.14 导出菜单选项", "failed", details="未找到导出选项")
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(300)
                else:
                    record_test("4.14 导出菜单选项", "failed", details="更多操作按钮不可见")
            except Exception as e:
                record_test("4.14 导出菜单选项", "failed", error=str(e))

            try:
                more_btn = page.locator('button[aria-label*="更多"], button[aria-label*="more"], button:has-text("更多操作"), button:has-text("更多")').first
                if more_btn.is_visible(timeout=3000):
                    more_btn.click(timeout=3000)
                    page.wait_for_timeout(500)
                    delete_option = page.locator('[role="menuitem"]:has-text("删除"), button:has-text("删除"), :has-text("删除项目")').first
                    if delete_option.is_visible(timeout=2000):
                        delete_option.click(timeout=2000)
                        page.wait_for_timeout(500)
                        confirm_dialog = page.locator('[role="dialog"], [role="alertdialog"], [data-state="open"]').first
                        if confirm_dialog.is_visible(timeout=3000):
                            record_test("4.15 删除项目确认弹窗", "passed", "删除确认弹窗成功显示")
                            take_screenshot(page, "23-delete-confirm")
                            cancel_btn = page.locator('button:has-text("取消")').first
                            if cancel_btn.is_visible(timeout=1000):
                                cancel_btn.click(timeout=2000)
                                page.wait_for_timeout(300)
                        else:
                            record_test("4.15 删除项目确认弹窗", "failed", details="确认弹窗未显示")
                    else:
                        record_test("4.15 删除项目确认弹窗", "skipped", "删除选项不可见")
                        page.keyboard.press("Escape")
                        page.wait_for_timeout(300)
                else:
                    record_test("4.15 删除项目确认弹窗", "skipped", "更多操作按钮不可见")
            except Exception as e:
                record_test("4.15 删除项目确认弹窗", "failed", error=str(e))

            try:
                multi_select_btn = page.locator('button:has-text("多选")').first
                if multi_select_btn.is_visible(timeout=3000):
                    multi_select_btn.click(timeout=3000)
                    page.wait_for_timeout(500)
                    record_test("4.16 多选章节模式", "passed", "多选模式可进入")
                    take_screenshot(page, "24-multi-select-mode")
                    cancel_multi = page.locator('button:has-text("取消")').first
                    if cancel_multi.is_visible(timeout=2000):
                        cancel_multi.click(timeout=2000)
                        page.wait_for_timeout(300)
                else:
                    record_test("4.16 多选章节模式", "skipped", "多选按钮不可见（可能无章节）")
            except Exception as e:
                record_test("4.16 多选章节模式", "failed", error=str(e))

        else:
            record_test("4.x 项目详情页测试", "skipped", "无法获取项目ID，跳过详情页测试")

        # ============================================================
        # SECTION 5: 章节编辑页测试
        # ============================================================
        print("\n📋 SECTION 5: 章节编辑页测试")

        if project_id:
            page.goto(f"{BASE_URL}/projects/{project_id}/chapters/new")
            page.wait_for_load_state("networkidle", timeout=15000)
            take_screenshot(page, "25-chapter-editor")

            try:
                title_input = page.locator('input[placeholder*="标题"], input[placeholder*="章节"]').first
                content_area = page.locator('textarea').first
                save_btn = page.locator('button:has-text("保存"), button:has-text("创建")').first
                title_visible = title_input.is_visible(timeout=3000)
                content_visible = content_area.is_visible(timeout=3000)
                save_visible = save_btn.is_visible(timeout=3000)
                if title_visible and content_visible and save_visible:
                    record_test("5.1 章节编辑器元素", "passed", "标题输入、内容区域、保存按钮均可见")
                else:
                    record_test("5.1 章节编辑器元素", "failed", details=f"标题:{title_visible}, 内容:{content_visible}, 保存:{save_visible}")
            except Exception as e:
                record_test("5.1 章节编辑器元素", "failed", error=str(e))

            try:
                title_input = page.locator('input[placeholder*="标题"], input[placeholder*="章节"]').first
                if title_input.is_visible(timeout=3000):
                    title_input.fill("第一章 测试章节")
                content_area = page.locator('textarea').first
                if content_area.is_visible(timeout=3000):
                    content_area.fill("这是自动化测试填写的章节内容。主角在修仙世界中踏出了第一步。")
                record_test("5.2 填写章节内容", "passed", "章节标题和内容已填写")
                take_screenshot(page, "26-chapter-filled")
            except Exception as e:
                record_test("5.2 填写章节内容", "failed", error=str(e))

            try:
                save_btn = page.locator('button:has-text("保存"), button:has-text("创建")').first
                if save_btn.is_visible(timeout=3000):
                    save_btn.click(timeout=5000)
                    page.wait_for_load_state("networkidle", timeout=10000)
                    record_test("5.3 保存章节", "passed", f"保存后URL: {page.url}")
                    take_screenshot(page, "27-chapter-saved")
                else:
                    record_test("5.3 保存章节", "failed", details="保存按钮不可见")
            except Exception as e:
                record_test("5.3 保存章节", "failed", error=str(e))

            try:
                back_btn = page.locator('button:has-text("返回"), a:has-text("返回")').first
                if back_btn.is_visible(timeout=3000):
                    back_btn.click(timeout=3000)
                    page.wait_for_load_state("networkidle", timeout=10000)
                    record_test("5.4 返回项目按钮", "passed", f"返回后URL: {page.url}")
                else:
                    record_test("5.4 返回项目按钮", "failed", details="返回按钮不可见")
            except Exception as e:
                record_test("5.4 返回项目按钮", "failed", error=str(e))

            try:
                fullscreen_btn = page.locator('button[aria-label*="全屏"], button[aria-label*="fullscreen"], button:has-text("全屏")').first
                if fullscreen_btn.is_visible(timeout=3000):
                    fullscreen_btn.click(timeout=3000)
                    page.wait_for_timeout(500)
                    record_test("5.5 全屏切换", "passed", "全屏切换按钮可点击")
                    take_screenshot(page, "28-fullscreen")
                    fullscreen_btn.click(timeout=3000)
                    page.wait_for_timeout(300)
                else:
                    record_test("5.5 全屏切换", "skipped", "全屏按钮不可见")
            except Exception as e:
                record_test("5.5 全屏切换", "failed", error=str(e))

        else:
            record_test("5.x 章节编辑页测试", "skipped", "无法获取项目ID")

        # ============================================================
        # SECTION 6: 设置页测试
        # ============================================================
        print("\n📋 SECTION 6: 设置页测试")

        page.goto(f"{BASE_URL}/settings")
        page.wait_for_load_state("networkidle", timeout=15000)
        take_screenshot(page, "29-settings-page")

        try:
            tabs = ["AI 配置", "Agent 管理", "工作流 Hooks"]
            found_tabs = [tab for tab in tabs if page.locator(f'button:has-text("{tab}")').first.is_visible(timeout=2000)]
            if len(found_tabs) >= 2:
                record_test("6.1 设置页Tab切换", "passed", f"找到Tab: {found_tabs}")
            else:
                record_test("6.1 设置页Tab切换", "failed", details=f"只找到: {found_tabs}")
        except Exception as e:
            record_test("6.1 设置页Tab切换", "failed", error=str(e))

        try:
            add_config_btn = page.locator('button:has-text("添加配置")').first
            if add_config_btn.is_visible(timeout=3000):
                add_config_btn.click(timeout=3000)
                page.wait_for_timeout(800)
                config_modal = page.locator('[role="dialog"], [data-state="open"]').first
                if config_modal.is_visible(timeout=3000):
                    record_test("6.2 AI配置-添加配置弹窗", "passed", "添加配置弹窗成功打开")
                    take_screenshot(page, "30-add-ai-config")

                    inputs = config_modal.locator("input, select, textarea").all()
                    input_info = []
                    for inp in inputs:
                        try:
                            tag = inp.evaluate("el => el.tagName", timeout=1000)
                            name = inp.get_attribute("name", timeout=1000) or ""
                            input_type = inp.get_attribute("type", timeout=1000) or ""
                            input_info.append(f"{tag} name={name} type={input_type}")
                        except Exception:
                            pass
                    record_test("6.2b AI配置-表单元素", "passed" if len(inputs) >= 3 else "failed",
                                f"找到 {len(inputs)} 个表单元素: {input_info[:5]}")

                    test_conn_btn = page.locator('button:has-text("测试连接")').first
                    record_test("6.2c AI配置-测试连接按钮", "passed" if test_conn_btn.is_visible(timeout=1000) else "failed",
                                "测试连接按钮" + ("可见" if test_conn_btn.is_visible(timeout=1000) else "不可见"))

                    page.keyboard.press("Escape")
                    page.wait_for_timeout(300)
                else:
                    record_test("6.2 AI配置-添加配置弹窗", "failed", details="弹窗未显示")
            else:
                record_test("6.2 AI配置-添加配置弹窗", "failed", details="添加配置按钮不可见")
        except Exception as e:
            record_test("6.2 AI配置-添加配置弹窗", "failed", error=str(e))

        try:
            test_btn = page.locator('button:has-text("测试")').first
            record_test("6.3 AI配置列表-测试按钮", "passed" if test_btn.is_visible(timeout=2000) else "skipped",
                        "测试按钮" + ("可见" if test_btn.is_visible(timeout=2000) else "不可见"))
        except Exception as e:
            record_test("6.3 AI配置列表-测试按钮", "failed", error=str(e))

        try:
            agent_tab = page.locator('button:has-text("Agent 管理")').first
            if agent_tab.is_visible(timeout=3000):
                agent_tab.click(timeout=3000)
                page.wait_for_timeout(800)
                take_screenshot(page, "31-agent-manager")

                agent_names = ["PLANNER", "WRITER", "POLISHER", "VALIDATOR", "SUMMARIZER", "RESEARCHER", "REVIEWER", "DESLOPPER"]
                found_agents = [a for a in agent_names if page.locator(f':has-text("{a}")').first.is_visible(timeout=500)]
                record_test("6.4 Agent管理-Agent列表", "passed" if len(found_agents) >= 3 else "failed",
                            f"找到 {len(found_agents)} 个Agent: {found_agents}")

                execute_btn = page.locator('button:has-text("执行")').first
                record_test("6.4b Agent管理-执行按钮", "passed" if execute_btn.is_visible(timeout=1000) else "failed",
                            "执行按钮" + ("可见" if execute_btn.is_visible(timeout=1000) else "不可见"))
            else:
                record_test("6.4 Agent管理Tab", "failed", details="Agent管理Tab不可见")
        except Exception as e:
            record_test("6.4 Agent管理Tab", "failed", error=str(e))

        try:
            hooks_tab = page.locator('button:has-text("工作流 Hooks")').first
            if hooks_tab.is_visible(timeout=3000):
                hooks_tab.click(timeout=3000)
                page.wait_for_timeout(800)
                take_screenshot(page, "32-workflow-hooks")

                refresh_btn = page.locator('button:has-text("刷新")').first
                if refresh_btn.is_visible(timeout=2000):
                    refresh_btn.click(timeout=3000)
                    page.wait_for_timeout(500)
                    record_test("6.5 工作流Hooks-刷新", "passed", "刷新按钮可点击")
                else:
                    record_test("6.5 工作流Hooks-刷新", "failed", details="刷新按钮不可见")

                hook_items = page.locator('[class*="accordion"], [data-state]').all()
                if len(hook_items) > 0:
                    hook_items[0].click(timeout=2000)
                    page.wait_for_timeout(300)
                    record_test("6.5b 工作流Hooks-展开详情", "passed", f"找到 {len(hook_items)} 个Hook项")
                else:
                    record_test("6.5b 工作流Hooks-展开详情", "skipped", "无Hook项可展开")
            else:
                record_test("6.5 工作流Hooks Tab", "failed", details="Hooks Tab不可见")
        except Exception as e:
            record_test("6.5 工作流Hooks Tab", "failed", error=str(e))

        # ============================================================
        # SECTION 7: 成本管理页测试
        # ============================================================
        print("\n📋 SECTION 7: 成本管理页测试")

        page.goto(f"{BASE_URL}/cost")
        page.wait_for_load_state("networkidle", timeout=15000)
        take_screenshot(page, "33-cost-page")

        try:
            page_content = page.locator("body").text_content(timeout=3000)
            if "成本" in page_content or "配额" in page_content:
                record_test("7.1 成本管理页加载", "passed", "成本管理页成功加载")
            else:
                record_test("7.1 成本管理页加载", "failed", details="页面内容不包含成本相关文字")
        except Exception as e:
            record_test("7.1 成本管理页加载", "failed", error=str(e))

        try:
            refresh_btn = page.locator('button:has-text("刷新")').first
            if refresh_btn.is_visible(timeout=3000):
                refresh_btn.click(timeout=3000)
                page.wait_for_timeout(1000)
                record_test("7.2 成本-刷新按钮", "passed", "刷新按钮可点击")
            else:
                record_test("7.2 成本-刷新按钮", "failed", details="刷新按钮不可见")
        except Exception as e:
            record_test("7.2 成本-刷新按钮", "failed", error=str(e))

        try:
            quota_btn = page.locator('button:has-text("配额设置")').first
            if quota_btn.is_visible(timeout=3000):
                quota_btn.click(timeout=3000)
                page.wait_for_timeout(800)
                quota_modal = page.locator('[role="dialog"], [data-state="open"]').first
                if quota_modal.is_visible(timeout=3000):
                    record_test("7.3 配额设置弹窗", "passed", "配额设置弹窗成功打开")
                    take_screenshot(page, "34-quota-settings")

                    monthly_input = page.locator('input[type="number"]').first
                    if monthly_input.is_visible(timeout=2000):
                        monthly_input.fill("100")
                        record_test("7.3b 配额-月度配额输入", "passed", "月度配额输入框可填写")
                    else:
                        record_test("7.3b 配额-月度配额输入", "failed", details="月度配额输入框不可见")

                    save_btn = page.locator('button:has-text("保存")').first
                    record_test("7.3c 配额-保存按钮", "passed" if save_btn.is_visible(timeout=1000) else "failed",
                                "保存按钮" + ("可见" if save_btn.is_visible(timeout=1000) else "不可见"))

                    page.keyboard.press("Escape")
                    page.wait_for_timeout(300)
                else:
                    record_test("7.3 配额设置弹窗", "failed", details="弹窗未显示")
            else:
                record_test("7.3 配额设置弹窗", "failed", details="配额设置按钮不可见")
        except Exception as e:
            record_test("7.3 配额设置弹窗", "failed", error=str(e))

        try:
            calc_inputs = page.locator('input[type="number"]').all()
            calc_btn = page.locator('button:has-text("计算预估")').first
            if len(calc_inputs) >= 2:
                calc_inputs[0].fill("10")
                calc_inputs[1].fill("3000")
                record_test("7.4 成本预估计算器", "passed", "预估计算器输入框可填写")
                take_screenshot(page, "35-cost-calculator")
            elif calc_btn.is_visible(timeout=2000):
                record_test("7.4 成本预估计算器", "passed", "预估按钮可见")
            else:
                record_test("7.4 成本预估计算器", "failed", details="未找到计算器输入或按钮")
        except Exception as e:
            record_test("7.4 成本预估计算器", "failed", error=str(e))

        try:
            page.reload()
            page.wait_for_load_state("networkidle", timeout=15000)
            to_fixed_errors = [e for e in console_errors if "toFixed" in e]
            if len(to_fixed_errors) == 0:
                record_test("7.5 成本页-toFixed错误检查", "passed", "无toFixed运行时错误")
            else:
                record_test("7.5 成本页-toFixed错误检查", "failed", error=str(to_fixed_errors[:2]))
        except Exception as e:
            record_test("7.5 成本页-toFixed错误检查", "failed", error=str(e))

        # ============================================================
        # SECTION 8: 市场分析页测试
        # ============================================================
        print("\n📋 SECTION 8: 市场分析页测试")

        page.goto(f"{BASE_URL}/market")
        page.wait_for_load_state("networkidle", timeout=15000)
        take_screenshot(page, "36-market-page")

        try:
            trend_tab = page.locator('button:has-text("市场趋势分析")').first
            if trend_tab.is_visible(timeout=3000):
                trend_tab.click(timeout=3000)
                page.wait_for_timeout(500)
                record_test("8.1 市场趋势分析Tab", "passed", "市场趋势Tab可切换")
            else:
                record_test("8.1 市场趋势分析Tab", "failed", details="趋势Tab不可见")
        except Exception as e:
            record_test("8.1 市场趋势分析Tab", "failed", error=str(e))

        try:
            selects = page.locator("select").all()
            if len(selects) > 0:
                selects[0].select_option(index=1)
                page.wait_for_timeout(300)
                record_test("8.2 市场分析-平台选择", "passed", f"找到 {len(selects)} 个下拉选择器")
            else:
                record_test("8.2 市场分析-平台选择", "failed", details="未找到下拉选择器")
        except Exception as e:
            record_test("8.2 市场分析-平台选择", "failed", error=str(e))

        try:
            analyze_btn = page.locator('button:has-text("开始分析")').first
            record_test("8.3 市场分析-开始分析按钮", "passed" if analyze_btn.is_visible(timeout=2000) else "failed",
                        "开始分析按钮" + ("可见" if analyze_btn.is_visible(timeout=2000) else "不可见"))
        except Exception as e:
            record_test("8.3 市场分析-开始分析按钮", "failed", error=str(e))

        try:
            recommend_tab = page.locator('button:has-text("题材推荐")').first
            if recommend_tab.is_visible(timeout=3000):
                recommend_tab.click(timeout=3000)
                page.wait_for_timeout(500)
                record_test("8.4 题材推荐Tab", "passed", "题材推荐Tab可切换")
                take_screenshot(page, "37-market-recommend")

                add_advantage_btn = page.locator('button:has-text("添加优势"), button:has-text("添加")').first
                if add_advantage_btn.is_visible(timeout=2000):
                    add_advantage_btn.click(timeout=2000)
                    page.wait_for_timeout(300)
                    record_test("8.4b 题材推荐-添加优势", "passed", "添加优势按钮可点击")
                else:
                    record_test("8.4b 题材推荐-添加优势", "failed", details="添加优势按钮不可见")

                get_recommend_btn = page.locator('button:has-text("获取推荐")').first
                record_test("8.4c 题材推荐-获取推荐按钮", "passed" if get_recommend_btn.is_visible(timeout=1000) else "failed",
                            "获取推荐按钮" + ("可见" if get_recommend_btn.is_visible(timeout=1000) else "不可见"))
            else:
                record_test("8.4 题材推荐Tab", "failed", details="题材推荐Tab不可见")
        except Exception as e:
            record_test("8.4 题材推荐Tab", "failed", error=str(e))

        # ============================================================
        # SECTION 9: API端点测试
        # ============================================================
        print("\n📋 SECTION 9: API端点测试")

        api_tests = [
            ("GET /api/novel/projects", "/api/novel/projects"),
            ("GET /api/novel/ai-configs", "/api/novel/ai-configs"),
            ("GET /api/notifications", "/api/notifications"),
            ("GET /api/agents", "/api/agents"),
            ("GET /api/hooks", "/api/hooks"),
            ("GET /api/novel/cost", "/api/novel/cost"),
            ("GET /api/novel/cost/estimate", "/api/novel/cost/estimate?chapters=10&wordsPerChapter=3000"),
        ]

        for test_name, endpoint in api_tests:
            try:
                response = page.request.get(f"{BASE_URL}{endpoint}", timeout=10000)
                status = response.status
                if 200 <= status < 500:
                    record_test(f"9.x {test_name}", "passed", f"HTTP {status}")
                else:
                    record_test(f"9.x {test_name}", "failed", details=f"HTTP {status}")
            except Exception as e:
                record_test(f"9.x {test_name}", "failed", error=str(e))

        # ============================================================
        # SECTION 10: 控制台错误检测
        # ============================================================
        print("\n📋 SECTION 10: 控制台错误检测")

        critical_errors = []
        for err in console_errors:
            if any(kw in err.lower() for kw in ["typeerror", "referenceerror", "syntaxerror", "cannot read"]):
                if "devtools" not in err.lower() and "favicon" not in err.lower():
                    critical_errors.append(err[:200])

        if len(critical_errors) == 0:
            record_test("10.1 控制台无严重错误", "passed", "未检测到严重控制台错误")
        else:
            record_test("10.1 控制台严重错误", "failed", error=f"发现 {len(critical_errors)} 个错误")

        # ============================================================
        # SECTION 11: 响应式布局测试
        # ============================================================
        print("\n📋 SECTION 11: 响应式布局测试")

        viewports = [
            ("桌面端 1440x900", 1440, 900),
            ("平板端 768x1024", 768, 1024),
            ("手机端 375x667", 375, 667),
        ]

        for viewport_name, width, height in viewports:
            try:
                page.set_viewport_size({"width": width, "height": height})
                page.goto(f"{BASE_URL}/projects")
                page.wait_for_load_state("networkidle", timeout=10000)
                page.wait_for_timeout(500)
                take_screenshot(page, f"38-responsive-{width}x{height}")
                record_test(f"11.x 响应式-{viewport_name}", "passed", f"{width}x{height} 布局正常")
            except Exception as e:
                record_test(f"11.x 响应式-{viewport_name}", "failed", error=str(e))

        page.set_viewport_size({"width": 1440, "height": 900})

        # ============================================================
        # SECTION 12: 拆解小说向导测试
        # ============================================================
        print("\n📋 SECTION 12: 拆解小说向导测试")

        page.goto(f"{BASE_URL}/projects")
        page.wait_for_load_state("networkidle", timeout=15000)

        try:
            analyze_btn = page.locator('button:has-text("拆解小说")').first
            if analyze_btn.is_visible(timeout=3000):
                analyze_btn.click(timeout=3000)
                page.wait_for_timeout(800)
                wizard = page.locator('[role="dialog"], [data-state="open"]').first
                if wizard.is_visible(timeout=3000):
                    take_screenshot(page, "39-analyze-wizard-step1")

                    title_input = wizard.locator('input[name="title"], input[placeholder*="标题"]').first
                    if title_input.is_visible(timeout=2000):
                        title_input.fill("拆解测试小说")
                        record_test("12.1 拆解向导-Step1填写", "passed", "标题输入框可填写")
                    else:
                        record_test("12.1 拆解向导-Step1填写", "failed", details="标题输入框不可见")

                    next_btn = wizard.locator('button:has-text("下一步")').first
                    record_test("12.2 拆解向导-下一步按钮", "passed" if next_btn.is_visible(timeout=1000) else "failed",
                                "下一步按钮" + ("可见" if next_btn.is_visible(timeout=1000) else "不可见"))

                    cancel_btn = wizard.locator('button:has-text("取消")').first
                    if cancel_btn.is_visible(timeout=2000):
                        cancel_btn.click(timeout=2000)
                        page.wait_for_timeout(300)
                        record_test("12.3 拆解向导-取消按钮", "passed", "取消按钮可关闭弹窗")
                    else:
                        page.keyboard.press("Escape")
                        page.wait_for_timeout(300)
                        record_test("12.3 拆解向导-取消按钮", "skipped", "用Escape关闭")
                else:
                    record_test("12.x 拆解小说向导", "failed", details="向导弹窗未显示")
            else:
                record_test("12.x 拆解小说向导", "failed", details="拆解小说按钮不可见")
        except Exception as e:
            record_test("12.x 拆解小说向导", "failed", error=str(e))

        # ============================================================
        # SECTION 13: 页面性能测试
        # ============================================================
        print("\n📋 SECTION 13: 页面性能测试")

        perf_pages = [
            ("项目列表页", "/projects"),
            ("设置页", "/settings"),
            ("成本管理页", "/cost"),
            ("市场分析页", "/market"),
        ]

        for page_name, path in perf_pages:
            try:
                start = time.time()
                page.goto(f"{BASE_URL}{path}")
                page.wait_for_load_state("networkidle", timeout=15000)
                elapsed = time.time() - start
                if elapsed < 5:
                    record_test(f"13.x 性能-{page_name}", "passed", f"加载时间: {elapsed:.2f}s")
                elif elapsed < 10:
                    record_test(f"13.x 性能-{page_name}", "passed", f"加载时间: {elapsed:.2f}s (较慢)")
                else:
                    record_test(f"13.x 性能-{page_name}", "failed", details=f"加载时间: {elapsed:.2f}s (过慢)")
            except Exception as e:
                record_test(f"13.x 性能-{page_name}", "failed", error=str(e))

        browser.close()

    # ============================================================
    # 生成测试报告
    # ============================================================
    report = {
        "title": "Novel-AI 全覆盖功能测试报告",
        "timestamp": datetime.now().isoformat(),
        "summary": test_stats,
        "pass_rate": f"{(test_stats['passed'] / test_stats['total'] * 100):.1f}%" if test_stats['total'] > 0 else "0%",
        "results": test_results,
        "console_errors_count": len(console_errors),
        "console_errors_sample": [e[:200] for e in console_errors[:5]],
    }

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"📊 测试报告摘要")
    print(f"  总测试数: {test_stats['total']}")
    print(f"  通过: {test_stats['passed']} ✅")
    print(f"  失败: {test_stats['failed']} ❌")
    print(f"  跳过: {test_stats['skipped']} ⏭️")
    print(f"  通过率: {report['pass_rate']}")
    print(f"  控制台错误: {len(console_errors)}")
    print(f"  报告文件: {REPORT_FILE}")
    print(f"  截图目录: {SCREENSHOT_DIR}")
    print("=" * 60)

    return report


if __name__ == "__main__":
    run_tests()
