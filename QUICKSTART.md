# Quick Start Guide

## Step-by-Step Installation

### 1. Prerequisites Check

Make sure you have Node.js installed:
```bash
node --version  # Should be v16 or higher
npm --version
```

If not installed, download from: https://nodejs.org/

### 2. Create Project Directory

```bash
mkdir whatsapp-channel-bot
cd whatsapp-channel-bot
```

### 3. Create All Files

Create the following directory structure:

```
whatsapp-channel-bot/
├── src/
│   ├── api/
│   │   ├── controllers.js
│   │   └── routes.js
│   ├── bot/
│   │   └── whatsapp.js
│   ├── config/
│   │   └── config.js
│   └── utils/
│       └── logger.js
├── .env.example
├── .gitignore
├── index.js
├── package.json
└── README.md
```

Copy the content from each artifact into the corresponding file.

### 4. Install Dependencies

```bash
npm install
```

This will install:
- @whiskeysockets/baileys (WhatsApp library)
- express (Web server)
- dotenv (Environment variables)
- qrcode-terminal (QR display)
- pino (Logging)
- axios (HTTP requests)
- commander (CLI)

### 5. Configure Environment

```bash
cp .env.example .env
```

The default `.env` is fine for local testing.

### 6. Start the Bot

```bash
npm start
```

### 7. Scan QR Code

When you see the QR code in the terminal:

1. Open WhatsApp on your phone
2. Go to **Settings** → **Linked Devices**
3. Tap **"Link a Device"**
4. Scan the QR code from your terminal

You should see: `✅ WhatsApp connected successfully!`

---

## Getting Your Channel ID

### Option 1: Via API

Once connected, open a new terminal and run:

```bash
curl http://localhost:3000/api/channels
```

You'll get a response like:
```json
{
  "success": true,
  "count": 2,
  "channels": [
    {
      "id": "123456789@newsletter",
      "name": "My Tech Channel",
      "description": "Latest tech news"
    },
    {
      "id": "987654321@newsletter", 
      "name": "My Cooking Channel",
      "description": "Daily recipes"
    }
  ]
}
```

Copy the `id` value (e.g., `123456789@newsletter`)

### Option 2: Via CLI

```bash
node src/cli.js list-channels
```

---

## Posting to Your Channel

### Method 1: Using cURL (Recommended)

**Send text message:**
```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "123456789@newsletter",
    "message": "Hello from my bot! 🚀"
  }'
```

**Send image:**
```bash
curl -X POST http://localhost:3000/api/send-image \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "123456789@newsletter",
    "imageUrl": "https://picsum.photos/800/600",
    "caption": "Check out this beautiful image!"
  }'
```

### Method 2: Using CLI

**Send text:**
```bash
node src/cli.js send-message \
  --channel "123456789@newsletter" \
  --text "Hello from CLI!"
```

**Send image:**
```bash
node src/cli.js send-image \
  --channel "123456789@newsletter" \
  --url "https://picsum.photos/800/600" \
  --caption "Amazing photo"
```

### Method 3: Using Postman/Insomnia

**Endpoint:** `POST http://localhost:3000/api/send`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "channelId": "123456789@newsletter",
  "message": "Hello World!"
}
```

### Method 4: Using JavaScript/Node.js

```javascript
const axios = require('axios');

async function sendToChannel() {
  try {
    const response = await axios.post('http://localhost:3000/api/send', {
      channelId: '123456789@newsletter',
      message: 'Hello from Node.js!'
    });
    
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

sendToChannel();
```

### Method 5: Using Python

```python
import requests

url = "http://localhost:3000/api/send"
payload = {
    "channelId": "123456789@newsletter",
    "message": "Hello from Python! 🐍"
}

response = requests.post(url, json=payload)
print(response.json())
```

---

## Testing the Setup

### 1. Check Connection Status
```bash
curl http://localhost:3000/api/status
```

Expected response:
```json
{
  "success": true,
  "connected": true,
  "status": "connected",
  "message": "WhatsApp is connected and ready"
}
```

### 2. List Channels
```bash
curl http://localhost:3000/api/channels
```

### 3. Send Test Message
```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "YOUR_CHANNEL_ID@newsletter",
    "message": "Test message from bot!"
  }'
```

Check your WhatsApp channel - you should see the message!

---

## Common Issues & Solutions

### QR Code Not Appearing
- Close and restart the application
- Make sure no other instance is running
- Check if port 3000 is available

### "WhatsApp not connected" Error
- Wait a few seconds after scanning QR code
- Check `/api/status` endpoint
- Look at terminal logs for connection status

### Cannot Send to Channel
1. Verify you are an admin of the channel
2. Check channel ID format: must end with `@newsletter`
3. Ensure bot is connected (check `/api/status`)

### Channel ID Not Found
- Make sure you've created a channel in WhatsApp
- You must be the admin/creator of the channel
- Run `/api/channels` to see all available channels

### Session Expired
```bash
# Delete session and restart
rm -rf auth_info
npm start
# Scan QR code again
```

---

## Production Deployment

### Using PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start index.js --name whatsapp-bot

# View logs
pm2 logs whatsapp-bot

# Restart
pm2 restart whatsapp-bot

# Stop
pm2 stop whatsapp-bot
```

### Using Docker

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t whatsapp-bot .
docker run -p 3000:3000 -v $(pwd)/auth_info:/app/auth_info whatsapp-bot
```

---

## Automation Examples

### Schedule Messages (Using Node-Cron)

```bash
npm install node-cron
```

Create `scheduler.js`:
```javascript
const cron = require('node-cron');
const axios = require('axios');

// Send message every day at 9 AM
cron.schedule('0 9 * * *', async () => {
  await axios.post('http://localhost:3000/api/send', {
    channelId: 'YOUR_CHANNEL_ID@newsletter',
    message: 'Good morning! ☀️'
  });
});

console.log('Scheduler started...');
```

### Webhook Integration

Add to your Express app to receive webhooks:
```javascript
app.post('/webhook', async (req, res) => {
  const { message } = req.body;
  
  await sendTextToChannel('YOUR_CHANNEL_ID@newsletter', message);
  
  res.json({ success: true });
});
```

---

## Next Steps

1. ✅ Bot is running
2. ✅ QR code scanned
3. ✅ Channel ID obtained
4. ✅ Test message sent

Now you can:
- Integrate with your existing systems
- Schedule automated posts
- Build custom workflows
- Add more features (polls, reactions, etc.)

---

## Support

If you encounter issues:
1. Check the logs in terminal
2. Verify channel ID format
3. Ensure you're a channel admin
4. Check WhatsApp connection status
5. Try restarting the bot

Remember: This is an unofficial API. Use with caution and always test with a secondary number first!