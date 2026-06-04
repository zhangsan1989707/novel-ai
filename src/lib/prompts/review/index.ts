interface ReviewPromptInput {
  content: string
  genre?: string | null
  targetAudience?: string | null
  chapterNo?: number
  worldSetting?: string | null
}

interface ReviewResult {
  reviewer: string
  scores: { dimension: string; score: number; comment: string }[]
  overallScore: number
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
}

const OUTPUT_FORMAT = `
请以严格 JSON 格式输出：
{
  "reviewer": "审稿人名称",
  "scores": [
    { "dimension": "维度名称", "score": 1-100分数, "comment": "简要评语" }
  ],
  "overallScore": 1-100综合分数,
  "strengths": ["优点1", "优点2", "优点3"],
  "weaknesses": ["缺点1", "缺点2", "缺点3"],
  "suggestions": ["建议1", "建议2", "建议3"]
}`

function buildCommonContext(input: ReviewPromptInput): string {
  const parts: string[] = []

  if (input.genre) {
    parts.push(`【小说类型】${input.genre}`)
  }

  if (input.targetAudience) {
    parts.push(`【目标受众】${input.targetAudience === 'MALE' ? '男频' : input.targetAudience === 'FEMALE' ? '女频' : input.targetAudience}`)
  }

  if (input.chapterNo) {
    parts.push(`【当前章节】第${input.chapterNo}章`)
  }

  if (input.worldSetting) {
    parts.push(`【世界观设定】${input.worldSetting}`)
  }

  return parts.join('\n')
}

export function buildMaleReaderReviewPrompt(input: ReviewPromptInput): string {
  const parts: string[] = []

  parts.push('你是一位资深男频网文审稿编辑，拥有10年起点中文网和番茄小说的审稿经验。你深谙男频读者的阅读心理，能够精准判断作品的商业潜力和读者留存率。')

  parts.push('\n【审稿标准】')
  parts.push('你将从以下维度进行严格审稿：')
  parts.push('1. 爽点密度（0-100）：爽点是否密集、节奏是否紧凑，每1000字是否至少有1个爽点')
  parts.push('2. 升级节奏（0-100）：主角成长节奏是否合理，是否让读者有持续的期待感')
  parts.push('3. 金手指合理性（0-100）：主角的金手指设定是否自洽、有趣、不破坏平衡')
  parts.push('4. 代入感（0-100）：读者是否能快速代入主角，是否有强烈的参与感')
  parts.push('5. 追读率预估（0-100）：基于内容质量预估读者追读意愿，章末是否有钩子')

  const context = buildCommonContext(input)
  if (context) {
    parts.push(`\n${context}`)
  }

  parts.push('\n【待审稿内容】')
  parts.push(input.content)

  parts.push('\n【任务】')
  parts.push('请以男频审稿人的视角，严格按照审稿标准对内容进行评分和分析。')
  parts.push('重点关注：爽点是否到位、节奏是否拖沓、金手指是否合理、读者是否会弃书。')
  parts.push('评分要严格客观，不要一味给高分，真实反映作品水平。')

  parts.push(OUTPUT_FORMAT)
  parts.push('reviewer 固定为 "男频审稿人"')

  return parts.join('\n')
}

/**
 * 合并的多视角审稿 prompt
 * 将4个独立审稿视角合并为单次调用，降低 LLM 调用成本
 */
