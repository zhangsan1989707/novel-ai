# Changelog

所有重要的项目变更都将记录在此文件中。

## [Unreleased]

### 新增
- **章节列表生成功能** (`/api/novel/ai/generate-chapter-list`)
  - 支持 AI 批量生成章节目录
  - 支持三种标题风格：网文风格、传统风格、诗词风格
  - 支持自定义章节数量（1-500章）
  - 前端交互组件 `ChapterListGenerator`

### 改进
- **目标受众支持**
  - 新增 `targetAudience` 字段（MALE/FEMALE）
  - 在简介生成时自动注入目标受众信息

### 重构
- **提示词系统优化**
  - 统一提示词结构为四段式：基础信息/设定/任务/输出格式
  - 新增 Few-shot 示例
  - 增强去 AI 味约束

---

## [0.1.0] - 2024-05-15

### 新增

#### 核心功能
- **多智能体协作系统**
  - Planner Agent - 章节大纲策划
  - Writer Agent - 章节正文生成
  - Polisher Agent - 文笔润色优化
  - Validator Agent - 质量校验验证
  - Summarizer Agent - 章节摘要生成

- **项目管理**
  - 项目 CRUD 操作
  - 项目状态管理（DRAFT/WRITING/COMPLETED/PAUSED）
  - 项目筛选和搜索

- **章节管理**
  - 章节 CRUD 操作
  - 章节状态管理
  - 版本历史记录
  - 批量生成支持

- **角色系统**
  - 角色档案管理
  - 角色关系图可视化（React Flow）
  - 角色类型区分（主角/反派/配角/次要）

- **伏笔追踪**
  - 伏笔/支线/冲突管理
  - 自动伏笔回收
  - 伏笔计划章节设置

- **故事状态**
  - 情绪曲线追踪
  - 主线/支线冲突状态
  - 章节进度管理

- **分层摘要系统**
  - L1: 章节摘要（200-300字）
  - L2: 卷摘要（500-800字）
  - L3: 全书摘要（1000-1500字）

- **虚拟作家**
  - 风格特征定义
  - 文档上传和处理
  - 写作风格学习

- **AI 分析功能**
  - 情节分析
  - 风格分析
  - 章节节奏热力图
  - 章节校验

- **导出功能**
  - TXT 导出
  - Markdown 导出
  - JSON 导出
  - EPUB 导出

- **成本追踪**
  - AI 调用记录
  - Token 使用统计
  - 月度配额管理
  - 费用预警

#### 技术特性
- **多 AI 提供商支持**
  - OpenAI (GPT系列)
  - Anthropic (Claude系列)
  - 阿里云 (通义千问)
  - DeepSeek
  - MiniMax
  - 火山引擎 (字节跳动)

- **开发工具**
  - Vitest 单元测试
  - Playwright 端到端测试
  - ESLint 代码检查
  - Pino 日志系统

### 数据库模型
- User
- AIModelConfig
- NovelProject
- NovelChapter
- ChapterVersion
- VirtualWriter
- WriterDocument
- BookAnalysis
- SourceNovel
- Character
- Plotline
- StoryState
- StoryEvent
- AgentLog
- ChapterSummary
- VolumeSummary
- BookSummary
- ModelPricing
- UserQuota
- AIUsage

---

## 旧版本

[0.0.1] - Initial release (待补充)
