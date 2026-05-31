# TODO Issues 转换记录

> 创建时间：2026-05-31
> 更新：发现新的 TODO 时添加到此文档

---

## High Priority

### TODO-001: 从 writer 获取 finishReason

**位置：** `src/lib/engine/orchestrator.ts:636`

**原始代码：**
```typescript
finishReason: undefined, // TODO: 从 writer 获取 finishReason
```

**问题描述：**
writerAgent 执行后未正确传递 finishReason，导致在某些场景下无法获取正确的生成终止原因。

**期望行为：**
从 writerAgent 的返回结果中获取 finishReason 并传递给调用方。

**验收标准：**
- [ ] 确认 writerAgent 返回值包含 finishReason
- [ ] 在 orchestrator 中正确提取并传递 finishReason
- [ ] 编写单元测试覆盖此场景

**状态：** 待处理

---

## Medium Priority

（暂无）

---

## Low Priority

（暂无）

---

## 已完成项

（暂无）

---

## 添加新 Issue 的方法

当发现新的 TODO 时，请按以下格式添加：

```markdown
### TODO-XXX: [简短描述]

**位置：** `src/path/to/file.ts:LINENUMBER`

**原始代码：**
```typescript
// TODO: [描述]
```

**问题描述：**
[详细描述问题]

**期望行为：**
[描述期望的行为]

**验收标准：**
- [ ] [标准1]
- [ ] [标准2]

**状态：** 待处理
```
