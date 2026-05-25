/**
 * EPUB 生成器
 * 生成符合 EPUB 3.0 标准的电子书文件
 */

interface EpubChapter {
  title: string
  content: string
  chapterNumber: number
}

interface EpubMetadata {
  title: string
  author?: string
  description?: string
  coverImage?: string
  language?: string
}

interface EpubOptions {
  metadata: EpubMetadata
  chapters: EpubChapter[]
  includeStyles?: boolean
}

export function generateEpub(options: EpubOptions): string {
  const { metadata, chapters } = options
  const lang = metadata.language || 'zh-CN'
  const uuid = generateUUID()

  const mimetype = 'application/epub+zip'

  const containerXml = generateContainerXml()

  const contentOpf = generateContentOpf({ metadata, chapters, uuid, lang })

  const tocNcx = generateTocNcx({ metadata, chapters, uuid })

  const styles = options.includeStyles !== false ? generateDefaultCss() : null

  const chapterHtmls = chapters.map(ch => generateChapterHtml(ch, lang))

  return JSON.stringify({
    mimetype,
    containerXml,
    contentOpf,
    tocNcx,
    styles,
    chapters: chapterHtmls,
    manifest: chapters.map((ch, i) => ({
      id: `chapter-${i + 1}`,
      href: `chapter-${i + 1}.xhtml`,
      title: ch.title,
    })),
  })
}

function generateUUID(): string {
  return 'urn:uuid:' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function generateContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
}

function generateContentOpf({ metadata, chapters, uuid, lang }: EpubOptions & { uuid: string, lang: string }): string {
  const items = chapters.map((_, i) =>
    `    <item id="chapter-${i + 1}" href="chapter-${i + 1}.xhtml" media-type="application/xhtml+xml"/>`
  ).join('\n')

  const spineItems = chapters.map((_, i) =>
    `    <itemref idref="chapter-${i + 1}"/>`
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${uuid}</dc:identifier>
    <dc:title>${escapeXml(metadata.title)}</dc:title>
    ${metadata.author ? `<dc:creator>${escapeXml(metadata.author)}</dc:creator>` : ''}
    ${metadata.description ? `<dc:description>${escapeXml(metadata.description)}</dc:description>` : ''}
    <dc:language>${lang}</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString()}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${items}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`
}

function generateTocNcx({ metadata, chapters, uuid }: EpubOptions & { uuid: string }): string {
  const navPoints = chapters.map((ch, i) =>
    `    <navPoint id="navpoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
      <content src="chapter-${i + 1}.xhtml"/>
    </navPoint>`
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(metadata.title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`
}

function generateChapterHtml(chapter: EpubChapter, lang: string): string {
  const paragraphs = chapter.content
    .split('\n')
    .filter(p => p.trim())
    .map(p => `    <p>${escapeXml(p.trim())}</p>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}">
<head>
  <title>${escapeXml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h2>${escapeXml(chapter.title)}</h2>
${paragraphs}
</body>
</html>`
}

function generateDefaultCss(): string {
  return `body { font-family: "Noto Serif CJK SC", "Source Han Serif SC", serif; line-height: 1.8; margin: 1em; }
h2 { text-align: center; margin: 1.5em 0; font-size: 1.3em; }
p { text-indent: 2em; margin: 0.5em 0; }`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}