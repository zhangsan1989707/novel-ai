import { countChineseWords } from '@/lib/utils'

type ProjectWordCountDb = {
  novelChapter: {
    aggregate(args: {
      where: { projectId: number }
      _sum: { wordCount: true }
    }): Promise<{ _sum: { wordCount: number | null } }>
  }
  novelProject: {
    update(args: {
      where: { id: number }
      data: { currentWordCount: number }
    }): Promise<unknown>
  }
}

export function countChapterWords(content?: string | null): number {
  return countChineseWords(content || '')
}

export async function getProjectChapterWordCount(db: ProjectWordCountDb, projectId: number): Promise<number> {
  const totalWordCount = await db.novelChapter.aggregate({
    where: { projectId },
    _sum: { wordCount: true },
  })

  return totalWordCount._sum.wordCount || 0
}

export async function syncProjectChapterWordCount(db: ProjectWordCountDb, projectId: number): Promise<number> {
  const currentWordCount = await getProjectChapterWordCount(db, projectId)
  await db.novelProject.update({
    where: { id: projectId },
    data: { currentWordCount },
  })

  return currentWordCount
}
