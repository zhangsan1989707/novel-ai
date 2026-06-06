import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import JSZip from 'jszip'
import { logError } from '@/lib/logger'
import { ProjectMode } from '@/types'
import { getCurrentUserId } from '@/lib/auth'
import { createProviderFromDefaultConfig } from '@/lib/ai'
import { parseAiJsonObject } from '@/lib/engine/ai-json'
import { queueProjectBootstrap } from '@/lib/engine/auto-maintenance'
import { splitIntoChapters } from '@/lib/analysis/chapter-utils'
import { countChapterWords, syncProjectChapterWordCount } from '@/lib/novel/chapter-word-count'

// ============================================
// 工具函数
// ============================================

async function extractTextFromEpub(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const chapters: string[] = []

  const contentFiles = Object.keys(zip.files).filter((path) => {
    const lower = path.toLowerCase()
    return (
      lower.endsWith('.xhtml') ||
      lower.endsWith('.html') ||
      lower.endsWith('.htm') ||
      (lower.includes('content') && lower.endsWith('.xml'))
    )
  })

  contentFiles.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || '0')
    const numB = parseInt(b.match(/\d+/)?.[0] || '0')
    return numA - numB
  })

  for (const filePath of contentFiles) {
    const content = await zip.file(filePath)?.async('string')
    if (content) {
      const text = content
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      if (text.length > 50) {
        chapters.push(text)
      }
    }
  }

  return chapters.join('\n\n')
}

async function extractTextFromTxt(arrayBuffer: ArrayBuffer): Promise<string> {
  let text = new TextDecoder('utf-8').decode(arrayBuffer)
  if (text.includes('�')) {
    text = new TextDecoder('gbk').decode(arrayBuffer)
  }
  return text.trim()
}

