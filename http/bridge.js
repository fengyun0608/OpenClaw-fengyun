import WebSocket from 'ws'
import fs from 'fs/promises'
import BotUtil from '../../../lib/util.js'

const XRK_BRIDGE_PATH = '/XrkBridge'
const connections = new Map()
const sentMessages = new Map()
const MESSAGE_EXPIRE = 10000

function isDuplicate(to, text) {
  const key = `${to.kind}:${to.userId}:${to.groupId || 'none'}`
  const now = Date.now()
  const lastText = sentMessages.get(key)
  if (lastText && lastText.text === text && (now - lastText.time) < MESSAGE_EXPIRE) {
    return true
  }
  sentMessages.set(key, { text, time: now })
  setTimeout(() => {
    const current = sentMessages.get(key)
    if (current && current.time === now) {
      sentMessages.delete(key)
    }
  }, MESSAGE_EXPIRE)
  return false
}

async function processFile(file) {
  const fileUrl = file.url || file.path
  if (!fileUrl) return null
  
  if (fileUrl.startsWith('data:')) {
    return { type: file.type || 'image', data: { file: fileUrl } }
  }
  
  if (fileUrl.startsWith('base64://')) {
    const base64Data = fileUrl.replace('base64://', 'data:image/png;base64,')
    return { type: file.type || 'image', data: { file: base64Data } }
  }
  
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://') || fileUrl.startsWith('file://')) {
    return { type: file.type || 'image', data: { file: fileUrl } }
  }
  
  try {
    const fileBuffer = await fs.readFile(fileUrl)
    const base64 = fileBuffer.toString('base64')
    const ext = fileUrl.split('.').pop()?.toLowerCase() || 'jpg'
    const mimeTypes = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', 
      gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
      mp4: 'video/mp4', avi: 'video/x-msvideo', mov: 'video/quicktime',
      mp3: 'audio/mpeg', wav: 'audio/wav', amr: 'audio/amr',
      pdf: 'application/pdf'
    }
    const mimeType = mimeTypes[ext] || 'application/octet-stream'
    return { type: file.type || 'image', data: { file: `data:${mimeType};base64,${base64}` } }
  } catch (err) {
    BotUtil.makeLog('error', `[XrkBridge] 读取文件失败: ${err.message}`, 'XrkBridge')
    return null
  }
}

const ERROR_PATTERNS = [
  /Unknown target/i,
  /Message: send.*failed/i,
  /EMBEDDED_PI_RUN/i,
  /No handler registered/i
]

function shouldFilterMessage(text) {
  if (!text) return false
  return ERROR_PATTERNS.some(pattern => pattern.test(text))
}

async function sendReplyToQQ(to, text, files = []) {
  if (shouldFilterMessage(text)) {
    BotUtil.makeLog('debug', `[XrkBridge] 过滤错误消息: ${text?.slice(0, 50)}`, 'XrkBridge')
    return
  }

  if (isDuplicate(to, text)) {
    BotUtil.makeLog('debug', `[XrkBridge] 跳过重复消息`, 'XrkBridge')
    return
  }

  const isGroup = to.kind === 'group' && to.groupId
  const userId = String(to.userId)
  const groupId = String(to.groupId)

  if (!text?.trim() && files.length === 0) return

  BotUtil.makeLog('info', `[XrkBridge] 流式发送 group=${groupId} user=${userId} text=${text?.slice(0, 50)} files=${files.length}`, 'XrkBridge')

  try {
    const messages = []
    
    if (text && text.trim()) {
      messages.push({ type: 'text', data: { text } })
    }
    
    for (const file of files) {
      const processed = await processFile(file)
      if (!processed) continue
      
      const fileType = file.type || processed.type
      if (fileType === 'image') {
        messages.push({ type: 'image', data: processed.data })
      } else if (fileType === 'video') {
        messages.push({ type: 'video', data: processed.data })
      } else if (fileType === 'audio' || fileType === 'voice') {
        messages.push({ type: 'record', data: processed.data })
      } else {
        messages.push({ type: 'file', data: { ...processed.data, name: file.name || 'file' } })
      }
    }

    if (messages.length === 0) return

    if (isGroup) {
      await Bot.pickGroup(groupId).sendMsg(messages)
      BotUtil.makeLog('info', `[XrkBridge] 已发送群消息 group=${groupId}`, 'XrkBridge')
    } else {
      await Bot.pickFriend(userId).sendMsg(messages)
      BotUtil.makeLog('info', `[XrkBridge] 已发送私聊消息 user=${userId}`, 'XrkBridge')
    }
  } catch (err) {
    BotUtil.makeLog('error', `[XrkBridge] 发送失败: ${err.message}`, 'XrkBridge')
  }
}

