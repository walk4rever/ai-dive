# Agent 超时修复说明

## 问题描述

Agent 对话经常在处理复杂问题（多次工具调用）时超时并中断，导致用户体验不佳。流式传输意外中断时，前端无法区分"正常完成"和"被超时切断"。

## 根本原因

1. **超时配置过于严格**：原 `maxDuration=90s` 和 `timeout=85s` 对于多工具调用场景（60-80s）留的余量不足
2. **缺少完整性追踪**：前端无法判断流是否正常结束，超时切断的不完整回答被当作完整答案展示
3. **缺少用户反馈**：即使检测到问题，也没有告知用户可以继续追问

## 修复方案（从 buffett-tribe 迁移）

### 1. 后端超时配置调整

**文件**: `src/app/api/agent/route.ts`

```typescript
// 修改前
export const maxDuration = 90
const upstream = await fetch(`${GATEWAY_URL}/chat`, {
  signal: AbortSignal.any([req.signal, AbortSignal.timeout(85_000)]),
})

// 修改后
export const maxDuration = 300  // Vercel Pro 上限
const upstream = await fetch(`${GATEWAY_URL}/chat`, {
  signal: AbortSignal.any([req.signal, AbortSignal.timeout(290_000)]),
})
```

**理由**: 多工具问题实测需 60-80s，90s/85s 的配置在复杂场景下必然超时

### 2. 前端完整性追踪

**文件**: `src/hooks/useAgentChat.ts`

**关键改动**:

```typescript
// 1. 消息接口增加 incomplete 标记
export interface AgentMessage {
  // ... 其他字段
  incomplete?: boolean  // 流被切断或达到 max_tokens
}

// 2. sendMessage 中追踪终止事件
let sawTerminal = false  // 是否收到 done/error 事件
let truncated = false    // done 事件中的 truncated 标记

// 3. 处理 done 事件
} else if (eventType === 'done') {
  sawTerminal = true
  truncated = data.truncated === true
}

// 4. 处理 error 事件时标记 sawTerminal
} else if (eventType === 'error') {
  // ...
  hadError = true
  sawTerminal = true  // ← 新增
}

// 5. 流结束后检查完整性
if (!hadError) {
  if (!sawTerminal || truncated) {
    setMessages((prev) =>
      prev.map((m, i) => (i === assistantIndex ? { ...m, incomplete: true } : m))
    )
  }
  // 无论是否完整都持久化（部分答案仍有价值）
  persistTurn('assistant', assistantText)
}
```

**逻辑**:
- Gateway 正常完成会发送 `event: done`
- 超时/连接断开时流直接关闭，没有 `done` 事件
- 通过 `sawTerminal` 标记区分这两种情况

### 3. 用户反馈 UI

**文件**: `src/components/AgentChat.tsx`

```tsx
{msg.incomplete && (
  <div className="text-xs mt-2 px-2 py-1 rounded" 
       style={{ color: '#87867f', background: '#faf9f5', border: '1px solid var(--border)' }}>
    ⚠️ 回答未完成（超时或连接中断），你可以继续提问让 AI 补充
  </div>
)}
```

当检测到 `incomplete` 时，明确告知用户可以继续对话。

## Gateway 端确认

**文件**: `services/pi-gateway/src/stream.ts`

Gateway 已正确实现终止事件：

```typescript
try {
  await session.prompt(message, ...)
  sse(res, "done", {})  // ← 成功时发送 done
} catch (err) {
  sse(res, "error", { message })  // ← 失败时发送 error
} finally {
  res.end()
}
```

## 测试要点

1. **正常对话**：验证简单问题仍能正常完成，不会误报 incomplete
2. **多工具调用**：测试需要 5+ 工具调用的复杂问题，确认不再超时
3. **真实超时**：如果确实超过 290s，验证 incomplete 提示正确显示
4. **错误处理**：验证 error 事件不会被标记为 incomplete

## 迁移完成度

✅ 后端超时配置调整  
✅ 前端完整性追踪逻辑  
✅ UI 反馈提示  
✅ Gateway 端确认已实现  

## 参考

- buffett-tribe 修复 commit: 参见 `../buffett-tribe` 项目历史
- 相关文件对比:
  - `useAgentChat.ts`: 两项目已对齐
  - `api/*/route.ts`: 超时配置已对齐
  - UI 提示: 已适配当前项目样式
