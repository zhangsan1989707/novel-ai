type JsonKind = 'object' | 'array'

function stripCodeFences(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  return content.trim()
}

function extractBalancedJson(content: string, kind: JsonKind): string | null {
  const text = stripCodeFences(content)
  const openChar = kind === 'object' ? '{' : '['
  const closeChar = kind === 'object' ? '}' : ']'

  const start = text.indexOf(openChar)
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const char = text[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === openChar) depth++
    if (char === closeChar) {
      depth--
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }

  return null
}

export function parseAiJsonObject<T>(content: string): T {
  const extracted = extractBalancedJson(content, 'object')
  if (!extracted) throw new Error('AI 返回中未找到 JSON 对象')
  return JSON.parse(extracted.replace(/,\s*([\]}])/g, '$1')) as T
}

export function parseAiJsonArray<T>(content: string): T[] {
  const extracted = extractBalancedJson(content, 'array')
  if (!extracted) throw new Error('AI 返回中未找到 JSON 数组')
  return JSON.parse(extracted.replace(/,\s*([\]}])/g, '$1')) as T[]
}
