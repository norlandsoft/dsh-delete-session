# 删除会话 / Delete Session

为 DSH Web UI 增加一个“删除会话”动作，位置在会话 `...` 菜单的“归档会话”下方。它不是归档：确认后会清理该会话在 Harness 中的数据，且无法撤销。

## 安装

```bash
git clone https://github.com/norlandsoft/dsh-delete-session.git
```

在 DSH 的插件管理中将该目录安装为 bundle。安装后 Host 与 Client 两半会随 bundle 一起激活。

## 使用

1. 打开侧边栏某个会话的 `...` 菜单。
2. 选择“删除会话”。
3. 在确认框中再次确认“永久删除”。

## 清理范围

- 会话持久化日志目录（`session.v4.jsonl.zstd`、`session.lock` 及同目录会话文件）
- 投影缓存（`session_projcache` 中该会话的记录）
- 工作区记账：归档集合、置顶集合、工作区中的会话槽位
- 该会话的定时任务与投递记录
- 该会话拥有的后台任务与终端
- 仅被该会话引用的图片/文件附件（共享的 content-addressed 对象会保留）
- 该会话的临时溢出目录（spill）

## 不会删除

- 工作区目录里的项目文件、Git 工作树或用户生成的文件
- 与其他会话共享的附件对象
- 全局图片请求缓存（可由原图重新生成）

## 安全与一致性

- 复用 Host 的 `/dsh-session-delete` 精确路由，并调用 `ctx.connection.requestRejection`，与 `/api` 使用同一套 Host/Origin 与浏览器会话准入。
- 运行中的会话先通过工作区注册表停止 turn、子代理、任务与定时任务，再取消并排空 Agent。
- 附件按引用清扫：先读取待删日志收集引用，再扫描其余所有会话；只要有一个会话读取失败，就跳过附件删除，宁可留下也不误删共享文件。
- 通过 `api-session/removed` 通知 Client 立即移除行；同时删除 Host 内存中的 Session/Agent 注册项，避免刷新后“复活”。

## 已知边界

- 依赖当前 DSH 版本的 `ctx.sessions.store` / `ctx.agents.store` 字段完成运行中会话的内存移除；未来版本若改名，文件与工作区数据仍会删除，但运行中的会话可能要到 Host 重启后才完全消失。
- 不清理全局图片请求缓存。
- 删除当前正在对话的会话会立即使该会话从列表和界面中消失，请先确认不再需要它。

## 文件

- `server.js` — Host 半：路由、停止活动、清理日志/缓存/工作区/附件/溢出文件
- `client.js` — Client 半：菜单行、确认对话框、结果提示
- `cordis.patch.yml` — Bundle patch
- `locale/{zh,en}.json` — 插件标题、描述与界面文案
- `icon.svg` — 插件图标
