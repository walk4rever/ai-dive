# air7 Agent 多版本共存与回滚方案

> 记录时间：2026-10-19  
> 范围：air7 上运行的 pi-coding-agent gateway，包括 ai-dive 与 buffett-tribe  
> 结论：先做最小的 release 目录与一键回滚，不立即升级 1.3.0，不引入蓝绿发布和全局控制面。

## 1. 背景

最初的问题是：pi-coding-agent 已经从 `0.79.x` 发展到 `1.3.0`，air7 上的 gateway 是否应该升级。

进一步的需求是：agent 部分的代码框架要支持依赖的多版本共存。希望达到的效果是：

- 当前稳定版本完整保留，作为备份。
- 可以尝试新版本。
- 新版本出问题时，能快速切回稳定版本。
- air7 上同时运行多个项目的 agent，方案不能只服务 ai-dive。

## 2. air7 现状盘点

当前实际在跑的 gateway：

| 项目 | pi-coding-agent | 端口 | nginx 路径 | PM2 名称 |
|---|---:|---:|---|---|
| ai-dive | `0.79.10` | 3458 | `/pi-ai-dive/` | `pi-gateway-ai-dive` |
| buffett-tribe | `0.79.6` | 3456 | `/pi/` | `pi-gateway-buffett-tribe` |

机器资源：

- Node.js：`22.22.2`
- CPU：2 核
- 内存：3.4 GB
- 根分区可用空间：约 11 GB
- 每个 gateway 实际占用约 200–250 MB（包括 `tsx` loader 和 esbuild）

其他相关进程：

- `llm-proxy`：端口 3002
- `voice-relay`：当前停止
- `pm2-logrotate`：在线

两个 gateway 的项目结构非常接近，都使用：

- `createAgentSession`
- `SessionManager`
- `DefaultResourceLoader`
- `defineTool`
- `session.modelRegistry.find(...)`

buffett-tribe 的 `npm start` 会先执行 `sync:shared`，把共享库复制进自己的目录。这个动作必须在构建阶段完成，运行阶段不能再修改 release 目录。

## 3. 版本调研结论

### 3.1 版本时间线

- air7 当前：`0.79.10`，2026-06-22 发布。
- 上游最新：`1.3.0`，2026-10-15 发布。
- 中间跨过 `0.80 → 0.99 → 1.x`。

### 3.2 与 gateway 相关的 breaking changes

真正影响 gateway 的只有一处：

- `AgentSession.modelRegistry` 在 `1.3.0` 中不再公开。
- vision 模型查找需要改用 `session.modelRuntime.getModel(...)`。

兼容写法：

```ts
const runtime = (session as any).modelRuntime;
const visionModel = runtime?.getModel?.(provider, modelId)
  ?? (session as any).modelRegistry?.find?.(provider, modelId);
```

其他变化：

- `0.87` 让 `SessionManager` 成为会话上下文的唯一来源。gateway 本来就是通过 `appendMessage()` 注入历史，因此兼容。
- `0.84` 之后 `message_update` 只发送增量。gateway 本来就只读取 `delta`，因此兼容。
- `1.3.0` 内置 TypeBox `1.3.27`，gateway 当前锁的是 `1.1.38`。实测 `1.1.38` 在 `1.3.0` 下工具调用正常，暂时不需要升级。

### 3.3 在 air7 staging 做过的验证

使用 `1.3.0` 在 air7 独立目录做过真实冒烟测试：

- TypeScript 类型检查通过。
- 现有 34 个 gateway 测试全部通过。
- 普通对话 SSE 正常。
- `search_ai_dive` 工具调用成功。
- 冷启动历史回放成功。
- 图片请求成功切到 vision 模型。
- `/cancel` 能让会话恢复为非 streaming。

staging 也暴露了一个配置耦合问题：

- 生产 `.env` 中的 `PI_AGENT_DIR` 是绝对路径。
- staging 复用了这份 `.env`，导致 `1.3.0` 把 `models-store.json` 写进了生产 `.pi-agent`。
- 该文件只有 2 字节的 `{}`，已删除，当前 0.79 健康检查正常。
- 结论：**测试进程永远不能复用生产 `.env` 中的 `PI_AGENT_DIR`。**

