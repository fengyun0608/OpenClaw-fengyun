import plugin from '../../../lib/plugins/plugin.js';
import BotUtil from '../../../lib/util.js';
import cfg from '../../../lib/config/config.js';
import fs from 'fs';
import path from 'path';

BotUtil.makeLog('info', '[XRK-Bridge-Forward] 消息转发插件已加载', 'XRK-Bridge');

const CONFIG_PATH = path.join(process.cwd(), 'data', 'xrk-bridge-op.json');

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        BotUtil.makeLog('warn', `[XRK-Bridge-Forward] 加载配置失败: ${e.message}`, 'XRK-Bridge');
    }
    return { opUsers: [] };
}

function saveConfig(config) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    } catch (e) {
        BotUtil.makeLog('error', `[XRK-Bridge-Forward] 保存配置失败: ${e.message}`, 'XRK-Bridge');
    }
}

let config = loadConfig();

function getMasterQQList() {
    const masterQQ = cfg.masterQQ || [];
    return Array.isArray(masterQQ) ? masterQQ.map(id => String(id)) : [String(masterQQ)];
}

function checkIsMaster(userId) {
    return getMasterQQList().some(id => String(userId) === id);
}

function checkIsOp(userId) {
    return config.opUsers.some(id => String(id) === String(userId));
}

function checkPermission(userId) {
    return checkIsMaster(userId) || checkIsOp(userId);
}

function isOpenClawConnected() {
    const connections = Bot._xrkBridgeConnections;
    if (!connections || connections.size === 0) return false;
    for (const [, c] of connections) {
        if (c.ready && c.conn && c.conn.readyState === 1) return true;
    }
    return false;
}

const COOLDOWN_MS = 3000;
const userCooldown = new Map();

function isOnCooldown(userId) {
    const lastTime = userCooldown.get(String(userId));
    if (!lastTime) return false;
    return Date.now() - lastTime < COOLDOWN_MS;
}

function setCooldown(userId) {
    userCooldown.set(String(userId), Date.now());
}

const HELP_TEXT = `📖 XRK-Bridge 帮助

【使用方式】
• 群聊：@机器人 + 消息
• 私聊：直接发送消息

【授权指令】(仅主人可用)
• #op添加@用户 - 添加授权用户
• #op删除@用户 - 删除授权用户
• #op列表 - 查看授权列表

【权限说明】
• 主人：可直接使用
• 授权用户：需主人授权后使用
• 其他用户：无权限

【配置文件】
data/xrk-bridge-op.json`;

const NOT_CONNECTED_MSG = `❌ 当前 OpenClaw 未连接，请联系管理员处理
 
 ╭─ 状态 ─────────────╮ 
 │  🟢 XRK-Yunzai: 已就绪                           │ 
 │  🔴 OpenClaw: 未连接                              │ 
 │                                                                     │ 
 │  请检查 OpenClaw 服务是否已启动         │ 
 ╰─────────────────╯`;

