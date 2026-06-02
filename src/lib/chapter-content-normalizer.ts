const WRAPPED_CONTENT_FIELDS = ['revisedContent', 'content'] as const

function stripOuterCodeFence(value: string): string {
  const fenceMatch = value.trim().match(/^```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/)
  return fenceMatch ? fenceMatch[1].trim() : value.trim()
}

function tryParseJsonObject(source: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(source)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function decodeLooseJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`)
  } catch {
    return value
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
}

function extractLooseStringField(source: string, field: string): string | null {
  const marker = `"${field}"`
  const fieldIndex = source.indexOf(marker)
  if (fieldIndex < 0) return null

  const colonIndex = source.indexOf(':', fieldIndex + marker.length)
  if (colonIndex < 0) return null

  const firstQuoteIndex = source.indexOf('"', colonIndex + 1)
  if (firstQuoteIndex < 0) return null

  const bodyStart = firstQuoteIndex + 1
  const tail = source.slice(bodyStart)
  const nextFieldMatch = tail.match(/"\s*,\s*"(changes|originalScore|revisedScore|improvement|tokens|duration)"\s*:/)
  const closingObjectMatch = tail.match(/"\s*}\s*$/)
  const bodyEnd = nextFieldMatch?.index ?? closingObjectMatch?.index

  const body = bodyEnd === undefined ? tail : tail.slice(0, bodyEnd)
  const decoded = decodeLooseJsonString(body).trim()
  return decoded || null
}

export function extractWrappedChapterContent(raw: string): string | null {
  const trimmed = stripOuterCodeFence(raw)

  const parseCandidates = [
    trimmed,
    trimmed.match(/\{[\s\S]*\}/)?.[0],
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of parseCandidates) {
    const parsed = tryParseJsonObject(candidate)
    if (!parsed) continue

    for (const field of WRAPPED_CONTENT_FIELDS) {
      const value = parsed[field]
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
  }

  for (const field of WRAPPED_CONTENT_FIELDS) {
    const looseValue = extractLooseStringField(trimmed, field)
    if (looseValue) return looseValue
  }

  return null
}

export function normalizeChapterContentForUser(content: string | null | undefined): string {
  if (!content) return ''
  return extractWrappedChapterContent(content) || content
}