// ============================================
// API Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectIdStr = formData.get('projectId') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_FILE', message: '请提供要上传的文件' } },
        { status: 400 }
      )
    }

    const validTypes = ['text/plain', 'application/epub+zip']
    const validExtensions = ['.txt', '.epub']
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))

    if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TYPE', message: '只支持 .txt 和 .epub 格式' } },
        { status: 400 }
      )
    }

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: { code: 'FILE_TOO_LARGE', message: '文件大小不能超过 100MB' } },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()

    let originalText: string
    let sourceName: string | null = null

    if (extension === '.epub') {
      originalText = await extractTextFromEpub(arrayBuffer)
      sourceName = file.name.replace(/\.epub$/i, '').replace(/[_-]/g, ' ')
    } else {
      originalText = await extractTextFromTxt(arrayBuffer)
      sourceName = file.name.replace(/\.txt$/i, '').replace(/[_-]/g, ' ')
    }

    originalText = originalText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

    if (originalText.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'EMPTY_CONTENT', message: '文件内容为空' } },
        { status: 400 }
      )
    }

    const wordCount = countChapterWords(originalText)
    const contentPreview = originalText.slice(0, 8000)

    let savedSourceNovel = null
    let chaptersCreated = 0
    let projectIdToReturn: number | null = null

    // 智能分章（先分章，用于后续关联到项目）
    const chapters = splitIntoChapters(originalText)

    // 如果没有提供 projectId，自动创建项目并提取元数据
    let projectId = projectIdStr ? parseInt(projectIdStr, 10) : null

    if (!projectId || isNaN(projectId)) {
      // 1. AI 提取元数据（含高级设定）
      const extractedMeta = {
        title: sourceName || file.name.replace(/\.(txt|epub)$/i, ''),
        genre: undefined as string | undefined,
        writingStyle: undefined as string | undefined,
        corePitch: `拆解自《${sourceName || file.name}》`,
        description: `拆解自《${sourceName || '未知来源'}》`,
        targetWordCount: wordCount,
        chapterWordCount: 3000,
        totalVolumes: 4,
        targetAudience: undefined as 'MALE' | 'FEMALE' | undefined,
        worldSetting: undefined as string | undefined,
        powerSystem: undefined as string | undefined,
        protagonistProfile: undefined as string | undefined,
        antagonistSetting: undefined as string | undefined,
      }

      try {
        const provider = await createProviderFromDefaultConfig()
        const prompt = `你是一位专业的小说分析师。请阅读以下小说内容，提取其关键元数据和设定信息。

【小说内容】
${contentPreview}

【任务】
请分析这部小说，提取以下信息：
1. title - 小说标题（如果没有明确标题，从内容中推断最合适的）
2. genre - 小说类型（玄幻、奇幻、仙侠、都市、科幻、历史、游戏、悬疑、言情、军事、体育、轻小说之一）
3. writingStyle - 写作风格（轻松幽默、热血激昂、暗黑沉重、唯美文艺、悬疑烧脑、搞笑吐槽、史诗宏大、细腻温情、快节奏爽文、慢热养成之一）
4. corePitch - 一句话简介/核心卖点（50字以内）
5. description - 小说简介（200字以内）
6. targetAudience - MALE(男频) 或 FEMALE(女频)，如果不确定留空
7. estimatedTotalVolumes - 预估总卷数（1-10的数字）
8. worldSetting - 世界观设定（200字以内，描述小说所在的世界观）
9. powerSystem - 力量体系（200字以内，描述小说中的力量/修炼体系）
10. protagonistProfile - 主角人设（200字以内，描述主角的性格、外貌、背景）
11. antagonistSetting - 反派设定（200字以内，描述主要反派/ antagonists 的设定）

【输出格式】
请严格按照以下 JSON 格式输出：
{
  "title": "小说标题",
  "genre": "类型",
  "writingStyle": "风格",
  "corePitch": "一句话简介",
  "description": "小说简介",
  "targetAudience": "MALE或FEMALE",
  "estimatedTotalVolumes": 4,
  "worldSetting": "世界观设定",
  "powerSystem": "力量体系",
  "protagonistProfile": "主角人设",
  "antagonistSetting": "反派设定"
}

注意：只输出 JSON，不要输出任何额外文字。如果某些高级设定无法从内容中推断，留空字符串。`

        const result = await provider.generate(prompt, { temperature: 0.3 })
        const parsed = parseAiJsonObject(result.content) as Record<string, unknown> | null

        if (parsed) {
          if (typeof parsed.title === 'string' && parsed.title.trim()) extractedMeta.title = parsed.title.trim()
          if (typeof parsed.genre === 'string' && parsed.genre.trim()) extractedMeta.genre = parsed.genre.trim()
          if (typeof parsed.writingStyle === 'string' && parsed.writingStyle.trim()) extractedMeta.writingStyle = parsed.writingStyle.trim()
          if (typeof parsed.corePitch === 'string' && parsed.corePitch.trim()) extractedMeta.corePitch = parsed.corePitch.trim()
          if (typeof parsed.description === 'string' && parsed.description.trim()) extractedMeta.description = parsed.description.trim()
          if (parsed.targetAudience === 'MALE' || parsed.targetAudience === 'FEMALE') extractedMeta.targetAudience = parsed.targetAudience as 'MALE' | 'FEMALE'
          if (typeof parsed.estimatedTotalVolumes === 'number') extractedMeta.totalVolumes = parsed.estimatedTotalVolumes
          if (typeof parsed.worldSetting === 'string' && parsed.worldSetting.trim()) extractedMeta.worldSetting = parsed.worldSetting.trim()
          if (typeof parsed.powerSystem === 'string' && parsed.powerSystem.trim()) extractedMeta.powerSystem = parsed.powerSystem.trim()
          if (typeof parsed.protagonistProfile === 'string' && parsed.protagonistProfile.trim()) extractedMeta.protagonistProfile = parsed.protagonistProfile.trim()
          if (typeof parsed.antagonistSetting === 'string' && parsed.antagonistSetting.trim()) extractedMeta.antagonistSetting = parsed.antagonistSetting.trim()
        }
      } catch (e) {
        logError(e instanceof Error ? e : new Error(String(e)), { type: 'extract_metadata_during_upload' })
        // 元数据提取失败不影响主流程，使用默认值
      }

      let creatorId = await getCurrentUserId()
      const user = await prisma.user.findUnique({ where: { id: creatorId } })
      if (!user) {
        const newUser = await prisma.user.create({
          data: {
            email: 'dev@example.com',
            name: '开发者',
            password: 'hashed_password_placeholder',
          },
        })
        creatorId = newUser.id
      }

      // 2. 创建项目（含高级设定）
      const project = await prisma.novelProject.create({
        data: {
          title: extractedMeta.title,
          description: extractedMeta.description,
          genre: extractedMeta.genre,
          writingStyle: extractedMeta.writingStyle,
          corePitch: extractedMeta.corePitch,
          targetAudience: extractedMeta.targetAudience,
          targetWordCount: extractedMeta.targetWordCount,
          chapterWordCount: extractedMeta.chapterWordCount,
          totalVolumes: extractedMeta.totalVolumes,
          worldSetting: extractedMeta.worldSetting,
          powerSystem: extractedMeta.powerSystem,
          protagonistProfile: extractedMeta.protagonistProfile,
          antagonistSetting: extractedMeta.antagonistSetting,
          projectMode: ProjectMode.ANALYZE,
          creatorId,
          outline: `【拆解分析】

来源：${sourceName || '未知'}
字数：${wordCount.toLocaleString()} 字
章节数：${chapters.length} 章

本项目为拆解分析项目，用于分析小说结构，为后续续写做准备。
`,
        },
      })
      projectId = project.id
      projectIdToReturn = projectId

      // 3. 触发 bootstrap（生成设定、蓝图等）
      await queueProjectBootstrap(project.id, {
        source: 'analyze_upload',
        title: project.title,
      })
    }

    projectIdToReturn = projectId ?? projectIdToReturn

    // 保存原始文本
    savedSourceNovel = await prisma.sourceNovel.upsert({
      where: { projectId },
      update: {
        originalText,
        wordCount,
        sourceName,
      },
      create: {
        projectId,
        originalText,
        wordCount,
        sourceName,
      },
    })

    // 删除旧的章节（如果有）
    await prisma.novelChapter.deleteMany({
      where: { projectId },
    })

    // 批量创建章节（复用前面已分好的 chapters 数组）
    const chapterData = chapters.map((ch, idx) => ({
      projectId,
      chapterNumber: idx + 1,
      title: ch.title,
      content: ch.content,
      wordCount: countChapterWords(ch.content),
      status: 'REVIEWING' as const,
    }))

    if (chapterData.length > 0) {
      await prisma.novelChapter.createMany({
        data: chapterData,
      })
      chaptersCreated = chapterData.length
    }
    await syncProjectChapterWordCount(prisma, projectId)

    return NextResponse.json({
      success: true,
      data: {
        projectId: projectIdToReturn,
        fileName: file.name,
        sourceName,
        wordCount,
        previewLength: Math.min(500, originalText.length),
        preview: originalText.slice(0, 500),
        savedId: savedSourceNovel?.id || null,
        chaptersCreated,
        chapterCount: chapters.length,
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'upload_source_novel' })
    return NextResponse.json(
      { success: false, error: { code: 'UPLOAD_ERROR', message: '文件处理失败' } },
      { status: 500 }
    )
  }
}
