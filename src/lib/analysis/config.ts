import { AnalysisDimension } from '@/types'

export const ANALYSIS_DIMENSIONS = [
  AnalysisDimension.STORY_OVERVIEW,
  AnalysisDimension.CHARACTER_RELATION,
  AnalysisDimension.CHARACTER_ARC,
  AnalysisDimension.PLOT_LINE,
  AnalysisDimension.FORESHADOWING,
  AnalysisDimension.CHAPTER_STRUCTURE,
  AnalysisDimension.READING_EXPERIENCE,
  AnalysisDimension.WORLD_SETTING,
  AnalysisDimension.STYLE_PROFILE,
] as const

export const DEFAULT_ANALYSIS_DIMENSIONS = [...ANALYSIS_DIMENSIONS]

export const ANALYSIS_DIMENSION_LABELS: Record<AnalysisDimension, string> = {
  [AnalysisDimension.STORY_OVERVIEW]: '故事总览',
  [AnalysisDimension.CHARACTER_RELATION]: '人物关系',
  [AnalysisDimension.CHARACTER_ARC]: '角色成长',
  [AnalysisDimension.PLOT_LINE]: '剧情线',
  [AnalysisDimension.FORESHADOWING]: '伏笔悬念',
  [AnalysisDimension.CHAPTER_STRUCTURE]: '章节结构',
  [AnalysisDimension.READING_EXPERIENCE]: '阅读体验',
  [AnalysisDimension.WORLD_SETTING]: '世界观设定',
  [AnalysisDimension.STYLE_PROFILE]: '文风提取',
}

export const ANALYSIS_DIMENSION_DESCRIPTIONS: Record<AnalysisDimension, string> = {
  [AnalysisDimension.STORY_OVERVIEW]: '提炼题材定位、主冲突、阶段大纲和卖点',
  [AnalysisDimension.CHARACTER_RELATION]: '分析角色关系、阵营和核心矛盾',
  [AnalysisDimension.CHARACTER_ARC]: '梳理主角成长线、配角功能和反派压迫感',
  [AnalysisDimension.PLOT_LINE]: '梳理主线、副线、关键转折与时间线',
  [AnalysisDimension.FORESHADOWING]: '标记伏笔、悬念和回收情况',
  [AnalysisDimension.CHAPTER_STRUCTURE]: '分析章节功能、节奏分布和结构推进',
  [AnalysisDimension.READING_EXPERIENCE]: '评估开篇抓力、爽点、章尾钩子和疲劳段',
  [AnalysisDimension.WORLD_SETTING]: '提取世界观、规则体系和设定兑现度',
  [AnalysisDimension.STYLE_PROFILE]: '深度提取小说文笔、句式、修辞、叙事、剧情、人物创作风格',
}