## 4. 方案演进

### 4.1 方案 A：同进程多版本加载

想法：

- 用 npm alias 同时安装多个 `pi-coding-agent` 版本。
- 在同一进程中按需加载。

不采用的原因：

- SDK 内部有全局状态、模型目录、定时器和可选原生依赖。
- 同进程加载两份会增加难以排查的冲突。
- 同一时刻每个请求只需要一个版本，没有实际收益。
- npm alias 更适合做兼容测试，不适合生产运行。

### 4.2 方案 B：完整蓝绿发布

想法：

- 每个项目两个 PM2 slot。
- 两个端口同时在线。
- nginx upstream 从稳定版切到候选版。
- 全局 `gatewayctl`、项目注册表、端口分配、自动回滚。

不采用的原因：

- air7 只有 2 核、3.4 GB 内存，双 slot 会让两个项目从 2 个进程变成 4 个。
- 多了一套 nginx upstream 配置和切换失败的可能。
- 多了一套全局控制面，脚本 bug 可能同时影响多个项目。
- 真正需要的是“快速回到旧版本”，不是零停机。

### 4.3 方案 C：最小 release 目录 + 停止/启动切换

采用：

- 每个项目、每个版本一个独立 release 目录。
- 每个 release 有自己的 `package.json`、`package-lock.json`、`node_modules`。
- 项目保持固定生产端口，nginx 完全不变。
- 激活时停止旧进程，启动新 release。
- 旧 release 完整保留，回滚时直接启动。
- 每个项目一个 `deploy.sh`，不做全局控制面。

代价：

- 激活时约 2–5 秒中断。
- 没有自动 watchdog，回滚由人执行。

这个代价对当前规模可以接受。现有部署本来也会重启进程，且会话历史可从数据库冷启动恢复。

## 5. 最终目录结构

以 ai-dive 为例：

```text
/root/pi-gateway-ai-dive/
  .env                         # 保持在项目根目录
  .pi-agent/                   # 保持在项目根目录
  releases/
    0.79.10-20261019/          # 稳定版快照，含完整 node_modules
      src/
      package.json
      package-lock.json
      node_modules/
      ecosystem.config.cjs
      .env -> ../../.env       # 符号链接，不复制密钥
      .release.json
    1.3.0-20261020/            # 候选版本
  staging/
    .env                       # 测试端口和独立 PI_AGENT_DIR
    .pi-agent/                 # 测试专用，不碰生产配置
  state/
    active                     # 当前 active release id
    previous                   # 上一个 release id
```

每个 release 都是自包含的运行单元。旧 release 的 `node_modules` 不删除，回滚不依赖网络。

## 6. 发布流程

### 6.1 冻结当前稳定版

先做快照，不升级任何东西：

```bash
rsync -a \
  --exclude releases \
  --exclude staging \
  --exclude .env \
  --exclude .pi-agent \
  /root/pi-gateway-ai-dive/ \
  /root/pi-gateway-ai-dive/releases/0.79.10-20261019/
```

快照包含现有 `node_modules`。即使 npm registry 不可用，也能回滚。

### 6.2 构建候选版本

候选版本只写入新的 release 目录，线上目录和进程完全不动。

```bash
cd releases/<release-id>
npm ci --omit=dev --ignore-scripts
```

air7 只有 2 核，构建时加全局锁，避免两个项目同时安装依赖：

```bash
flock /tmp/air7-agent-build.lock npm ci --omit=dev --ignore-scripts
```

### 6.3 候选版本使用独立测试环境

测试端口：

| 项目 | 生产端口 | 测试端口 |
|---|---:|---:|
| ai-dive | 3458 | 3459 |
| buffett-tribe | 3456 | 3457 |

测试环境不能直接使用生产 `.env`。需要生成 `staging/.env`：

```env
PORT=3459
PI_AGENT_DIR=/root/pi-gateway-ai-dive/staging/.pi-agent
```

