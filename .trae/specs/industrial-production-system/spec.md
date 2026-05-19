# AI 长篇网文工业化生产系统 Spec

## Why
当前项目定位偏「Word + AI」，重编辑器、重参数配置、重人工参与。需要升级为「AI 网文导演系统」——用户给灵感，AI 自动生产整本书，支持无限续写，防止长篇崩坏和提前结局。

## What Changes
- **BREAKING**: 项目创建页从大表单重构为极简模式（平台、题材、卖点、风格、长度类型）
- **BREAKING**: 编辑器从写作主界面降级为结果预览器，手工编辑移入工具箱
- **BREAKING**: 目录系统从一次性全书目录改为三级结构：Book Blueprint → Arc Plan → Chapter Batch Outline
- **BREAKING**: 正文生成从手动触发改为全自动一键式流水线
- 新增 StorySteering 方向控制系统（用户高层调节节奏/黑暗度/爽度等）
- 新增 LongNovelController 长篇意识系统（防提前结局、世界扩张、无限续写稳定）
- 新增 NarrativeDirector Agent 总导演协调器
- 新增 PlatformStyleEngine 平台模板系统
- 新增 BatchPlanner 动态批次规划器
- 新增 OutlineValidator 防提前结局校验器
- 新增 WorldExpansionEngine 世界扩张引擎
- 新增 VillainLifecycleManager 反派生命周期管理
- 新增 GenerationJob 异步任务系统
- 新增 PipelineCheckpoint 断点续传
- 新增 ContextBudgetManager 上下文预算管理
- 新增 ModelFallbackPolicy 模型降级策略
- 新增工具箱系统（AI 去 AI 味、风格转换、爽文增强等独立工具）

## Impact
- Affected specs: 全部现有功能模块
- Affected code: 
  - `src/app/(main)/projects/new/` — 项目创建页重构
  - `src/app/(main)/projects/[projectId]/` — 项目详情页重构
  - `src/components/chapter/ChapterEditor.tsx` — 编辑器降级
  - `src/lib/agents/` — 新增 NarrativeDirector
  - `src/lib/engine/` — 新增 LongNovelController、WorldExpansionEngine 等
  - `src/app/api/novel/` — 新增流水线 API、GenerationJob API
  - `prisma/schema.prisma` — 新增数据模型
  - `src/types/` — 新增类型定义

## ADDED Requirements

### Requirement 1: 极简项目创建
系统 SHALL 提供极简项目创建表单，仅包含 5 个必填项。

#### Scenario: 用户快速创建项目
- **WHEN** 用户访问项目创建页
- **THEN** 看到 5 个必填项：平台（起点/番茄/飞卢/晋江/七猫）、题材、一句话卖点、风格、长度类型（短/中/长/超长）
- **AND** 高级选项（主角设定、世界观、禁忌、参考书）默认折叠
- **AND** 不再显示卷数、章节结构、节奏控制等 AI 自动控制的字段

### Requirement 2: 全自动一键式流水线
系统 SHALL 支持用户一键启动全自动写作流水线。

#### Scenario: 一键启动自动写作
- **WHEN** 用户创建项目后点击「开始创作」
- **THEN** AI 按序自动执行：生成 Book Blueprint → Arc Plan → 批次规划 → 阶段目录 → 逐章生成 → 校验 → 润色 → 去 AI 味 → 摘要 → 更新状态 → 进入下一阶段
- **AND** 全流程无需用户手动触发各步骤
- **AND** 用户可随时通过 StorySteering 面板调整方向

### Requirement 3: 三级目录结构
系统 SHALL 使用 Book Blueprint → Arc Plan → Chapter Batch 三级结构替代一次性全书目录。

#### Scenario: AI 自动规划目录
- **WHEN** AI 开始规划目录
- **THEN** 先生成 Book Blueprint（核心卖点、世界方向、主线方向、成长方向、终局可能性，不生成完整章节）
- **AND** 再生成 Arc Plan（当前阶段：开局/成长/扩张/中期冲突/大战前夕/终局）
- **AND** 最后生成 Chapter Batch（当前批次 10-30 章，AI 自动决定批次大小）
- **AND** 只有当前批次章节显示为可写目录

