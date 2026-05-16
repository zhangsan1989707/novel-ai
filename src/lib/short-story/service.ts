import { prisma } from '@/lib/prisma'
import { AIService } from '@/lib/ai/service'
import { countChineseWords } from '@/lib/utils'
import { logger } from '@/lib/logger'
import {
  buildShortOutlinePrompt,
  buildShortEmotionDesignPrompt,
  buildShortReversalDesignPrompt,
  buildShortHookDesignPrompt,
  buildShortWritingPrompt,
  STRUCTURE_SECTIONS,
} from '@/lib/prompts/short-story'

interface OutlineSection {
  sectionNumber: number
  title: string
  sectionType: string
  emotionalTarget: number
  description: string
}

interface OutlineResult {
  premise: string
  sections: OutlineSection[]
}

interface EmotionKeyMoment {
  position: string
  emotion: string
  intensity: number
  description: string
}

interface EmotionTransition {
  from: string
  to: string
  trigger: string
  technique: string
}

interface EmotionDesign {
  overallArc: string
  keyMoments: EmotionKeyMoment[]
  emotionalTransitions: EmotionTransition[]
}

interface ReversalItem {
  sectionNumber: number
  type: string
  description: string
  setupHint: string
  payoffHint: string
}

interface ReversalDesign {
  reversals: ReversalItem[]
}

interface HookItem {
  sectionNumber: number
  openingHook: { type: string; description: string }
  closingHook: { type: string; description: string }
}

interface HookDesign {
  hooks: HookItem[]
}

function parseJSON<T>(text: string): T {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim()
  return JSON.parse(jsonStr) as T
}

export async function generateShortOutline(params: {
  projectId: number
  structure: 'three_act' | 'four_act' | 'five_act'
  targetWordCount: number
}) {
  const project = await prisma.novelProject.findUnique({
    where: { id: params.projectId },
  })

  if (!project) {
    throw new Error('项目不存在')
  }

  const provider = await AIService.createProvider({
    projectId: params.projectId,
    usageType: 'SHORT_OUTLINE',
  })

  const prompt = buildShortOutlinePrompt({
    title: project.title,
    genre: project.genre || '未指定',
    targetAudience: project.targetAudience || undefined,
    targetWordCount: params.targetWordCount,
    structure: params.structure,
    premise: project.outline || undefined,
  })

  const result = await provider.generate(prompt, { temperature: 0.7 })
  const outline = parseJSON<OutlineResult>(result.content)

  const existing = await prisma.shortStory.findUnique({
    where: { projectId: params.projectId },
  })

  let shortStory

  if (existing) {
    await prisma.shortStorySection.deleteMany({
      where: { storyId: existing.id },
    })

    shortStory = await prisma.shortStory.update({
      where: { id: existing.id },
      data: {
        structure: params.structure,
        targetWordCount: params.targetWordCount,
        premise: outline.premise,
      },
      include: { sections: true },
    })
  } else {
    shortStory = await prisma.shortStory.create({
      data: {
        projectId: params.projectId,
        structure: params.structure,
        targetWordCount: params.targetWordCount,
        premise: outline.premise,
      },
      include: { sections: true },
    })
  }

  const sectionCount = STRUCTURE_SECTIONS[params.structure].length
  const wordsPerSection = Math.floor(params.targetWordCount / sectionCount)

  for (const section of outline.sections) {
    await prisma.shortStorySection.create({
      data: {
        storyId: shortStory.id,
        sectionNumber: section.sectionNumber,
        title: section.title,
        sectionType: section.sectionType,
        emotionalTarget: section.emotionalTarget,
        wordCount: 0,
      },
    })
  }

  const updatedStory = await prisma.shortStory.findUnique({
    where: { id: shortStory.id },
    include: { sections: { orderBy: { sectionNumber: 'asc' } } },
  })

  logger.info({ projectId: params.projectId, sectionCount: outline.sections.length }, 'Short story outline generated')

  return {
    ...updatedStory,
    sectionWordTarget: wordsPerSection,
  }
}

export async function designShortEmotion(params: { projectId: number }) {
  const story = await prisma.shortStory.findUnique({
    where: { projectId: params.projectId },
    include: { sections: true, project: true },
  })

  if (!story) {
    throw new Error('短篇故事不存在，请先生成大纲')
  }

  const provider = await AIService.createProvider({
    projectId: params.projectId,
    usageType: 'SHORT_EMOTION',
  })

  const prompt = buildShortEmotionDesignPrompt({
    genre: story.project.genre || '未指定',
    structure: story.structure,
    premise: story.premise || '',
  })

  const result = await provider.generate(prompt, { temperature: 0.7 })
  const emotionDesign = parseJSON<EmotionDesign>(result.content)

  await prisma.shortStory.update({
    where: { id: story.id },
    data: {
      emotionalDesign: emotionDesign as unknown as object,
    },
  })

  logger.info({ projectId: params.projectId }, 'Short story emotion design generated')

  return emotionDesign
}

