# OpenClaw-fengyun 部署指南

> 本文档用于指导部署 XRK-Yunzai 与 OpenClaw (小龙虾) 的桥接插件

## 📋 目录

- [环境要求](#环境要求)
- [部署流程](#部署流程)
- [插件使用](#插件使用)
- [常见问题](#常见问题)

---

## 🌟 这是什么

OpenClaw-fengyun 是一个桥接插件，用于将 QQ 机器人（XRK-Yunzai）的消息转发到 OpenClaw AI 助手（小龙虾），实现 QQ 消息与 AI 的双向通信。

**主要功能**：
- 🔔 消息转发 - 自动转发群艾特消息和私聊消息到 OpenClaw
- 🌊 流式回复 - 支持流式消息发送，实时响应
- 🖼️ 多媒体支持 - 支持图片、视频、音频、文件等多媒体消息
- 🔌 WebSocket 通信 - 基于 WebSocket 的双向实时通信
- 🧹 错误过滤 - 自动过滤 OpenClaw 端的错误消息，保持聊天清爽
- 🔐 授权系统 - 支持主人授权用户管理，控制访问权限

**适用场景**：
- 群聊中 @机器人发送消息
- 私聊直接发送消息
- 主人可管理授权用户
- 授权用户可使用机器人

---

## 环境要求

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | ≥ 24.0.0 | JavaScript 运行环境 |
| Redis | ≥ 5.0.0（支持 RESP3） | 缓存数据库 |
| 浏览器 | Chrome / Chromium / Edge（渲染或 Web 面板需要） | Web 面板渲染 |
| 包管理器 | 推荐 pnpm ≥ 9（npm/yarn 亦可） | 包管理工具 |

**检查方法**：

**Windows**：
```powershell
# 检查 Node.js
node --version

# 检查 pnpm
pnpm --version

# 检查 Redis
redis-cli --version
```

**Linux**：
```bash
# 检查 Node.js
node --version

# 检查 pnpm
pnpm --version

# 检查 Redis
redis-cli --version
```

---

## 部署流程

### 第一步：安装 OpenClaw 桥接扩展

**所有平台通用**

访问 https://github.com/sunflowermm/openclaw-xrk-bridger 并按照说明安装 OpenClaw 的 xrk-bridger 扩展。

**安装说明**：
1. 下载扩展文件
2. 在 OpenClaw 中安装扩展
3. 配置 WebSocket 地址为 `ws://127.0.0.1:1145/XrkBridge`
4. 启用扩展

**验证安装**：
- 在 OpenClaw 设置中查看 xrk-bridger 扩展是否已启用
- 检查 WebSocket 连接状态

---

### 第二步：安装 XRK-Yunzai 框架

#### 🖥️ 电脑部署（Windows）

**1. 检查安装位置**

**自动检测**：
- 如果有 D 盘 → 安装到 `D:\XRK-Yunzai`（节省 C 盘空间）
- 如果没有 D 盘 → 安装到 `C:\XRK-Yunzai`

**手动选择**：
- D 盘：`D:\XRK-Yunzai`
- C 盘：`C:\XRK-Yunzai`

**2. 克隆项目**

```bash
# 有 D 盘
cd D:\
git clone https://gitcode.com/Xrkseek/XRK-Yunzai.git

# 没有 D 盘
cd C:\
git clone https://gitcode.com/Xrkseek/XRK-Yunzai.git
```

**说明**：
- 克隆过程可能需要几分钟，请耐心等待
- 如果网络较慢，可以使用镜像源加速

**3. 安装依赖**

```bash
cd XRK-Yunzai
pnpm install
```

**说明**：
- 安装过程可能需要 5-10 分钟
- 如果安装失败，尝试删除 `node_modules` 后重新安装
- pnpm 会自动安装 package.json 中的所有依赖

**4. 启动框架**

```bash
pnpm run dev
```

**说明**：
- 启动后会自动打开浏览器窗口
- 看到 "智能体启动完成" 表示启动成功
- 记录启动时间，用于后续故障排查

---

#### 🐧 服务器部署（Linux）

**1. 克隆项目**

```bash
cd ~
git clone https://gitcode.com/Xrkseek/XRK-Yunzai.git
```

**说明**：
- 克隆到用户主目录
- 确保有足够的磁盘空间

**2. 安装依赖**

```bash
cd XRK-Yunzai
pnpm install
```

**说明**：
- 使用 pnpm 安装，速度更快
- 可以使用 `--registry` 参数指定镜像源

**3. 启动框架**

```bash
pnpm run dev
```

**说明**：
- 启动后会监听 1145 端口
- 可以使用 `nohup` 或 `screen` 保持后台运行

---

### 第三步：安装 NapCat

**所有平台通用**

访问 https://napneko.github.io/guide/boot/Shell 按照说明安装并启动 NapCat。

**安装说明**：
1. 下载安装脚本
2. 按照说明执行安装命令
3. 配置 NapCat 连接参数
4. 启动 NapCat 服务

**⚠️ 端口说明**：

| 服务 | 默认端口 | 说明 |
|------|----------|------|
| NapCat | `1145` | NapCat 默认端口 |
| XRK-Yunzai | `1145` | XRK-Yunzai 默认端口 |
| 桥接对接 | `1145` | WebSocket 桥接端口 |

**端口配置**：
- 确保三个服务使用相同端口（默认 1145）
- 如果端口冲突，需要修改配置文件
- 检查防火墙设置，确保端口可访问

**验证安装**：
- 检查 NapCat 是否正常运行
- 检查端口是否被占用
- 查看 NapCat 日志确认启动状态

---

### 第四步：安装插件

**1. 安装 XRK-plugin**

```bash
cd XRK-Yunzai/plugins
git clone https://gitcode.com/Xrkseek/XRK-plugin.git
```

**说明**：
- XRK-plugin 是 XRK-Yunzai 的官方插件集合
- 包含各种实用插件

**2. 安装 OpenClaw-fengyun**

```bash
cd XRK-Yunzai/plugins
git clone https://github.com/fengyun0608/OpenClaw-fengyun.git
```

**说明**：
- 本插件就是 OpenClaw-fengyun
- 安装后会在 `plugins/OpenClaw-fengyun/` 目录下

**验证安装**：
- 检查插件目录结构是否正确
- 确认所有文件都已正确放置

---

### 第五步：重启框架

#### 🖥️ 电脑部署（Windows）

**1. 关闭当前运行的终端窗口**

- 找到运行 XRK-Yunzai 的终端窗口
- 按 `Ctrl + C` 关闭
- 或直接关闭窗口

**2. 重新启动**

```bash
pnpm run dev
```

**说明**：
- 重新启动会加载新安装的插件
- 检查启动日志确认插件加载状态

---

#### 🐧 服务器部署（Linux）

**1. 查找进程**

```bash
# 查找 Node.js 进程
ps aux | grep node

# 或使用 pgrep
pgrep -f "node.*XRK-Yunzai"
```

**2. 杀掉进程（替换 PID）**

```bash
# 找到进程 PID 后
kill -9 <PID>

# 或使用 pkill
pkill -f "node.*XRK-Yunzai"
```

**说明**：
- 替换 `<PID>` 为实际的进程 ID
- 确保杀掉所有相关进程

**3. 重新启动**

```bash
pnpm run dev
```

**说明**：
- 使用 `nohup` 或 `screen` 保持后台运行
- 查看启动日志：`tail -f logs/app.log`

---

### 第六步：登录 QQ 账号

**1. 扫码登录**

- 打开 QQ 机器人
- 扫描登录二维码
- 使用机器人账号登录

**2. 设置主人权限**

**方法一：配置文件**

在 `XRK-Yunzai/config/bot.yaml` 中添加：

```yaml
masterQQ: [你的QQ号]
```

**说明**：
- 可以添加多个主人 QQ 号
- 使用数组格式：`[123456789, 987654321]`
- 修改配置后需要重启框架生效

**方法二：命令行设置**

```bash
# 在机器人控制台执行
# 设置主人权限
setMaster 123456789

# 查看当前主人列表
getMaster
```

**说明**：
- 使用机器人控制台命令更方便
- 可以随时添加或删除主人
- 设置后立即生效

**3. 验证登录**

- 登录成功后，机器人会发送确认消息
- 检查机器人是否在线
- 确认主人权限设置成功

---

### 第七步：验证部署

**测试功能**：

1. **测试消息转发**
   - 在群聊中 @机器人 发送测试消息
   - 观察是否成功转发到 OpenClaw
   - 检查 OpenClaw 是否收到消息

2. **查看授权帮助**
   - 发送 `#op帮助` 查看帮助信息
   - 确认帮助信息正确显示

3. **添加授权用户**
   - 发送 `#op添加@用户` 添加测试授权用户
   - 确认授权用户添加成功

4. **检查日志**
   - 查看 `logs/app.log` 日志文件
   - 确认没有错误信息
   - 检查插件加载状态

**验证清单**：

- [ ] OpenClaw xrk-bridger 扩展已安装
- [ ] XRK-Yunzai 框架正常运行
- [ ] NapCat 正常运行
- [ ] OpenClaw-fengyun 插件已加载
- [ ] WebSocket 连接正常
- [ ] 消息转发功能正常
- [ ] 授权系统正常工作

---

## 插件使用

### 授权指令（仅主人可用）

| 指令 | 说明 | 示例 |
|------|------|------|
| `#op添加@用户` | 添加授权用户 | `#op添加@123456789` |
| `#op删除@用户` | 删除授权用户 | `#op删除@123456789` |
| `#op列表` | 查看授权列表 | `#op列表` |
| `#op帮助` | 查看帮助 | `#op帮助` |

**说明**：
- 指令大小写不敏感，`#` 符号可选
- 支持 `#OP添加`、`#op添加`、`#Op添加` 等格式
- 使用 `@用户` 来指定要操作的用户

### 使用方式

- **群聊**：@机器人 + 消息
  - 例如：`@机器人 你好`
  - 机器人会转发消息到 OpenClaw

- **私聊**：直接发送消息
  - 例如：直接私聊机器人发送消息
  - 机器人会转发消息到 OpenClaw

### 权限说明

| 用户类型 | 权限 | 说明 |
|---------|------|------|
| 主人 | 完全权限 | 可使用所有功能，包括授权管理 |
| 授权用户 | 受限权限 | 可使用消息转发功能，不能管理授权 |
| 其他用户 | 无权限 | 无法使用任何功能 |

### 配置文件

**授权用户列表**：

配置文件位置：`data/xrk-bridge-op.json`

```json
{
  "opUsers": ["123456789", "987654321"]
}
```

**说明**：
- 文件会在首次添加授权用户时自动创建
- 可以手动编辑此文件添加或删除授权用户
- 修改后需要重启框架生效

**配置示例**：

```json
{
  "opUsers": [
    "123456789",
    "987654321",
    "2701300299"
  ]
}
```

---

## 常见问题

### Q: 端口冲突怎么办？

**A: 确保三个服务使用相同的端口（默认 1145），检查是否有其他程序占用。**

**解决方法**：
1. 检查端口占用：
   ```bash
   # Windows
   netstat -ano | findstr :1145
   
   # Linux
   netstat -tlnp | grep :1145
   ```

2. 修改端口配置：
   - 修改 NapCat 配置文件
   - 修改 XRK-Yunzai 配置文件
   - 修改 OpenClaw 配置文件

3. 关闭占用端口的程序：
   ```bash
   # Windows
   taskkill /F /IM node.exe
   
   # Linux
   killall node
   ```

---

### Q: 消息没有转发？

**A: 检查以下几点**

1. 检查 OpenClaw 的 xrk-bridger 扩展是否正确安装
2. 检查 WebSocket 连接是否正常
3. 确认用户是否有权限（主人或授权用户）
4. 检查日志中的错误信息

**排查步骤**：
1. 查看 OpenClaw 设置，确认 xrk-bridger 已启用
2. 检查 WebSocket 地址配置是否正确
3. 重启 OpenClaw 重新连接
4. 重启 XRK-Yunzai 框架

---

### Q: 如何查看日志？

**A: 日志文件位置和查看方法**

**日志位置**：
- 主日志：`logs/app.log`
- 错误日志：`logs/error.log`
- WebSocket 日志：`logs/websocket.log`

**查看方法**：

**Windows**：
```powershell
# 实时查看日志
Get-Content logs/app.log -Wait

# 查看最后 100 行
Get-Content logs/app.log -Tail 100

# 搜索错误
Select-String -Path logs/app.log -Pattern "Error" -Context 2
```

**Linux**：
```bash
# 实时查看日志
tail -f logs/app.log

# 查看最后 100 行
tail -n 100 logs/app.log

# 搜索错误
grep "Error" logs/app.log

# 查看插件加载日志
grep "OpenClaw-fengyun" logs/app.log
```

---

### Q: 插件没有加载？

**A: 检查以下几点**

1. 确认插件目录结构正确
2. 检查插件文件是否有语法错误
3. 重启机器人
4. 检查日志中的错误信息

**排查步骤**：
1. 检查插件文件语法：
   ```bash
   node --check plugins/OpenClaw-fengyun/apps/forward.js
   node --check plugins/OpenClaw-fengyun/http/bridge.js
   ```

2. 检查插件目录结构：
   ```bash
   # Windows
   dir plugins\OpenClaw-fengyun
   
   # Linux
   ls -la plugins/OpenClaw-fengyun
   ```

3. 检查 index.js 导出：
   ```bash
   node --check plugins/OpenClaw-fengyun/index.js
   ```

4. 重启框架：
   ```bash
   # Windows
   pnpm run dev
   
   # Linux
   pnpm run dev
   ```

---

## 项目地址

| 项目 | 地址 | 说明 |
|------|------|------|
| XRK-Yunzai | https://gitcode.com/Xrkseek/XRK-Yunzai | Yunzai-Bot 的分支 |
| XRK-plugin | https://gitcode.com/Xrkseek/XRK-plugin | XRK-Yunzai 官方插件集合 |
| OpenClaw-fengyun | https://github.com/fengyun0608/OpenClaw-fengyun | 本插件仓库 |
| OpenClaw Bridger | https://github.com/sunflowermm/openclaw-xrk-bridger | OpenClaw 端的桥接扩展 |
| NapCat | https://napneko.github.io/guide/boot/Shell | NapCat 启动脚本 |
| OpenClaw | https://github.com/clawdbot/openclaw | OpenClaw 官方仓库 |

---

## 📄 开源协议

本项目采用 [MIT](LICENSE) 协议开源。

**MIT 协议特点**：
- 允许商业使用
- 允许修改和分发
- 保留版权声明
- 无担保责任

---

## 👤 作者

**风云 (fengyun)**

---

## 🙏 致谢

感谢以下项目的开发者：

- [Xrkseek](https://gitcode.com/Xrkseek) - XRK-Yunzai 作者
- [Clawdbot Team](https://github.com/clawdbot) - OpenClaw 开发团队
- [sunflowermm](https://github.com/sunflowermm) - OpenClaw-xrk-bridger 作者
- [NapCat Team](https://napneko.github.io) - NapCat 开发团队

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给一个 Star ⭐**

</div>
