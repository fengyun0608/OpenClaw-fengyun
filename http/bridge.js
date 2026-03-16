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

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.heic', '.heif', '.avif']

async function processUrl(url) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('base64://')) {
    return url
  }
  const filePath = url.replace(/^file:\/\/+/i, '').replace(/^\/([A-Za-z]:)/, '$1')
  try {
    const stat = await fs.stat(filePath)
    if (stat.isFile()) {
      const buffer = await fs.readFile(filePath)
      return `base64://${buffer.toString('base64')}`
    }
  } catch (err) {
    BotUtil.makeLog('debug', `[XrkBridge] 文件不存在: ${filePath}`, 'XrkBridge')
  }
  return null
}

async function processFile(file) {
  const fileUrl = file.url || file.path
  if (!fileUrl) return null
  
  if (fileUrl.startsWith('data:')) {
    return { data: { file: fileUrl } }
  }
  
  if (fileUrl.startsWith('base64://')) {
    return { data: { file: fileUrl } }
  }
  
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return { data: { file: fileUrl } }
  }
  
  if (fileUrl.startsWith('file://')) {
    const processed = await processUrl(fileUrl)
    if (processed) return { data: { file: processed } }
    return null
  }
  
  const processed = await processUrl(fileUrl)
  if (processed) return { data: { file: processed } }
  
  return null
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

function getFileExtensionFromBase64(base64Data) {
  try {
    const firstBytes = Buffer.from(base64Data.slice(0, 16), 'base64');
    
    // 图片类型
    if (firstBytes[0] === 0xFF && firstBytes[1] === 0xD8) return '.jpg';
    if (firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4E && firstBytes[3] === 0x47) return '.png';
    if (firstBytes[0] === 0x47 && firstBytes[1] === 0x49 && firstBytes[2] === 0x46) return '.gif';
    if (firstBytes[0] === 0x42 && firstBytes[1] === 0x4D) return '.bmp';
    if (firstBytes[0] === 0x52 && firstBytes[1] === 0x49 && firstBytes[2] === 0x46 && firstBytes[3] === 0x46 && firstBytes[8] === 0x57 && firstBytes[9] === 0x45 && firstBytes[10] === 0x42 && firstBytes[11] === 0x50) return '.webp';
    
    // 文档类型
    if (firstBytes[0] === 0x50 && firstBytes[1] === 0x4B) {
      // ZIP 格式（包括 docx, xlsx, pptx 等）
      if (firstBytes[2] === 0x03 && firstBytes[3] === 0x04) {
        // 尝试从文件名推断具体类型
        return '.zip';
      }
    }
    
    // PDF
    if (firstBytes[0] === 0x25 && firstBytes[1] === 0x50 && firstBytes[2] === 0x44 && firstBytes[3] === 0x46) return '.pdf';
    
    // 文本文件
    if (firstBytes[0] === 0xEF && firstBytes[1] === 0xBB && firstBytes[2] === 0xBF) return '.txt'; // UTF-8 BOM
    
  } catch {}
  return '.bin';
}

