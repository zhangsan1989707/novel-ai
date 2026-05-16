export interface ForbiddenWord {
  word: string
  level: 'critical' | 'warning'
  reason: string
  replacement?: string
}

export interface ForbiddenPattern {
  pattern: string
  description: string
  level: 'critical' | 'warning'
  example: { bad: string; good: string }
}

export const forbiddenWords: ForbiddenWord[] = [
  { word: '不禁', level: 'critical', reason: 'AI高频词', replacement: '' },
  { word: '顿时', level: 'critical', reason: 'AI高频词', replacement: '' },
  { word: '瞬间', level: 'critical', reason: 'AI高频词', replacement: '' },
  { word: '宛如', level: 'critical', reason: '过度比喻', replacement: '' },
  { word: '仿佛', level: 'critical', reason: '过度比喻', replacement: '' },
  { word: '犹如', level: 'critical', reason: '过度比喻', replacement: '' },
  { word: '赫然', level: 'critical', reason: 'AI高频词', replacement: '' },
  { word: '竟然', level: 'warning', reason: 'AI高频词', replacement: '' },
  { word: '居然', level: 'warning', reason: 'AI高频词', replacement: '' },
  { word: '缓缓', level: 'warning', reason: 'AI高频词', replacement: '' },
  { word: '微微', level: 'warning', reason: 'AI高频词', replacement: '' },
  { word: '淡淡', level: 'warning', reason: 'AI高频词', replacement: '' },
  { word: '轻轻', level: 'warning', reason: 'AI高频词', replacement: '' },
  { word: '默默', level: 'warning', reason: 'AI高频词', replacement: '' },
  { word: '深深', level: 'warning', reason: 'AI高频词', replacement: '' },
  { word: '渐渐', level: 'warning', reason: 'AI高频词', replacement: '' },
  { word: '悄然', level: 'warning', reason: 'AI高频词', replacement: '' },
  { word: '骤然', level: 'warning', reason: 'AI高频词', replacement: '' },
  { word: '陡然', level: 'warning', reason: 'AI高频词', replacement: '' },
  { word: '蓦然', level: 'warning', reason: 'AI高频词', replacement: '' },
]

export const forbiddenPatterns: ForbiddenPattern[] = [
  { pattern: '排比句堆砌', description: '三个以上结构相同的短语并列', level: 'critical', example: { bad: '他感到愤怒、悲伤、迷茫、无助。', good: '他攥紧了拳头。' } },
  { pattern: '段落结构过于工整', description: '每段长度和结构相似', level: 'warning', example: { bad: '第一段：他做了A。第二段：他做了B。第三段：他做了C。', good: '他做了A。然后——算了，B的事以后再说。C倒是等不及了。' } },
  { pattern: '每段都以人名开头', description: '连续多段以同一人名开始', level: 'warning', example: { bad: '他看着窗外。他想起了过去。他叹了口气。', good: '窗外下着雨。过去的事不想也罢。叹气有什么用？' } },
  { pattern: '总结性陈述句结尾', description: '段落末尾用总结性陈述收束', level: 'warning', example: { bad: '这一天，他学到了重要的一课：永远不要放弃希望。', good: '他攥着那张皱巴巴的纸条，攥了很久。' } },
  { pattern: '过度比喻', description: '连续使用比喻或类比', level: 'critical', example: { bad: '她的笑容如春风般温暖，如阳光般明媚，如花朵般绽放。', good: '她笑了。' } },
  { pattern: '心理描写直白', description: '直接描述情绪而非通过行为体现', level: 'warning', example: { bad: '他感到非常愤怒，内心充满了怒火。', good: '他攥紧了拳头，指甲嵌进掌心。' } },
]

export function scanForbiddenWords(text: string): { word: ForbiddenWord; count: number; positions: number[] }[] {
  const results: { word: ForbiddenWord; count: number; positions: number[] }[] = []
  for (const fw of forbiddenWords) {
    const positions: number[] = []
    let idx = text.indexOf(fw.word)
    while (idx !== -1) {
      positions.push(idx)
      idx = text.indexOf(fw.word, idx + fw.word.length)
    }
    if (positions.length > 0) {
      results.push({ word: fw, count: positions.length, positions })
    }
  }
  return results
}

export function scanForbiddenPatterns(text: string): { pattern: ForbiddenPattern; matches: string[] }[] {
  const results: { pattern: ForbiddenPattern; matches: string[] }[] = []
  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0)

  if (paragraphs.length >= 3) {
    const startsWithSameName = paragraphs.slice(0, 5).filter(p => /^[\u4e00-\u9fa5]{1,3}[看着想坐站走说叹]/.test(p.trim()))
    if (startsWithSameName.length >= 3) {
      const pattern = forbiddenPatterns.find(p => p.pattern === '每段都以人名开头')!
      results.push({ pattern, matches: startsWithSameName })
    }
  }

  const parallelPattern = /[^，。！？、]+[、][^，。！？、]+[、][^，。！？、]+[、]/
  const parallelMatches = text.match(new RegExp(parallelPattern.source, 'g'))
  if (parallelMatches && parallelMatches.length > 0) {
    const pattern = forbiddenPatterns.find(p => p.pattern === '排比句堆砌')!
    results.push({ pattern, matches: parallelMatches })
  }

  const summaryPattern = /[这一他她][天战次，].*[：:].*[永远不要重要必须]/
  const summaryMatches = text.match(new RegExp(summaryPattern.source, 'g'))
  if (summaryMatches && summaryMatches.length > 0) {
    const pattern = forbiddenPatterns.find(p => p.pattern === '总结性陈述句结尾')!
    results.push({ pattern, matches: summaryMatches })
  }

  const similePattern = /[宛如仿佛犹如].*[般似的]/g
  const simileMatches = text.match(similePattern)
  if (simileMatches && simileMatches.length >= 2) {
    const pattern = forbiddenPatterns.find(p => p.pattern === '过度比喻')!
    results.push({ pattern, matches: simileMatches })
  }

  const emotionPattern = /[他她][感到觉得].*[愤怒悲伤快乐恐惧]/g
  const emotionMatches = text.match(emotionPattern)
  if (emotionMatches && emotionMatches.length > 0) {
    const pattern = forbiddenPatterns.find(p => p.pattern === '心理描写直白')!
    results.push({ pattern, matches: emotionMatches })
  }

  return results
}

export function getAntiAiPrompt(): string {
  const criticalWords = forbiddenWords.filter(w => w.level === 'critical').map(w => w.word)
  const warningWords = forbiddenWords.filter(w => w.level === 'warning').map(w => w.word)
  const lines: string[] = []
  lines.push('【一级禁用词（命中即替换）】')
  lines.push(criticalWords.join('、'))
  lines.push('【二级禁用词（尽量避免）】')
  lines.push(warningWords.join('、'))
  lines.push('【禁止模式】')
  for (const p of forbiddenPatterns) {
    lines.push(`- ${p.pattern}：${p.description}`)
    lines.push(`  反例：${p.example.bad}`)
    lines.push(`  正例：${p.example.good}`)
  }
  return lines.join('\n')
}
