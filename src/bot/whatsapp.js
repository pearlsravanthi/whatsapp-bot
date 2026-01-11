import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, proto, downloadMediaMessage } from '@whiskeysockets/baileys';
import { makeSimpleInMemoryStore } from './store.js';
import logger from '../utils/logger.js';
import qrcode from 'qrcode-terminal';
import axios from 'axios';

const store = makeSimpleInMemoryStore();
const STORE_FILE = './baileys_store.json';

// Load store on startup
store.readFromFile(STORE_FILE);

// Save store every 10 seconds
setInterval(() => {
    store.writeToFile(STORE_FILE);
}, 10000);

let sock = null;
let isConnected = false;

const initWhatsApp = async () => {
    try {
        // Use multi-file auth state for session persistence
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');

        // Fetch latest version
        const { version } = await fetchLatestBaileysVersion();

        // Create socket connection
        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false, // We'll handle QR display manually
            logger: logger,
            browser: ['WhatsApp', 'macOS', '10.15.7'], // Emulate Desktop for better history sync
            syncFullHistory: true, // Request full history sync
            markOnlineOnConnect: true,
            defaultQueryTimeoutMs: undefined,
            getMessage: async (key) => {
                if (store) {
                    const msg = await store.loadMessage(key.remoteJid, key.id);
                    return msg?.message || undefined;
                }
                return proto.Message.fromObject({});
            }
        });

        store.bind(sock.ev);

        // Save credentials whenever they're updated
        sock.ev.on('creds.update', saveCreds);

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Display QR code
            if (qr) {
                console.log('\n=================================');
                console.log('Scan this QR code with WhatsApp:');
                console.log('=================================\n');
                qrcode.generate(qr, { small: true });
                console.log('\n=================================\n');
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

                logger.info('Connection closed', {
                    reason: lastDisconnect?.error?.output?.statusCode,
                    shouldReconnect
                });

                // Save store on close
                store.writeToFile(STORE_FILE);

                isConnected = false;

                if (shouldReconnect) {
                    logger.info('Reconnecting...');
                    setTimeout(() => initWhatsApp(), 3000);
                } else {
                    logger.warn('Logged out. Please delete auth_info folder and restart.');
                }
            } else if (connection === 'open') {
                isConnected = true;
                logger.info('✅ WhatsApp connected successfully!');

                // Log user info
                const userInfo = sock.user;
                if (userInfo) {
                    logger.info(`Connected as: ${userInfo.name || userInfo.id}`);
                }
            }
        });

        // Handle incoming messages (optional - for debugging)
        sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const msg of messages) {
                if (!msg.key.fromMe && msg.message) {
                    logger.debug('Received message:', {
                        from: msg.key.remoteJid,
                        text: msg.message?.conversation || 'Media/Other'
                    });
                }
            }
        });

        return sock;
    } catch (error) {
        logger.error('Error initializing WhatsApp:', error);
        throw error;
    }
};

const getWhatsAppInstance = () => {
    if (!sock) {
        throw new Error('WhatsApp not initialized');
    }
    return sock;
};

const isWhatsAppConnected = () => {
    return isConnected;
};

// Get list of channels
const getChannels = async () => {
    try {
        const socket = getWhatsAppInstance();

        if (!isConnected) {
            throw new Error('WhatsApp not connected');
        }

        // Get all chats and filter for newsletters
        const chats = await socket.groupFetchAllParticipating();
        const channels = [];

        for (const [jid, chat] of Object.entries(chats)) {
            if (jid.endsWith('@newsletter')) {
                channels.push({
                    id: jid,
                    name: chat.subject || 'Unknown',
                    description: chat.desc || '',
                    createdAt: chat.creation || null,
                });
            }
        }

        return channels;
    } catch (error) {
        logger.error('Error fetching channels:', error);
        throw error;
    }
};

// Get channel metadata
const getChannelMetadata = async (channelId) => {
    try {
        const socket = getWhatsAppInstance();

        if (!channelId.endsWith('@newsletter')) {
            channelId = channelId + '@newsletter';
        }

        const metadata = await socket.newsletterMetadata('jid', channelId);
        return metadata;
    } catch (error) {
        logger.error('Error fetching channel metadata:', error);
        throw error;
    }
};

