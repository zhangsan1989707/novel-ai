import { createProviderFromDefaultConfig } from '@/lib/ai/factory'
import { enhanceInspirations, type HotInspiration, type InspirationCategory } from './data'

// ============================================
// 随机素材库
// ============================================

const GENRES_MALE = ['玄幻', '都市', '科幻', '仙侠', '历史', '游戏', '末世', '悬疑', '武侠', '奇幻']
const GENRES_FEMALE = ['言情', '古言', '都市', '仙侠', '科幻', '娱乐圈', '悬疑', '奇幻', '年代文', '校园']
const GENRES_UNISEX = ['都市', '科幻', '悬疑', '奇幻', '历史', '游戏', '轻小说', '末世']

const STYLES = [
  '快节奏爽文', '慢热升级', '权谋智斗', '甜宠日常', '暗黑写实',
  '热血激昂', '轻松幽默', '悬疑烧脑', '细腻温情', '史诗宏大',
  '沙雕搞笑', '虐恋情深', '种田经商', '逆袭打脸',
]

const ELEMENTS_MALE = [
  '系统流', '重生', '穿越', '金手指', '无敌流', '幕后黑手',
  '多女主', '单女主', '签到', '模拟器', '无限流', '退婚流',
  '赘婿', '神医', '战神', '科技修仙', '灵气复苏', '直播',
]

const ELEMENTS_FEMALE = [
  '重生', '穿越', '系统', '空间', '无CP', '大女主',
  '甜宠', '虐恋', '先婚后爱', '假千金', '真千金', '马甲',
  '娱乐圈', '科举', '经商', '种田', '团宠', '逆袭',
]

const ELEMENTS_UNISEX = [
  '重生', '穿越', '系统', '异能', '无限流', '末世',
  '都市', '校园', '职场', '冒险', '探险', '解谜',
  '克苏鲁', '赛博朋克', '时间循环', '平行世界',
]

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function pickCategory(): InspirationCategory {
  const r = Math.random()
  if (r < 0.45) return 'male'
  if (r < 0.8) return 'female'
  return 'unisex'
}

function buildCombination() {
  const category = pickCategory()
  const genres = category === 'male' ? GENRES_MALE
    : category === 'female' ? GENRES_FEMALE
    : GENRES_UNISEX
  const elements = category === 'male' ? ELEMENTS_MALE
    : category === 'female' ? ELEMENTS_FEMALE
    : ELEMENTS_UNISEX

  return {
    category,
    genres: pickRandom(genres, 2),
    style: pickRandom(STYLES, 1)[0],
    elements: pickRandom(elements, 3),
  }
}

// ============================================
// AI Prompt
// ============================================

function buildPrompt(combinations: ReturnType<typeof buildCombination>[]): string {
  const comboDesc = combinations.map((c, i) => `
组合${i + 1}：
- 频道：${c.category === 'male' ? '男频' : c.category === 'female' ? '女频' : '不限'}
- 题材：${c.genres.join('、')}
- 风格：${c.style}
- 元素：${c.elements.join('、')}
`).join('\n')

  return `你是一位资深网文编辑，精通中国网络文学市场趋势。请根据以下题材组合，为每个组合创作一张"爆款灵感卡"。

${comboDesc}

要求：
1. 每张卡要体现该组合的独特创意碰撞，不要泛泛而谈
2. title 要有吸引力，体现元素碰撞（如"系统流 x 末世废土"）
3. description 要简洁有力，2-3 句话讲清楚核心卖点
4. sampleTitle 要像真实网文标题，能直接用
5. sampleSummary 要写出完整的故事梗概（100-150字），包含开局、冲突、悬念
6. aiInsight 要给出专业的市场分析：为什么这个组合能火
7. openingScene 要给出具体的开局场景建议

请严格按以下 JSON 数组格式返回，不要包含其他内容：
[
  {
    "title": "组合名称",
    "description": "2-3句核心卖点",
    "exampleWorks": ["参考作品1", "参考作品2"],
    "coreElements": ["元素1", "元素2", "元素3", "元素4"],
    "targetAudience": "目标读者描述",
    "hotScore": 7-10的数字,
    "sampleTitle": "具体的网文标题",
    "sampleSummary": "完整故事梗概100-150字",
    "sampleGenre": "题材分类",
    "sampleWritingStyle": "写作风格",
    "tags": ["标签1", "标签2", "标签3", "标签4"],
    "aiInsight": "市场分析，为什么这个组合能火",
    "openingScene": "具体开局场景建议"
  }
]`
}

// ============================================
// 解析 AI 返回
// ============================================

function parseAIResponse(text: string): Partial<HotInspiration>[] {
  try {
    // 尝试直接解析
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // 尝试提取 JSON 数组
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed)) return parsed
      } catch { /* ignore */ }
    }
  }
  return []
}

function toHotInspiration(raw: Partial<HotInspiration>, category: InspirationCategory, index: number): HotInspiration {
  return {
    id: `ai-${Date.now()}-${index}`,
    category,
    title: raw.title || 'AI 灵感',
    description: raw.description || '',
    exampleWorks: Array.isArray(raw.exampleWorks) ? raw.exampleWorks.slice(0, 3) : [],
    coreElements: Array.isArray(raw.coreElements) ? raw.coreElements.slice(0, 5) : [],
    targetAudience: raw.targetAudience || '网文读者',
    hotScore: typeof raw.hotScore === 'number' ? Math.min(10, Math.max(6, raw.hotScore)) : 8,
    sampleTitle: raw.sampleTitle || '',
    sampleSummary: raw.sampleSummary || '',
    sampleGenre: raw.sampleGenre || '',
    sampleWritingStyle: raw.sampleWritingStyle || '',
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 6) : [],
    aiInsight: raw.aiInsight,
    openingScene: raw.openingScene,
  }
}

// ============================================
// 公开 API
// ============================================

/**
 * 用 AI 生成灵感卡
 * @param count 生成数量（实际会生成 count 张，每次调用 1 次 LLM）
 * @returns HotInspiration[] 失败时返回空数组
 */
export async function generateAIInspirations(count: number = 3): Promise<HotInspiration[]> {
  try {
    // 构建随机组合
    const combinations = Array.from({ length: count }, () => buildCombination())

    // 获取 AI provider
    const provider = await createProviderFromDefaultConfig()

    // 调用 AI
    const prompt = buildPrompt(combinations)
    const result = await provider.generate(prompt)
    const rawCards = parseAIResponse(result.content)

    if (rawCards.length === 0) return []

    // 转换为 HotInspiration
    const cards = rawCards.slice(0, count).map((raw, i) =>
      toHotInspiration(raw, combinations[i]?.category || 'unisex', i)
    )

    // 增强字段
    return enhanceInspirations(cards)
  } catch (error) {
    console.error('[ai-generator] AI 灵感生成失败:', error)
    return []
  }
}
