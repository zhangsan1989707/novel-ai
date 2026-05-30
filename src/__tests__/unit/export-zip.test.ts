import { describe, it, expect } from 'vitest'
import AdmZip from 'adm-zip'

describe('Export Zip Compression', () => {
  it('should create a valid zip buffer from content', () => {
    const content = 'This is test content for zip compression'
    const fileName = 'test_novel_2026-05-30.txt'

    const zip = new AdmZip()
    zip.addFile(fileName, Buffer.from(content, 'utf-8'))
    const zipBuffer = zip.toBuffer()
    const base64Content = zipBuffer.toString('base64')

    // Verify the zip was created
    expect(base64Content).toBeTruthy()
    expect(typeof base64Content).toBe('string')

    // Verify we can read back the zip
    const readZip = new AdmZip(zipBuffer)
    const entries = readZip.getEntries()

    // Should have exactly one entry
    expect(entries.length).toBe(1)
    expect(entries[0].entryName).toBe(fileName)

    // Content should match
    const readContent = entries[0].getData().toString('utf-8')
    expect(readContent).toBe(content)
  })

  it('should handle Chinese content in zip', () => {
    const content = '这是用于测试的中文内容\n第二行内容'
    const fileName = '小说导出_2026-05-30.txt'

    const zip = new AdmZip()
    zip.addFile(fileName, Buffer.from(content, 'utf-8'))
    const zipBuffer = zip.toBuffer()
    const base64Content = zipBuffer.toString('base64')

    expect(base64Content).toBeTruthy()

    const readZip = new AdmZip(zipBuffer)
    const entries = readZip.getEntries()

    expect(entries.length).toBe(1)
    expect(entries[0].entryName).toBe(fileName)

    const readContent = entries[0].getData().toString('utf-8')
    expect(readContent).toBe(content)
  })
})
