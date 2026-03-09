<div align="center">

# OpenClaw-fengyun

**XRK-Yunzai 与 OpenClaw (小龙虾) 的桥接插件**

实现 QQ 消息与 AI 的双向通信

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![XRK-Yunzai](https://img.shields.io/badge/XRK--Yunzai-支持-green.svg)](https://gitcode.com/Xrkseek/XRK-Yunzai)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-兼容-orange.svg)](https://github.com/clawdbot/openclaw)

</div>

---

## 📦 基于

本项目基于以下开源项目开发：

| 项目 | 说明 |
|------|------|
| [XRK-Yunzai](https://gitcode.com/Xrkseek/XRK-Yunzai) | Yunzai-Bot 的分支，支持多适配器 |
| [OpenClaw-xrk-bridger](https://github.com/sunflowermm/OpenClaw-xrk-bridger) | OpenClaw 端的 XRK 桥接扩展 |

## ✨ 功能特性

- 🔔 **消息转发** - 自动转发群艾特消息和私聊消息到 OpenClaw
- 🌊 **流式回复** - 支持流式消息发送，实时响应
- 🖼️ **多媒体支持** - 支持图片、视频、音频、文件等多媒体消息
- 🔌 **WebSocket 通信** - 基于 WebSocket 的双向实时通信
- 🧹 **错误过滤** - 自动过滤 OpenClaw 端的错误消息，保持聊天清爽

## 📥 安装

将插件放置在 `XRK-Yunzai/plugins/OpenClaw-fengyun/` 目录下。

## ⚙️ 配置

### OpenClaw 端配置

在 OpenClaw 的 `openclaw.json` 中添加：

```json
{
  "channels": {
    "xrk-agt": {
      "wsUrl": "ws://127.0.0.1:1145/XrkBridge",
      "outbound": {
        "enabled": true
      }
    }
  },
  "plugins": {
    "entries": {
      "xrk-agt-bridge": {
        "enabled": true
      }
    }
  }
}
```

## 📁 文件结构

```
OpenClaw-fengyun/
├── index.js          # 插件入口
├── apps/
│   └── forward.js    # 消息转发模块
├── http/
│   └── bridge.js     # WebSocket 桥接服务
├── LICENSE           # 开源许可证
├── README.md         # 说明文档
└── CHANGELOG.md      # 更新日志
```

## 🔌 API 接口

### HTTP 接口

| 方法 | 路径 | 说明 |
|:----:|------|------|
| `GET` | `/api/fengyun/status` | 获取连接状态 |
| `POST` | `/api/fengyun/send` | 发送消息 |

### WebSocket 接口

连接地址：`ws://host:port/XrkBridge`

| 类型 | 方向 | 说明 |
|:----:|:----:|------|
| `message` | ← | 接收消息 |
| `reply` | → | 发送回复 |
| `ping` | → | 心跳检测 |
| `pong` | ← | 心跳响应 |
| `connected` | ← | 连接成功 |

## 📄 开源协议

本项目采用 [MIT](LICENSE) 协议开源。

## 👤 作者

**风云 (fengyun)**

## 🙏 致谢

感谢以下项目的开发者：

- [Xrkseek](https://gitcode.com/Xrkseek) - XRK-Yunzai 作者
- [Clawdbot Team](https://github.com/clawdbot) - OpenClaw 开发团队
- [sunflowermm](https://github.com/sunflowermm) - OpenClaw-xrk-bridger 作者

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给一个 Star ⭐**

</div>
