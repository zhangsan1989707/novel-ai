/**
 * 截断检测器 - 检测章节是否被截断
 */

export interface TruncationCheckResult {
  isTruncated: boolean
  reasons: string[]
}

/**
 * 检测章节内容是否被截断
 */
export function isLikelyTruncated(
  content: string,
  finishReason?: string,
  minWordCount?: number
): TruncationCheckResult {
  const reasons: string[] = []
  
  if (!content || content.trim().length === 0) {
    return { isTruncated: true, reasons: ['内容为空'] }
  }

  // 1. 检查 finishReason
  if (finishReason === 'length' || finishReason === 'max_tokens') {
    reasons.push('模型因 token 限制提前停止')
  }

  // 2. 检查字数是否低于最低要求
  const wordCount = countChineseWords(content)
  if (minWordCount && wordCount < minWordCount) {
    reasons.push(`字数不足：${wordCount} < ${minWordCount}`)
  }

  // 3. 检查结尾是否是自然结束符
  const trimmedContent = content.trim()
  const lastChar = trimmedContent[trimmedContent.length - 1]
  const naturalEndings = ['。', '！', '？', '"', '」', '』', '）', '》', '…', '——']
  if (!naturalEndings.includes(lastChar)) {
    reasons.push(`结尾不是自然结束符：${lastChar}`)
  }

  // 4. 检查引号/括号是否闭合
  const bracketPairs = [
    { open: '"', close: '"' },
    { open: '「', close: '」' },
    { open: '『', close: '』' },
    { open: '（', close: '）' },
    { open: '《', close: '》' },
    { open: '【', close: '】' },
  ]
  
  for (const pair of bracketPairs) {
    const openCount = (content.match(new RegExp(pair.open, 'g')) || []).length
    const closeCount = (content.match(new RegExp(pair.close, 'g')) || []).length
    if (openCount !== closeCount) {
      reasons.push(`${pair.open}${pair.close} 未闭合：${openCount} 开 vs ${closeCount} 闭`)
    }
  }

  // 5. 检查最后一段是否明显未完成
  const paragraphs = content.split('\n').filter(p => p.trim().length > 0)
  if (paragraphs.length > 0) {
    const lastParagraph = paragraphs[paragraphs.length - 1].trim()
    // 最后一段过短可能是截断
    if (lastParagraph.length < 20 && !naturalEndings.includes(lastParagraph[lastParagraph.length - 1])) {
      reasons.push('最后一段过短且未完成')
    }
  }

  // 6. 检查是否有明显的悬断句式（真正的截断信号 — 句子语义不完整）
  // 注意：已将"忽然/突然/只见/正在这时"移除，这些是网文正常的悬念结尾手法
  const hardTrailingPatterns = [
    /他刚要说/,
    /她还没来得及/,
    /话还没说完/,
    /正要开口/,
    /还没反应过来/,
    /还没等/,
  ]

  const last200Chars = trimmedContent.slice(-200)
  for (const pattern of hardTrailingPatterns) {
    if (pattern.test(last200Chars)) {
      reasons.push(`结尾存在硬截断句式：${pattern.source}`)
      break
    }
  }

  // 7. 软信号检查：悬念式结尾（不判定为截断，仅作信息提示）
  // 此类句式在正常网文中是合法的章节结尾技巧，不应触发截断修复
  const softSuspensePatterns = [
    /忽然/,
    /突然/,
    /只见/,
    /正在这时/,
    /就在这时/,
  ]

  let hasSuspenseEnding = false
  for (const pattern of softSuspensePatterns) {
    if (pattern.test(last200Chars)) {
      hasSuspenseEnding = true
      break
    }
  }

  // 如果只检测到软信号，且结尾符正常、引号闭合，则不算截断
  if (hasSuspenseEnding && reasons.length === 0) {
    // 检查结尾是否以省略号或正常句读结束（网文悬念结尾常见 ... 或 ——）
    const suspenseEndings = ['…', '...', '——', '。', '！', '？', '"', '」', '』']
    if (suspenseEndings.includes(lastChar)) {
      return { isTruncated: false, reasons: [] }
    }
  }

  return {
    isTruncated: reasons.length > 0,
    reasons,
  }
}

/**
 * 统计中文字数（复用现有逻辑）
 */
function countChineseWords(text: string): number {
  if (!text) return 0
  // 统计中文字符
  const chineseChars = text.match(/[\u4e00-\u9fff]/g)
  // 统计英文单词
  const englishWords = text.match(/[a-zA-Z]+/g)
  return (chineseChars?.length || 0) + (englishWords?.length || 0)
}
