# 项目管理 API

## 概述

项目管理 API 提供小说的创建、查询、更新、删除等基础操作。所有接口遵循统一的响应格式。

## 基础信息

- **基础路径**：`/api/novel/projects`
- **认证方式**：Session 认证
- **内容类型**：`application/json`

## 响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... }
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "PROJECT_001",
    "message": "项目不存在或已被删除",
    "suggestions": [
      "检查项目ID是否正确",
      "刷新页面后重试"
    ]
  }
}
```

## 接口列表

### GET /api/novel/projects

获取当前用户的项目列表。

**请求参数**

| 参数 | 类型 | 位置 | 必填 | 说明 |
|------|------|------|------|------|
| `page` | number | query | 否 | 页码，默认 1 |
| `limit` | number | query | 否 | 每页数量，默认 20 |
| `status` | string | query | 否 | 筛选状态 |

**状态枚举**

| 值 | 说明 |
|-----|------|
| `ALL` | 全部 |
| `DRAFT` | 草稿 |
| `WRITING` | 创作中 |
| `COMPLETED` | 已完成 |
| `ARCHIVED` | 已归档 |

**响应示例**

```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": 1,
        "title": "修仙之路",
        "genre": "仙侠",
        "platform": "起点中文网",
        "status": "WRITING",
        "currentWordCount": 52000,
        "targetWordCount": 500000,
        "currentChapter": 23,
        "targetChapter": 200,
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-05-31T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1
    }
  }
}
```

---

### POST /api/novel/projects

创建新项目。

**请求体**

```json
{
  "title": "修仙之路",
  "genre": "仙侠",
  "platform": "起点中文网",
  "targetWordCount": 500000,
  "targetChapter": 200,
  "style": "严谨",
  "worldSetting": {
    "type": "修真世界",
    "powerSystem": "金丹元婴",
    "mainConflict": "正邪之争"
  },
  "tags": ["热血", "升级", "冒险"]
}
```

**请求参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 项目标题，2-50字符 |
| `genre` | string | 是 | 小说类型 |
| `platform` | string | 否 | 目标发布平台 |
| `targetWordCount` | number | 否 | 目标字数，默认 300000 |
| `targetChapter` | number | 否 | 目标章节数，默认 100 |
| `style` | string | 否 | 写作风格 |
| `worldSetting` | object | 否 | 世界观设定 |
| `tags` | string[] | 否 | 标签，最多5个 |

**成功响应**

```json
{
  "success": true,
  "data": {
    "id": 16,
    "title": "修仙之路",
    "genre": "仙侠",
    "status": "DRAFT",
    "createdAt": "2025-05-31T10:00:00Z"
  }
}
```

**错误响应**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_002",
    "message": "缺少必要的参数",
    "suggestions": ["请填写项目标题"]
  }
}
```

---

### GET /api/novel/projects/[id]

获取项目详情。

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | number | 项目ID |

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "修仙之路",
    "genre": "仙侠",
    "platform": "起点中文网",
    "status": "WRITING",
    "currentWordCount": 52000,
    "targetWordCount": 500000,
    "style": "严谨",
    "worldSetting": {
      "type": "修真世界",
      "powerSystem": "金丹元婴",
      "mainConflict": "正邪之争",
      "description": "详细的世界观描述..."
    },
    "characters": [
      {
        "id": 1,
        "name": "张三",
        "role": "PROTAGONIST",
        "personality": "坚毅果敢",
        "background": "出身贫寒的少年..."
      }
    ],
    "plotlines": [
      {
        "id": "pl-001",
        "title": "主角身世之谜",
        "status": "OPEN",
        "foreshadows": ["神秘老者", "血脉觉醒"]
      }
    ],
    "chapters": [],
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-05-31T10:30:00Z"
  }
}
```

---

### PATCH /api/novel/projects/[id]

更新项目信息。

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | number | 项目ID |

**请求体**

```json
{
  "title": "修仙之路（修订版）",
  "status": "WRITING",
  "targetWordCount": 600000
}
```

**注意**：支持部分更新，只传入需要修改的字段。

---

### DELETE /api/novel/projects/[id]

删除项目。

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | number | 项目ID |

**警告**：此操作不可恢复！

**成功响应**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "deleted": true
  }
}
```

---

### POST /api/novel/projects/[id]/duplicate

复制项目。

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | number | 项目ID |

**请求体**

```json
{
  "newTitle": "修仙之路（副本）"
}
```

**成功响应**

```json
{
  "success": true,
  "data": {
    "id": 17,
    "title": "修仙之路（副本）",
    "copiedFrom": 1
  }
}
```

---

## 相关接口

- [章节管理](./chapters.md)
- [角色管理](./characters.md)
- [伏笔追踪](./plotlines.md)
