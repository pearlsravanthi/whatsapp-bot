
import logger from '../utils/logger.js';
import fs from 'fs';

export const makeSimpleInMemoryStore = () => {
    const messages = {}; // Map<jid, WAMessage[]>
    const contacts = {}; // Map<jid, Contact>

    const writeToFile = (path) => {
        try {
            fs.writeFileSync(path, JSON.stringify({ messages, contacts }, null, 2));
        } catch (error) {
            logger.error(`Failed to write store to ${path}:`, error);
        }
    };

    const readFromFile = (path) => {
        try {
            if (fs.existsSync(path)) {
                const data = fs.readFileSync(path, 'utf-8');
                const parsed = JSON.parse(data);

                // Handle legacy format (just messages) or new format ({messages, contacts})
                if (parsed.messages) {
                    for (const jid in parsed.messages) {
                        messages[jid] = parsed.messages[jid];
                    }
                } else if (!parsed.messages && !parsed.contacts) {
                    // Assume legacy format where root is messages
                    for (const jid in parsed) {
                        messages[jid] = parsed[jid];
                    }
                }

                if (parsed.contacts) {
                    for (const jid in parsed.contacts) {
                        contacts[jid] = parsed.contacts[jid];
                    }
                }
                logger.info(`Store loaded from ${path}`);
            }
        } catch (error) {
            logger.error(`Failed to read store from ${path}:`, error);
        }
    };

    const bind = (ev) => {
        ev.on('messages.upsert', ({ messages: newMessages, type }) => {
            logger.info(`${newMessages.length} messages with type: ${type}`);

            for (const msg of newMessages) {
                const jid = msg.key.remoteJid;
                if (!jid) continue;

                if (!messages[jid]) {
                    messages[jid] = [];
                }

                // Check if message already exists
                const exists = messages[jid].some(m => m.key.id === msg.key.id);
                if (!exists) {
                    messages[jid].push(msg);
                }
            }
        });

        ev.on('messaging-history.set', ({ chats, contacts: newContacts, messages: historyMessages, isLatest }) => {
            logger.info(`Store received history sync. isLatest: ${isLatest}`);

            // Store contacts
            if (newContacts) {
                for (const contact of newContacts) {
                    contacts[contact.id] = Object.assign(contacts[contact.id] || {}, contact);
                }
            }

            for (const msg of historyMessages) {
                const jid = msg.key.remoteJid;
                if (!jid) continue;

                if (!messages[jid]) {
                    messages[jid] = [];
                }

                // Check if message already exists
                const exists = messages[jid].some(m => m.key.id === msg.key.id);
                if (!exists) {
                    messages[jid].push(msg);
                }
            }
        });

        ev.on('contacts.upsert', (newContacts) => {
            for (const contact of newContacts) {
                contacts[contact.id] = Object.assign(contacts[contact.id] || {}, contact);
            }
        });

        ev.on('contacts.update', (updates) => {
            for (const update of updates) {
                if (contacts[update.id]) {
                    Object.assign(contacts[update.id], update);
                }
            }
        });

        ev.on('messages.reaction', (reactions) => {
            logger.info(`Received ${reactions.length} reactions`);
            for (const { key, reaction } of reactions) {
                const jid = key.remoteJid;
                if (!messages[jid]) continue;

                const msg = messages[jid].find(m => m.key.id === key.id);
                if (msg) {
                    if (!msg.reactions) msg.reactions = [];
                    // Simple reaction update: remove previous from this user, add new
                    const participant = key.participant || (key.fromMe ? 'me' : jid);
                    msg.reactions = msg.reactions.filter(r => r.participant !== participant);

                    if (reaction.text) {
                        msg.reactions.push({
                            text: reaction.text,
                            participant,
                            ts: Date.now()
                        });
                    }
                }
            }
        });
    };

    const getTimestamp = (t) => {
        if (!t) return 0;
        if (typeof t === 'number') return t;
        if (typeof t === 'string') return parseInt(t);
        if (typeof t === 'object' && t.low !== undefined) return t.low;
        return Number(t) || 0;
    };

    const loadMessages = async (jid, count) => {
        const msgs = messages[jid] || [];
        // Sort by timestamp (most recent last)
        const sorted = [...msgs].sort((a, b) => {
            return getTimestamp(a.messageTimestamp) - getTimestamp(b.messageTimestamp);
        });

        // Return correct number of messages (most recent)
        return sorted.slice(-count);
    };

    const loadMessagesSince = async (jid, timestamp) => {
        const msgs = messages[jid] || [];
        return msgs.filter(m => {
            return getTimestamp(m.messageTimestamp) >= timestamp;
        }).sort((a, b) => {
            return getTimestamp(a.messageTimestamp) - getTimestamp(b.messageTimestamp);
        });
    };

    const loadMessage = async (jid, id) => {
        const msgs = messages[jid] || [];
        return msgs.find(m => m.key.id === id);
    };

    const getKnownJids = () => {
        return Object.keys(messages);
    };

    const getChatsSummary = () => {
        const summary = [];
        const jids = Object.keys(messages);

        for (const jid of jids) {
            const msgs = messages[jid];
            const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            const contact = contacts[jid] || {};

            // Try to resolve name: Contact name > Notify Name > JID
            let name = contact.name || contact.notify || jid;

            // Clean up JID for name if it's the only option
            if (name === jid) {
                name = jid.split('@')[0];
            }

            if (lastMsg) {
                const timestamp = getTimestamp(lastMsg.messageTimestamp);

                summary.push({
                    id: jid,
                    name: name,
                    lastMessageTimestamp: timestamp,
                    lastMessage: lastMsg // Send the whole object, let frontend parse
                });
            }
        }

        // Sort by recent activity
        return summary.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);
    };

    const purge = () => {
        for (const key in messages) {
            delete messages[key];
        }
        for (const key in contacts) {
            delete contacts[key];
        }
        // Also clear file
        try {
            if (fs.existsSync('./baileys_store.json')) {
                fs.unlinkSync('./baileys_store.json');
            }
        } catch (e) {
            logger.error('Failed to delete store file', e);
        }
        logger.info('Store purged');
    };

    return {
        bind,
        loadMessages,
        loadMessagesSince,
        loadMessage,
        getKnownJids,
        getChatsSummary,
        purge,
        writeToFile,
        readFromFile,
        messages, // Expose raw messages if needed
        contacts
    };
};
