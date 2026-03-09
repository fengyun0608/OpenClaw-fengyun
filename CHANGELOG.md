# 更新日志 (CHANGELOG)

## [1.0.0] - 2025-03-10

### 新增
- 初始版本发布
- 实现 XRK-Yunzai 与 OpenClaw 的 WebSocket 桥接
- 支持群艾特消息自动转发
- 支持私聊消息自动转发
- 支持流式消息发送
- 支持多媒体消息（图片、视频、音频、文件）
- HTTP API 接口（状态查询、消息发送）

### 技术实现
- `bridge.js`: WebSocket 服务端，处理连接和消息分发
- `forward.js`: 消息转发插件，监听 QQ 消息并转发到 OpenClaw
- `index.js`: 插件入口，自动加载 apps 目录下的模块

### 依赖
- ws: WebSocket 通信
- XRK-Yunzai 框架
- OpenClaw (小龙虾) 及 xrk-agt-bridge 扩展