export async function designShortReversal(params: { projectId: number }) {
  const story = await prisma.shortStory.findUnique({
    where: { projectId: params.projectId },
    include: { sections: true, project: true },
  })

  if (!story) {
    throw new Error('短篇故事不存在，请先生成大纲')
  }

  const provider = await AIService.createProvider({
    projectId: params.projectId,
    usageType: 'SHORT_REVERSAL',
  })

  const prompt = buildShortReversalDesignPrompt({
    genre: story.project.genre || '未指定',
    premise: story.premise || '',
    sectionCount: story.sections.length,
  })

  const result = await provider.generate(prompt, { temperature: 0.7 })
  const reversalDesign = parseJSON<ReversalDesign>(result.content)

  await prisma.shortStory.update({
    where: { id: story.id },
    data: {
      reversalDesign: reversalDesign as unknown as object,
    },
  })

  logger.info({ projectId: params.projectId }, 'Short story reversal design generated')

  return reversalDesign
}

export async function designShortHooks(params: { projectId: number }) {
  const story = await prisma.shortStory.findUnique({
    where: { projectId: params.projectId },
    include: { sections: { orderBy: { sectionNumber: 'asc' } }, project: true },
  })

  if (!story) {
    throw new Error('短篇故事不存在，请先生成大纲')
  }

  const provider = await AIService.createProvider({
    projectId: params.projectId,
    usageType: 'SHORT_HOOKS',
  })

  const prompt = buildShortHookDesignPrompt({
    genre: story.project.genre || '未指定',
    structure: story.structure,
    sections: story.sections.map(s => ({
      number: s.sectionNumber,
      type: s.sectionType,
      title: s.title,
    })),
  })

  const result = await provider.generate(prompt, { temperature: 0.7 })
  const hookDesign = parseJSON<HookDesign>(result.content)

  await prisma.shortStory.update({
    where: { id: story.id },
    data: {
      hookDesign: hookDesign as unknown as object,
    },
  })

  logger.info({ projectId: params.projectId }, 'Short story hook design generated')

  return hookDesign
}

export async function writeShortSection(params: {
  projectId: number
  sectionNumber: number
  onChunk?: (text: string) => void
}): Promise<{ content: string; wordCount: number }> {
  const story = await prisma.shortStory.findUnique({
    where: { projectId: params.projectId },
    include: {
      sections: { orderBy: { sectionNumber: 'asc' } },
      project: true,
    },
  })

  if (!story) {
    throw new Error('短篇故事不存在，请先生成大纲')
  }

  const section = story.sections.find(s => s.sectionNumber === params.sectionNumber)
  if (!section) {
    throw new Error(`段落 ${params.sectionNumber} 不存在`)
  }

  const previousSections = story.sections.filter(s => s.sectionNumber < params.sectionNumber)
  const previousContent = previousSections
    .map(s => s.content || '')
    .filter(Boolean)
    .join('\n\n')

  const sectionCount = story.sections.length
  const wordsPerSection = Math.floor(story.targetWordCount / sectionCount)

  const reversalDesign = story.reversalDesign as ReversalDesign | null
  const hookDesign = story.hookDesign as HookDesign | null

  let reversalHint = ''
  if (reversalDesign?.reversals) {
    const sectionReversal = reversalDesign.reversals.find(r => r.sectionNumber === params.sectionNumber)
    if (sectionReversal) {
      reversalHint = `本段反转：${sectionReversal.description}（类型：${sectionReversal.type}）`
    }
  }

  let hookHint = ''
  if (hookDesign?.hooks) {
    const sectionHook = hookDesign.hooks.find(h => h.sectionNumber === params.sectionNumber)
    if (sectionHook) {
      hookHint = `开头钩子：${sectionHook.openingHook.description}（${sectionHook.openingHook.type}）\n结尾钩子：${sectionHook.closingHook.description}（${sectionHook.closingHook.type}）`
    }
  }

  const provider = await AIService.createProvider({
    projectId: params.projectId,
    usageType: 'SHORT_WRITING',
  })

  const prompt = buildShortWritingPrompt({
    title: story.project.title,
    genre: story.project.genre || '未指定',
    sectionNumber: section.sectionNumber,
    sectionType: section.sectionType,
    sectionTitle: section.title,
    premise: story.premise || '',
    previousContent: previousContent.slice(-3000),
    emotionalTarget: section.emotionalTarget,
    targetWordCount: wordsPerSection,
    hookDesign: hookHint || undefined,
    reversalDesign: reversalHint || undefined,
  })

  let fullContent = ''

  if (params.onChunk) {
    for await (const token of provider.generateStream(prompt, { temperature: 0.8 })) {
      fullContent += token
      params.onChunk(token)
    }
  } else {
    const result = await provider.generate(prompt, { temperature: 0.8 })
    fullContent = result.content
  }

  const wordCount = countChineseWords(fullContent)

  await prisma.shortStorySection.update({
    where: {
      storyId_sectionNumber: {
        storyId: story.id,
        sectionNumber: params.sectionNumber,
      },
    },
    data: {
      content: fullContent,
      wordCount,
    },
  })

  const totalWordCount = story.sections.reduce((sum, s) => {
    if (s.sectionNumber === params.sectionNumber) return sum + wordCount
    return sum + s.wordCount
  }, 0)

  await prisma.shortStory.update({
    where: { id: story.id },
    data: { currentWordCount: totalWordCount },
  })

  logger.info({
    projectId: params.projectId,
    sectionNumber: params.sectionNumber,
    wordCount,
  }, 'Short story section written')

  return { content: fullContent, wordCount }
}

export async function getShortStory(projectId: number) {
  const story = await prisma.shortStory.findUnique({
    where: { projectId },
    include: {
      sections: { orderBy: { sectionNumber: 'asc' } },
      project: true,
    },
  })

  if (!story) return null

  return story
}
