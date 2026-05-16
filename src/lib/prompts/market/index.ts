interface MarketAnalysisPromptInput {
  genre: string
  platform: string
  targetAudience?: string
  existingTrends?: string
}

export function buildMarketAnalysisPrompt(input: MarketAnalysisPromptInput): string {
  const platformLabels: Record<string, string> = {
    qidian: '起点中文网',
    tomato: '番茄小说',
    jinjiang: '晋江文学城',
    qimao: '七猫小说',
    ciweimao: '刺猬猫',
  }

  const platformName = platformLabels[input.platform] || input.platform

  const parts: string[] = []

  parts.push(`你是一位资深的网文市场分析师，擅长分析各大网文平台的市场趋势和读者偏好。`)
  parts.push(``)
  parts.push(`【分析任务】`)
  parts.push(`请对「${platformName}」平台的「${input.genre}」题材进行市场趋势分析。`)

  if (input.targetAudience) {
    const audienceLabel = input.targetAudience === 'MALE' ? '男频' : '女频'
    parts.push(`目标受众：${audienceLabel}`)
  }

  if (input.existingTrends) {
    parts.push(``)
    parts.push(`【已有趋势数据】`)
    parts.push(input.existingTrends)
  }

  parts.push(``)
  parts.push(`【输出要求】`)
  parts.push(`请严格按照以下 JSON 格式输出分析结果，不要输出其他内容：`)
  parts.push(``)
  parts.push(`\`\`\`json`)
  parts.push(`{
  "trendDirection": "rising|stable|declining",
  "hotTags": ["标签1", "标签2", "标签3", "标签4", "标签5"],
  "readerPreferences": ["偏好1", "偏好2", "偏好3"],
  "competitorAnalysis": "竞品分析文字（200-300字，分析当前该题材头部作品的特点和趋势）",
  "recommendations": [
    {
      "genre": "推荐题材方向1",
      "reason": "推荐理由（100-200字）",
      "difficulty": "easy|medium|hard"
    },
    {
      "genre": "推荐题材方向2",
      "reason": "推荐理由",
      "difficulty": "easy|medium|hard"
    },
    {
      "genre": "推荐题材方向3",
      "reason": "推荐理由",
      "difficulty": "easy|medium|hard"
    }
  ]
}`)
  parts.push(`\`\`\``)
  parts.push(``)
  parts.push(`【分析维度说明】`)
  parts.push(`- trendDirection: 该题材当前的热度趋势方向`)
  parts.push(`- hotTags: 当前热门的标签和关键词（5-8个）`)
  parts.push(`- readerPreferences: 读者偏好分析（3-5条）`)
  parts.push(`- competitorAnalysis: 竞品分析，重点关注头部作品的内容特征、更新频率、字数范围`)
  parts.push(`- recommendations: 3-5个选题建议方向，包含推荐理由和创作难度评估`)

  return parts.join('\n')
}

interface GenreRecommendationPromptInput {
  userStrengths: string[]
  targetPlatform: string
  preferredGenres: string[]
}

export function buildGenreRecommendationPrompt(input: GenreRecommendationPromptInput): string {
  const platformLabels: Record<string, string> = {
    qidian: '起点中文网',
    tomato: '番茄小说',
    jinjiang: '晋江文学城',
    qimao: '七猫小说',
    ciweimao: '刺猬猫',
  }

  const platformName = platformLabels[input.targetPlatform] || input.targetPlatform

  const parts: string[] = []

  parts.push(`你是一位资深的网文选题顾问，擅长根据作者的优势和市场情况推荐最适合的题材方向。`)
  parts.push(``)
  parts.push(`【作者优势】`)
  parts.push(input.userStrengths.map((s, i) => `${i + 1}. ${s}`).join('\n'))
  parts.push(``)
  parts.push(`【目标平台】`)
  parts.push(platformName)
  parts.push(``)
  parts.push(`【偏好题材】`)
  parts.push(input.preferredGenres.join('、'))
  parts.push(``)
  parts.push(`【输出要求】`)
  parts.push(`请根据作者的优势和偏好，结合目标平台的市场特点，推荐3-5个最适合的题材方向。`)
  parts.push(`请严格按照以下 JSON 格式输出，不要输出其他内容：`)
  parts.push(``)
  parts.push(`\`\`\`json`)
  parts.push(`{
  "recommendations": [
    {
      "genre": "主题材",
      "subGenre": "细分题材",
      "reason": "推荐理由（150-250字，结合作者优势和市场情况）",
      "targetAudience": "目标读者群体描述",
      "difficulty": "easy|medium|hard",
      "marketSaturation": "low|medium|high"
    }
  ]
}`)
  parts.push(`\`\`\``)
  parts.push(``)
  parts.push(`【评估维度说明】`)
  parts.push(`- difficulty: 创作难度（easy=容易上手, medium=需要一定功底, hard=门槛较高）`)
  parts.push(`- marketSaturation: 市场饱和度（low=蓝海, medium=竞争适中, high=红海）`)

  return parts.join('\n')
}
