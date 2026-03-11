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

  BotUtil.makeLog('info', `[XrkBridge] 流式发送 group=${groupId} user=${userId} selfId=${selfId} text=${text?.slice(0, 50)} mediaUrls=${mediaUrls.length} files=${files.length}`, 'XrkBridge')

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
    
    if (isGroup) {
      BotUtil.makeLog('info', `[XrkBridge] 群聊模式：跳过媒体/文件发送`, 'XrkBridge')
      return
    }
    
    for (const url of mediaUrls) {
      if (!url) continue
      
      const isBase64 = url.startsWith('base64://')
      let isImage = IMAGE_EXTS.some(ext => url.toLowerCase().includes(ext))
      let fileExt = '.txt'
      
      if (isBase64) {
        try {
          const base64Data = url.replace(/^base64:\/\//i, '')
          const firstBytes = Buffer.from(base64Data.slice(0, 32), 'base64')
          
          if (firstBytes[0] === 0xFF && firstBytes[1] === 0xD8) {
            isImage = true
            fileExt = '.jpg'
          } else if (firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4E && firstBytes[3] === 0x47) {
            isImage = true
            fileExt = '.png'
          } else if (firstBytes[0] === 0x47 && firstBytes[1] === 0x49 && firstBytes[2] === 0x46) {
            isImage = true
            fileExt = '.gif'
          } else if (firstBytes[0] === 0x42 && firstBytes[1] === 0x4D) {
            isImage = true
            fileExt = '.bmp'
          } else if (firstBytes[0] === 0x52 && firstBytes[1] === 0x49 && firstBytes[2] === 0x46 && firstBytes[3] === 0x46 && firstBytes[8] === 0x57 && firstBytes[9] === 0x45 && firstBytes[10] === 0x42 && firstBytes[11] === 0x50) {
            isImage = true
            fileExt = '.webp'
          } else if (firstBytes[0] === 0x00 && firstBytes[1] === 0x00 && firstBytes[2] === 0x01 && firstBytes[3] === 0x00) {
            isImage = true
            fileExt = '.ico'
          } else if (firstBytes[0] === 0x49 && firstBytes[1] === 0x49 && firstBytes[2] === 0x2A && firstBytes[3] === 0x00) {
            isImage = true
            fileExt = '.tiff'
          } else if (firstBytes[0] === 0x4D && firstBytes[1] === 0x4D && firstBytes[2] === 0x00 && firstBytes[3] === 0x2A) {
            isImage = true
            fileExt = '.tiff'
          } else if (firstBytes[0] === 0x50 && firstBytes[1] === 0x4B && firstBytes[2] === 0x03 && firstBytes[3] === 0x04) {
            fileExt = '.zip'
          } else if (firstBytes[0] === 0x52 && firstBytes[1] === 0x61 && firstBytes[2] === 0x72 && firstBytes[3] === 0x21) {
            fileExt = '.rar'
          } else if (firstBytes[0] === 0x37 && firstBytes[1] === 0x7A && firstBytes[2] === 0xBC && firstBytes[3] === 0xAF) {
            fileExt = '.7z'
          } else if (firstBytes[0] === 0x1F && firstBytes[1] === 0x8B) {
            fileExt = '.gz'
          } else if (firstBytes[257] === 0x75 && firstBytes[258] === 0x73 && firstBytes[259] === 0x74 && firstBytes[260] === 0x61) {
            fileExt = '.tar'
          } else if (firstBytes[0] === 0x25 && firstBytes[1] === 0x50 && firstBytes[2] === 0x44 && firstBytes[3] === 0x46) {
            fileExt = '.pdf'
          } else if (firstBytes[0] === 0xD0 && firstBytes[1] === 0xCF && firstBytes[2] === 0x11 && firstBytes[3] === 0xE0) {
            fileExt = '.doc'
          } else if (firstBytes[0] === 0x50 && firstBytes[1] === 0x4B && firstBytes[2] === 0x03 && firstBytes[3] === 0x04) {
            fileExt = '.docx'
          } else if (firstBytes[4] === 0x66 && firstBytes[5] === 0x74 && firstBytes[6] === 0x79 && firstBytes[7] === 0x70) {
            if (firstBytes[8] === 0x4D && firstBytes[9] === 0x34 && firstBytes[10] === 0x41) {
              fileExt = '.m4a'
            } else if (firstBytes[8] === 0x69 && firstBytes[9] === 0x73 && firstBytes[10] === 0x6F) {
              fileExt = '.mp4'
            } else if (firstBytes[8] === 0x4D && firstBytes[9] === 0x53 && firstBytes[10] === 0x4E && firstBytes[11] === 0x56) {
              fileExt = '.mp4'
            } else if (firstBytes[8] === 0x66 && firstBytes[9] === 0x74 && firstBytes[10] === 0x79 && firstBytes[11] === 0x70) {
              fileExt = '.mov'
            } else {
              fileExt = '.mp4'
            }
          } else if (firstBytes[0] === 0x1A && firstBytes[1] === 0x45 && firstBytes[2] === 0xDF && firstBytes[3] === 0xA3) {
            fileExt = '.mkv'
          } else if (firstBytes[0] === 0x00 && firstBytes[1] === 0x00 && firstBytes[2] === 0x00 && (firstBytes[3] === 0x14 || firstBytes[3] === 0x18 || firstBytes[3] === 0x1C)) {
            fileExt = '.mp4'
          } else if (firstBytes[0] === 0x52 && firstBytes[1] === 0x49 && firstBytes[2] === 0x46 && firstBytes[3] === 0x46 && firstBytes[8] === 0x57 && firstBytes[9] === 0x41 && firstBytes[10] === 0x56 && firstBytes[11] === 0x45) {
            fileExt = '.wav'
          } else if (firstBytes[0] === 0x49 && firstBytes[1] === 0x44 && firstBytes[2] === 0x33) {
            fileExt = '.mp3'
          } else if (firstBytes[0] === 0xFF && (firstBytes[1] === 0xFB || firstBytes[1] === 0xFA || firstBytes[1] === 0xF3 || firstBytes[1] === 0xF2)) {
            fileExt = '.mp3'
          } else if (firstBytes[0] === 0x4F && firstBytes[1] === 0x67 && firstBytes[2] === 0x67) {
            fileExt = '.ogg'
          } else if (firstBytes[0] === 0x66 && firstBytes[1] === 0x4C && firstBytes[2] === 0x61 && firstBytes[3] === 0x43) {
            fileExt = '.flac'
          } else if (firstBytes[0] === 0x21 && firstBytes[1] === 0x23 && firstBytes[2] === 0x41 && firstBytes[3] === 0x4D && firstBytes[4] === 0x52) {
            fileExt = '.amr'
          } else if (firstBytes[0] === 0x4D && firstBytes[1] === 0x5A) {
            fileExt = '.exe'
          } else if (firstBytes[0] === 0x7F && firstBytes[1] === 0x45 && firstBytes[2] === 0x4C && firstBytes[3] === 0x46) {
            fileExt = '.elf'
          } else if (firstBytes[0] === 0xCA && firstBytes[1] === 0xFE && firstBytes[2] === 0xBA && firstBytes[3] === 0xBE) {
            fileExt = '.class'
          } else if (firstBytes[0] === 0x50 && firstBytes[1] === 0x4B && firstBytes[2] === 0x05 && firstBytes[3] === 0x06) {
            fileExt = '.jar'
          } else if (firstBytes[0] === 0x41 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4B && firstBytes[3] === 0x53) {
            fileExt = '.apk'
          } else if (firstBytes[0] === 0x64 && firstBytes[1] === 0x65 && firstBytes[2] === 0x78 && firstBytes[3] === 0x0A) {
            fileExt = '.dex'
          } else if (firstBytes[0] === 0x53 && firstBytes[1] === 0x51 && firstBytes[2] === 0x4C && firstBytes[3] === 0x69) {
            fileExt = '.sqlite'
          } else if (firstBytes[0] === 0x66 && firstBytes[1] === 0x6C && firstBytes[2] === 0x76) {
            fileExt = '.flv'
          } else if (firstBytes[0] === 0x41 && firstBytes[1] === 0x56 && firstBytes[2] === 0x49) {
            fileExt = '.avi'
          } else if (firstBytes[0] === 0x30 && firstBytes[1] === 0x26 && firstBytes[2] === 0xB2 && firstBytes[3] === 0x75) {
            fileExt = '.wmv'
          } else if (firstBytes[0] === 0x2E && firstBytes[1] === 0x52 && firstBytes[2] === 0x4D && firstBytes[3] === 0x46) {
            fileExt = '.rm'
          } else if (firstBytes[0] === 0x38 && firstBytes[1] === 0x42 && firstBytes[2] === 0x50 && firstBytes[3] === 0x53) {
            fileExt = '.psd'
          } else if (firstBytes[0] === 0x25 && firstBytes[1] === 0x21 && firstBytes[2] === 0x50 && firstBytes[3] === 0x53) {
            fileExt = '.ps'
          } else if (firstBytes[0] === 0x41 && firstBytes[1] === 0x49) {
            fileExt = '.ai'
          } else if (firstBytes[0] === 0x47 && firstBytes[1] === 0x49 && firstBytes[2] === 0x46) {
            isImage = true
            fileExt = '.gif'
          } else if (firstBytes[0] === 0x43 && firstBytes[1] === 0x44 && firstBytes[2] === 0x57 && firstBytes[3] === 0x41) {
            fileExt = '.cdr'
          } else if (firstBytes[0] === 0x53 && firstBytes[1] === 0x56) {
            fileExt = '.svg'
          } else if (firstBytes[0] === 0x3C && firstBytes[1] === 0x3F && firstBytes[2] === 0x78 && firstBytes[3] === 0x6D && firstBytes[4] === 0x6C) {
            fileExt = '.xml'
          } else if (firstBytes[0] === 0x7B && firstBytes[1] === 0x22) {
            fileExt = '.json'
          } else if (firstBytes[0] === 0x3C && firstBytes[1] === 0x21) {
            fileExt = '.html'
          } else if (firstBytes[0] === 0x3C && firstBytes[1] === 0x68) {
            fileExt = '.html'
          } else if (firstBytes[0] === 0x3C && firstBytes[1] === 0x3F && firstBytes[2] === 0x70 && firstBytes[3] === 0x68 && firstBytes[4] === 0x70) {
            fileExt = '.php'
          } else if (firstBytes[0] === 0x23 && firstBytes[1] === 0x21) {
            fileExt = '.sh'
          } else if (firstBytes[0] === 0x3C && firstBytes[1] === 0x25) {
            fileExt = '.asp'
          } else if (firstBytes[0] === 0x4A && firstBytes[1] === 0x41 && firstBytes[2] === 0x56 && firstBytes[3] === 0x41) {
            fileExt = '.java'
          } else if (firstBytes[0] === 0x70 && firstBytes[1] === 0x6B && firstBytes[2] === 0x03 && firstBytes[3] === 0x04) {
            fileExt = '.pptx'
          } else if (firstBytes[0] === 0x70 && firstBytes[1] === 0x6B && firstBytes[2] === 0x05 && firstBytes[3] === 0x06) {
            fileExt = '.pptx'
          } else if (firstBytes[0] === 0xFD && firstBytes[1] === 0x37 && firstBytes[2] === 0x7A && firstBytes[3] === 0x58) {
            fileExt = '.xz'
          } else if (firstBytes[0] === 0x42 && firstBytes[1] === 0x5A && firstBytes[2] === 0x68) {
            fileExt = '.bz2'
          } else if (firstBytes[0] === 0x4D && firstBytes[1] === 0x53 && firstBytes[2] === 0x43 && firstBytes[3] === 0x46) {
            fileExt = '.cab'
          } else if (firstBytes[0] === 0x49 && firstBytes[1] === 0x53 && firstBytes[2] === 0x63 && firstBytes[3] === 0x28) {
            fileExt = '.iso'
          } else if (firstBytes[0] === 0x56 && firstBytes[1] === 0x4D && firstBytes[2] === 0x44 && firstBytes[3] === 0x4B) {
            fileExt = '.vmdk'
          } else if (firstBytes[0] === 0x43 && firstBytes[1] === 0x52 && firstBytes[2] === 0x41 && firstBytes[3] === 0x47) {
            fileExt = '.crx'
          } else if (firstBytes[0] === 0x4D && firstBytes[1] === 0x4F && firstBytes[2] === 0x56) {
            fileExt = '.mov'
          } else if (firstBytes[0] === 0x00 && firstBytes[1] === 0x00 && firstBytes[2] === 0x00 && firstBytes[3] === 0x00 && firstBytes[4] === 0x66 && firstBytes[5] === 0x74 && firstBytes[6] === 0x79 && firstBytes[7] === 0x70) {
            fileExt = '.mp4'
          } else if (firstBytes[0] === 0x1F && firstBytes[1] === 0x8B && firstBytes[2] === 0x08) {
            fileExt = '.gz'
          } else if (firstBytes[0] === 0xED && firstBytes[1] === 0xAB && firstBytes[2] === 0xEE && firstBytes[3] === 0xDB) {
            fileExt = '.rpm'
          } else if (firstBytes[0] === 0x21 && firstBytes[1] === 0x3C && firstBytes[2] === 0x61 && firstBytes[3] === 0x72 && firstBytes[4] === 0x63 && firstBytes[5] === 0x68 && firstBytes[6] === 0x3E) {
            fileExt = '.deb'
          } else if (firstBytes[0] === 0x4D && firstBytes[1] === 0x53 && firstBytes[2] === 0x57 && firstBytes[3] === 0x49) {
            fileExt = '.msi'
          } else if (firstBytes[0] === 0x4D && firstBytes[1] === 0x5A && firstBytes[2] === 0x90 && firstBytes[3] === 0x00) {
            fileExt = '.dll'
          } else if (firstBytes[0] === 0x4D && firstBytes[1] === 0x50 && firstBytes[2] === 0x51) {
            fileExt = '.mpq'
          } else if (firstBytes[0] === 0x50 && firstBytes[1] === 0x4B && firstBytes[2] === 0x07 && firstBytes[3] === 0x08) {
            fileExt = '.zip'
          } else if (firstBytes[0] === 0x54 && firstBytes[1] === 0x41 && firstBytes[2] === 0x50 && firstBytes[3] === 0x45) {
            fileExt = '.tape'
          } else if (firstBytes[0] === 0x5A && firstBytes[1] === 0x57) {
            fileExt = '.zw'
          }
        } catch {}
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
        const fileName = `${extName}${fileExt}`
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

  if (type === 'message' || type === 'forward') {
    const { id, kind, selfId, userId, groupId, text, mediaUrls, files, sender, atBot } = payload
    BotUtil.makeLog('info', `[XrkBridge] 收到${type}消息 kind=${kind} user=${userId} group=${groupId} text=${text?.slice(0, 50)} mediaUrls=${mediaUrls?.length || 0} files=${files?.length || 0}`, 'XrkBridge')

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
      atBot: atBot || false,
      tasker: 'xrk-bridge',
      _clientId: clientId
    }
    Bot.em('xrk-bridge.message', eventData)
    Bot.em(`xrk-bridge.${kind === 'group' ? 'group' : 'private'}`, eventData)

  } else if (type === 'reply') {
    const { to, text, mediaUrls, files } = payload
    BotUtil.makeLog('info', `[XrkBridge] 收到回复 text=${text?.slice(0, 30)} mediaUrls=${mediaUrls?.length || 0} files=${files?.length || 0}`, 'XrkBridge')
    await sendReplyToQQ(to, text, mediaUrls || [], files || [])

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
        const { userId, groupId, text, kind, mediaUrls, files } = req.body || {}
        if (!userId || (!text && !mediaUrls?.length && !files?.length)) {
          return res.status(400).json({ success: false, error: '缺少消息内容' })
        }

        const sent = sendToBridge({
          type: 'reply',
          to: { kind: kind || (groupId ? 'group' : 'direct'), userId, groupId },
          text,
          mediaUrls,
          files
        })
        res.json({ success: true, sent })
      }
    }
  ]
}