// Send text message to channel
const sendTextToChannel = async (channelId, text) => {
    try {
        const socket = getWhatsAppInstance();

        if (!isConnected) {
            throw new Error('WhatsApp not connected');
        }

        // Ensure JID has correct format
        // Only append @newsletter if it's a raw ID (no suffix)
        if (!channelId.includes('@')) {
            channelId = channelId + '@newsletter';
        }

        const result = await socket.sendMessage(channelId, {
            text: text
        });

        logger.info(`Message sent to ${channelId}`);
        return result;
    } catch (error) {
        logger.error('Error sending message:', error);
        throw error;
    }
};

// Send image to channel
const sendImageToChannel = async (channelId, imageUrl, caption = '') => {
    try {
        const socket = getWhatsAppInstance();

        if (!isConnected) {
            throw new Error('WhatsApp not connected');
        }

        // Ensure JID has correct format
        if (!channelId.includes('@')) {
            channelId = channelId + '@newsletter';
        }

        // Download image
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');

        const result = await socket.sendMessage(channelId, {
            image: buffer,
            caption: caption
        });

        logger.info(`Image sent to ${channelId}`);
        return result;
    } catch (error) {
        logger.error('Error sending image:', error);
        throw error;
    }
};
// Get participating groups
const getGroups = async () => {
    try {
        const socket = getWhatsAppInstance();

        if (!isConnected) {
            throw new Error('WhatsApp not connected');
        }

        const groups = await socket.groupFetchAllParticipating();
        const formattedGroups = [];

        for (const [jid, group] of Object.entries(groups)) {
            formattedGroups.push({
                id: jid,
                subject: group.subject,
                creation: group.creation,
                owner: group.owner,
                desc: group.desc
            });
        }

        return formattedGroups;
    } catch (error) {
        logger.error('Error fetching groups:', error);
        throw error;
    }
};

// Get messages from a group
const getGroupMessages = async (groupId, limit = 50) => {
    try {
        if (!isConnected) {
            throw new Error('WhatsApp not connected');
        }

        // Ensure remoteJid is correct format
        if (!groupId.includes('@')) {
            groupId = groupId + '@g.us';
        }

        // Try to load from store
        if (store) {
            const messages = await store.loadMessages(groupId, limit);
            return messages;
        }

        return [];
    } catch (error) {
        logger.error('Error fetching group messages:', error);
        throw error;
    }
};

const getMessagesSince = async (jid, startTimeSeconds) => {
    try {
        if (store) {
            return await store.loadMessagesSince(jid, startTimeSeconds);
        }
        return [];
    } catch (error) {
        logger.error('Error in getMessagesSince:', error);
        return [];
    }
}

const getAllKnownJids = () => {
    if (store) {
        return store.getKnownJids();
    }
    return [];
}

const restartAndResync = async () => {
    try {
        if (store) {
            store.purge();
        }

        if (sock) {
            sock.end(undefined);
            sock = null;
        }

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));

        await initWhatsApp();
        return true;
    } catch (error) {
        logger.error('Error in restartAndResync:', error);
        throw error;
    }
};

const getChats = () => {
    if (store) {
        return store.getChatsSummary();
    }
    return [];
};

const getMessage = async (jid, id) => {
    if (store) {
        return await store.loadMessage(jid, id);
    }
    return null;
};

const downloadMedia = async (msg) => {
    try {
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            {
                logger,
                // pass this so that the library can re-download media if deleted
                reuploadRequest: sock.updateMediaMessage
            }
        );

        if (!buffer) {
            throw new Error('Failed to download media: Buffer is empty');
        }

        return buffer;
    } catch (error) {
        logger.error('Error downloading media:', error);
        throw error;
    }
};

const getGroupMetadata = async (groupId) => {
    try {
        const socket = getWhatsAppInstance();
        if (!isConnected) {
            throw new Error('WhatsApp not connected');
        }

        // Ensure remoteJid is correct format for groups
        if (!groupId.includes('@g.us') && !groupId.includes('@')) {
            groupId = groupId + '@g.us';
        }

        const metadata = await socket.groupMetadata(groupId);
        return metadata;
    } catch (error) {
        logger.error('Error fetching group metadata:', error);
        throw error;
    }
};

export {
    initWhatsApp,
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
    store // Export store
};