export function buildCombinedReviewPrompt(input: ReviewPromptInput): string {
  const parts: string[] = []

  parts.push('你是资深网文审稿团队，同时具备以下四个审稿视角的专业能力：')
  parts.push('1. 【男频审稿人】：起点/番茄资深编辑，关注爽点密度、升级节奏、金手指、代入感、追读率')
  parts.push('2. 【女频审稿人】：晋江/长佩资深编辑，关注情感张力、人物魅力、剧情节奏、虐点把控、CP感')
  parts.push('3. 【毒点检测器】：读者流失风险分析专家，检测逻辑硬伤、三观问题、圣母/降智/绿帽/送女等弃书毒点')
  parts.push('4. 【结构分析师】：网文结构专家，分析章节结构、节奏曲线、钩子设置、信息密度、收尾质量')

  const context = buildCommonContext(input)
  if (context) {
    parts.push(`\n${context}`)
  }

  parts.push('\n【待审稿内容】')
  parts.push(input.content)

  parts.push('\n【任务】')
  parts.push('请从以上四个视角分别审稿，每个视角独立评分和分析。')
  parts.push('评分要严格客观，不要一味给高分，真实反映作品水平。')

  parts.push(`
请以严格 JSON 格式输出：
{
  "reviews": [
    {
      "reviewer": "男频审稿人",
      "scores": [
        { "dimension": "爽点密度", "score": 1-100, "comment": "评语" },
        { "dimension": "升级节奏", "score": 1-100, "comment": "评语" },
        { "dimension": "金手指合理性", "score": 1-100, "comment": "评语" },
        { "dimension": "代入感", "score": 1-100, "comment": "评语" },
        { "dimension": "追读率预估", "score": 1-100, "comment": "评语" }
      ],
      "overallScore": 1-100,
      "strengths": ["优点1", "优点2"],
      "weaknesses": ["缺点1", "缺点2"],
      "suggestions": ["建议1", "建议2"]
    },
    {
      "reviewer": "女频审稿人",
      "scores": [
        { "dimension": "情感张力", "score": 1-100, "comment": "评语" },
        { "dimension": "人物魅力", "score": 1-100, "comment": "评语" },
        { "dimension": "剧情节奏", "score": 1-100, "comment": "评语" },
        { "dimension": "虐点把控", "score": 1-100, "comment": "评语" },
        { "dimension": "CP感", "score": 1-100, "comment": "评语" }
      ],
      "overallScore": 1-100,
      "strengths": ["优点1"],
      "weaknesses": ["缺点1"],
      "suggestions": ["建议1"]
    },
    {
      "reviewer": "毒点检测器",
      "scores": [
        { "dimension": "逻辑硬伤", "score": 1-100, "comment": "评语" },
        { "dimension": "三观风险", "score": 1-100, "comment": "评语" },
        { "dimension": "弃书毒点", "score": 1-100, "comment": "评语" }
      ],
      "overallScore": 1-100,
      "strengths": ["优点1"],
      "weaknesses": ["缺点1"],
      "suggestions": ["建议1"]
    },
    {
      "reviewer": "结构分析师",
      "scores": [
        { "dimension": "章节结构", "score": 1-100, "comment": "评语" },
        { "dimension": "节奏曲线", "score": 1-100, "comment": "评语" },
        { "dimension": "钩子设置", "score": 1-100, "comment": "评语" },
        { "dimension": "信息密度", "score": 1-100, "comment": "评语" },
        { "dimension": "收尾质量", "score": 1-100, "comment": "评语" }
      ],
      "overallScore": 1-100,
      "strengths": ["优点1"],
      "weaknesses": ["缺点1"],
      "suggestions": ["建议1"]
    }
  ]
}`)

  return parts.join('\n')
}

export function buildFemaleReaderReviewPrompt(input: ReviewPromptInput): string {
  const parts: string[] = []

  parts.push('你是一位资深女频网文审稿编辑，拥有10年晋江文学城和知乎盐言故事的审稿经验。你深谙女频读者的情感需求，能够精准把握感情线的节奏和人物塑造的细腻度。')

  parts.push('\n【审稿标准】')
  parts.push('你将从以下维度进行严格审稿：')
  parts.push('1. 感情线节奏（0-100）：感情发展是否自然、有张力，是否让读者心动')
  parts.push('2. 人物塑造（0-100）：角色是否有魅力、立体，是否有记忆点')
  parts.push('3. 情感共鸣（0-100）：是否能引发读者情感共鸣，是否有戳心的瞬间')
  parts.push('4. 安全感（0-100）：读者是否感到情感安全，是否有过度虐心的风险')
  parts.push('5. 甜虐比（0-100）：甜与虐的比例是否恰当，是否满足读者的情感预期')

  const context = buildCommonContext(input)
  if (context) {
    parts.push(`\n${context}`)
  }

  parts.push('\n【待审稿内容】')
  parts.push(input.content)

  parts.push('\n【任务】')
  parts.push('请以女频审稿人的视角，严格按照审稿标准对内容进行评分和分析。')
  parts.push('重点关注：感情线是否打动人心、人物是否有魅力、读者是否会因为虐心而弃书。')
  parts.push('评分要严格客观，不要一味给高分，真实反映作品水平。')

  parts.push(OUTPUT_FORMAT)
  parts.push('reviewer 固定为 "女频审稿人"')

  return parts.join('\n')
}

