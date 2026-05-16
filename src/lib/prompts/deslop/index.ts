interface DeslopPromptInput {
  content: string
  genre?: string | null
  writingStyle?: string | null
  strictness: 'light' | 'medium' | 'heavy'
  detectedIssues: {
    forbiddenWords: { word: string; count: number }[]
    forbiddenPatterns: { pattern: string; matches: string[] }[]
  }
}

export function buildDeslopPrompt(input: DeslopPromptInput): string {
  const parts: string[] = []

  parts.push('你是一位资深网文编辑，专精于去除AI生成文本的"机器感"，让文字回归人类写作的自然质感。')

  if (input.genre) {
    parts.push(`\n【小说类型】${input.genre}`)
  }
  if (input.writingStyle) {
    parts.push(`【文风要求】${input.writingStyle}`)
  }

  parts.push('\n【待处理文本】')
  parts.push(input.content)

  parts.push('\n【检测到的问题】')
  if (input.detectedIssues.forbiddenWords.length > 0) {
    parts.push('禁用词命中：')
    for (const fw of input.detectedIssues.forbiddenWords) {
      parts.push(`  - "${fw.word}" 出现 ${fw.count} 次`)
    }
  }
  if (input.detectedIssues.forbiddenPatterns.length > 0) {
    parts.push('禁止模式命中：')
    for (const fp of input.detectedIssues.forbiddenPatterns) {
      parts.push(`  - ${fp.pattern}：${fp.matches.join('；')}`)
    }
  }

  if (input.strictness === 'light') {
    parts.push('\n【处理策略：轻度】')
    parts.push('1. 仅替换一级禁用词（不禁、顿时、瞬间、宛如、仿佛、犹如、赫然），用自然表达替代')
    parts.push('2. 保持原文结构和段落不变')
    parts.push('3. 不改变句式和叙事节奏')
    parts.push('4. 替换时优先使用口语化、日常化的表达')
  } else if (input.strictness === 'medium') {
    parts.push('\n【处理策略：中度】')
    parts.push('1. 替换所有禁用词（一级和二级），用自然表达替代')
    parts.push('2. 修正禁止模式：拆解排比句、打乱段落结构、改换开头方式、删除总结性结尾')
    parts.push('3. 增加口语化表达，允许不完整的句子')
    parts.push('4. 长短句交替，段落长度参差不齐')
    parts.push('5. 情绪通过行为细节体现，用身体反应代替心理描写')
  } else {
    parts.push('\n【处理策略：重度 - 三遍去AI法】')
    parts.push('第一遍：去词汇')
    parts.push('  - 替换所有禁用词')
    parts.push('  - 删除冗余修饰词（"的""了""着"等高频虚词过度使用处）')
    parts.push('  - 用具体动作替代抽象描述')
    parts.push('第二遍：改结构')
    parts.push('  - 打破对称句式，让长短句不规律交替')
    parts.push('  - 拆解排比句，用递进或转折替代并列')
    parts.push('  - 段落长度拉开差距：有的一句话一段，有的五六句一段')
    parts.push('  - 变换段落开头方式，避免连续以人名或代词开头')
    parts.push('  - 删除总结性陈述结尾，改用细节或留白收束')
    parts.push('第三遍：加人味')
    parts.push('  - 加入人物内心独白，要有语气词（"妈的""这也太离谱了吧""嗯？"）')
    parts.push('  - 对话后不要每次都加动作描写，有时就是干对话')
    parts.push('  - 重要情节可以"拖戏"，无聊过场一句话带过')
    parts.push('  - 允许轻微的作者吐槽式插叙')
    parts.push('  - 关键时刻使用"留白"艺术')
    parts.push('  - 描写有细节不均匀感，有时啰嗦有时跳跃')
  }

  parts.push('\n【核心原则】')
  parts.push('- 保留原文的核心情节和信息，不删减内容')
  parts.push('- 改写后的文字读起来像人类网文作者写的')
  parts.push('- 人类写作的特点：不规律、有瑕疵、有个性、有节奏变化')
  parts.push('- AI写作的特点：过于工整、对称、完整、面面俱到——这些都要打破')

  parts.push('\n【输出格式】')
  parts.push('请以严格 JSON 格式输出：')
  parts.push('- revisedContent: string, 改写后的完整文本')
  parts.push('- changes: array, 每个变更包含：')
  parts.push('  - type: "word" | "pattern" | "structure", 变更类型')
  parts.push('  - original: string, 原文片段')
  parts.push('  - revised: string, 改写后片段')
  parts.push('  - reason: string, 变更原因')

  return parts.join('\n')
}

export type { DeslopPromptInput }
