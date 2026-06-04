/**
 * 健壮的 JSON 提取工具
 * 从 LLM 输出中提取 JSON，支持代码块、多个 JSON 对象、malformed JSON 修复
 */

/**
 * 尝试修复 malformed JSON（针对包含长文本的 JSON）
 * 只处理包含 string 值的简单对象
 */
function tryRepairMalformedJson(source: string): string | null {
  // 尝试修复包含未转义换行的 string 值
  const stringKeyMatch = source.match(/"(\w+)"\s*:\s*"([\s\S]*?)"/)
  if (!stringKeyMatch || stringKeyMatch.index === undefined) return null

  const rawValue = stringKeyMatch[2]
  const escapedValue = rawValue
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/"/g, '\\"')

  const repaired =
    source.slice(0, stringKeyMatch.index) +
    `"${stringKeyMatch[1]}": "${escapedValue}"` +
    source.slice(stringKeyMatch.index + stringKeyMatch[0].length)

  try {
    JSON.parse(repaired)
    return repaired
  } catch {
    return null
  }
}

/**
 * 从 LLM 输出中提取 JSON 对象
 * 支持：
 * - 代码块包裹的 JSON（```json ... ```）
 * - 多个 JSON 对象中提取第一个有效的
 * - 修复 malformed JSON（未转义换行等）
 *
 * @param raw LLM 输出的原始文本
 * @returns 解析后的 JSON 对象，提取失败返回 null
 */
export function extractJsonFromLLMOutput<T = Record<string, unknown>>(raw: string): T | null {
  const trimmed = raw.trim()

  // 1. 尝试从代码块中提取
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/)
  const candidateSource = fenceMatch ? fenceMatch[1].trim() : trimmed

  // 2. 尝试修复 malformed JSON
  const repairedCandidate = tryRepairMalformedJson(candidateSource)

  // 3. 构建候选列表：原始文本、各个 JSON 对象、修复后的文本
  const candidates = [
    candidateSource,
    ...Array.from(candidateSource.matchAll(/\{[\s\S]*?\}/g)).map(m => m[0]),
    ...(repairedCandidate ? [repairedCandidate] : []),
  ].filter(Boolean)

  // 4. 依次尝试解析每个候选
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as T
      }
    } catch {
      continue
    }
  }

  return null
}

/**
 * 从 LLM 输出中提取 JSON 数组
 * 支持代码块包裹的 JSON 数组
 *
 * @param raw LLM 输出的原始文本
 * @returns 解析后的 JSON 数组，提取失败返回 null
 */
export function extractJsonArrayFromLLMOutput<T = unknown>(raw: string): T[] | null {
  const trimmed = raw.trim()

  // 1. 尝试从代码块中提取
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/)
  const candidateSource = fenceMatch ? fenceMatch[1].trim() : trimmed

  // 2. 尝试直接解析
  try {
    const parsed = JSON.parse(candidateSource)
    if (Array.isArray(parsed)) {
      return parsed as T[]
    }
  } catch {
    // 继续
  }

  // 3. 尝试提取数组部分
  const arrayMatch = candidateSource.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0])
      if (Array.isArray(parsed)) {
        return parsed as T[]
      }
    } catch {
      // 继续
    }
  }

  return null
}
