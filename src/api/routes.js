import express from 'express';
const router = express.Router();
import {
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
} from './controllers.js';

// Status endpoint
router.get('/status', getStatus);

// Channel endpoints
router.get('/channels', listChannels);
router.get('/channel/:channelId', getChannelInfo);

// Message endpoints
router.post('/send', sendMessage);
router.post('/send-image', sendImage);

// Group endpoints
router.get('/groups', listGroups);
router.get('/chats', listChats);
router.get('/groups/:groupId/messages', listGroupMessages);
router.get('/chats/:chatId/messages/:messageId/download', downloadMediaController);
router.get('/messages/export-csv', getRecentMessagesCSV);

// History management
router.post('/resync-history', resyncHistory);

export default router;