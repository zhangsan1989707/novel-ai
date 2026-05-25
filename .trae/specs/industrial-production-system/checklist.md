# Checklist

## 基础设施
- [ ] Prisma 数据模型全部创建并通过 `prisma migrate dev` 迁移
- [ ] TypeScript 类型定义完整且编译无错误
- [ ] `npm run build` 通过（Phase 1 结束时）

## PlatformStyleEngine
- [ ] 5 个平台模板配置完整（起点/番茄/飞卢/晋江/七猫）
- [ ] `getPlatformTemplate(platform)` 返回正确的节奏/爽点/钩子参数
- [ ] `getStylePrompt()` 生成的提示词包含平台适配指令

## BatchPlanner
- [ ] `calculateBatchSize()` 根据不同平台/阶段/复杂度返回合理批次大小
- [ ] 批次大小在 10-30 范围内
- [ ] 番茄平台批次偏小（快节奏），起点平台批次偏大

## OutlineValidator
- [ ] 进度 < 85% 时检测到「大结局」「终局」等关键词并返回 violation
- [ ] 进度 >= 85% 时不拦截
- [ ] 校验结果包含 warnings 和 violations 列表

## WorldExpansionEngine
- [ ] `shouldExpandWorld()` 在新 Arc 开始时返回 true
- [ ] `generateExpansionPrompt()` 包含地图/势力/修炼/阶级/文明维度
- [ ] 同一 Arc 内不重复扩张

## VillainLifecycleManager
- [ ] 进度 < 70% 时 `shouldIntroduceFinalBoss()` 返回 false
- [ ] 阶段 Boss 标记为 `stage` tier
- [ ] 终极 Boss 标记为 `final` tier

## StorySteering
- [ ] 7 个维度（pace/darkness/humor/romance/powerGrowth/conflictIntensity/mysteryDensity）可独立调节
- [ ] `parseSteeringAction('更爽')` 正确增加相关维度值
- [ ] `applySteering()` 将参数正确注入提示词

## ContextBudgetManager
- [ ] 预算分配比例总和 = 100%
- [ ] `buildChapterContext()` 返回完整上下文字段
- [ ] `trimContext()` 优先丢弃老正文/过期角色/已关闭伏笔
- [ ] 当前目标/活跃伏笔/主角状态/世界规则绝不被裁剪

## LongNovelController
- [ ] 集成所有子引擎（BatchPlanner, OutlineValidator, WorldExpansionEngine, VillainLifecycleManager）
- [ ] `getNextBatchContext()` 返回下一批次的完整上下文
- [ ] `shouldAdvanceArc()` 正确判断阶段推进时机

## NarrativeDirector
- [ ] `directChapter()` 为每章生成导演指令
- [ ] 导演指令包含：StorySteering + ArcPlan + PlatformTemplate + WorldState + VillainState
- [ ] Writer Agent 能正确消费导演指令

## ModelFallbackPolicy
- [ ] Agent 到模型优先级映射正确
- [ ] 超时→重试→降级→暂停 链路完整
- [ ] 降级后不影响其他 Agent

## GenerationJob + PipelineCheckpoint
- [ ] `createJob()` 创建异步任务记录
- [ ] `executeJob()` 按序执行流水线步骤
- [ ] 每步完成后保存 checkpoint
- [ ] `resumeJob()` 从失败步骤恢复
- [ ] 前端可通过 SSE 订阅任务进度

## 极简项目创建页
- [ ] 5 个必填项正确显示（平台、题材、卖点、风格、长度）
- [ ] 高级模式默认折叠
- [ ] 「开始创作」按钮触发全自动流水线
- [ ] 不再显示卷数、章节数等 AI 自动控制的字段

## 项目详情页（创作总控台）
- [ ] 流水线进度面板正确显示当前步骤
- [ ] StorySteering 面板可调节 7 个维度
- [ ] 章节预览列表按 Arc 分组展示
- [ ] 工具箱入口可用
- [ ] 不再有复杂的目录 Tab 和正文 Tab 独立操作

## 编辑器预览模式
- [ ] 主区域为只读预览
- [ ] 工具栏：AI 续写、AI 重写、AI 改风格、AI 去 AI 味 可用
- [ ] 手工编辑在独立面板中（非默认显示）
- [ ] 移除富文本复杂编辑功能

## 工具箱
- [ ] 7 个工具（去AI味、改番茄风格、爽文增强、扩写、压缩、对话增强、打脸增强）可用
- [ ] 每个工具独立弹窗
- [ ] 不进入主流程

## 流水线 API
- [ ] `/pipeline/start` 启动后创建 GenerationJob 并异步执行
- [ ] `/pipeline/status` 返回当前步骤和进度
- [ ] `/pipeline/resume` 从 checkpoint 恢复
- [ ] `/steering` 正确更新 StorySteering 参数

## 三层目录 API
- [ ] Blueprint API 返回核心方向（不生成完整章节列表）
- [ ] ArcPlan API 返回当前阶段的 Arc 规划
- [ ] 目录生成 API 只生成当前批次（10-30 章）

## 全流程端到端测试
- [ ] 创建项目 → 一键启动 → 自动生成 Blueprint → ArcPlan → 目录 → 逐章正文 → 可预览
- [ ] 中间步骤出错后能从 checkpoint 恢复
- [ ] StorySteering 调节后生成风格明显变化
- [ ] 平台切换后节奏/爽点密度有明显差异
- [ ] 进度 < 85% 时不出现大结局内容
- [ ] `npm run build` 通过
- [ ] 部署到线上后功能正常