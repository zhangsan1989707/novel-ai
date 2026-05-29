/**
 * 多风格适配引擎
 * 基于风格向量空间实现风格调制
 */

import { AIService } from '@/lib/ai/service'

/** 风格向量 — 用数值表示风格的各个维度 (0-1) */
export interface StyleVector {
  /** 节奏：0=慢节奏铺陈 1=快节奏爽文 */
  pace: number
  /** 文笔华丽度：0=朴素白描 1=华丽辞藻 */
  ornateness: number
  /** 对话密度：0=叙事为主 1=对话为主 */
  dialogueDensity: number
  /** 情感浓度：0=冷峻克制 1=浓烈煽情 */
  emotionalIntensity: number
  /** 幽默程度：0=严肃正经 1=轻松搞笑 */
  humor: number
  /** 暗黑程度：0=光明向善 1=暗黑残酷 */
  darkness: number
  /** 口语化程度：0=书面化 1=口语化/方言化 */
  colloquialism: number
  /** 段落碎片化：0=段落完整 1=碎片短句 */
  fragmentation: number
}

/** 风格预设 */
export interface StylePreset {
  name: string
  description: string
  vector: StyleVector
  /** 适用平台 */
  platforms?: string[]
  /** 适用题材 */
  genres?: string[]
}

/** 风格调制结果 */
export interface StyleModulation {
  /** 风格向量 */
  vector: StyleVector
  /** 调制提示词片段 */
  promptFragment: string
  /** 预设名称（如果是预设） */
  presetName?: string
}

/** 内置风格预设 */
const STYLE_PRESETS: StylePreset[] = [
  {
    name: '起点爽文',
    description: '快节奏、强冲突、金手指、打脸流',
    vector: { pace: 0.8, ornateness: 0.3, dialogueDensity: 0.5, emotionalIntensity: 0.7, humor: 0.3, darkness: 0.4, colloquialism: 0.6, fragmentation: 0.5 },
    platforms: ['qidian'],
    genres: ['玄幻', '都市', '修仙'],
  },
  {
    name: '番茄快餐',
    description: '极快节奏、章末必有钩子、短章节',
    vector: { pace: 0.95, ornateness: 0.2, dialogueDensity: 0.6, emotionalIntensity: 0.8, humor: 0.4, darkness: 0.3, colloquialism: 0.8, fragmentation: 0.7 },
    platforms: ['fanqie'],
    genres: ['都市', '重生', '系统'],
  },
  {
    name: '晋江言情',
    description: '细腻情感、角色刻画、文学性较强',
    vector: { pace: 0.4, ornateness: 0.6, dialogueDensity: 0.4, emotionalIntensity: 0.8, humor: 0.3, darkness: 0.2, colloquialism: 0.3, fragmentation: 0.3 },
    platforms: ['jinjiang'],
    genres: ['言情', '古言', '现言'],
  },
  {
    name: '飞卢同人',
    description: '极度爽文、数据流、系统流、打脸',
    vector: { pace: 0.9, ornateness: 0.15, dialogueDensity: 0.5, emotionalIntensity: 0.9, humor: 0.5, darkness: 0.3, colloquialism: 0.7, fragmentation: 0.6 },
    platforms: ['feilu'],
    genres: ['同人', '系统', '穿越'],
  },
  {
    name: '传统文学',
    description: '深度描写、文学性、人物内心',
    vector: { pace: 0.3, ornateness: 0.7, dialogueDensity: 0.3, emotionalIntensity: 0.5, humor: 0.2, darkness: 0.4, colloquialism: 0.1, fragmentation: 0.2 },
    genres: ['文学', '严肃'],
  },
  {
    name: '悬疑推理',
    description: '紧凑节奏、冷峻风格、细节描写',
    vector: { pace: 0.6, ornateness: 0.4, dialogueDensity: 0.4, emotionalIntensity: 0.4, humor: 0.1, darkness: 0.6, colloquialism: 0.3, fragmentation: 0.4 },
    genres: ['悬疑', '推理', '刑侦'],
  },
]

/**
 * 获取风格预设列表
 */
export function getStylePresets(): StylePreset[] {
  return [...STYLE_PRESETS]
}

/**
 * 按平台/题材匹配最佳预设
 */
export function matchStylePreset(platform?: string, genre?: string): StylePreset | null {
  let best: StylePreset | null = null
  let bestScore = -1

  for (const preset of STYLE_PRESETS) {
    let score = 0
    if (platform && preset.platforms?.includes(platform)) score += 2
    if (genre && preset.genres?.some(g => genre.includes(g))) score += 1
    if (score > bestScore) {
      bestScore = score
      best = preset
    }
  }

  return bestScore > 0 ? best : null
}

/**
 * 将风格向量转化为写作风格指令
 */
