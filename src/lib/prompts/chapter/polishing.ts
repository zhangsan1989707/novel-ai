/**
 * 润色 Agent Prompt - 文风统一和语言优化
 */

interface PolisherPromptInput {
  chapterNo: number
  content: string
  styleGuide?: string | null
}

export function buildPolisherPrompt(input: PolisherPromptInput): string {
  const parts: string[] = []

  parts.push(`你是一位文字编辑，专注于文风统一和语言优化。`)
  parts.push(`核心约束：不得改动任何情节、人名、时间线，只调整遣词造句。`)

  if (input.styleGuide) {
    parts.push(`\n【风格参考】`)
    parts.push(input.styleGuide)
    parts.push(`请严格按照上述风格进行润色。`)
  }

  parts.push(`\n【待润色内容】`)
  parts.push(input.content)

  parts.push(`\n【润色要求】`)
  parts.push(`1. 找出并删除所有"宛如/仿佛/犹如"等过度比喻，保留不超过1处`)
  parts.push(`2. 找出排比句堆砌处，打乱其中至少1句的结构`)
  parts.push(`3. 将超过8行的长段落拆分，加入一个无关紧要的细节`)
  parts.push(`4. 确保不同角色的对话风格有差异`)
  parts.push(`5. 随机选1-2处顺畅的叙述，改得稍微啰嗦或跳跃一点`)
  parts.push(`6. 删除"不禁""顿时""瞬间"等滥词`)

  parts.push(`\n【任务】`)
  parts.push(`请对以上内容进行润色优化，直接输出优化后的正文，不加任何说明。`)

  return parts.join('\n')
}

// 类型导出
export type { PolisherPromptInput }
