# OpenClaw-fengyun 部署指南

> 本文档用于指导部署 XRK-Yunzai 与 OpenClaw 的桥接插件

## ⚠️ 部署前说明

在开始部署之前，请先检查当前环境：

- **如果已经完整部署过** → 跳过部署流程，直接使用
- **如果部署不完整** → 删除现有部署，重新按照本文档完整部署
- **如果从未部署过** → 按照本文档步骤依次执行

**检查方法**：
1. 检查 `XRK-Yunzai` 目录是否存在
2. 检查 `XRK-Yunzai/plugins/XRK-plugin` 目录是否存在
3. 检查 `XRK-Yunzai/plugins/OpenClaw-fengyun` 目录是否存在
4. 检查 NapCat 是否正常运行
5. 检查 OpenClaw 的 xrk-bridger 扩展是否已安装

---

## 📋 目录

- [环境要求](#环境要求)
- [部署流程](#部署流程)
- [插件使用](#插件使用)
- [常见问题](#常见问题)

---

## 环境要求

| 组件 | 版本 |
|------|------|
| Node.js | ≥ 24.0.0 |
| Redis | ≥ 5.0.0（支持 RESP3） |
| 浏览器 | Chrome / Chromium / Edge（渲染或 Web 面板需要） |
| 包管理器 | 推荐 pnpm ≥ 9（npm/yarn 亦可） |

---

## 部署流程

### 第一步：安装 OpenClaw 桥接扩展

**所有平台通用**

访问 https://github.com/sunflowermm/openclaw-xrk-bridger 并按照说明安装 OpenClaw 的 xrk-bridger 扩展。

---

### 第二步：安装 XRK-Yunzai 框架

#### 🖥️ 电脑部署（Windows）

**1. 检查安装位置**
- 如果有 D 盘 → 安装到 `D:\XRK-Yunzai`（节省 C 盘空间）
- 如果没有 D 盘 → 安装到 `C:\XRK-Yunzai`

**2. 克隆项目**
```bash
# 有 D 盘
cd D:\
git clone https://gitcode.com/Xrkseek/XRK-Yunzai.git

# 没有 D 盘
cd C:\
git clone https://gitcode.com/Xrkseek/XRK-Yunzai.git
```

**3. 安装依赖**
```bash
cd XRK-Yunzai
pnpm install
```

**4. 启动框架**
```bash
pnpm run dev
```

---

#### 🐧 服务器部署（Linux）

**1. 克隆项目**
```bash
cd ~
git clone https://gitcode.com/Xrkseek/XRK-Yunzai.git
```

**2. 安装依赖**
```bash
cd XRK-Yunzai
pnpm install
```

**3. 启动框架**
```bash
pnpm run dev
```

---

### 第三步：安装 NapCat

**所有平台通用**

访问 https://napneko.github.io/guide/boot/Shell 按照说明安装并启动 NapCat。

> ⚠️ **端口说明**：
> - NapCat 默认端口：`1145`
> - XRK-Yunzai 默认端口：`1145`
> - 桥接对接端口：`1145`

---

### 第四步：安装插件

**安装 XRK-plugin**
```bash
cd XRK-Yunzai/plugins
git clone https://gitcode.com/Xrkseek/XRK-plugin.git
```

**安装 OpenClaw-fengyun**
```bash
cd XRK-Yunzai/plugins
git clone https://github.com/fengyun0608/OpenClaw-fengyun.git
```

---

### 第五步：重启框架

**Windows**：
- 关闭当前运行的终端窗口
- 重新执行 `pnpm run dev`

**Linux**：
```bash
# 查找进程
ps aux | grep node

# 杀掉进程（替换 PID）
kill -9 <PID>

# 重新启动
pnpm run dev
```

---

### 第六步：登录 QQ 账号

1. 扫码登录机器人 QQ 账号
2. 登录成功后，设置主人权限

**设置主人**：
在配置文件中添加主人 QQ 号：
```yaml
# config/config/bot.yaml
masterQQ: [你的QQ号]
```

---

### 第七步：验证部署

登录成功后，机器人会发送消息确认。你可以：

1. **测试消息转发**：在群聊中 @机器人 发送消息
2. **查看授权帮助**：发送 `#op帮助`
3. **添加授权用户**：发送 `#op添加@用户`

---

## 插件使用

### 授权指令（仅主人可用）

| 指令 | 说明 |
|------|------|
| `#op添加@用户` | 添加授权用户 |
| `#op删除@用户` | 删除授权用户 |
| `#op列表` | 查看授权列表 |
| `#op帮助` | 查看帮助 |

> 💡 指令大小写不敏感，`#` 符号可选

### 使用方式

- **群聊**：@机器人 + 消息
- **私聊**：直接发送消息

### 权限说明

- **主人**：可直接使用，可管理授权用户
- **授权用户**：需主人授权后使用
- **其他用户**：无权限

### 配置文件

授权用户列表保存在：`data/xrk-bridge-op.json`

```json
{
  "opUsers": ["123456789", "987654321"]
}
```

---

## 常见问题

### Q: 端口冲突怎么办？
A: 确保 NapCat 和 XRK-Yunzai 使用相同的端口（默认 1145），检查是否有其他程序占用。

### Q: 消息没有转发？
A: 
1. 检查 OpenClaw 的 xrk-bridger 扩展是否正确安装
2. 检查 WebSocket 连接是否正常
3. 确认用户是否有权限（主人或授权用户）

### Q: 如何查看日志？
A: 日志文件位于 `logs/app.log`

### Q: 插件没有加载？
A: 
1. 确认插件目录结构正确
2. 重启机器人
3. 检查日志中的错误信息

---

## 项目地址

- XRK-Yunzai: https://gitcode.com/Xrkseek/XRK-Yunzai
- XRK-plugin: https://gitcode.com/Xrkseek/XRK-plugin
- OpenClaw-fengyun: https://github.com/fengyun0608/OpenClaw-fengyun
- OpenClaw Bridger: https://github.com/sunflowermm/openclaw-xrk-bridger
- NapCat: https://napneko.github.io/guide/boot/Shell
