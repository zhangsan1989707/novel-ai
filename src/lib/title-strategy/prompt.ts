import type { TitleStrategyInput } from './types'

const PLATFORM_LABELS: Record<string, string> = {
  qidian: '起点中文网',
  fanqie: '番茄小说',
  qimao: '七猫小说',
  jjwxc: '晋江文学城',
  general: '通用网文平台',
}

const CHANNEL_LABELS: Record<string, string> = {
  male: '男频',
  female: '女频',
}

const STYLE_LABELS: Record<string, string> = {
  market: '市场向爆款',
  quality: '品质向精品',
  short_drama: '短剧向快节奏',
  literary: '文艺向口碑',
}

const HOOK_KEYWORDS_FEMALE = [
  '重生', '穿越', '真千金', '假千金', '替身', '白月光', '退婚', '离婚',
  '追妻火葬场', '团宠', '偏宠', '马甲', '逆袭', '打脸', '复仇',
  '豪门', '京圈', '全员后悔', '联手',
]

const HOOK_KEYWORDS_MALE = [
  '系统', '签到', '无敌', '升级', '万古', '神帝', '仙尊', '重生',
  '全球', '深空', '末世', '我在', '修仙', '反杀', '逆袭',
]

/**
 * 构建标题工厂的 prompt，让 AI 一次性生成 30 个候选标题。
 */
export function buildTitleFactoryPrompt(input: TitleStrategyInput): string {
  const platform = PLATFORM_LABELS[input.platform] || input.platform
  const channel = CHANNEL_LABELS[input.channel] || input.channel
  const style = STYLE_LABELS[input.targetStyle] || input.targetStyle
  const hookKeywords = input.channel === 'female' ? HOOK_KEYWORDS_FEMALE : HOOK_KEYWORDS_MALE

  const lines: string[] = []

  lines.push('你是网文平台标题策划专家，不是文学编辑。你的唯一目标是生成高点击率的市场化小说标题。')
  lines.push('')

  lines.push(`【目标平台】${platform}`)
  lines.push(`【频道】${channel}`)
  lines.push(`【题材】${input.genre}${input.subGenres?.length ? ' · ' + input.subGenres.join(' · ') : ''}`)
  lines.push(`【风格方向】${style}`)
  lines.push('')

  lines.push('【核心卖点】')
  lines.push(input.coreHook)
  if (input.protagonistIdentity) lines.push(`主角身份：${input.protagonistIdentity}`)
  if (input.conflict) lines.push(`核心冲突：${input.conflict}`)
  if (input.emotionalPromise) lines.push(`情绪承诺：${input.emotionalPromise}`)
  lines.push('')

  lines.push('【标题生成规则】')
  lines.push('1. 标题必须一眼看出题材、身份、冲突或爽点之一')
  lines.push('2. 禁止生成过于文艺、抽象、含混的标题')
  lines.push(`3. 优先使用强点击结构关键词：${hookKeywords.join('、')}`)
  lines.push('4. 每个标题长度 4-20 字，简洁有力')
  lines.push('5. 标题风格要多样化：一部分偏热点爆款，一部分偏稳重经典，一部分偏短剧风')
  lines.push('6. 不要只改一两个字重复生成，每个标题要有差异化')
  if (input.forbiddenWords?.length) {
    lines.push(`7. 禁止使用以下词汇：${input.forbiddenWords.join('、')}`)
  }
  lines.push('')

  lines.push('【评分标准（每项给分，满分 100）】')
  lines.push('- 题材识别度（0-20）：一眼看出是现言/古言/重生/豪门等')
  lines.push('- 爽点强度（0-25）：是否有重生/打脸/逆袭/复仇/团宠/追妻火葬场等')
  lines.push('- 冲突密度（0-20）：标题是否含明确矛盾')
  lines.push('- 情绪刺激（0-15）：能否引发好奇/愤怒/期待/代入')
  lines.push('- 平台适配（0-10）：是否符合目标平台标题气质')
  lines.push('- 可读性（0-10）：是否顺口、不拗口')
  lines.push('')

  lines.push('【输出格式】')
  lines.push('严格输出 JSON，不要输出任何其他内容：')
  lines.push(`{
  "candidates": [
    {
      "title": "标题文本",
      "subtitle": "可选副标题或一句话卖点",
      "style": "hot|stable|literary|short_drama|platform",
      "score": 85,
      "tags": ["重生", "真千金", "打脸"],
      "reason": "一句话说明为什么这个标题好",
      "risk": "一句话说明风险点"
    }
  ]
}`)
  lines.push('')
  lines.push('请生成 30 个候选标题，按点击潜力从高到低排序。')

  return lines.join('\n')
}