export class XRKBridgeForward extends plugin {
    constructor() {
        super({
            name: 'XRK-Bridge-Forward',
            dsc: '转发艾特/私聊消息到 OpenClaw',
            event: 'message',
            priority: 1,
            rule: [
                { reg: /^#?op添加/i, fnc: 'addOp', log: false },
                { reg: /^#?op删除/i, fnc: 'removeOp', log: false },
                { reg: /^#?op列表$/i, fnc: 'listOp', log: false },
                { reg: /^#?op帮助$/i, fnc: 'showHelp', log: false },
                { reg: '.*', fnc: 'handleMessage', log: false }
            ]
        });
    }

    async showHelp(e) {
        await e.reply(HELP_TEXT);
        return true;
    }

    async addOp(e) {
        if (!checkIsMaster(e.user_id)) {
            await e.reply('⚠️ 只有主人才能添加授权用户');
            return true;
        }

        const atUsers = e.message?.filter(seg => seg.type === 'at') || [];
        if (atUsers.length === 0) {
            await e.reply('请@要添加授权的用户');
            return true;
        }

        const addedUsers = [];
        for (const at of atUsers) {
            const userId = String(at.qq || at.data?.qq);
            if (userId && !config.opUsers.includes(userId)) {
                config.opUsers.push(userId);
                addedUsers.push(userId);
            }
        }

        if (addedUsers.length > 0) {
            saveConfig(config);
            await e.reply(`✅ 已添加授权用户: ${addedUsers.map(id => `[${id}]`).join(' ')}`);
        } else {
            await e.reply('这些用户已经在授权列表中');
        }
        return true;
    }

    async removeOp(e) {
        if (!checkIsMaster(e.user_id)) {
            await e.reply('⚠️ 只有主人才能删除授权用户');
            return true;
        }

        const atUsers = e.message?.filter(seg => seg.type === 'at') || [];
        if (atUsers.length === 0) {
            await e.reply('请@要删除授权的用户');
            return true;
        }

        const removedUsers = [];
        for (const at of atUsers) {
            const userId = String(at.qq || at.data?.qq);
            const index = config.opUsers.indexOf(userId);
            if (index > -1) {
                config.opUsers.splice(index, 1);
                removedUsers.push(userId);
            }
        }

        if (removedUsers.length > 0) {
            saveConfig(config);
            await e.reply(`✅ 已删除授权用户: ${removedUsers.map(id => `[${id}]`).join(' ')}`);
        } else {
            await e.reply('这些用户不在授权列表中');
        }
        return true;
    }

    async listOp(e) {
        if (!checkIsMaster(e.user_id)) {
            await e.reply('⚠️ 只有主人才能查看授权列表');
            return true;
        }

        if (config.opUsers.length === 0) {
            await e.reply('📋 授权列表为空');
        } else {
            await e.reply(`📋 授权用户列表:\n${config.opUsers.map(id => `- [${id}]`).join('\n')}`);
        }
        return true;
    }

    async handleMessage(e) {
        if (e.tasker === 'xrk-bridge') return false;

        const isAtBot = e.atBot || e.message?.some?.(seg =>
            seg.type === 'at' && (String(seg.qq) === String(e.self_id) || String(seg.data?.qq) === String(e.self_id))
        );
        const isPrivate = !e.isGroup && !e.group_id;

        if (!isAtBot && !isPrivate) return false;

        if (!checkPermission(e.user_id)) {
            BotUtil.makeLog('info', `[XRK-Bridge-Forward] 非授权用户，跳过处理: user=${e.user_id}`, 'XRK-Bridge');
            return false;
        }

        if (!isOpenClawConnected()) {
            BotUtil.makeLog('warn', `[XRK-Bridge-Forward] OpenClaw 未连接`, 'XRK-Bridge');
            await e.reply(NOT_CONNECTED_MSG);
            return true;
        }

        const sendToBridge = Bot._xrkBridgeSend;
        if (!sendToBridge) return false;

        const text = (e.msg || e.raw_message || '').replace(/\[CQ:[^\]]+\]/g, '').trim();
        const isMaster = checkIsMaster(e.user_id);
        const isOp = checkIsOp(e.user_id);

        if (isOnCooldown(e.user_id)) {
            BotUtil.makeLog('debug', `[XRK-Bridge-Forward] 冷却中: user=${e.user_id}`, 'XRK-Bridge');
            return false;
        }

        setCooldown(e.user_id);

        const mediaUrls = [];
        const files = [];
        const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.heic', '.heif', '.avif'];
        
        if (e.img && Array.isArray(e.img)) {
            for (const url of e.img) {
                if (url) mediaUrls.push(url);
            }
        }
        
        if (e.video && Array.isArray(e.video)) {
            for (const url of e.video) {
                if (url) files.push({ url, name: 'video.mp4' });
            }
        }
        
        if (e.audio && Array.isArray(e.audio)) {
            for (const url of e.audio) {
                if (url) files.push({ url, name: 'audio.amr' });
            }
        }
        
        if (e.fileList && Array.isArray(e.fileList)) {
            for (const f of e.fileList) {
                if (f.url) {
                    const fileName = f.name || 'file';
                    const ext = path.extname(fileName).toLowerCase();
                    if (IMAGE_EXTS.includes(ext)) {
                        mediaUrls.push(f.url);
                    } else {
                        files.push({ url: f.url, name: fileName });
                    }
                }
            }
        }
        
        if (e.message) {
            for (const seg of e.message) {
                if (!seg?.type) continue;
                
                const url = seg.url || seg.file || seg.data?.url || seg.data?.file;
                
                if (seg.type === 'image' && url) {
                    if (!mediaUrls.includes(url)) mediaUrls.push(url);
                } else if (seg.type === 'video' && url) {
                    files.push({ url, name: seg.name || 'video.mp4' });
                } else if (seg.type === 'audio' && url) {
                    files.push({ url, name: seg.name || 'audio.amr' });
                } else if (seg.type === 'file' && url) {
                    const fileName = seg.name || seg.data?.name || 'file';
                    const ext = path.extname(fileName).toLowerCase();
                    if (IMAGE_EXTS.includes(ext)) {
                        if (!mediaUrls.includes(url)) mediaUrls.push(url);
                    } else {
                        files.push({ url, name: fileName });
                    }
                }
            }
        }

        const payload = {
            type: 'message',
            id: e.message_id || Date.now().toString(),
            kind: e.group_id ? 'group' : 'direct',
            selfId: String(e.self_id),
            userId: String(e.user_id),
            groupId: e.group_id ? String(e.group_id) : undefined,
            text: isMaster ? `[主人✓] ${text}` : (isOp ? `[授权] ${text}` : `[用户] ${text}`),
            mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
            files: files.length > 0 ? files : undefined,
            sender: { user_id: String(e.user_id), nickname: e.sender?.nickname || '' },
            isMaster
        };

        BotUtil.makeLog('info', `[XRK-Bridge-Forward] 转发 user=${payload.userId} group=${payload.groupId} isMaster=${isMaster} isOp=${isOp}`, 'XRK-Bridge');

        try {
            if (e.group_id) await Bot.pickGroup(String(e.group_id)).pokeMember(String(e.user_id));
        } catch {}

        return sendToBridge(payload) > 0;
    }
}
