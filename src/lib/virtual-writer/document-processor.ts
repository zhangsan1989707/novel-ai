import * as fs from 'fs/promises'
import * as path from 'path'
import { countChineseWords } from '@/lib/utils'

const SUPPORTED_EXTENSIONS = ['.txt', '.md']

export async function processWriterDocument(
  filePath: string,
  fileName: string
): Promise<{ text: string; wordCount: number }> {
  const ext = path.extname(fileName).toLowerCase()
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(`不支持的文件格式: ${ext}，仅支持 .txt 和 .md`)
  }

  const text = await fs.readFile(filePath, 'utf-8')
  const wordCount = countChineseWords(text)

  return { text, wordCount }
}
