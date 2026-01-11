const state = {
    currentChatId: null,
    chats: []
};

// --- API Calls ---

async function fetchChats() {
    try {
        const response = await fetch('/api/chats');
        const data = await response.json();
        if (data.success) {
            state.chats = data.chats;
            renderChatList();
        }
    } catch (error) {
        console.error('Failed to fetch chats:', error);
    }
}

async function fetchMessages(chatId) {
    try {
        // Assume endpoints are consistent for groups and DMs for now or handle appropriately
        // Use group endpoint which calls getGroupsMessages -> store.loadMessages which handles all JIDs
        // Note: endpoint is /api/groups/:groupId/messages, but internally it handles any JID essentially if store has it
        // Ideally we should rename the route to /api/chats/:chatId/messages in backend, but let's use what we have or add query
        const response = await fetch(`/api/groups/${chatId}/messages?limit=400`);
        const data = await response.json();
        if (data.success) {
            renderMessages(data.messages);
        }
    } catch (error) {
        console.error('Failed to fetch messages:', error);
    }
}

async function sendMessage(chatId, text) {
    try {
        const response = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channelId: chatId, // endpoint expects channelId but works for JIDs usually depending on implementation
                message: text
            })
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('message-input').value = '';
            // Refresh messages immediately
            fetchMessages(chatId);
            // Refresh chat list to update last message
            fetchChats();
        }
    } catch (error) {
        console.error('Failed to send message:', error);
    }
}

// --- Render Functions ---

function renderChatList() {
    const chatList = document.getElementById('chat-list');
    chatList.innerHTML = '';

    state.chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = `chat-item ${chat.id === state.currentChatId ? 'active' : ''}`;
        div.onclick = () => selectChat(chat);

        const date = chat.lastMessageTimestamp
            ? new Date(chat.lastMessageTimestamp * 1000).toLocaleDateString()
            : '';

        // Preview text
        let preview = '';
        if (chat.lastMessage) {
            const msg = chat.lastMessage.message;
            if (msg) {
                if (msg.conversation) preview = msg.conversation;
                else if (msg.extendedTextMessage?.text) preview = msg.extendedTextMessage.text;
                else if (msg.imageMessage) preview = '📷 Image';
                else if (msg.videoMessage) preview = '🎥 Video';
                else preview = 'Unsupported message';
            } else {
                preview = 'Synced / System Message';
            }
        }

        div.innerHTML = `
            <div class="chat-avatar">
                <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E" alt="Avatar"> 
            </div>
            <div class="chat-info">
                <div class="chat-top">
                    <h4 title="${chat.name}">${chat.name}</h4>
                    <span>${date}</span>
                </div>
                <div class="chat-bottom">
                    <p>${preview}</p>
                </div>
            </div>
        `;
        chatList.appendChild(div);
    });
}

