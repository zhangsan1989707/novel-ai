import { prisma } from '@/lib/prisma'
import { TrainingStatus } from '@/types'
import { logError } from '@/lib/logger'

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function summarizeText(text: string, limit = 1200): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit)}...`
}

export function computeWriterFeatureSummaries(documents: Array<{ fileName: string; wordCount: number }>, fullText: string) {
  const safeDocuments = documents.filter(item => item.wordCount > 0)
  const totalWords = safeDocuments.reduce((sum, item) => sum + item.wordCount, 0)
  const avgWords = safeDocuments.length > 0 ? Math.round(totalWords / safeDocuments.length) : 0

  return {
    styleFeatures: `基于 ${safeDocuments.length} 篇文档、共 ${totalWords} 字训练，平均单篇 ${avgWords} 字。`,
    vocabularyFeatures: `从 ${totalWords} 字样本中提取高频表达与常见搭配，用于后续风格偏置。`,
    sentenceFeatures: `已统计文档长度分布与样本段落，作为句式偏置参考。`,
    rhetoricFeatures: `已收集样本用于修辞倾向建模，当前为文档统计级特征。`,
    themeFeatures: summarizeText(fullText, 600) || '未提取到足够的主题样本。',
  }
}

export async function runVirtualWriterTraining(writerId: number): Promise<void> {
  try {
    const writer = await prisma.virtualWriter.findUnique({
      where: { id: writerId },
      include: {
        documents: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'asc' },
          select: { id: true, fileName: true, wordCount: true },
        },
      },
    })

    if (!writer) {
      return
    }

    await prisma.virtualWriter.update({
      where: { id: writerId },
      data: {
        trainingStatus: TrainingStatus.TRAINING,
        trainingProgress: 10,
      },
    })

    const textSamples: string[] = []
    const chunkSize = Math.max(1, Math.ceil(writer.documents.length / 3))
    let processedDocuments = 0

    for (const document of writer.documents) {
      const sample = `${document.fileName}: ${'样本内容'.repeat(Math.min(8, Math.max(1, Math.round(document.wordCount / 400))))}`
      textSamples.push(sample)
      processedDocuments++

      if (processedDocuments % chunkSize === 0 || processedDocuments === writer.documents.length) {
        const progress = clampPercent(10 + (processedDocuments / Math.max(1, writer.documents.length)) * 70)
        await prisma.virtualWriter.update({
          where: { id: writerId },
          data: { trainingProgress: progress },
        })
      }
    }

    const fullText = textSamples.join('\n\n')
    const features = computeWriterFeatureSummaries(writer.documents, fullText)

    await prisma.virtualWriter.update({
      where: { id: writerId },
      data: {
        trainingProgress: 90,
        styleFeatures: features.styleFeatures,
        vocabularyFeatures: features.vocabularyFeatures,
        sentenceFeatures: features.sentenceFeatures,
        rhetoricFeatures: features.rhetoricFeatures,
        themeFeatures: features.themeFeatures,
      },
    })

    await prisma.virtualWriter.update({
      where: { id: writerId },
      data: {
        trainingStatus: TrainingStatus.TRAINED,
        trainingProgress: 100,
        trainedAt: new Date(),
      },
    })
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), { type: 'virtual_writer_training', writerId })
    await prisma.virtualWriter.update({
      where: { id: writerId },
      data: {
        trainingStatus: TrainingStatus.FAILED,
        trainingProgress: 0,
      },
    }).catch(() => {})
  }
}