export function buildToxicityReviewPrompt(input: ReviewPromptInput): string {
  const parts: string[] = []

  parts.push('你是一位网文内容安全审核专家，专门负责检测小说中的毒点和风险内容。你熟悉国内网文平台的审核标准，能够精准识别可能导致作品被下架或引发争议的内容。')

  parts.push('\n【审稿标准】')
  parts.push('你将从以下维度进行严格审稿：')
  parts.push('1. 敏感内容（0-100）：是否包含政治敏感、暴力血腥、色情擦边等违规内容，分数越高越安全')
  parts.push('2. 政策红线（0-100）：是否触碰网文平台的内容红线，如涉政、涉教、涉毒等，分数越高越安全')
  parts.push('3. 三观问题（0-100）：是否存在价值观偏差、美化犯罪、歧视等内容，分数越高越安全')
  parts.push('4. 争议情节（0-100）：是否包含可能引发读者大规模争议的情节，分数越高越安全')
  parts.push('5. 读者弃书点（0-100）：是否存在导致读者大量弃书的毒点，分数越高越安全')

  const context = buildCommonContext(input)
  if (context) {
    parts.push(`\n${context}`)
  }

  parts.push('\n【待审稿内容】')
  parts.push(input.content)

  parts.push('\n【任务】')
  parts.push('请以毒点检测器的视角，严格排查内容中的各类风险。')
  parts.push('重点关注：是否有违规内容、是否触碰红线、是否有价值观问题、是否有争议情节、是否有导致弃书的毒点。')
  parts.push('宁可误报不可漏报，安全第一。如果发现严重问题，请在 weaknesses 和 suggestions 中重点标注。')

  parts.push(OUTPUT_FORMAT)
  parts.push('reviewer 固定为 "毒点检测器"')

  return parts.join('\n')
}

export function buildStructureReviewPrompt(input: ReviewPromptInput): string {
  const parts: string[] = []

  parts.push('你是一位资深叙事结构分析师，精通各类叙事理论和结构分析方法。你能够从宏观和微观两个层面分析小说的叙事结构，发现结构问题并提出优化建议。')

  parts.push('\n【审稿标准】')
  parts.push('你将从以下维度进行严格审稿：')
  parts.push('1. 节奏（0-100）：叙事节奏是否张弛有度，是否有拖沓或仓促的问题')
  parts.push('2. 伏笔（0-100）：伏笔的埋设和回收是否合理，是否有遗忘的伏笔')
  parts.push('3. 逻辑（0-100）：情节逻辑是否自洽，是否有逻辑漏洞或前后矛盾')
  parts.push('4. 结构（0-100）：整体结构是否完整，起承转合是否清晰')
  parts.push('5. 钩子（0-100）：章首是否吸引人，章末是否有悬念，信息密度是否合理')

  const context = buildCommonContext(input)
  if (context) {
    parts.push(`\n${context}`)
  }

  parts.push('\n【待审稿内容】')
  parts.push(input.content)

  parts.push('\n【任务】')
  parts.push('请以结构分析师的视角，严格分析内容的叙事结构。')
  parts.push('重点关注：节奏是否合理、伏笔是否到位、逻辑是否自洽、结构是否完整、钩子是否有效。')
  parts.push('评分要严格客观，不要一味给高分，真实反映作品水平。')

  parts.push(OUTPUT_FORMAT)
  parts.push('reviewer 固定为 "结构分析师"')

  return parts.join('\n')
}

export type { ReviewPromptInput, ReviewResult }