async function sendReplyToQQ(to, text, mediaUrls = [], files = []) {
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
  const selfId = to.selfId || null

  if (!text?.trim() && mediaUrls.length === 0 && files.length === 0) return

  BotUtil.makeLog('info', `[XrkBridge] 发送回复 kind=${to.kind} group=${groupId} user=${userId} selfId=${selfId} text=${text?.slice(0, 50)} mediaUrls=${mediaUrls.length} files=${files.length}`, 'XrkBridge')

  const getTarget = () => {
    if (selfId && Bot.bots[selfId]) {
      const bot = Bot.bots[selfId]
      return isGroup ? bot.pickGroup(groupId) : bot.pickFriend(userId)
    }
    return isGroup ? Bot.pickGroup(groupId) : Bot.pickFriend(userId)
  }

  try {
    const target = getTarget()
    
    if (text && text.trim()) {
      await target.sendMsg([{ type: 'text', data: { text } }])
      BotUtil.makeLog('info', `[XrkBridge] 已发送文本 ${isGroup ? `group=${groupId}` : `user=${userId}`}`, 'XrkBridge')
    }
    
    for (const url of mediaUrls) {
      if (!url) continue
      
      const isBase64 = url.startsWith('base64://')
      let isImage = false
      let fileExt = '.bin'
      
      if (isBase64) {
        try {
          const base64Data = url.replace(/^base64:\/\//i, '')
          fileExt = getFileExtensionFromBase64(base64Data)
          
          // 检查是否为图片类型
          const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
          isImage = imageExts.includes(fileExt)
        } catch {}
      } else {
        const urlLower = url.toLowerCase()
        if (urlLower.match(/\.(jpg|jpeg|png|gif|bmp|webp|ico|tiff?|svg|heic|heif|avif)(\?|$)/)) {
          isImage = true
          const extMatch = urlLower.match(/\.(jpg|jpeg|png|gif|bmp|webp|ico|tiff?|svg|heic|heif|avif)/)
          fileExt = extMatch ? '.' + extMatch[0].slice(1) : '.jpg'
        } else if (urlLower.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|txt|md|js|json|html|css)(\?|$)/)) {
          const extMatch = urlLower.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|txt|md|js|json|html|css)/)
          fileExt = extMatch ? '.' + extMatch[0].slice(1) : '.bin'
        }
      }
      
      if (isImage) {
        try {
          await target.sendMsg([{ type: 'image', data: { file: url } }])
          BotUtil.makeLog('info', `[XrkBridge] 已发送图片`, 'XrkBridge')
        } catch (err) {
          BotUtil.makeLog('error', `[XrkBridge] 图片发送失败: ${err.message}`, 'XrkBridge')
        }
      } else {
        const extName = fileExt.replace('.', '')
        const fileName = `file_${Date.now()}${fileExt}`
        try {
          await target.sendMsg([{ type: 'file', data: { file: url, name: fileName } }])
          BotUtil.makeLog('info', `[XrkBridge] 已发送文件: ${fileName}`, 'XrkBridge')
        } catch (err) {
          BotUtil.makeLog('error', `[XrkBridge] 文件发送失败: ${err.message}`, 'XrkBridge')
        }
      }
    }
    
    for (const file of files) {
      const processed = await processFile(file)
      if (!processed) continue
      
      const fileName = file.name || 'file'
      const ext = '.' + (fileName.split('.').pop()?.toLowerCase() || '')
      
      try {
        if (IMAGE_EXTS.includes(ext)) {
          await target.sendMsg([{ type: 'image', data: processed.data }])
          BotUtil.makeLog('info', `[XrkBridge] 已发送图片文件: ${fileName}`, 'XrkBridge')
        } else {
          await target.sendMsg([{ type: 'file', data: { ...processed.data, name: fileName } }])
          BotUtil.makeLog('info', `[XrkBridge] 已发送文件: ${fileName}`, 'XrkBridge')
        }
      } catch (err) {
        BotUtil.makeLog('error', `[XrkBridge] 文件发送失败: ${fileName} - ${err.message}`, 'XrkBridge')
      }
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

  if (type === 'message') {
    const { id, kind, selfId, userId, groupId, text, mediaUrls, files, sender } = payload
    BotUtil.makeLog('info', `[XrkBridge] 收到消息 kind=${kind} user=${userId} group=${groupId || 'none'} selfId=${selfId} text=${text?.slice(0, 50)} mediaUrls=${mediaUrls?.length || 0} files=${files?.length || 0}`, 'XrkBridge')

    const eventData = {
      id,
      kind,
      selfId,
      userId,
      groupId,
      text,
      mediaUrls: mediaUrls || [],
      files: files || [],
      sender: sender || { user_id: userId },
      raw_message: text,
      message: [{ type: 'text', text }],
      post_type: 'message',
      message_type: kind === 'group' ? 'group' : 'private',
      self_id: selfId || 'xrk-bridge',
      time: Math.floor(Date.now() / 1000),
      bot: Bot,
      isGroup: kind === 'group',
      tasker: 'xrk-bridge',
      _clientId: clientId
    }
    Bot.em('xrk-bridge.message', eventData)
    Bot.em(`xrk-bridge.${kind === 'group' ? 'group' : 'private'}`, eventData)

  } else if (type === 'reply') {
    const { id, selfId, to, text, mediaUrls, files } = payload
    BotUtil.makeLog('info', `[XrkBridge] 收到回复 id=${id} to=${JSON.stringify(to)} text=${text?.slice(0, 30)} mediaUrls=${mediaUrls?.length || 0} files=${files?.length || 0}`, 'XrkBridge')
    
    const replyTo = {
      kind: to.kind,
      userId: to.userId,
      groupId: to.groupId,
      selfId: selfId || to.selfId
    }
    await sendReplyToQQ(replyTo, text, mediaUrls || [], files || [])

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
        const { userId, groupId, text, kind, mediaUrls, files, selfId } = req.body || {}
        if (!userId || (!text && !mediaUrls?.length && !files?.length)) {
          return res.status(400).json({ success: false, error: '缺少消息内容' })
        }

        const replyPayload = {
          type: 'reply',
          id: Date.now().toString(),
          selfId,
          to: { 
            kind: kind || (groupId ? 'group' : 'direct'), 
            userId, 
            groupId,
            selfId 
          },
          text,
          mediaUrls,
          files
        }
        
        const sent = sendToBridge(replyPayload)
        res.json({ success: true, sent })
      }
    }
  ]
}
