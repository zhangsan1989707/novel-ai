interface CoverPromptInput {
  title: string
  genre: string
  synopsis?: string
  targetAudience?: string
  style?: string
}

const genreVisualStyles: Record<string, string> = {
  玄幻: '仙气飘渺、山川云海、金色光芒、神秘符文、磅礴气势',
  都市: '现代都市、霓虹灯光、人物剪影、高楼大厦、都市夜景',
  仙侠: '修仙意境、飞剑仙山、云雾缭绕、仙鹤祥云、古风仙韵',
  科幻: '未来科技、星空宇宙、赛博朋克、机械装甲、星际飞船',
  言情: '柔美色调、人物特写、浪漫氛围、花瓣飘落、温馨光影',
  历史: '古风建筑、水墨风格、朝堂战场、兵马铠甲、古典韵味',
  悬疑: '暗色调、阴影、神秘氛围、迷雾笼罩、破碎镜面',
  奇幻: '魔法世界、奇幻生物、史诗战场、古老城堡、魔法光芒',
  游戏: '游戏界面、虚拟世界、像素风格、装备道具、冒险场景',
  军事: '战场硝烟、钢铁洪流、军旗飘扬、战略地图、铁血荣耀',
  体育: '运动场景、竞技赛场、热血拼搏、冠军奖杯、速度激情',
  轻小说: '动漫风格、可爱角色、校园场景、日常氛围、青春活力',
}

export function buildCoverImagePrompt(input: CoverPromptInput): string {
  const parts: string[] = []

  const genreStyle = genreVisualStyles[input.genre] || genreVisualStyles['玄幻']
  const styleOverride = input.style ? input.style : genreStyle

  parts.push('A professional book cover illustration for a novel.')
  parts.push(`Title: "${input.title}"`)
  parts.push(`Genre: ${input.genre}`)
  parts.push(`Visual style: ${styleOverride}`)

  if (input.synopsis) {
    parts.push(`Story synopsis: ${input.synopsis.slice(0, 200)}`)
  }

  if (input.targetAudience) {
    parts.push(`Target audience: ${input.targetAudience === 'MALE' ? 'Male readers' : 'Female readers'}`)
  }

  parts.push('\nDesign requirements:')
  parts.push('- Create a visually striking book cover with the title text prominently displayed')
  parts.push('- Use rich, vibrant colors that match the genre atmosphere')
  parts.push('- Include symbolic visual elements that represent the story themes')
  parts.push('- Professional illustration quality, suitable for a published novel')
  parts.push('- Portrait orientation (3:4 aspect ratio)')
  parts.push('- No watermarks or text other than the title')

  return parts.join('\n')
}

export function buildCoverAnalysisPrompt(input: CoverPromptInput): string {
  const parts: string[] = []

  parts.push('你是一位专业的书籍封面设计师，擅长根据小说题材和内容设计封面方案。')

  parts.push('\n【小说信息】')
  parts.push(`书名：${input.title}`)
  parts.push(`题材：${input.genre}`)

  if (input.synopsis) {
    parts.push(`简介：${input.synopsis.slice(0, 500)}`)
  }

  if (input.targetAudience) {
    parts.push(`目标受众：${input.targetAudience === 'MALE' ? '男频' : '女频'}`)
  }

  if (input.style) {
    parts.push(`风格偏好：${input.style}`)
  }

  parts.push('\n【任务】')
  parts.push('请根据以上信息，为这本小说设计封面方案，包括配色、构图和核心视觉元素。')

  parts.push('\n【输出格式】')
  parts.push('请以严格 JSON 格式输出：')
  parts.push('- colorScheme: string[], 配色方案（3-5个颜色，使用十六进制或中文描述，如["#1a1a2e", "#16213e", "#0f3460", "#e94560"]）')
  parts.push('- composition: string, 构图建议（描述封面的整体布局和视觉层次）')
  parts.push('- elements: string[], 核心视觉元素（3-6个关键元素，如"飞剑"、"仙山"、"云雾"）')
  parts.push('- mood: string, 整体氛围（如"神秘磅礴"、"温馨浪漫"、"紧张悬疑"）')

  return parts.join('\n')
}

export type { CoverPromptInput }