export const ANALYSIS_FORMAT_TEMPLATES: Record<AnalysisDimension, string> = {
  [AnalysisDimension.STORY_OVERVIEW]: `{
  "positioning": {
    "genreLabel": "题材定位",
    "targetReader": "目标读者",
    "coreHook": "核心钩子",
    "sellingPoints": ["卖点1", "卖点2"]
  },
  "outline": {
    "premise": "一句话前提",
    "coreConflict": "核心冲突",
    "goalLine": "主角目标",
    "stageBreakdown": [
      { "stage": "开篇/成长/转折/高潮/收束", "chapterRange": "1-20", "summary": "阶段摘要" }
    ],
    "endingShape": "结局形态"
  },
  "strengths": ["优势1", "优势2"],
  "risks": ["风险1", "风险2"],
  "summary": "100-200字整书总评"
}`,
  [AnalysisDimension.CHARACTER_RELATION]: `{
  "characters": [
    {
      "name": "角色名",
      "role": "protagonist|antagonist|supporting|minor",
      "importance": 1,
      "description": "角色描述（50-100字）",
      "relationships": [
        { "target": "相关角色", "type": "关系类型如：盟友/敌对/爱慕", "description": "关系描述" }
      ]
    }
  ],
  "summary": "人物关系整体概述（100-200字）"
}`,
  [AnalysisDimension.CHARACTER_ARC]: `{
  "protagonistArc": {
    "startState": "初始状态",
    "growthStages": ["阶段1", "阶段2"],
    "turningPoints": [{ "chapter": 12, "event": "关键转折" }],
    "endState": "阶段性终态"
  },
  "supportingArcs": [
    { "name": "配角名", "function": "功能定位", "arc": "成长弧或作用" }
  ],
  "antagonistPressure": {
    "mainAntagonist": "主要反派",
    "pressureSources": ["压迫来源1", "压迫来源2"],
    "effectiveness": "压迫感评价"
  },
  "summary": "角色成长线结论"
}`,
  [AnalysisDimension.PLOT_LINE]: `{
  "mainPlot": [
    { "title": "主线标题", "keyEvents": ["关键事件1", "关键事件2"], "emotionalArc": "情感弧线描述" }
  ],
  "subPlots": [
    { "title": "副线标题", "keyEvents": ["关键事件"], "relationship": "与主线关联" }
  ],
  "timeline": [
    { "event": "事件", "chapter": 章节号, "significance": "major|minor" }
  ],
  "turningPoints": [
    { "chapter": 章节号, "event": "转折事件", "impact": "转折作用" }
  ]
}`,
  [AnalysisDimension.FORESHADOWING]: `{
  "items": [
    {
      "setup": "伏笔内容（首次出现）",
      "description": "伏笔描述（30-50字）",
      "payoff": "回收位置（章节号或待回收）",
      "chapter": 章节号,
      "importance": "major|minor",
      "type": "plot|character|world|prophecy"
    }
  ],
  "unresolved": ["未回收伏笔列表"],
  "payoffQuality": "伏笔回收质量评价"
}`,
  [AnalysisDimension.CHAPTER_STRUCTURE]: `{
  "chapters": [
    {
      "number": 1,
      "title": "章节标题",
      "function": "setup|development|climax|resolution|transition",
      "keyEvents": ["关键事件"],
      "wordCount": 字数,
      "emotionalBeat": "本章情感基调"
    }
  ],
  "arcAnalysis": "整体结构分析（200-300字）",
  "pacingAssessment": "节奏评估",
  "slowSections": [{ "chapterRange": "21-30", "reason": "原因" }],
  "peakSections": [{ "chapterRange": "31-36", "reason": "高点原因" }]
}`,
  [AnalysisDimension.READING_EXPERIENCE]: `{
  "scores": {
    "openingHook": 80,
    "pacing": 78,
    "immersion": 76,
    "chapterEndingHook": 82,
    "readerRetention": 79
  },
  "readingFeel": {
    "hookSummary": "开篇抓力评价",
    "wowPointSummary": "爽点或满足感评价",
    "fatigueSummary": "阅读疲劳风险总结",
    "chapterEndingSummary": "章尾留钩评价"
  },
  "highlightChapters": [
    { "chapter": 12, "reason": "阅读体验高点原因" }
  ],
  "fatigueChapters": [
    { "chapterRange": "24-29", "reason": "疲劳原因" }
  ],
  "readerTakeaway": "读者可能最强感受"
}`,
  [AnalysisDimension.WORLD_SETTING]: `{
  "settings": [
    {
      "name": "设定名称",
      "description": "详细描述（100-200字）",
      "rules": ["规则1", "规则2"],
      "firstAppear": "首次出现章节"
    }
  ],
  "powerSystem": {
    "name": "力量体系名称",
    "levels": ["等级1", "等级2"],
    "rules": ["修炼规则1", "规则2"]
  },
  "locations": [
    { "name": "地名", "description": "描述", "significance": "重要程度" }
  ],
  "consistency": "设定一致性评价"
}`,
  [AnalysisDimension.STYLE_PROFILE]: `{
  "prose": {
    "overallTone": "整体文笔语气",
    "sentenceLength": "short|medium|long|mixed",
    "rhythm": "节奏描述",
    "descriptionDensity": 50,
    "dialogueDensity": 30,
    "innerMonologueDensity": 10
  },
  "vocabulary": {
    "commonWords": ["高频词1", "高频词2"],
    "forbiddenWords": ["应避免词1"],
    "idiomLevel": "low|medium|high",
    "modernity": "classical|modern|webnovel"
  },
  "sentence": {
    "commonPatterns": ["句式1", "句式2"],
    "paragraphPattern": "段落特征",
    "transitionStyle": "过渡方式"
  },
  "rhetoric": {
    "devices": ["比喻", "白描"],
    "metaphorStyle": "比喻风格",
    "ironyLevel": 20,
    "sensoryDetail": "感官描写特征"
  },
  "narrative": {
    "pov": "third_limited",
    "narratorPresence": 30,
    "expositionStyle": "信息揭示方式",
    "suspenseMethod": "悬念手法"
  },
  "plot": {
    "pacing": "节奏特征",
    "conflictDensity": 70,
    "reversalFrequency": 30,
    "cliffhangerStyle": "章尾钩子特征",
    "payoffPattern": "爽点兑现方式"
  },
  "character": {
    "protagonistPattern": "主角塑造模式",
    "dialogueStyle": "对话风格",
    "emotionalExpression": "情绪外化方式",
    "relationshipPattern": "人物关系特征"
  },
  "generationGuide": {
    "mustDo": ["风格必须遵循的要点1", "要点2"],
    "avoid": ["风格必须避免的1", "避免2"],
    "sampleInstruction": "生成指导说明"
  },
  "riskNotes": ["风险提示1"]
}`,
}

export const DEFAULT_CONTEXT_CHAPTER_COUNT = 3
