import {
    getWhatsAppInstance,
    isWhatsAppConnected,
    getChannels,
    getChannelMetadata,
    sendTextToChannel,
    sendImageToChannel,
    getGroups,
    getGroupMessages,
    getMessagesSince,
    getAllKnownJids,
    restartAndResync,
    getChats,
    downloadMedia,
    getMessage,
    getGroupMetadata,
    store
} from '../bot/whatsapp.js';
// store import from file removed
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

// Get connection status
const getStatus = async (req, res) => {
    try {
        const connected = isWhatsAppConnected();

        res.json({
            success: true,
            connected: connected,
            status: connected ? 'connected' : 'disconnected',
            message: connected
                ? 'WhatsApp is connected and ready'
                : 'WhatsApp is not connected. Please scan QR code.'
        });
    } catch (error) {
        logger.error('Status check error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// List all channels
const listChannels = async (req, res) => {
    try {
        if (!isWhatsAppConnected()) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp not connected'
            });
        }

        const channels = await getChannels();

        res.json({
            success: true,
            count: channels.length,
            channels: channels
        });
    } catch (error) {
        logger.error('List channels error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get specific channel info
const getChannelInfo = async (req, res) => {
    try {
        if (!isWhatsAppConnected()) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp not connected'
            });
        }

        const { channelId } = req.params;

        if (!channelId) {
            return res.status(400).json({
                success: false,
                error: 'Channel ID is required'
            });
        }

        const metadata = await getChannelMetadata(channelId);

        res.json({
            success: true,
            channel: metadata
        });
    } catch (error) {
        logger.error('Get channel info error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Send text message
const sendMessage = async (req, res) => {
    try {
        if (!isWhatsAppConnected()) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp not connected'
            });
        }

        const { channelId, message } = req.body;

        // Validation
        if (!channelId || !message) {
            return res.status(400).json({
                success: false,
                error: 'channelId and message are required'
            });
        }

        if (typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message must be a non-empty string'
            });
        }

        const result = await sendTextToChannel(channelId, message);

        res.json({
            success: true,
            message: 'Message sent successfully',
            messageId: result.key.id
        });
    } catch (error) {
        logger.error('Send message error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Send image
const sendImage = async (req, res) => {
    try {
        if (!isWhatsAppConnected()) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp not connected'
            });
        }

        const { channelId, imageUrl, caption } = req.body;

        // Validation
        if (!channelId || !imageUrl) {
            return res.status(400).json({
                success: false,
                error: 'channelId and imageUrl are required'
            });
        }

        // Validate URL format
        try {
            new URL(imageUrl);
        } catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Invalid image URL'
            });
        }

        const result = await sendImageToChannel(channelId, imageUrl, caption || '');

        res.json({
            success: true,
            message: 'Image sent successfully',
            messageId: result.key.id
        });
    } catch (error) {
        logger.error('Send image error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// List groups
const listGroups = async (req, res) => {
    try {
        if (!isWhatsAppConnected()) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp not connected'
            });
        }

        const groups = await getGroups();

        res.json({
            success: true,
            count: groups.length,
            groups: groups
        });
    } catch (error) {
        logger.error('List groups error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get group messages
const listGroupMessages = async (req, res) => {
    try {
        if (!isWhatsAppConnected()) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp not connected'
            });
        }

        const { groupId } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        if (!groupId) {
            return res.status(400).json({
                success: false,
                error: 'Group ID is required'
            });
        }

        const messages = await getGroupMessages(groupId, limit);

        res.json({
            success: true,
            count: messages.length,
            messages: messages
        });
    } catch (error) {
        logger.error('Get group messages error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Export all messages for last 24 hours as CSV
const getRecentMessagesCSV = async (req, res) => {
    try {
        if (!isWhatsAppConnected()) {
            return res.status(503).send('WhatsApp not connected');
        }

        const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
        let jidsToScan = [];
        let groupMap = {}; // Map<jid, groupName>

        // Get Group info for naming
        try {
            const groups = await getGroups();
            for (const g of groups) {
                groupMap[g.id] = g.subject;
            }
        } catch (e) {
            logger.warn('Failed to fetch group names for CSV', e);
        }

        // Determine which JIDs to scan
        if (req.query.groupId) {
            jidsToScan = [req.query.groupId];
        } else {
            // Get ALL valid JIDs from store, not just groups we participate in
            jidsToScan = getAllKnownJids();
        }

        // CSV Header
        let csvContent = `JID,Name,Timestamp,DateTime,Sender Name,Sender ID,Type,Content,Caption,Media Type,File Name\n`;

        for (const jid of jidsToScan) {
            const messages = await getMessagesSince(jid, oneDayAgo);
            const name = groupMap[jid] || 'Unknown/Private';

            for (const msg of messages) {
                if (!msg.message) continue;

                const msgContent = msg.message;
                const type = Object.keys(msgContent).find(k => k !== 'messageContextInfo' && k !== 'senderKeyDistributionMessage') || 'unknown';

                let content = '';
                let caption = '';
                let mediaType = '';
                let fileName = '';

                // Extract content based on type
                if (type === 'conversation') {
                    content = msgContent.conversation;
                } else if (type === 'extendedTextMessage') {
                    content = msgContent.extendedTextMessage?.text;
                } else if (type === 'imageMessage') {
                    mediaType = 'image';
                    caption = msgContent.imageMessage?.caption;
                    content = '[Image]';
                } else if (type === 'videoMessage') {
                    mediaType = 'video';
                    caption = msgContent.videoMessage?.caption;
                    content = '[Video]';
                } else if (type === 'documentMessage') {
                    mediaType = 'document';
                    fileName = msgContent.documentMessage?.fileName;
                    caption = msgContent.documentMessage?.caption;
                    content = `[Document: ${fileName}]`;
                } else if (type === 'audioMessage') {
                    mediaType = 'audio';
                    content = '[Audio]';
                } else if (type === 'stickerMessage') {
                    mediaType = 'sticker';
                    content = '[Sticker]';
                } else if (type === 'protocolMessage') {
                    // Skip protocol messages (like history sync notifications) usually
                    continue;
                } else {
                    content = `[${type}]`;
                }

                // Sanitize fields for CSV (escape quotes)
                const sanitize = (str) => str ? `"${str.toString().replace(/"/g, '""')}"` : '""';

                const timestamp = msg.messageTimestamp && (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : msg.messageTimestamp.low);
                const date = new Date(timestamp * 1000).toISOString();
                const senderName = msg.pushName || 'Unknown';
                const senderId = msg.key.participant || msg.key.remoteJid; // In DMs, remoteJid is sender. In groups, participant is sender.

                // Add row
                csvContent += `${sanitize(jid)},${sanitize(name)},${timestamp},"${date}",${sanitize(senderName)},${sanitize(senderId)},"${type}",${sanitize(content)},${sanitize(caption)},"${mediaType}",${sanitize(fileName)}\n`;
            }
        }

        res.header('Content-Type', 'text/csv');
        res.attachment('recent_messages.csv');
        res.send(csvContent);

    } catch (error) {
        logger.error('Export CSV error:', error);
        res.status(500).send('Error generating CSV');
    }
};

const resyncHistory = async (req, res) => {
    try {
        logger.info('Purging store and resyncing history...');
        await restartAndResync();

        res.json({
            success: true,
            message: 'Store purged and resync initiated. Please wait for history to sync (this may take a few seconds).'
        });
    } catch (error) {
        logger.error('Resync error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

const listChats = async (req, res) => {
    try {
        if (!isWhatsAppConnected()) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp not connected'
            });
        }

        const chats = getChats();

        res.json({
            success: true,
            count: chats.length,
            chats: chats
        });
    } catch (error) {
        logger.error('List chats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

const downloadMediaController = async (req, res) => {
    try {
        const { chatId, messageId } = req.params;

        if (!chatId || !messageId) {
            return res.status(400).send('Missing chatId or messageId');
        }

        const msg = await getMessage(chatId, messageId);
        if (!msg) {
            return res.status(404).send('Message not found');
        }

        // Determine mimeType/extension first
        const m = msg.message;
        let mimeType = 'application/octet-stream';
        let ext = 'bin';

        if (m.imageMessage) {
            mimeType = m.imageMessage.mimetype;
            ext = mimeType.split('/')[1] || 'jpg';
        }
        else if (m.videoMessage) {
            mimeType = m.videoMessage.mimetype;
            ext = mimeType.split('/')[1] || 'mp4';
        }
        else if (m.audioMessage) {
            mimeType = m.audioMessage.mimetype;
            ext = mimeType.split('/')[1] || 'ogg'; // OGG usually for WA Audio
        }
        else if (m.documentMessage) {
            mimeType = m.documentMessage.mimetype;
            ext = m.documentMessage.fileName ? m.documentMessage.fileName.split('.').pop() : (mimeType.split('/')[1] || 'bin');
        }
        else if (m.stickerMessage) {
            mimeType = m.stickerMessage.mimetype;
            ext = 'webp';
        }

        // Clean extension
        ext = ext.split(';')[0];

        const fileName = `${messageId}.${ext}`;
        const filePath = path.join(process.cwd(), 'public', 'media', fileName);

        // Check cache
        if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', mimeType);
            return res.sendFile(filePath);
        }

        const buffer = await downloadMedia(msg);

        // Save to cache
        try {
            fs.writeFileSync(filePath, buffer);
            logger.info(`Cached media: ${fileName}`);
        } catch (e) {
            logger.warn(`Failed to cache media ${fileName}:`, e);
            // Continue to serve buffer if write failed
        }

        res.setHeader('Content-Type', mimeType);
        res.sendFile(filePath); // Send file if written, or use res.send(buffer) if preferred, but sendFile handles ranges/etc for video better.
        // If write failed, we can't use sendFile on missing file.
        // Let's safe guard.
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.send(buffer);
        }

    } catch (error) {
        logger.error('Download media error:', error);
        res.status(500).send('Error downloading media');
    }
};

const _calculateStats = async (groupId, days = 2) => {
    // Lookback range
    const startTime = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
    const messages = await getMessagesSince(groupId, startTime);

    // Structure: { dateString: { userJid: { name, points: 0, tasks: [], counts: { text: 0, image: 0, video: 0, reactions: 0, replies: 0 } } } }
    const dailyStats = {};
    const msgMap = {};
    for (const msg of messages) {
        msgMap[msg.key.id] = msg;
    }

    const getDayKey = (ts) => {
        const d = new Date(ts * 1000);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const getStatNode = (day, jid, name) => {
        if (!dailyStats[day]) dailyStats[day] = {};
        if (!dailyStats[day][jid]) {
            dailyStats[day][jid] = {
                name: name || 'Unknown',
                points: 0,
                tasks: [],
                counts: { text: 0, image: 0, video: 0, reactions: 0, replies: 0 }
            };
        }
        return dailyStats[day][jid];
    };

    // Pass 1: Activity Counters & Identify Tasks/Points
    for (const msg of messages) {
        // if (msg.key.fromMe) continue; // Skip bot messages unless tracking bot activity? user usually implies members.

        const ts = (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : msg.messageTimestamp.low);
        const dayKey = getDayKey(ts);

        // Resolve JID for self (Unify with Pass 3 logic)
        let senderJid = msg.key.participant || msg.key.remoteJid;
        if (msg.key.fromMe) {
            const socket = getWhatsAppInstance();
            senderJid = socket?.user?.id || senderJid;
        }

        // Ensure domain
        if (!senderJid.includes('@')) senderJid = senderJid + '@s.whatsapp.net';

        // Normalize: remove device part
        const userPart = senderJid.split('@')[0].split(':')[0];
        const server = senderJid.split('@')[1] || 's.whatsapp.net';
        senderJid = `${userPart}@${server}`;

        const name = msg.pushName || (msg.key.fromMe ? 'Me' : userPart);

        const node = getStatNode(dayKey, senderJid, name);

        // Count Message Types
        const m = msg.message;
        if (m) {
            if (m.conversation || m.extendedTextMessage) node.counts.text++;
            else if (m.imageMessage) node.counts.image++;
            else if (m.videoMessage) node.counts.video++;

            // Count Replies (if contextInfo exists)
            const context = m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo || m.videoMessage?.contextInfo;
            if (context && context.quotedMessage) {
                node.counts.replies++;
            }
        }

        // Count Reactions Received (This logic is tricky with store structure. 
        // If msg has reactions, those are reactions *on* this message, so they are points FOR this sender effectively? 
        // Or user wants "reactions made"? Reactions made is hard to track unless we have reaction events separate from messages.
        // Usually `messages` in Baileys store contains the current state of reactions ON the message. 
        // We cannot easily track WHO made the reaction unless we scan all reactions on all messages for this user's JID.
        // Let's count *reactions received* on their messages for now as "reactions" stat? 
        // Or if user meant "reactions performed by sender", we need to scan EVERY message's reaction list.
        // Let's try scanning all messages for reactions BY this user.)
    }

    // Pass 2: Scan for Reactions Performed by users (iterate all msgs again or integrate?)
    // This is expensive if many messages, but for 2 days ok.
    for (const msg of messages) {
        if (msg.reactions) {
            msg.reactions.forEach(r => {
                // reaction r has key (sender jid in some stores? Baileys store reaction object usually: { text, count? key? } )
                // Baileys standard store reactions are often just aggregated or list of { key: { remoteJid, fromMe, id, participant? }, text, timestamp }
                // We need to check exact store implementation format.
                // Assuming we can't easily get reaction sender without inspecting distinct reaction events which store might merge.
                // If we assume `msg.reactions` is array of `{ key: { participant }, text }`
                const reactor = r.key?.participant || r.key?.remoteJid;
                if (reactor) {
                    const reactionDay = getDayKey(r.timestamp || Date.now() / 1000); // timestamp might be missing
                    const rNode = getStatNode(reactionDay, reactor, 'Unknown');
                    rNode.counts.reactions++;
                }
            });
        }
    }

    // Pass 3: Identify Tasks and Points
    // We need to scan ALL messages to find tasks first, THEN check if they have point replies.

    // Fetch Admins (Normalize to User ID)
    let admins = new Set();
    try {
        const metadata = await getGroupMetadata(groupId);
        if (metadata.participants) {
            metadata.participants.forEach(p => {
                if (p.admin === 'admin' || p.admin === 'superadmin') {
                    // Normalize: remove server part AND device part if present (123:4@s.whatsapp.net -> 123)
                    const userPart = p.id.split('@')[0].split(':')[0];
                    admins.add(userPart);
                }
            });
        }
        logger.info(`[Stats] Found ${admins.size} admins in group: ${Array.from(admins).join(', ')}`);
    } catch (e) {
        logger.warn('Failed to fetch group metadata for admin check, proceeding without admin restrictions:', e);
    }
    // 3a. Find all Tasks first

    // 3a. Find all Tasks first
    for (const msg of messages) {
        // if (msg.key.fromMe) continue; // Allow self-messages

        const m = msg.message;
        let isTask = false;
        let content = '';

        const text = m?.conversation || m?.extendedTextMessage?.text || '';
        // Strict start of message check
        if (text.match(/^Task:/i)) {
            isTask = true;
            content = text;
        } else if (m?.imageMessage?.caption?.match(/^Task:/i)) {
            isTask = true;
            content = m.imageMessage.caption;
        } else if (m?.videoMessage?.caption?.match(/^Task:/i)) {
            isTask = true;
            content = m.videoMessage.caption;
        }

        if (isTask) {
            logger.info(`[Stats] Found Task: ${content.substring(0, 20)}... from ${msg.pushName}`);
            const ts = (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : msg.messageTimestamp.low);
            const day = getDayKey(ts);

            // Resolve JID for self
            let jid = msg.key.participant || msg.key.remoteJid;
            if (msg.key.fromMe) {
                const socket = getWhatsAppInstance();
                jid = socket?.user?.id || jid;
            }

            // Should contain @s.whatsapp.net usually, but just in case
            if (!jid.includes('@')) jid = jid + '@s.whatsapp.net';

            // Normalize JID: remove device part (user:dev@server -> user@server)
            const rawJid = jid;
            const userPart = rawJid.split('@')[0].split(':')[0];
            const server = rawJid.split('@')[1] || 's.whatsapp.net';
            jid = `${userPart}@${server}`;

            const name = msg.pushName || (msg.key.fromMe ? 'Me' : userPart);

            const node = getStatNode(day, jid, name);

            // Add to tasks list (initially 0 points, means unreplied/unscored)
            if (!node.tasks.find(t => t.id === msg.key.id)) {
                node.tasks.push({
                    id: msg.key.id,
                    text: content.substring(0, 40) + (content.length > 40 ? '...' : ''),
                    points: 0,
                    replied: false // Track if it got a point reply
                });
            }
        }
    }

    // 3b. Find Point Replies and Update Tasks
    for (const msg of messages) {
        // Enforce Admin Only for Points
        let senderJid = msg.key.participant;
        // Handle fromMe fallback
        if (msg.key.fromMe && !senderJid) {
            try {
                const me = getWhatsAppInstance().user;
                if (me) senderJid = me.id;
            } catch (e) { }
        }
        // Fallback for non-group
        if (!senderJid) senderJid = msg.key.remoteJid;

        const senderId = senderJid ? senderJid.split('@')[0].split(':')[0] : '';
        let isAdmin = admins.has(senderId);

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

        // Strict Match: "^Points: number"
        const pointMatch = text.match(/^Points:\s*(\d{1,3})/i);

        if (pointMatch) {
            const points = parseInt(pointMatch[1]);
            // Validate Range 0-100
            if (points > 0 && points <= 100) {
                logger.info(`[Stats] Checking Point Award from ${senderId} (Admin: ${isAdmin}) - Points: ${points}`);
                if (!isAdmin) continue; // Only check admin if points are valid format
                const context = msg.message?.extendedTextMessage?.contextInfo;
                if (context && context.quotedMessage) {
                    let targetJid = context.participant;

                    // Normalize Target JID
                    const targetUser = targetJid.split('@')[0].split(':')[0];
                    const targetServer = targetJid.split('@')[1] || 's.whatsapp.net';
                    targetJid = `${targetUser}@${targetServer}`;

                    const stanzaId = context.stanzaId; // Valid task ID if it was in our window

                    // Search for the task across all days in our window
                    let taskFound = false;
                    for (const date in dailyStats) {
                        // Strategy 1: Direct Lookup (Fastest)
                        if (dailyStats[date][targetJid]) {
                            const t = dailyStats[date][targetJid].tasks.find(t => t.id === stanzaId);
                            if (t) {
                                t.points = points;
                                t.replied = true;
                                taskFound = true;
                                break;
                            }
                        }

                        // Strategy 2: Fallback Scan by ID (Handles JID mismatches like LID vs PN)
                        if (!taskFound) {
                            const users = Object.values(dailyStats[date]);
                            for (const userNode of users) {
                                const t = userNode.tasks.find(t => t.id === stanzaId);
                                if (t) {
                                    t.points = points;
                                    t.replied = true;
                                    taskFound = true;
                                    break;
                                }
                            }
                        }

                        if (taskFound) break;
                    }
                }
            }
        }
    }

    // Pass 4: Recalculate Total Points per User
    Object.keys(dailyStats).forEach(date => {
        Object.values(dailyStats[date]).forEach(user => {
            user.points = user.tasks.reduce((sum, t) => sum + t.points, 0);
        });
    });

    // Transform to array
    const result = Object.keys(dailyStats).map(date => ({
        date,
        users: Object.values(dailyStats[date])
            // Filter: Include if they have points OR any activity OR any tasks (even unreplied)
            .filter(u => u.points > 0 || u.tasks.length > 0 || u.counts.text > 0)
            .sort((a, b) => b.points - a.points)
    })).sort((a, b) => new Date(b.date) - new Date(a.date));

    return result;
};

const getGroupStats = async (req, res) => {
    try {
        const { groupId } = req.params;
        const days = parseInt(req.query.days) || 1;

        // Fetch group Name
        let groupName = 'Unknown Group';
        try {
            const meta = await getGroupMetadata(groupId);
            groupName = meta.subject;
        } catch (e) {
            logger.warn('Could not fetch group name for stats', e);
        }

        const summary = await _calculateStats(groupId, days);

        res.json({
            success: true,
            groupId,
            groupName,
            days,
            stats: summary
        });
    } catch (error) {
        logger.error('Get group stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const publishGroupStats = async (req, res) => {
    try {
        const { groupId } = req.params;
        const days = parseInt(req.query.days) || 1;

        const summary = await _calculateStats(groupId, days);

        if (summary.length === 0) {
            return res.json({ success: true, message: 'No stats to publish.' });
        }

        let text = `📊 *Task & Points Summary* 📊\n`;

        summary.forEach(day => {
            text += `\n📅 *${day.date}*\n`;
            day.users.forEach((s, i) => {
                const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : '👤'));
                text += `\n${medal} *${s.name}*`;
                text += `\n   💰 *Total Points*: ${s.points}`;

                // Counters
                const c = s.counts;
                text += `\n   📊 Activities: 💬${c.text}  📷${c.image}  🎥${c.video}  ↩️${c.replies}  ❤️${c.reactions}`;

                if (s.tasks.length > 0) {
                    text += `\n   📝 *Tasks*:`;
                    s.tasks.forEach(t => {
                        const status = t.replied ? `[✅ ${t.points} pts]` : `[⏳ Pending]`;
                        text += `\n     └ ${status} ${t.text}`;
                    });
                }
            });
            text += `\n────────────────\n`;
        });

        text += `\n_Keep up the good work!_ 🚀`;

        const socket = getWhatsAppInstance();
        await socket.sendMessage(groupId, { text });

        res.json({
            success: true,
            message: 'Stats published to group',
            summary: summary
        });
    } catch (error) {
        logger.error('Publish stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getGroupAdmins = async (req, res) => {
    try {
        const { groupId } = req.params;
        const meta = await getGroupMetadata(groupId);

        const admins = meta.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => ({
                id: p.id,
                admin: p.admin
            }));

        res.json({ success: true, admins });
    } catch (error) {
        logger.error('Get group admins error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getGroupMembers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const meta = await getGroupMetadata(groupId);

        const socket = getWhatsAppInstance();
        // socket.user usually { id: "123:4@s.whatsapp.net", name: "Me" }
        const myJid = socket?.user?.id;

        const contactCount = Object.keys(store.contacts).length;
        logger.info(`[Members] Store has ${contactCount} contacts.`);

        const members = meta.participants.map(p => {
            // Normalize JID: user:device@server -> user@server
            const userPart = p.id.split('@')[0].split(':')[0];
            const server = p.id.split('@')[1] || 's.whatsapp.net';
            const normalizedJid = `${userPart}@${server}`;

            const contact = (store.contacts && (store.contacts[normalizedJid] || store.contacts[p.id])) || {};

            let name = contact.name || contact.notify || contact.verifiedName;

            // Handle Self
            if (!name && myJid) {
                const myUserPart = myJid.split('@')[0].split(':')[0];
                if (userPart === myUserPart) name = socket.user?.name || "Me";
            }

            return {
                id: p.id,
                name: name || userPart,
                admin: p.admin || null
            };
        });

        res.json({ success: true, members, count: members.length });
    } catch (error) {
        logger.error('Get group members error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export {
    getStatus,
    listChannels,
    getChannelInfo,
    sendMessage,
    sendImage,
    listGroups,
    listGroupMessages,
    getRecentMessagesCSV,
    resyncHistory,
    listChats,
    downloadMediaController,
    getGroupStats,
    publishGroupStats,
    getGroupAdmins,
    getGroupMembers
};