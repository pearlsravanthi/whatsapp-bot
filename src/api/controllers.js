import {
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
    getMessage
} from '../bot/whatsapp.js';
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
    downloadMediaController
};