### Requirement 4: StorySteering 方向控制
系统 SHALL 提供 StorySteering 面板让用户做高层风格调节。

#### Scenario: 用户调节故事风格
- **WHEN** 用户点击「更爽」「更快」「更黑暗」「增加感情线」等按钮
- **THEN** 系统更新 pace/darkness/humor/romance/powerGrowth/conflictIntensity/mysteryDensity 参数
- **AND** AI 在后续生成中自动调整内部节奏适配新参数

### Requirement 5: 防提前结局
系统 SHALL 通过 OutlineValidator 防止 AI 提前写出大结局。

#### Scenario: 进度不足时禁止结局
- **WHEN** 当前进度 < 85% 总预计章节
- **THEN** 校验器禁止目录/正文中出现：最终Boss死亡、世界终局、全部伏笔回收、主线完成、大结局语义
- **AND** 检测到关键词（终局、大结局、最终决战、天下太平、一切结束、终焉）时标记警告

### Requirement 6: 世界扩张引擎
系统 SHALL 通过 WorldExpansionEngine 确保持续扩张世界不写死。

#### Scenario: AI 持续扩张世界
- **WHEN** 进入新的 Arc 阶段
- **THEN** AI 必须扩张：地图范围、势力数量、世界层级、修炼体系上限、阶级结构、文明层级
- **AND** 避免前期把世界范围写死

### Requirement 7: 反派生命周期管理
系统 SHALL 通过 VillainLifecycleManager 管理反派层级。

#### Scenario: 阶段 Boss 标记
- **WHEN** AI 生成反派角色时
- **THEN** 前期 Boss 标记为阶段 Boss，不标记为终极 Boss
- **AND** 终极 Boss 只在进度 > 70% 时才能出场

### Requirement 8: 平台模板系统
系统 SHALL 根据用户选择的平台自动适配节奏/爽点密度/钩子频率。

#### Scenario: 番茄小说模板
- **WHEN** 用户选择「番茄」平台
- **THEN** AI 采用快节奏、高爽点密度、高钩子频率的模板

#### Scenario: 起点中文模板
- **WHEN** 用户选择「起点」平台
- **THEN** AI 采用中节奏、高伏笔密度、高成长密度的模板

#### Scenario: 飞卢模板
- **WHEN** 用户选择「飞卢」平台
- **THEN** AI 采用超快节奏、极高爽点密度的模板

### Requirement 9: NarrativeDirector Agent
系统 SHALL 新增 NarrativeDirector Agent 负责全书节奏、世界扩张、长篇稳定、阶段控制、爽点控制、主线推进。

#### Scenario: Director 协调各 Agent
- **WHEN** 每章生成前
- **THEN** Director 检查当前 Arc 目标、StorySteering 参数、进度比例
- **AND** 将协调后的上下文注入 Writer Agent
- **AND** 避免各 Agent 各写各的导致剧情不一致

### Requirement 10: 编辑器降级
系统 SHALL 将章节编辑器降级为结果预览器。

#### Scenario: 查看生成结果
- **WHEN** 用户点击章节进入编辑页
- **THEN** 主区域为只读预览，支持 AI 续写、AI 重写、AI 改风格、AI 去 AI 味
- **AND** 手工编辑入口移到工具栏/工具箱中，不在主界面
- **AND** 移除富文本复杂编辑功能

### Requirement 11: 工具箱系统
系统 SHALL 提供独立的工具箱面板。

#### Scenario: 使用工具箱
- **WHEN** 用户打开工具箱
- **THEN** 看到：AI 去 AI 味、AI 改番茄风格、AI 爽文增强、AI 扩写、AI 压缩、AI 对话增强、AI 打脸增强
- **AND** 工具不进入主流程，作为独立操作