function renderMessages(messages) {
    const container = document.getElementById('messages-container');

    // Check if we were at the bottom before re-rendering
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50;

    const getTimestamp = (t) => {
        if (!t) return 0;
        if (typeof t === 'number') return t;
        if (typeof t === 'string') return parseInt(t);
        if (typeof t === 'object' && t.low !== undefined) return t.low;
        return Number(t) || 0;
    };

    // Sort messages locally
    messages.sort((a, b) => getTimestamp(a.messageTimestamp) - getTimestamp(b.messageTimestamp));

    // We clear and re-render the whole batch to ensure perfect chronological order in the DOM
    container.innerHTML = '';

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.id = `msg-${msg.key.id}`;
        const fromMe = msg.key.fromMe;
        div.className = `message ${fromMe ? 'outgoing' : 'incoming'}`;

        // Sender name for groups (incoming only)
        let senderName = '';
        if (!fromMe && msg.pushName) {
            senderName = `<span class="message-sender">${msg.pushName}</span>`;
        }

        // Content
        let content = '';
        const m = msg.message;

        // Handle Quoted Message (ContextInfo)
        let quotedContent = '';
        // More robust contextInfo extraction
        let contextInfo = null;
        if (m) {
            if (m.extendedTextMessage?.contextInfo) contextInfo = m.extendedTextMessage.contextInfo;
            else if (m.imageMessage?.contextInfo) contextInfo = m.imageMessage.contextInfo;
            else if (m.videoMessage?.contextInfo) contextInfo = m.videoMessage.contextInfo;
            else if (m.audioMessage?.contextInfo) contextInfo = m.audioMessage.contextInfo;
            else if (m.documentMessage?.contextInfo) contextInfo = m.documentMessage.contextInfo;
            else {
                // Fallback: search all keys
                for (const key in m) {
                    if (m[key]?.contextInfo) {
                        contextInfo = m[key].contextInfo;
                        break;
                    }
                }
            }
        }

        if (contextInfo && contextInfo.quotedMessage) {
            const qm = contextInfo.quotedMessage;
            let qText = '';
            let qMedia = '';

            if (qm.conversation) qText = qm.conversation;
            else if (qm.extendedTextMessage?.text) qText = qm.extendedTextMessage.text;
            else if (qm.imageMessage) {
                qText = qm.imageMessage.caption || '📷 Photo';
                if (qm.imageMessage.jpegThumbnail) {
                    qMedia = `<img src="data:image/jpeg;base64,${qm.imageMessage.jpegThumbnail.toString('base64')}" style="max-width: 50px; border-radius: 4px; margin-left: 10px;">`;
                }
            }
            else if (qm.videoMessage) qText = qm.videoMessage.caption || '🎥 Video';
            else if (qm.audioMessage) qText = '🎵 Audio';
            else qText = '...';

            const qParticipant = contextInfo.participant ? contextInfo.participant.split('@')[0] : 'Unknown';
            quotedContent = `
                <div class="quoted-message" style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-weight: bold; color: var(--accent); font-size: 0.8rem;">${qParticipant}</div>
                        <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-height: 40px;">${qText}</div>
                    </div>
                    ${qMedia}
                </div>`;
        }

        if (m) {
            const getUrl = () => `/api/chats/${msg.key.remoteJid}/messages/${msg.key.id}/download`;

            // Text
            if (m.conversation) content = m.conversation;
            else if (m.extendedTextMessage?.text) content = m.extendedTextMessage.text;

            // Media - On-demand loading with Thumbnails
            if (m.imageMessage) {
                const url = getUrl();
                const caption = m.imageMessage.caption ? m.imageMessage.caption.replace(/'/g, "\\'") : '';
                const thumb = m.imageMessage.jpegThumbnail ? `data:image/jpeg;base64,${m.imageMessage.jpegThumbnail.toString('base64')}` : null;
                content = `
                    <div class="media-container placeholder ${thumb ? 'has-thumb' : ''}" onclick="loadMedia(this, 'image', '${url}', '${caption}')">
                        ${thumb ? `<img src="${thumb}" class="media-thumbnail">` : '<span style="font-size: 1.5rem;">📷</span>'}
                        <span>${thumb ? 'Show Full Image' : 'Click to load Image'}</span>
                        <div class="caption">${m.imageMessage.caption || ''}</div>
                    </div>`;
            }
            else if (m.videoMessage) {
                const url = getUrl();
                const caption = m.videoMessage.caption ? m.videoMessage.caption.replace(/'/g, "\\'") : '';
                const thumb = m.videoMessage.jpegThumbnail ? `data:image/jpeg;base64,${m.videoMessage.jpegThumbnail.toString('base64')}` : null;
                content = `
                    <div class="media-container placeholder ${thumb ? 'has-thumb' : ''}" onclick="loadMedia(this, 'video', '${url}', '${caption}')">
                        ${thumb ? `<div style="position:relative;"><img src="${thumb}" class="media-thumbnail"><div class="play-overlay">▶</div></div>` : '<span style="font-size: 1.5rem;">🎥</span>'}
                        <span>${thumb ? 'Play Video' : 'Click to load Video'}</span>
                        <div class="caption">${m.videoMessage.caption || ''}</div>
                    </div>`;
            }
            else if (m.audioMessage) {
                content = `
                    <div class="media-container placeholder" onclick="loadMedia(this, 'audio', '${getUrl()}')">
                        <span style="font-size: 1.5rem;">🎵</span>
                        <span>Click to load Audio</span>
                    </div>`;
            }
            else if (m.stickerMessage) {
                content = `
                    <div class="media-container placeholder" onclick="loadMedia(this, 'sticker', '${getUrl()}')">
                        <span>💟 Click to load Sticker</span>
                    </div>`;
            }

            // Fallback for types we don't handle explicitly
            if (!content && !m.conversation && !m.extendedTextMessage) {
                const type = Object.keys(m).find(k => k !== 'contextInfo') || 'unknown';
                content = `<div class="system-msg">Media/System Message ([${type}])</div>`;
            }
        } else if (msg.messageStubType) {
            // Handle System/Stub Messages
            div.className = 'message system-stub';
            senderName = '';
            let stubText = msg.messageStubType;
            if (msg.messageStubType === 'GROUP_PARTICIPANT_ADD') stubText = '👤 User Added';
            else if (msg.messageStubType === 'GROUP_PARTICIPANT_REMOVE') stubText = '👤 User Removed';
            else if (msg.messageStubType === 'GROUP_CHANGE_SUBJECT') stubText = '📝 Group Subject Changed';

            content = `<div class="system-msg">${stubText}</div>`;
        }

        // Reactions (Simple retrieval if available in store/msg object - Note: Baileys store might handle reactions differently)
        // Usually reactions are stored as separate events or updated in the message object if using the store.
        // Assuming reactions might be available on the message object if the store supports it.
        // If not, we'd need to aggregate them. For now, checking typical store reaction structure.
        let reactionsHtml = '';
        if (msg.reactions && msg.reactions.length > 0) {
            reactionsHtml = '<div class="reactions">';
            msg.reactions.forEach(r => {
                reactionsHtml += `<span class="reaction">${r.text} ${r.count || 1}</span>`;
            });
            reactionsHtml += '</div>';
        }

        // Time Validation
        let timeStr = '';
        const ts = getTimestamp(msg.messageTimestamp);
        if (ts > 0) {
            timeStr = new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        div.innerHTML = `
            ${senderName}
            ${quotedContent}
            <div class="message-content">${content}</div>
            ${reactionsHtml}
            <span class="message-meta">${timeStr}</span>
        `;
        container.appendChild(div);
    });

    // Auto-scroll logic
    if (isAtBottom) {
        scrollToBottom();
    }
}

window.loadMedia = function (element, type, url, caption) {
    element.onclick = null; // Remove handler
    element.classList.remove('placeholder');
    element.classList.remove('has-thumb');
    element.classList.add('loading');

    // Keep caption if it exists
    const captionDiv = element.querySelector('.caption')?.outerHTML || '';
    element.innerHTML = '<span>⏳ Downloading...</span>' + (captionDiv && type !== 'image' && type !== 'video' ? captionDiv : '');

    // Create actual media element
    let html = '';
    if (type === 'image') {
        html = `<img src="${url}" alt="Image" class="loaded-media" onclick="window.open('${url}', '_blank')">`;
        if (caption && caption !== 'undefined' && caption !== '') html += `<div class="caption">${caption}</div>`;
    } else if (type === 'video') {
        html = `<video src="${url}" controls autoplay class="loaded-media"></video>`;
        if (caption && caption !== 'undefined' && caption !== '') html += `<div class="caption">${caption}</div>`;
    } else if (type === 'audio') {
        html = `<audio src="${url}" controls autoplay></audio>`;
    } else if (type === 'sticker') {
        html = `<img src="${url}" alt="Sticker" style="width:100px;">`;
    }

    // Small delay to allow 'loading' text to be seen or just swap
    setTimeout(() => {
        element.innerHTML = html;
        element.classList.remove('loading');
    }, 500);
};

// Helper to determine fetch range and filtering for stats
function getStatsConfig() {
    const range = document.getElementById('stats-range').value;
    let days = 1;
    let filter = null;

    if (range === 'today') {
        days = 1;
    } else if (range === 'yesterday') {
        days = 2;
        filter = 'yesterday'; // We'll filter the result to show only the 2nd day (yesterday)
    } else if (range === 'month') {
        const now = new Date();
        days = now.getDate();
    } else {
        days = parseInt(range) || 7;
    }

    return { days, filter };
}

window.publishStats = async function () {
    if (!state.currentChatId) return;

    const { days, filter } = getStatsConfig();

    try {
        let url = `/api/groups/${state.currentChatId}/stats?days=${days}`;
        if (filter) url += `&filter=${filter}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) {
            alert('Error fetching stats: ' + (data.error || 'Unknown'));
            return;
        }

        let stats = data.stats;
        if (!stats || stats.length === 0) {
            alert('No stats available for the selected range.');
            return;
        }

        // Render Leaderboard in Modal
        const statsBody = document.getElementById('stats-body');
        let html = '';

        stats.forEach(day => {
            html += `<div class="day-header">📅 ${day.date}</div>`;
            day.users.forEach(u => {
                html += `
                    <div class="user-card">
                        <div class="user-header">
                            <span class="user-name">${u.name}</span>
                            <span class="user-points">${u.points} pts</span>
                        </div>
                        <div class="stat-pills">
                            <span class="pill">💬 ${u.counts.text}</span>
                            <span class="pill">🖼️ ${u.counts.image}</span>
                            <span class="pill">🎥 ${u.counts.video}</span>
                            <span class="pill">❤️ ${u.counts.reactions}</span>
                            <span class="pill">↪️ ${u.counts.replies}</span>
                        </div>
                `;

                if (u.tasks.length > 0) {
                    html += `<div class="task-list">`;
                    u.tasks.forEach(t => {
                        const statusClass = t.replied ? 'task-status-done' : 'task-status-pending';
                        const icon = t.replied ? '✅' : '⏳';
                        html += `
                            <div class="task-item">
                                <span class="task-icon ${statusClass}">${icon}</span>
                                <span>${t.text} (${t.points} pts)</span>
                            </div>
                        `;
                    });
                    html += `</div>`;
                }
                html += `</div>`; // Close user-card
            });
        });

        statsBody.innerHTML = html;
        document.getElementById('stats-modal').style.display = 'flex';
    } catch (e) {
        console.error(e);
        alert('An error occurred while fetching stats.');
    }
};

window.closeStats = function () {
    document.getElementById('stats-modal').style.display = 'none';
};

window.confirmPublish = async function () {
    if (!state.currentChatId) return;

    const { days, filter } = getStatsConfig();

    try {
        let url = `/api/groups/${state.currentChatId}/stats/publish?days=${days}`;
        if (filter) url += `&filter=${filter}`;

        const pubRes = await fetch(url, { method: 'POST' });
        const pubData = await pubRes.json();

        if (pubData.success) {
            alert('🚀 Stats published successfully to the group!');
            closeStats();
            fetchMessages(state.currentChatId);
        } else {
            alert('Publish failed: ' + (pubData.error || pubData.message));
        }
    } catch (e) {
        console.error(e);
        alert('An error occurred while publishing stats.');
    }
};

window.showAdmins = async function () {
    if (!state.currentChatId) return;

    try {
        const response = await fetch(`/api/groups/${state.currentChatId}/admins`);
        const data = await response.json();

        if (data.success) {
            let msg = "👮‍♂️ Group Admins:\n\n";
            data.admins.forEach(a => {
                msg += `• ${a.id.split('@')[0]} (${a.admin})\n`;
            });
            alert(msg);
        } else {
            alert('Failed to fetch admins: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        console.error(e);
        alert('Error fetching admins.');
    }
};

window.showMembers = async function () {
    if (!state.currentChatId) return;

    try {
        const response = await fetch(`/api/groups/${state.currentChatId}/members`);
        const data = await response.json();

        if (data.success) {
            let msg = `👥 Group Members (${data.count}):\n\n`;
            data.members.sort((a, b) => (b.admin ? 1 : 0) - (a.admin ? 1 : 0)); // Admins first

            data.members.forEach(m => {
                const adminTag = m.admin ? ` (${m.admin})` : '';
                msg += `• ${m.name} [${m.id.split('@')[0]}]${adminTag}\n`;
            });
            alert(msg);
        } else {
            alert('Failed to fetch members: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        console.error(e);
        alert('Error fetching members.');
    }
};

function selectChat(chat) {
    state.currentChatId = chat.id;

    // UI Updates
    document.getElementById('header-name').innerText = chat.name;
    document.getElementById('header-status').innerText = chat.id; // Show ID for specific info
    document.getElementById('placeholder').style.display = 'none';
    document.getElementById('main-header').style.display = 'flex';
    document.getElementById('messages-container').style.display = 'flex';
    document.getElementById('input-area').style.display = 'flex';

    document.getElementById('messages-container').innerHTML = ''; // Clear previous messages

    // Render list again to update active state
    renderChatList();

    // Fetch messages
    fetchMessages(chat.id);
}

function scrollToBottom() {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    fetchChats();

    // Poll for new chats/messages (simple implementation)
    setInterval(() => {
        fetchChats();
        if (state.currentChatId) {
            fetchMessages(state.currentChatId);
        }
    }, 5000); // Poll every 5 seconds

    document.getElementById('send-btn').addEventListener('click', () => {
        const input = document.getElementById('message-input');
        const text = input.value.trim();
        if (text && state.currentChatId) {
            sendMessage(state.currentChatId, text);
        }
    });

    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const text = e.target.value.trim();
            if (text && state.currentChatId) {
                sendMessage(state.currentChatId, text);
            }
        }
    });

    document.getElementById('chat-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.chat-item');
        items.forEach(item => {
            const name = item.querySelector('h4').innerText.toLowerCase();
            item.style.display = name.includes(term) ? 'flex' : 'none';
        });
    });

    document.getElementById('resync-btn').addEventListener('click', async () => {
        if (confirm('This will purge local history and restart the bot. Continue?')) {
            try {
                await fetch('/api/resync-history', { method: 'POST' });
                alert('Resync initiated. Page will reload in 10 seconds.');
                setTimeout(() => location.reload(), 10000);
            } catch (e) {
                alert('Error during resync');
            }
        }
    });
});