其余密钥从生产 `.env` 复制，但 `PORT` 和 `PI_AGENT_DIR` 必须覆盖。

最小测试内容：

- `/health` 正常。
- 一轮普通对话返回 `delta` 和 `done`。
- 一次工具调用返回 `tool_start`、`tool_end`、`done`。

### 6.4 激活

```bash
pm2 delete pi-gateway-ai-dive
pm2 start releases/<release-id>/ecosystem.config.cjs
```

`ecosystem.config.cjs` 使用 `cwd: __dirname`，因此进程工作目录就是该 release。

启动后轮询 `/health`。失败则自动启动 `state/previous` 指向的旧 release。

成功后必须执行：

```bash
pm2 save
```

否则机器重启后 PM2 可能恢复到旧路径。

### 6.5 回滚

```bash
./deploy.sh rollback
```

脚本读取 `state/previous`，停止新进程，启动旧 release，再 `pm2 save`。

整个过程不需要重新构建，也不需要联网。

## 7. 多项目约定

不做全局注册表和统一控制面。两个项目各自保持独立：

| 项目 | 根目录 | 生产端口 | 测试端口 | PM2 名称 |
|---|---|---:|---:|---|
| ai-dive | `/root/pi-gateway-ai-dive` | 3458 | 3459 | `pi-gateway-ai-dive` |
| buffett-tribe | `/root/pi-gateway-buffett-tribe` | 3456 | 3457 | `pi-gateway-buffett-tribe` |

每个仓库的 `deploy.sh` 使用同一套模板，只改四个常量：

- 项目根目录
- PM2 名称
- 生产端口
- 测试端口

项目之间唯一的共享资源是机器的 CPU、内存和 npm cache。版本切换、配置、日志、数据库连接彼此独立。

一个项目的部署脚本出问题，不影响另一个项目。

## 8. 代码兼容策略

稳定版快照保持原样，不为了框架修改 0.79 的代码。

只有在准备新版本候选 release 时，才加入兼容 helper：

```ts
const runtime = (session as any).modelRuntime;
const visionModel = runtime?.getModel?.(provider, modelId)
  ?? (session as any).modelRegistry?.find?.(provider, modelId);
```

这段代码在 `0.79` 和 `1.3.0` 下都能工作：

- `0.79` 没有 `modelRuntime`，回退到 `modelRegistry`。
- `1.3.0` 使用 `modelRuntime.getModel`。

buffett-tribe 的共享库同步必须在构建阶段执行：

```text
sync:shared -> npm ci -> 冻结 release
```

PM2 启动时直接运行 `tsx src/server.ts`，不要运行 `npm start`，避免启动阶段修改 release 目录。

## 9. 资源与容量

最小方案不增加常驻进程：

- 每个项目仍然只有一个 gateway 进程。
- 不会因为 release slot 翻倍内存。

磁盘：

- 每个 release 约 180–190 MB。
- 每个项目保留 2–3 个 release。
- 两个项目约 1 GB，当前 11 GB 可用空间足够。
- 暂不自动 prune；需要时手工删除最旧的 release，绝不能删除 active 和 previous。

构建：

- `npm ci` 只在 air7 上执行，避免 macOS 与 Linux 的原生依赖差异。
- 两个项目不要同时构建；用全局 `flock` 保护。

## 10. 风险与边界

### 10.1 激活期间有短暂中断

`pm2 delete` 到新进程监听端口之间约 2–5 秒。当前部署本来也会重启进程，因此这不是新增风险。

如果以后零停机成为硬需求，再在现有 release 目录基础上增加 nginx upstream 切换。当前方案不需要推倒重来。

### 10.2 内存会话会丢失

gateway 的 session 在内存中，重启会丢失。下一轮请求会从数据库历史冷启动恢复最近对话。这是现有行为，不是本方案引入的问题。

### 10.3 共享 `.pi-agent`

生产 `.pi-agent` 仍在项目根目录，由所有 release 共享。简单方案下同一项目同一时刻只运行一个版本，因此可以接受。

