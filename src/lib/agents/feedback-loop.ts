/**
 * Agent 反馈循环管理器
 * 实现写作→校验→重写的自动修正流程
 */
import { writerAgent } from './writer'
import { validatorAgent } from './validator'
import { polisherAgent } from './polisher'
import type { ChapterOutline, CharacterProfile, PlotlineData } from '../engine/types'
import { logAIGeneration } from '@/lib/logger'

interface FeedbackLoopConfig {
  maxIterations: number
  passThreshold: number
  enablePolisher: boolean
  enableQuickFix: boolean
}

interface FeedbackLoopInput {
  projectId: number
  chapterNo: number
  outline: ChapterOutline
  characterProfiles: CharacterProfile[]
  recentSummaries: { chapterNo: number; summary: string }[]
  openPlotlines: PlotlineData[]
  worldSetting?: string | null
  writingStyle?: string | null
  genre?: string | null
  targetWordCount: number
  config?: Partial<FeedbackLoopConfig>
}

interface FeedbackLoopResult {
  success: boolean
  content: string
  iterations: number
  reports: Array<{
    iteration: number
    score: number
    issues: string[]
    action: string
  }>
  finalScore: number
  error?: string
}

const DEFAULT_CONFIG: FeedbackLoopConfig = {
  maxIterations: 3,
  passThreshold: 85,
  enablePolisher: true,
  enableQuickFix: true,
}

export async function runFeedbackLoop(
  input: FeedbackLoopInput,
  onProgress?: (info: { iteration: number; action: string; score?: number }) => void,
  onChunk?: (text: string) => void
): Promise<FeedbackLoopResult> {
  const config = { ...DEFAULT_CONFIG, ...input.config }
  const reports: FeedbackLoopResult['reports'] = []
  
  let currentContent = ''
  const currentOutline = input.outline
  
  logAIGeneration(input.projectId, input.chapterNo, 'feedback_loop_start', { config })

  for (let iteration = 1; iteration <= config.maxIterations; iteration++) {
    logAIGeneration(input.projectId, input.chapterNo, 'feedback_loop_iteration', { iteration })
    onProgress?.({ iteration, action: '正在生成章节内容...' })

    // 1. 写作 Agent 生成内容
    try {
      const writerResult = await writerAgent({
        projectId: input.projectId,
        chapterNo: input.chapterNo,
        projectTitle: '', // 将从上下文获取
        outline: currentOutline,
        characterProfiles: input.characterProfiles,
        recentSummaries: input.recentSummaries,
        targetWordCount: input.targetWordCount,
        genre: input.genre || undefined,
        writingStyle: input.writingStyle || undefined,
        worldSetting: input.worldSetting || undefined,
      })
      currentContent = writerResult.content
      onChunk?.(currentContent)
      
      logAIGeneration(input.projectId, input.chapterNo, 'writer_completed', { 
        iteration, 
        wordCount: currentContent.length 
      })
    } catch (error) {
      return {
        success: false,
        content: '',
        iterations: iteration,
        reports,
        finalScore: 0,
        error: `写作失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }
    }

    // 2. 校验 Agent 验证内容
    onProgress?.({ iteration, action: '正在进行质量校验...' })
    
    let validationReport
    try {
      validationReport = await validatorAgent({
        projectId: input.projectId,
        chapterNo: input.chapterNo,
        newChapterContent: currentContent,
        characterProfiles: input.characterProfiles,
        recentSummaries: input.recentSummaries,
        worldSetting: input.worldSetting || undefined,
        openPlotlines: input.openPlotlines,
        chapterTitle: currentOutline.chapterTitle,
        chapterGoal: currentOutline.chapterGoal,
      })
      
      logAIGeneration(input.projectId, input.chapterNo, 'validator_completed', {
        iteration,
        score: validationReport.score,
        result: validationReport.result,
        issueCount: validationReport.issues.length,
      })
    } catch (error) {
      reports.push({
        iteration,
        score: 0,
        issues: [`校验失败: ${error instanceof Error ? error.message : '未知错误'}`],
        action: '校验失败，跳过',
      })
      continue
    }

    // 记录报告
    reports.push({
      iteration,
      score: validationReport.score,
      issues: validationReport.issues.map(i => `[${i.severity}] ${i.description}`),
      action: validationReport.result === 'pass' ? '通过' : validationReport.result === 'fail' ? '需要重写' : '需要修正',
    })

    // 检查是否通过
    if (validationReport.score >= config.passThreshold && validationReport.result === 'pass') {
      logAIGeneration(input.projectId, input.chapterNo, 'validation_passed', { iteration, score: validationReport.score })
      
      // 3. 可选：润色 Agent 优化
      if (config.enablePolisher) {
        onProgress?.({ iteration, action: '正在进行文风优化...' })
        
        try {
          const polishedContent = await polisherAgent({
            projectId: input.projectId,
            chapterNo: input.chapterNo,
            content: currentContent,
            writingStyle: input.writingStyle || undefined,
            genre: input.genre || undefined,
            chapterTitle: currentOutline.chapterTitle,
          })
          currentContent = polishedContent.content
          
          logAIGeneration(input.projectId, input.chapterNo, 'polisher_completed', { iteration })
        } catch (error) {
          logAIGeneration(input.projectId, input.chapterNo, 'polisher_failed', { 
            iteration, 
            error: error instanceof Error ? error.message : '未知错误' 
          })
        }
      }

      return {
        success: true,
        content: currentContent,
        iterations: iteration,
        reports,
        finalScore: validationReport.score,
      }
    }

    // 如果有 major 或 critical 问题，进行修正
    const majorIssues = validationReport.issues.filter(i => i.severity === 'major' || i.severity === 'critical')
    const criticalIssues = validationReport.issues.filter(i => i.severity === 'critical')

    if (criticalIssues.length > 0) {
      // Critical 问题：需要根据建议调整大纲
      onProgress?.({ iteration, action: '发现严重问题，正在调整大纲...' })
      
      // 在下一次迭代中，大纲需要根据校验反馈调整
      // 这里可以添加自动调整大纲的逻辑
      logAIGeneration(input.projectId, input.chapterNo, 'critical_issues_found', {
        iteration,
        issues: criticalIssues.map(i => i.description),
      })
    }

    // 如果是最后一次迭代，返回当前最佳结果
    if (iteration === config.maxIterations) {
      logAIGeneration(input.projectId, input.chapterNo, 'max_iterations_reached', { 
        score: validationReport.score 
      })
      
      // 即使没达到阈值，也返回当前结果，让用户决定是否使用
      return {
        success: validationReport.score >= 60, // 60分为最低可接受分数
        content: currentContent,
        iterations: iteration,
        reports,
        finalScore: validationReport.score,
        error: validationReport.score < config.passThreshold 
          ? `质量分数 ${validationReport.score} 未达到阈值 ${config.passThreshold}，但已达到最低标准` 
          : undefined,
      }
    }
  }

  // 理论上不会到这里
  return {
    success: false,
    content: currentContent,
    iterations: config.maxIterations,
    reports,
    finalScore: 0,
    error: '未知错误',
  }
}

// 导出配置类型
export type { FeedbackLoopConfig, FeedbackLoopInput, FeedbackLoopResult }