export function buildStyleDirective(vector: StyleVector): string {
  const directives: string[] = []

  if (vector.pace > 0.7) directives.push('节奏紧凑，快速推进剧情，减少冗长描写')
  else if (vector.pace < 0.3) directives.push('节奏舒缓，注重细节铺陈和氛围烘托')

  if (vector.ornateness > 0.7) directives.push('文笔华丽，善用修辞和意象描写')
  else if (vector.ornateness < 0.3) directives.push('文笔朴素，用白描手法，少用华丽辞藻')

  if (vector.dialogueDensity > 0.7) directives.push('对话驱动叙事，减少大段叙述')
  else if (vector.dialogueDensity < 0.3) directives.push('叙事为主，对话精炼克制')

  if (vector.emotionalIntensity > 0.7) directives.push('情感浓烈，通过细节渲染情绪')
  else if (vector.emotionalIntensity < 0.3) directives.push('情感克制，用行动而非心理描写表达情绪')

  if (vector.humor > 0.6) directives.push('适当加入幽默元素和轻松桥段')
  if (vector.darkness > 0.6) directives.push('增加暗黑元素，描写残酷现实')

  if (vector.colloquialism > 0.7) directives.push('口语化表达，允许方言和网络用语')
  else if (vector.colloquialism < 0.3) directives.push('书面化表达，避免口语化')

  if (vector.fragmentation > 0.7) directives.push('多用短句碎片，增强节奏感')
  else if (vector.fragmentation < 0.3) directives.push('段落完整，长短句交替')

  return directives.join('；')
}

/**
 * 合并两个风格向量（用于微调预设）
 */
export function blendStyleVectors(base: StyleVector, overrides: Partial<StyleVector>, weight: number = 0.5): StyleVector {
  const result = { ...base }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined && value !== null) {
      const k = key as keyof StyleVector
      result[k] = base[k] * (1 - weight) + value * weight
    }
  }
  return result
}

/**
 * 构建风格调制 prompt 片段（注入 Writer prompt）
 */
export function buildStyleModulationPrompt(vector: StyleVector, presetName?: string): string {
  const parts: string[] = []

  parts.push('## 风格调制指令')
  if (presetName) {
    parts.push(`风格预设：${presetName}`)
  }

  parts.push(`风格参数：
- 节奏：${(vector.pace * 100).toFixed(0)}%
- 文笔华丽度：${(vector.ornateness * 100).toFixed(0)}%
- 对话密度：${(vector.dialogueDensity * 100).toFixed(0)}%
- 情感浓度：${(vector.emotionalIntensity * 100).toFixed(0)}%
- 幽默程度：${(vector.humor * 100).toFixed(0)}%
- 暗黑程度：${(vector.darkness * 100).toFixed(0)}%
- 口语化程度：${(vector.colloquialism * 100).toFixed(0)}%
- 碎片化程度：${(vector.fragmentation * 100).toFixed(0)}%`)

  parts.push('')
  parts.push('具体要求：')
  parts.push(buildStyleDirective(vector))

  return parts.join('\n')
}

/**
 * 从已分析的小说中提取风格向量（AI 辅助）
 */
export async function extractStyleVector(
  projectId: number,
  sampleContent: string
): Promise<StyleVector> {
  const provider = await AIService.createProvider({
    projectId,
    usageType: 'STYLE_EXTRACT',
  })

  const prompt = `请分析以下文本的写作风格，用 0-1 的数值评估各维度：

【文本】
${sampleContent.slice(0, 6000)}

请以 JSON 格式输出：
{
  "pace": 0.5,           // 节奏：0=慢 1=快
  "ornateness": 0.5,     // 华丽度：0=朴素 1=华丽
  "dialogueDensity": 0.5, // 对话密度：0=少 1=多
  "emotionalIntensity": 0.5, // 情感：0=克制 1=浓烈
  "humor": 0.5,          // 幽默：0=严肃 1=搞笑
  "darkness": 0.5,       // 暗黑：0=光明 1=暗黑
  "colloquialism": 0.5,  // 口语化：0=书面 1=口语
  "fragmentation": 0.5   // 碎片化：0=完整 1=碎片
}`

  const result = await provider.generate(prompt, { temperature: 0.2, maxTokens: 500 })

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const raw = JSON.parse(jsonMatch[0])
      return {
        pace: clamp01(raw.pace),
        ornateness: clamp01(raw.ornateness),
        dialogueDensity: clamp01(raw.dialogueDensity),
        emotionalIntensity: clamp01(raw.emotionalIntensity),
        humor: clamp01(raw.humor),
        darkness: clamp01(raw.darkness),
        colloquialism: clamp01(raw.colloquialism),
        fragmentation: clamp01(raw.fragmentation),
      }
    }
  } catch {
    // 解析失败返回中性向量
  }

  return DEFAULT_STYLE_VECTOR
}

function clamp01(value: unknown): number {
  const num = typeof value === 'number' ? value : 0.5
  return Math.max(0, Math.min(1, num))
}

export const DEFAULT_STYLE_VECTOR: StyleVector = {
  pace: 0.5,
  ornateness: 0.5,
  dialogueDensity: 0.5,
  emotionalIntensity: 0.5,
  humor: 0.3,
  darkness: 0.3,
  colloquialism: 0.5,
  fragmentation: 0.4,
}
