/**
 * 增强版润色 Agent Prompt - 精细化文风优化
 */

interface PolisherPromptInput {
  chapterNo: number
  content: string
  styleGuide?: string | null
  writingStyle?: string | null
  genre?: string | null
  chapterTitle?: string
}

export function buildPolisherPrompt(input: PolisherPromptInput): string {
  const parts: string[] = []

  parts.push(`# 章节润色任务`)
  parts.push(`\n## 基本信息`)
  parts.push(`- 章节编号：第${input.chapterNo}章`)
  if (input.chapterTitle) parts.push(`- 章节标题：${input.chapterTitle}`)
  if (input.genre) parts.push(`- 小说类型：${input.genre}`)
  if (input.writingStyle) parts.push(`- 写作风格：${input.writingStyle}`)

  if (input.styleGuide) {
    parts.push(`\n## 风格指南（必须严格遵守）`)
    parts.push(input.styleGuide)
  }

  parts.push(`\n## 润色原则`)
  parts.push(`**核心约束**：`)
  parts.push(`- ❌ 禁止改动任何情节、人物关系、时间线`)
  parts.push(`- ❌ 禁止删除重要对话内容`)
  parts.push(`- ❌ 禁止改变章节主题或情感基调`)
  parts.push(`- ✅ 只调整遣词造句、句式结构、表达方式`)
  parts.push(`- ✅ 可以在不改变意思的前提下调整段落顺序`)

  parts.push(`\n## 具体润色要求`)
  
  parts.push(`\n### 1. 去除 AI 痕迹`)
  parts.push(`识别并修复以下 AI 写作特征：`)
  parts.push(`- "宛如"、"仿佛"、"犹如" 等过度比喻 → 替换为具体描写或直接陈述`)
  parts.push(`- "不禁"、"顿时"、"瞬间"、"忽然" 等滥词 → 删除或替换为具体动作`)
  parts.push(`- 排比句堆砌（如"他感到愤怒、悲伤、迷茫"）→ 拆分为独立的情感表达`)
  parts.push(`- 过于工整对称的段落结构 → 打乱结构，增加自然感`)
  parts.push(`- 连续多段以人名/代词开头 → 穿插场景描写或内心独白`)
  parts.push(`- 大段连续环境描写（超过3段）→ 精简或融入动作`)

  parts.push(`\n### 2. 增强人物差异`)
  parts.push(`确保不同角色的表达有差异：`)
  parts.push(`- 不同角色的对话要有不同的语气、词汇、口头禅`)
  parts.push(`- 主角和配角的表达要有明显的层次感`)
  parts.push(`- 反派角色的语言要有威慑感或欺骗性`)
  parts.push(`- 同一角色的对话风格要前后一致`)

  parts.push(`\n### 3. 优化叙事节奏`)
  parts.push(`- 超过8行的长段落 → 拆分，加入过渡或细节`)
  parts.push(`- 连续3个以上短句 → 适当合并或增加描写`)
  parts.push(`- 拖沓的描述 → 精简或删除冗余修饰`)
  parts.push(`- 重要场景 → 允许"拖戏"，增加细节`)

  parts.push(`\n### 4. 强化情感表达`)
  parts.push(`- 用行为细节展现情感，而非直接描述心理`)
  parts.push(`- 关键情感点允许内心独白，但不超过每章3次`)
  parts.push(`- 情绪变化要有铺垫，不能突兀`)

  parts.push(`\n### 5. 优化对话`)
  parts.push(`- 删除"废话式"对话（寒暄、客套话等）`)
  parts.push(`- 对话要有潜台词，增加张力`)
  parts.push(`- 重要对话后不要每次都加动作描写，有时就是干对话`)
  parts.push(`- 控制对话和描写的比例（建议4:6）`)

  parts.push(`\n### 6. 特殊处理`)
  parts.push(`- 随机选1-2处顺畅的叙述，改得稍微跳跃或啰嗦，增加"人味"`)
  parts.push(`- 允许轻微的作者吐槽式插叙（但要符合整体风格）`)
  parts.push(`- 关键情节可使用"留白"艺术，不写满`)

  parts.push(`\n## 输出要求`)
  parts.push(`- 仅输出润色后的 Markdown 正文`)
  parts.push(`- 不加任何说明、注释或对比`)
  parts.push(`- 不输出 JSON 或其他元数据`)

  parts.push(`\n---\n## 待润色内容`)
  parts.push(input.content)

  return parts.join('\n')
}

// 类型导出
export type { PolisherPromptInput }
