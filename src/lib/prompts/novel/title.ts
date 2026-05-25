interface TitleGenerationInput {
  inspirationTitle: string
  inspirationDescription: string
  genre?: string
  writingStyle?: string
  targetAudience?: string
}

export function buildTitleGenerationPrompt(input: TitleGenerationInput): string {
  const parts: string[] = []

  parts.push(`【灵感来源】`)
  parts.push(`灵感主题：${input.inspirationTitle}`)
  parts.push(`灵感描述：${input.inspirationDescription}`)
  if (input.genre) parts.push(`小说类型：${input.genre}`)
  if (input.writingStyle) parts.push(`写作风格：${input.writingStyle}`)
  if (input.targetAudience) parts.push(`目标受众：${input.targetAudience}`)

  parts.push(`\n【任务】`)
  parts.push(`请基于以上灵感，为这部网络小说起一个响亮、吸引人的书名。`)

  parts.push(`\n【命名要求】`)
  parts.push(`1. 书名长度2-10个字，简洁有力，朗朗上口`)
  parts.push(`2. 体现小说的核心卖点和类型特征`)
  parts.push(`3. 有悬念感或画面感，让读者一看就想点进去`)
  parts.push(`4. 符合当前网文市场的命名趋势`)
  parts.push(`5. 避免过于直白或过于文艺，要有商业感`)
  parts.push(`6. 不要使用冒号分隔的副标题格式`)

  parts.push(`\n【参考风格】`)
  parts.push(`玄幻/仙侠：苍穹之上、万古神帝、逆天邪神`)
  parts.push(`都市/科幻：全球高武、深空彼岸、我的治愈系游戏`)
  parts.push(`悬疑/灵异：十日终焉、神秘复苏、深夜书屋`)
  parts.push(`言情/古言：凤归朝、簪星、折腰`)
  parts.push(`轻松/日常：修仙就是这么难、我师兄实在太稳健了`)

  parts.push(`\n请以 JSON 格式输出，格式如下：`)
  parts.push(`{
  "title": "你推荐的最佳书名",
  "alternatives": ["备选书名1", "备选书名2", "备选书名3"]
}`)

  return parts.join('\n')
}

export type { TitleGenerationInput }