### Requirement 12: GenerationJob 异步任务
系统 SHALL 通过 GenerationJob 异步执行流水线，避免一次请求超时。

#### Scenario: 异步生成任务
- **WHEN** 启动自动写作流水线
- **THEN** 创建 GenerationJob，记录 type/status/currentStep/retryCount
- **AND** 前端轮询或 SSE 订阅任务状态
- **AND** 每步骤完成后保存 PipelineCheckpoint

### Requirement 13: PipelineCheckpoint 断点续传
系统 SHALL 在流水线每个步骤完成后保存 checkpoint。

#### Scenario: 模型超时后恢复
- **WHEN** 某个步骤因模型超时失败
- **THEN** 系统从最近 checkpoint 恢复，重试当前步骤
- **AND** 不影响已完成步骤的结果
- **AND** 不会整批失败

### Requirement 14: ContextBudgetManager 上下文预算
系统 SHALL 通过 ContextBudgetManager 管理每章生成的上下文分配。

#### Scenario: 上下文超限裁剪
- **WHEN** 上下文接近模型限制
- **THEN** 优先丢弃：老正文、过期角色、已关闭伏笔、旧阶段目标
- **AND** 保留：当前目标、活跃伏笔、主角状态、世界规则
- **AND** 按比例分配：blueprint 10%, arcPlan 15%, summaries 25%, plotlines 15%, characters 15%, styleGuide 10%, currentOutline 10%

### Requirement 15: ModelFallbackPolicy 模型降级
系统 SHALL 在模型超时/失败时执行降级策略。

#### Scenario: 模型超时降级
- **WHEN** 模型调用超时
- **THEN** 重试当前模型
- **AND** 仍失败则降级到备用模型
- **AND** 仍失败则暂停任务，通知用户
- **AND** 不同 Agent 使用不同级别模型（Planner 高质量，Writer 中文长文本，Validator 便宜逻辑，Summarizer 快速便宜，Deslopper 中等）

### Requirement 16: 动态批次大小
系统 SHALL 通过 BatchPlanner 根据平台/阶段/复杂度自动决定批次大小。

#### Scenario: 自动决定批次大小
- **WHEN** AI 规划当前批次的章节目录
- **THEN** 根据平台节奏、当前阶段、世界复杂度、剧情密度计算 batchSize
- **AND** batchSize 范围 10-30 章

## MODIFIED Requirements

### Requirement: 项目详情页（原 page.tsx）
系统 SHALL 重构项目详情页为创作总控台。
- 移除复杂的目录 Tab 和正文 Tab（被全自动流水线替代）
- 保留：流水线进度面板、StorySteering 面板、章节预览列表（只读）
- 新增：阶段进度可视化、工具箱入口

### Requirement: 目录生成（原 ChapterListGenerator）
系统 SHALL 重构目录生成为阶段批次生成。
- 移除一次性全书目录生成
- 改为生成当前 Arc 阶段的 Chapter Batch（10-30 章）
- 目录项不再包含复杂编辑操作

### Requirement: 正文生成（原 generate/stream）
系统 SHALL 重构为逐章串联生成。
- 移除批量生成（一次生成多章）
- 改为：生成第 N 章 → 摘要 → 更新 StoryState → 更新 Plotline → 生成第 N+1 章
- 每章生成后自动进入下一章

## REMOVED Requirements

### Requirement: 手动写作功能
**Reason**: 编辑器降级为预览器，手动逐字写作不符合「AI 导演系统」定位
**Migration**: 手工编辑移入工具箱，作为独立辅助工具

### Requirement: 一次性全书目录
**Reason**: 导致 AI 理解为完整故事，造成提前结局、世界写死
**Migration**: 改为三级目录结构，只生成当前批次章节

### Requirement: 批量生成多章正文
**Reason**: 一次生成 20 章会导致长篇失控、剧情不连贯
**Migration**: 改为逐章串联生成 + StoryState 更新