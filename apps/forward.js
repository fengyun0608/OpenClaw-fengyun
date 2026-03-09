import plugin from '../../../lib/plugins/plugin.js';
import BotUtil from '../../../lib/util.js';

BotUtil.makeLog('info', '[XRK-Bridge-Forward] 消息转发插件已加载', 'XRK-Bridge');

export class XRKBridgeForward extends plugin {
  constructor() {
    super({
      name: 'XRK-Bridge-Forward',
      dsc: '转发艾特/私聊消息到 OpenClaw，支持图片等多媒体',
      event: 'message',
      priority: 1,
      rule: [
        { reg: '.*', fnc: 'handleMessage', log: false }
      ]
    });
  }

  async handleMessage(e) {
    if (e.tasker === 'xrk-bridge') return false;
    
    const isAtBot = e.atBot || (e.message && e.message.some && e.message.some(seg => seg.type === 'at' && (String(seg.qq) === String(e.self_id) || String(seg.data?.qq) === String(e.self_id))));
    const isPrivate = !e.isGroup && !e.group_id;
    
    if (!isAtBot && !isPrivate) {
      return false;
    }

    const sendToBridge = Bot._xrkBridgeSend;
    if (!sendToBridge) {
      BotUtil.makeLog('warn', '[XRK-Bridge-Forward] Bridge 模块未就绪', 'XRK-Bridge');
      return false;
    }

    const isGroup = e.isGroup || e.group_id;
    const text = e.msg || e.raw_message || '';
    const cleanText = text.replace(/\[CQ:[^\]]+\]/g, '').trim();
    
    const files = [];
    if (e.message && Array.isArray(e.message)) {
      for (const seg of e.message) {
        if (seg.type === 'image') {
          const url = seg.url || seg.data?.url;
          if (url) {
            files.push({ type: 'image', url, name: seg.file || 'image.jpg' });
          }
        } else if (seg.type === 'video') {
          const url = seg.url || seg.data?.url;
          if (url) {
            files.push({ type: 'video', url, name: seg.file || 'video.mp4' });
          }
        } else if (seg.type === 'record') {
          const url = seg.url || seg.data?.url;
          if (url) {
            files.push({ type: 'audio', url, name: seg.file || 'audio.amr' });
          }
        } else if (seg.type === 'file') {
          const url = seg.url || seg.data?.url;
          const name = seg.name || seg.data?.name || 'file';
          if (url) {
            files.push({ type: 'file', url, name });
          }
        }
      }
    }
    
    const payload = {
      type: 'message',
      id: e.message_id || Date.now().toString(),
      kind: isGroup ? 'group' : 'direct',
      userId: String(e.user_id),
      groupId: e.group_id ? String(e.group_id) : null,
      text: cleanText,
      files,
      sender: {
        user_id: String(e.user_id),
        nickname: e.sender?.nickname || e.sender?.card || ''
      },
      self_id: String(e.self_id),
      atBot: isAtBot
    };

    BotUtil.makeLog('info', `[XRK-Bridge-Forward] 转发${isPrivate ? '私聊' : '艾特'}消息 user=${payload.userId} group=${payload.groupId} text=${cleanText?.slice(0, 30)} files=${files.length}`, 'XRK-Bridge');

    if (isGroup && e.group_id && e.user_id) {
      try {
        const group = Bot.pickGroup(String(e.group_id));
        if (group && group.pokeMember) {
          await group.pokeMember(String(e.user_id));
        }
      } catch (err) {
        BotUtil.makeLog('debug', `[XRK-Bridge-Forward] 戳一戳失败: ${err.message}`, 'XRK-Bridge');
      }
    }

    const sent = sendToBridge(payload);
    return sent > 0;
  }
}