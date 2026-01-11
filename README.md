# WhatsApp Bot & Channel Manager

A complete Node.js application for managing WhatsApp Channels, Groups, and Chats using the Baileys library. Includes a modern web-based user interface.

## ⚠️ Warning

This uses an unofficial WhatsApp API. Using this may result in your WhatsApp account being banned. Use at your own risk with a test number you can afford to lose.

## Features

- **🖥️ Web Interface**:
  - Full-featured WhatsApp Web clone
  - Dark mode UI
  - Real-time message updates
  - Rich media support (Images, Videos, Audio, Stickers)
  - Interactive chat threads with quoted messages and reactions

- **⚡ Core Features**:
  - ✅ Send text messages to Channels and Chats
  - ✅ Send images with captions
  - ✅ List all subscribed Channels and Groups
  - ✅ Auto-reconnection handling
  - ✅ Session persistence
  - ✅ RESTful API interface

- **🛠️ Advanced Tools**:
  - **History Management**: Unlimited backward history fetching and "Hard Resync" capability
  - **CSV Export**: Export recent message history for analysis
  - **Media Caching**: Efficient on-demand media downloading and local caching

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A WhatsApp account (preferably a test number)

## Installation

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd whatsapp-bot
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` file (optional defaults provided):
```
PORT=3000
NODE_ENV=development
```

### Step 4: Start the Application

```bash
npm start
```

## Usage

### 🖥️ Web Interface
Open your browser and navigate to:
**http://localhost:3000**

- **Scan QR Code**: If not connected, a QR code will appear in your **terminal**. Scan it with your phone (Linked Devices).
- **View Chats**: Browse all your DMs and Group chats.
- **View Media**: Click on media placeholders ("📷 Click to find image") to download and view them.
- **Resync History**: Use the restart button in the sidebar to purge local data and re-fetch from WhatsApp servers.

### 🔌 API Endpoints

#### Channels & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Check connection status |
| `GET` | `/api/channels` | List admin channels |
| `GET` | `/api/channel/:id` | Get channel metadata |

#### Messaging

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/send` | Send text message (body: `{channelId, message}`) |
| `POST` | `/api/send-image` | Send image (body: `{channelId, imageUrl, caption}`) |

#### Chats & Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/chats` | List all chat threads (DMs & Groups) |
| `GET` | `/api/groups` | List participating groups |
| `GET` | `/api/groups/:id/messages` | Get messages for a specific chat/group |
| `GET` | `/api/messages/export-csv` | Download CSV of recent messages |

#### Media & System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/chats/:cid/messages/:mid/download` | Download/Cache media attachment |
| `POST` | `/api/resync-history` | Purge local store and force full history resync |

## Project Structure

```
whatsapp-bot/
├── public/                # Frontend Web UI (HTML/CSS/JS)
├── src/
│   ├── bot/
│   │   ├── whatsapp.js    # Core Baileys Logic
│   │   └── store.js       # In-memory message store & persistence
│   ├── api/
│   │   ├── routes.js      # API Routes definition
│   │   └── controllers.js # Request Handlers
│   ├── config/
│   └── utils/
├── auth_info/             # Session credentials (do not commit)
├── baileys_store.json     # Local message database
└── index.js               # Entry point
```

## Troubleshooting

### QR Code Not Appearing
- Check your terminal output. The QR code renders there.
- Ensure port 3000 is free.

### Media Not Loading
- Media is downloaded on-demand to save bandwidth. Click the placeholder in the UI.
- If it fails, the media might be too old or deleted from WhatsApp servers.

### Missing History
- Click the "Resync History" button in the web UI.
- This will restart the bot, delete local database, and request a fresh history sync from WhatsApp.

## Disclaimer

This project is for educational purposes only. The authors are not responsible for any misuse or for any accounts that may be banned as a result of using this code.