function sendToBridge(payload) {
  let sent = 0
  for (const [, c] of connections) {
    if (c.ready && c.conn && c.conn.readyState === WebSocket.OPEN) {
      try {
        c.conn.send(JSON.stringify(payload))
        sent++
      } catch (err) {
        BotUtil.makeLog('error', `[XrkBridge] 发送失败: ${err.message}`, 'XrkBridge')
      }
    }
  }
  return sent
}

async function handleMessage(conn, payload, Bot, clientId) {
  const { type } = payload

  if (type === 'message' || type === 'forward') {
    const { id, kind, userId, groupId, text, files, sender, atBot } = payload
    BotUtil.makeLog('info', `[XrkBridge] 收到${type}消息 kind=${kind} user=${userId} group=${groupId} text=${text?.slice(0, 50)}`, 'XrkBridge')

    const eventData = {
      id,
      kind,
      userId,
      groupId,
      text,
      files: files || [],
      sender: sender || { user_id: userId },
      raw_message: text,
      message: [{ type: 'text', text }],
      post_type: 'message',
      message_type: kind === 'group' ? 'group' : 'private',
      self_id: 'xrk-bridge',
      time: Math.floor(Date.now() / 1000),
      bot: Bot,
      isGroup: kind === 'group',
      atBot: atBot || false,
      tasker: 'xrk-bridge',
      _clientId: clientId
    }
    Bot.em('xrk-bridge.message', eventData)
    Bot.em(`xrk-bridge.${kind === 'group' ? 'group' : 'private'}`, eventData)

  } else if (type === 'reply') {
    const { to, text, files } = payload
    BotUtil.makeLog('info', `[XrkBridge] 收到回复 text=${text?.slice(0, 30)}`, 'XrkBridge')
    await sendReplyToQQ(to, text, files || [])

  } else if (type === 'ping') {
    conn.send(JSON.stringify({ type: 'pong' }))
  } else if (type === 'register') {
    const c = connections.get(clientId)
    if (c && payload.accountId) {
      c.accountId = payload.accountId
      BotUtil.makeLog('info', `[XrkBridge] 注册账号: ${payload.accountId}`, 'XrkBridge')
    }
  }
}

export function getBridgeConnections() {
  return connections
}

export { sendToBridge }

export default {
  name: 'OpenClaw-fengyun',
  dsc: '小龙虾桥接 - WebSocket 通信',
  priority: 100,

  init: async (app, Bot) => {
    Bot._xrkBridgeConnections = connections
    Bot._xrkBridgeSend = sendToBridge
    BotUtil.makeLog('info', '[XrkBridge] 桥接模块初始化完成', 'XrkBridge')
  },

  ws: {
    [XRK_BRIDGE_PATH]: (conn, req, Bot) => {
      const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`
      BotUtil.makeLog('info', `[XrkBridge] 新连接: ${clientId}`, 'XrkBridge')

      let accountId = 'default'
      connections.set(clientId, { conn, accountId, ready: true })

      conn.on('message', async (data) => {
        try {
          const payload = JSON.parse(String(data))
          await handleMessage(conn, payload, Bot, clientId)
        } catch (err) {
          BotUtil.makeLog('error', `[XrkBridge] 消息解析失败: ${err.message}`, 'XrkBridge')
        }
      })

      conn.on('close', () => {
        connections.delete(clientId)
        BotUtil.makeLog('info', `[XrkBridge] 连接关闭: ${clientId}`, 'XrkBridge')
      })

      conn.on('error', (err) => {
        BotUtil.makeLog('error', `[XrkBridge] 连接错误: ${err.message}`, 'XrkBridge')
        connections.delete(clientId)
      })

      conn.send(JSON.stringify({ type: 'connected', clientId }))
    }
  },

  routes: [
    {
      method: 'GET',
      path: '/api/fengyun/status',
      handler: async (req, res, Bot) => {
        const conns = []
        for (const [id, c] of connections) {
          conns.push({ clientId: id, accountId: c.accountId, ready: c.ready })
        }
        res.json({ success: true, connections: conns, total: connections.size })
      }
    },
    {
      method: 'POST',
      path: '/api/fengyun/send',
      handler: async (req, res, Bot) => {
        const { userId, groupId, text, kind, files } = req.body || {}
        if (!userId || (!text && !files?.length)) {
          return res.status(400).json({ success: false, error: '缺少消息内容' })
        }

        const sent = sendToBridge({
          type: 'reply',
          to: { kind: kind || (groupId ? 'group' : 'direct'), userId, groupId },
          text,
          files
        })
        res.json({ success: true, sent })
      }
    }
  ]
}
