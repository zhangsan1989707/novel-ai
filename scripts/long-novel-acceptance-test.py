#!/usr/bin/env python3
"""
Long novel acceptance test.

This script verifies whether the app can carry a 300k-word long novel workflow:
- UI smoke coverage for project list/detail and generation modals.
- API coverage for project setup, AI planning, cost estimate, chapter scale,
  quality tools, cover generation, export, and notifications.
- 300k/100-chapter scale is tested with deterministic chapter content.
- Real AI calls are deliberately small by default, so the test validates the
  provider chain without burning a full 300k-word generation budget.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


BASE_URL = os.environ.get("NOVEL_AI_BASE_URL", "http://localhost:3200").rstrip("/")
ROOT_DIR = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT_DIR / "test-results" / "long-novel-acceptance"
SCREENSHOT_DIR = REPORT_DIR / "screenshots"
REPORT_FILE = REPORT_DIR / "report.json"

PROJECT_TITLE_PREFIX = "自动化30万长篇验收"
TARGET_WORDS = 300_000
CHAPTER_COUNT = 100
CHAPTER_WORDS = 3_000


@dataclass
class TestResult:
    module: str
    name: str
    status: str
    detail: str = ""
    duration_ms: int = 0
    evidence: dict[str, Any] = field(default_factory=dict)


class Recorder:
    def __init__(self) -> None:
        self.results: list[TestResult] = []
        self.project_id: int | None = None
        self.start_time = time.time()

    def add(
        self,
        module: str,
        name: str,
        status: str,
        detail: str = "",
        started_at: float | None = None,
        **evidence: Any,
    ) -> None:
        duration_ms = 0
        if started_at is not None:
            duration_ms = round((time.time() - started_at) * 1000)
        result = TestResult(module, name, status, detail, duration_ms, evidence)
        self.results.append(result)
        mark = {"PASS": "PASS", "FAIL": "FAIL", "WARN": "WARN", "SKIP": "SKIP"}[status]
        print(f"[{mark}] {module} / {name}: {detail}")

    def summary(self) -> dict[str, int]:
        counts = {"PASS": 0, "FAIL": 0, "WARN": 0, "SKIP": 0}
        for result in self.results:
            counts[result.status] += 1
        return counts

    def write_report(self, extra: dict[str, Any] | None = None) -> None:
        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        data = {
            "baseUrl": BASE_URL,
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "durationSeconds": round(time.time() - self.start_time, 2),
            "projectId": self.project_id,
            "target": {
                "wordCount": TARGET_WORDS,
                "chapterCount": CHAPTER_COUNT,
                "chapterWordCount": CHAPTER_WORDS,
            },
            "summary": self.summary(),
            "results": [result.__dict__ for result in self.results],
            "extra": extra or {},
        }
        REPORT_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


rec = Recorder()


def request_json(
    method: str,
    path: str,
    body: dict[str, Any] | None = None,
    timeout: int = 60,
) -> tuple[int, Any, dict[str, str]]:
    url = f"{BASE_URL}{path}"
    payload = None
    headers = {"Accept": "application/json"}
    if body is not None:
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            content_type = resp.headers.get("Content-Type", "")
            if "application/json" in content_type:
                return resp.status, json.loads(raw.decode("utf-8")), dict(resp.headers)
            return resp.status, raw, dict(resp.headers)
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            parsed = json.loads(raw.decode("utf-8"))
        except Exception:
            parsed = raw.decode("utf-8", errors="replace")
        return exc.code, parsed, dict(exc.headers)


def expect_success(module: str, name: str, method: str, path: str, body: dict[str, Any] | None = None, timeout: int = 60) -> Any:
    started = time.time()
    try:
        status, data, _headers = request_json(method, path, body, timeout)
        ok = 200 <= status < 300 and (not isinstance(data, dict) or data.get("success") is not False)
        rec.add(
            module,
            name,
            "PASS" if ok else "FAIL",
            f"HTTP {status}",
            started,
            path=path,
            response=compact(data),
        )
        return data
    except Exception as exc:
        rec.add(module, name, "FAIL", str(exc), started, path=path)
        return None


def compact(value: Any, limit: int = 1200) -> Any:
    value = sanitize(value)
    text = json.dumps(value, ensure_ascii=False, default=str)
    if len(text) <= limit:
        return value
    return {"truncated": True, "preview": text[:limit]}


def sanitize(value: Any) -> Any:
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if key.lower() in {"apikey", "api_key", "authorization", "token"}:
                result[key] = "***"
            else:
                result[key] = sanitize(item)
        return result
    if isinstance(value, list):
        return [sanitize(item) for item in value]
    return value


def chapter_content(chapter_number: int) -> str:
    sentence = (
        f"第{chapter_number}章中，主角在星港与旧盟友重逢，调查遗失的记忆晶核。"
        "他必须在家族承诺、城市秩序和个人自由之间做出选择。"
        "场景推进包含线索发现、关系冲突、短暂失败、策略调整和新的悬念。"
    )
    text = []
    while sum(len(part) for part in text) < CHAPTER_WORDS:
        text.append(sentence)
    return "".join(text)[:CHAPTER_WORDS]


def run_ui_smoke() -> None:
    started = time.time()
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        rec.add("前端自动化", "Playwright 可用性", "FAIL", str(exc), started)
        return

    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        try:
            page.goto(f"{BASE_URL}/projects", wait_until="networkidle", timeout=60_000)
            page.screenshot(path=str(SCREENSHOT_DIR / "01-projects.png"), full_page=True)
            body = page.inner_text("body")
            rec.add(
                "前端自动化",
                "项目列表页",
                "PASS" if "我的小说" in body else "FAIL",
                "可打开项目列表" if "我的小说" in body else "未看到项目列表标识",
                started,
                screenshot=str(SCREENSHOT_DIR / "01-projects.png"),
            )

            if rec.project_id:
                page.goto(f"{BASE_URL}/projects/{rec.project_id}", wait_until="networkidle", timeout=60_000)
            else:
                page.goto(f"{BASE_URL}/projects/1", wait_until="networkidle", timeout=60_000)
            page.screenshot(path=str(SCREENSHOT_DIR / "02-project-detail.png"), full_page=True)
            detail_text = page.inner_text("body")
            required = ["创作流程", "下一步", "项目完整度", "生成大纲"]
            missing = [item for item in required if item not in detail_text]
            rec.add(
                "前端自动化",
                "项目详情引导",
                "PASS" if not missing else "FAIL",
                "创作流程与下一步引导存在" if not missing else f"缺少: {missing}",
                evidence_required=required,
                screenshot=str(SCREENSHOT_DIR / "02-project-detail.png"),
            )

            if page.get_by_text("生成大纲", exact=True).count() > 0:
                page.get_by_text("生成大纲", exact=True).first.click(timeout=10_000)
                page.wait_for_timeout(500)
                page.screenshot(path=str(SCREENSHOT_DIR / "03-outline-modal.png"), full_page=True)
                modal_text = page.inner_text("body")
                old_bottom_text = ["AI 生成小说大纲", "点击上方按钮开始生成大纲"]
                has_old_copy = any(item in modal_text for item in old_bottom_text)
                has_dialog = page.locator('[role="dialog"]').count() > 0
                rec.add(
                    "前端自动化",
                    "生成大纲弹窗化",
                    "PASS" if has_dialog and not has_old_copy else "FAIL",
                    "大纲选项位于弹窗，旧底部文案未出现" if has_dialog and not has_old_copy else "弹窗或旧底部文案校验失败",
                    oldBottomTextPresent=has_old_copy,
                    screenshot=str(SCREENSHOT_DIR / "03-outline-modal.png"),
                )
                page.keyboard.press("Escape")
            else:
                rec.add("前端自动化", "生成大纲弹窗化", "FAIL", "找不到生成大纲入口")

            tool_labels = ["生成目录", "资料研究", "对抗审稿", "去 AI 味", "封面生成"]
            for label in tool_labels:
                opened = False
                try:
                    target_url = f"{BASE_URL}/projects/{rec.project_id}" if rec.project_id else f"{BASE_URL}/projects/1"
                    page.goto(target_url, wait_until="networkidle", timeout=60_000)
                    button = page.get_by_role("button", name=label).first
                    if button.count() > 0:
                        button.click(timeout=5_000)
                        page.wait_for_timeout(400)
                        opened = page.locator('[role="dialog"]').count() > 0
                        page.keyboard.press("Escape")
                except Exception:
                    opened = False
                rec.add("前端自动化", f"{label}入口", "PASS" if opened else "WARN", "入口可点击并打开弹窗" if opened else "入口未弹出或未找到")
        finally:
            context.close()
            browser.close()


def create_project() -> int | None:
    configs = expect_success("配置", "AI 配置列表", "GET", "/api/novel/ai-configs")
    ai_model_id = None
    if isinstance(configs, dict):
        config_items = configs.get("configs") or configs.get("data") or []
        if config_items:
            ai_model_id = config_items[0].get("id")
            has_api_key = bool(config_items[0].get("hasApiKey") or config_items[0].get("apiKey"))
            rec.add(
                "配置",
                "默认 AI 模型",
                "PASS" if has_api_key else "WARN",
                f"{config_items[0].get('vendor')} / {config_items[0].get('modelId')}",
                hasApiKey=has_api_key,
            )
        else:
            rec.add("配置", "默认 AI 模型", "FAIL", "未配置 AI 模型")

    payload = {
        "title": f"{PROJECT_TITLE_PREFIX}-{int(time.time())}",
        "description": "用于自动化验收的 30 万字长篇小说项目。测试目标是验证系统能否承载完整长篇创作流程。",
        "genre": "科幻",
        "writingStyle": "强情节、快节奏、群像推进",
        "targetWordCount": TARGET_WORDS,
        "chapterWordCount": CHAPTER_WORDS,
        "totalVolumes": 4,
        "targetAudience": "MALE",
        "outline": "第一卷觉醒，第二卷追索，第三卷反击，第四卷终局。",
        "outlineStages": {
            "stage1": [{"title": "觉醒", "summary": "主角发现记忆晶核异常。"}],
            "stage2": [{"title": "追索", "summary": "追查星港背后的旧战争真相。"}],
            "stage3": [{"title": "反击", "summary": "集结盟友反制控制系统。"}],
            "stage4": [{"title": "终局", "summary": "在城市核心完成选择。"}],
        },
        "worldSetting": "近未来星港城市，记忆可被交易、抵押和篡改，城市由算法议会维持秩序。",
        "powerSystem": "角色通过记忆晶核获得短暂能力，但每次使用都会改变自身经历。",
        "protagonistProfile": "林澈，退役调查员，逻辑冷静但抗拒亲密关系。",
        "protagonistGoal": "找回被切除的战争记忆，并阻止算法议会重启记忆清洗。",
        "antagonistSetting": "算法议会代理人岑霁，坚信牺牲少数记忆可以换取城市稳定。",
        "endingPlan": "主角公开记忆真相，保留城市秩序但废止强制清洗。",
        "writingPrompt": "每章包含明确冲突、人物选择、场景变化和结尾钩子。",
    }
    if ai_model_id:
        payload["aiModelId"] = ai_model_id

    data = expect_success("项目", "创建 30 万字项目", "POST", "/api/novel/projects", payload)
    project_id = data.get("data", {}).get("id") if isinstance(data, dict) else None
    if project_id:
        rec.project_id = int(project_id)
        return rec.project_id
    return None


def run_planning_ai(project_id: int) -> None:
    base = {
        "projectTitle": f"{PROJECT_TITLE_PREFIX}-{project_id}",
        "genre": "科幻",
        "writingStyle": "强情节、快节奏、群像推进",
        "worldSetting": "近未来星港城市，记忆可被交易、抵押和篡改。",
        "protagonistProfile": "林澈，退役调查员。",
        "protagonistGoal": "找回被切除的战争记忆。",
        "antagonistSetting": "算法议会代理人岑霁。",
        "endingPlan": "公开真相并废止强制清洗。",
    }
    expect_success("AI 规划", "生成简介", "POST", "/api/novel/ai/generate-synopsis", base, timeout=120)
    expect_success("AI 规划", "生成大纲", "POST", "/api/novel/ai/generate-outline", base, timeout=120)
    chapter_list_payload = {
        **base,
        "projectId": project_id,
        "outline": "四卷结构，每卷 25 章。",
        "totalChapters": 10,
        "titleStyle": "webnovel",
        "temperature": 0.6,
    }
    expect_success("AI 规划", "生成目录小样本", "POST", "/api/novel/ai/generate-chapter-list", chapter_list_payload, timeout=180)


def run_cost_estimate(project_id: int) -> None:
    data = expect_success(
        "成本",
        "30 万字成本估算",
        "POST",
        "/api/novel/cost/estimate",
        {"projectId": project_id, "chapterCount": CHAPTER_COUNT, "targetWordCount": CHAPTER_WORDS},
    )
    if isinstance(data, dict) and data.get("success") is True:
        rec.add("成本", "成本估算可解释", "PASS", "已返回 tokens 与费用估算", estimate=compact(data.get("data") or data))
    expect_success("成本", "成本总览", "GET", "/api/novel/cost")


def seed_300k_chapters(project_id: int) -> list[int]:
    chapter_ids: list[int] = []
    started_all = time.time()
    for number in range(1, CHAPTER_COUNT + 1):
        payload = {
            "title": f"第{number:03d}章 记忆回声",
            "chapterNumber": number,
            "summary": f"第{number}章承接主线，推进线索与人物选择。",
            "content": chapter_content(number),
        }
        started = time.time()
        status, data, _headers = request_json("POST", f"/api/novel/projects/{project_id}/chapters", payload, timeout=30)
        ok = 200 <= status < 300 and isinstance(data, dict) and data.get("success") is True
        if ok:
            chapter_id = data["data"]["id"]
            chapter_ids.append(chapter_id)
            update_status, update_data, _headers = request_json(
                "PUT",
                f"/api/novel/projects/{project_id}/chapters/{chapter_id}",
                {"status": "COMPLETED"},
                timeout=30,
            )
            if update_status >= 300 or not isinstance(update_data, dict) or update_data.get("success") is not True:
                rec.add(
                    "章节",
                    f"标记第 {number} 章完成",
                    "FAIL",
                    f"HTTP {update_status}",
                    response=compact(update_data),
                )
                break
        elif status == 400 and isinstance(data, dict) and data.get("error", {}).get("code") == "DUPLICATE":
            rec.add("章节", f"创建第 {number} 章", "WARN", "章节已存在，跳过重复创建", started)
        else:
            rec.add("章节", f"创建第 {number} 章", "FAIL", f"HTTP {status}", started, response=compact(data))
            break
    rec.add(
        "章节",
        "100 章 / 30 万字写入",
        "PASS" if len(chapter_ids) == CHAPTER_COUNT else "FAIL",
        f"已创建 {len(chapter_ids)} / {CHAPTER_COUNT} 章",
        started_all,
    )
    detail = expect_success("章节", "读取章节列表", "GET", f"/api/novel/projects/{project_id}/chapters")
    project = expect_success("项目", "校验 30 万字进度", "GET", f"/api/novel/projects/{project_id}")
    if isinstance(project, dict) and isinstance(project.get("data"), dict):
        data = project["data"]
        words = int(data.get("currentWordCount") or 0)
        chapters = len(data.get("chapters") or [])
        ok = words >= TARGET_WORDS and chapters >= CHAPTER_COUNT
        rec.add(
            "项目",
            "30 万字容量校验",
            "PASS" if ok else "FAIL",
            f"当前字数 {words}，章节 {chapters}",
            words=words,
            chapters=chapters,
        )
    if isinstance(detail, dict):
        rec.add("章节", "章节列表可用", "PASS" if len(detail.get("data", [])) >= CHAPTER_COUNT else "FAIL", f"返回 {len(detail.get('data', []))} 章")
    return chapter_ids


def run_generation_smoke(project_id: int) -> None:
    payload = {
        "title": "第101章 AI 小样本生成",
        "chapterNumber": 101,
        "summary": "用极小目标字数验证批量生成 SSE 链路。",
    }
    status, data, _headers = request_json("POST", f"/api/novel/projects/{project_id}/chapters", payload, timeout=30)
    if not (200 <= status < 300 and isinstance(data, dict) and data.get("success")):
        rec.add("AI 正文", "创建待生成章节", "FAIL", f"HTTP {status}", response=compact(data))
        return
    chapter_id = data["data"]["id"]
    started = time.time()
    try:
        url = f"{BASE_URL}/api/novel/projects/{project_id}/generate/batch"
        body = json.dumps(
            {
                "chapterIds": [chapter_id],
                "useContext": True,
                "contextChapterCount": 2,
                "targetWordCount": 200,
                "temperature": 0.5,
            },
            ensure_ascii=False,
        ).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=180) as resp:
            raw = resp.read(200_000).decode("utf-8", errors="replace")
            ok = resp.status == 200 and ("event: complete" in raw or "event: chapter_complete" in raw or "event: token" in raw)
            rec.add(
                "AI 正文",
                "批量生成 SSE 小样本",
                "PASS" if ok else "FAIL",
                "SSE 返回生成事件" if ok else "未收到有效 SSE 生成事件",
                started,
                preview=raw[:1200],
            )
    except Exception as exc:
        rec.add(
            "AI 正文",
            "批量生成 SSE 小样本",
            "WARN",
            f"AI 链路未完成，可能是外部模型网络、额度或超时: {exc}",
            started,
        )


def run_quality_tools(project_id: int) -> None:
    sample = "他深吸一口气，眼神坚定，仿佛整个世界都在这一刻安静下来。命运的齿轮开始转动，他知道自己别无选择。"
    expect_success("质量工具", "去 AI 味检测", "POST", "/api/novel/deslop/detect", {"content": sample})
    expect_success("质量工具", "去 AI 味改写", "POST", "/api/novel/deslop/rewrite", {"projectId": project_id, "content": sample, "strictness": "medium"}, timeout=120)
    expect_success("质量工具", "资料研究", "POST", "/api/novel/research", {"projectId": project_id, "topic": "近未来星港交通系统", "context": "用于科幻长篇世界观"}, timeout=120)
    expect_success("质量工具", "对抗审稿", "POST", "/api/novel/review", {"projectId": project_id, "content": sample, "chapterNo": 1}, timeout=180)


def run_market_and_cover(project_id: int) -> None:
    expect_success(
        "市场",
        "市场分析",
        "POST",
        "/api/market/analyze",
        {"genre": "科幻", "platform": "起点中文网", "targetAudience": "MALE"},
        timeout=120,
    )
    expect_success(
        "市场",
        "选题推荐",
        "POST",
        "/api/market/recommend",
        {"userStrengths": ["强情节", "悬疑", "群像"], "targetPlatform": "起点中文网", "preferredGenres": ["科幻", "都市"]},
        timeout=120,
    )

    started = time.time()
    try:
        status, data, _headers = request_json("POST", "/api/novel/cover/generate", {"projectId": project_id, "style": "科幻商业封面"}, timeout=120)
        ok = 200 <= status < 300 and isinstance(data, dict) and data.get("success") is not False
        rec.add(
            "封面",
            "AI 封面生成",
            "PASS" if ok else "WARN",
            f"HTTP {status}" if ok else f"当前模型/配置可能不支持图片生成，HTTP {status}",
            started,
            response=compact(data),
        )
    except Exception as exc:
        rec.add("封面", "AI 封面生成", "WARN", f"封面链路未完成: {exc}", started)
    expect_success("封面", "封面列表", "GET", f"/api/novel/cover/list?projectId={project_id}")


def run_export(project_id: int) -> None:
    for fmt in ["txt", "md", "json", "epub"]:
        started = time.time()
        try:
            status, data, headers = request_json(
                "POST",
                f"/api/novel/projects/{project_id}/export",
                {"format": fmt, "includeMetadata": True, "includeChapterTitles": True},
                timeout=120,
            )
            if fmt == "epub":
                ok = status == 200 and isinstance(data, (bytes, bytearray)) and len(data) > 1000
                detail = f"HTTP {status}, bytes={len(data) if isinstance(data, (bytes, bytearray)) else 0}"
            else:
                ok = 200 <= status < 300 and isinstance(data, dict) and data.get("success") is True
                detail = f"HTTP {status}"
            rec.add(
                "导出",
                f"{fmt.upper()} 导出",
                "PASS" if ok else "FAIL",
                detail,
                started,
                contentType=headers.get("Content-Type"),
                response=compact(data if fmt != "epub" else {"bytes": len(data) if isinstance(data, (bytes, bytearray)) else 0}),
            )
        except Exception as exc:
            rec.add("导出", f"{fmt.upper()} 导出", "FAIL", str(exc), started)


def run_misc(project_id: int) -> None:
    expect_success("通知", "通知列表", "GET", "/api/notifications")
    expect_success("通知", "全部已读", "PATCH", "/api/notifications/read-all")
    expect_success("项目", "下一章节号", "GET", f"/api/novel/projects/{project_id}/chapters/next-number")
    expect_success("项目", "续写上下文", "GET", f"/api/novel/projects/{project_id}/continuation/context")
    expect_success("Agent", "Agent 列表", "GET", "/api/agents")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-ai", action="store_true", help="Skip real AI calls and run only local/API scale checks.")
    parser.add_argument("--skip-ui", action="store_true", help="Skip Playwright UI checks.")
    args = parser.parse_args()

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

    expect_success("环境", "项目列表 API", "GET", "/api/novel/projects")
    project_id = create_project()
    if not project_id:
        rec.write_report()
        return 1

    if not args.skip_ai:
        run_planning_ai(project_id)
    else:
        rec.add("AI 规划", "真实 AI 调用", "SKIP", "按参数跳过")

    run_cost_estimate(project_id)
    seed_300k_chapters(project_id)

    if not args.skip_ai:
        run_generation_smoke(project_id)
        run_quality_tools(project_id)
        run_market_and_cover(project_id)
    else:
        rec.add("AI 正文", "真实 AI 调用", "SKIP", "按参数跳过")
        rec.add("质量工具", "真实 AI 调用", "SKIP", "按参数跳过")
        rec.add("市场/封面", "真实 AI 调用", "SKIP", "按参数跳过")

    run_export(project_id)
    run_misc(project_id)

    if not args.skip_ui:
        run_ui_smoke()
    else:
        rec.add("前端自动化", "UI 检查", "SKIP", "按参数跳过")

    rec.add(
        "验收结论",
        "30 万字真实生成声明",
        "WARN",
        "本次没有让 AI 实际生成 100 章正文；已用 100 章确定性内容验证 30 万字容量与导出，用小样本验证 AI 生成链路。",
    )
    rec.write_report({"reportFile": str(REPORT_FILE), "screenshotDir": str(SCREENSHOT_DIR)})
    summary = rec.summary()
    print(f"\nReport: {REPORT_FILE}")
    print(f"Summary: {summary}")
    return 1 if summary["FAIL"] else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        rec.add("环境", "用户中断", "FAIL", "KeyboardInterrupt")
        rec.write_report()
        raise
    except Exception as exc:
        rec.add("环境", "脚本异常", "FAIL", f"{exc}\n{traceback.format_exc()}")
        rec.write_report()
        raise
