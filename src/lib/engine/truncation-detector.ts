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

  // 6. 检查是否有明显的悬断句式
  const trailingPatterns = [
    /他刚要说/,
    /她还没来得及/,
    /话还没说完/,
    /只见/,
    /忽然/,
    /突然/,
    /正在这时/,
  ]
  
  const last200Chars = trimmedContent.slice(-200)
  for (const pattern of trailingPatterns) {
    if (pattern.test(last200Chars)) {
      reasons.push(`结尾存在悬断句式：${pattern.source}`)
      break
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