测试进程必须使用 `staging/.pi-agent`，不能使用生产目录。

### 10.4 PM2 路径必须精确

激活时必须启动具体 release 目录下的 `ecosystem.config.cjs`，不要依赖可能被缓存的旧 cwd。

每次激活或回滚后执行 `pm2 save`。

### 10.5 没有自动 watchdog

新版本激活后如果出现非健康检查类的业务问题，需要人工执行回滚。第一版接受这个边界，避免引入更复杂的监控和自动切换逻辑。

## 11. 是否升级 1.3.0

### 11.1 当前判断

**现在没有必须升级的理由。**

- `0.79.10` 稳定运行，没有发现安全公告。
- `1.3.0` 的收益主要是上游错误重试、工具参数校验、模型切换清理，属于可靠性改进。
- `1.3.0` 发布才 4 天，不是必须立刻跟进的安全版本。
- buffett-tribe 还在 `0.79.6`，两个项目没有必要同时升级。

不能因为“有新版本”就升级。

### 11.2 触发升级的条件

出现以下情况之一再考虑：

- 0.79 的上游临时错误导致用户可见的回复中断，且 1.3.0 的 retry 修复能解决。
- 工具参数损坏导致错误调用，需要 1.3.0 的参数校验。
- 需要 1.3.0 新增的模型或协议能力。
- 出现安全公告。

### 11.3 如果要试，按这个顺序

1. 只给 ai-dive 试 `1.3.0`。
2. 保留 `0.79.10` 完整快照。
3. 候选版本在 3459 跑完最小冒烟测试。
4. 激活后观察一周。
5. ai-dive 稳定后，再决定 buffett-tribe 是否跟进。

不要在同一个窗口升级两个项目。

## 12. 实施清单

### Phase 0：冻结

- [ ] 为 ai-dive 创建 `releases/0.79.10-20261019`，包含 `node_modules`。
- [ ] 为 buffett-tribe 创建 `releases/0.79.6-20261019`，包含 `node_modules`。
- [ ] 记录两个 release 的 `.release.json`。
- [ ] 验证当前进程健康。

### Phase 1：最小发布脚本

- [ ] 两个项目各自加入 `deploy.sh` 的 `build`、`activate`、`rollback`、`status`。
- [ ] release 目录创建 `.env` 符号链接。
- [ ] `ecosystem.config.cjs` 使用 `cwd: __dirname`。
- [ ] 激活后执行 `pm2 save`。
- [ ] 构建使用 `flock`。

### Phase 2：验证回滚

- [ ] 用当前稳定版构建一个 release，不升级版本。
- [ ] 激活它，确认行为和现在一致。
- [ ] 手工执行一次 `rollback`，确认能回到旧 release。
- [ ] 确认 nginx 配置没有变化。
- [ ] 确认 staging 没有写生产 `.pi-agent`。

### Phase 3：可选升级

- [ ] 只有满足第 11.2 节条件时，才构建 ai-dive 的 `1.3.0` 候选。
- [ ] 加入兼容 helper。
- [ ] 在 3459 跑普通对话、工具调用、历史回放、图片、取消。
- [ ] 激活并观察一周。
- [ ] 再评估 buffett-tribe。

## 13. 验收标准

- [ ] 旧 release 的 `node_modules` 完整保留。
- [ ] 回滚不需要 `npm install`。
- [ ] 回滚命令执行后，`/health` 在 10 秒内恢复。
- [ ] `pm2 save` 后重启 PM2，仍启动正确 release。
- [ ] nginx 配置和 upstream 路径没有改动。
- [ ] 两个项目的端口、PM2 名称、`.env`、`.pi-agent` 完全隔离。
- [ ] 测试环境使用独立 `PI_AGENT_DIR`，不写生产目录。
- [ ] 没有为了框架升级 TypeBox 或 Pi 版本。

## 14. 一句话总结

一个项目一个 release 目录，一个固定端口，PM2 停止/启动切换；旧版本带完整依赖常驻磁盘，一条命令回滚。先建立可逆能力，再根据真实痛点决定是否升级 1.3.0。
