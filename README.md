# WhatsApp Channel Bot

A complete Node.js application for posting messages to WhatsApp Channels using Baileys library.

## ⚠️ Warning

This uses an unofficial WhatsApp API. Using this may result in your WhatsApp account being banned. Use at your own risk with a test number you can afford to lose.

## Features

- ✅ Send text messages to WhatsApp Channels
- ✅ Send images with captions
- ✅ List all your channels
- ✅ Get channel metadata
- ✅ Auto-reconnection handling
- ✅ Session persistence
- ✅ RESTful API interface
- ✅ Environment variable configuration

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A WhatsApp account (preferably a test number)
- Admin access to a WhatsApp Channel

## Installation

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd whatsapp-channel-bot
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` file:
```
PORT=3000
NODE_ENV=development
```

### Step 4: Start the Application

```bash
npm start
```

On first run, a QR code will be displayed in the terminal. Scan it with your WhatsApp app:
1. Open WhatsApp on your phone
2. Go to Settings → Linked Devices
3. Tap "Link a Device"
4. Scan the QR code from the terminal

## Project Structure

```
whatsapp-channel-bot/
├── src/
│   ├── bot/
│   │   ├── whatsapp.js       # WhatsApp connection logic
│   │   └── messageHandler.js  # Message handling
│   ├── api/
│   │   ├── routes.js          # API routes
│   │   └── controllers.js     # Request handlers
│   ├── config/
│   │   └── config.js          # Configuration
│   └── utils/
│       └── logger.js          # Logging utility
├── auth_info/                 # Session data (auto-generated)
├── .env                       # Environment variables
├── .gitignore
├── package.json
├── index.js                   # Entry point
└── README.md
```

## Usage

### Using the API

Once connected, you can use the following endpoints:

#### 1. List Your Channels

```bash
curl http://localhost:3000/api/channels
```

Response:
```json
{
  "success": true,
  "channels": [
    {
      "id": "123456789@newsletter",
      "name": "My Channel",
      "description": "Channel description",
      "subscribers": 1234
    }
  ]
}
```

#### 2. Send Text Message to Channel

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "123456789@newsletter",
    "message": "Hello from the bot!"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Message sent successfully"
}
```

#### 3. Send Image to Channel

```bash
curl -X POST http://localhost:3000/api/send-image \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "123456789@newsletter",
    "imageUrl": "https://example.com/image.jpg",
    "caption": "Check out this image!"
  }'
```

#### 4. Get Channel Info

```bash
curl http://localhost:3000/api/channel/123456789@newsletter
```

### Using the CLI

You can also use the included CLI commands:

```bash
# List channels
node src/cli.js list-channels

# Send message
node src/cli.js send-message --channel "123456789@newsletter" --text "Hello!"

# Send image
node src/cli.js send-image --channel "123456789@newsletter" --url "https://example.com/image.jpg" --caption "Caption"
```

## API Reference

### GET /api/status
Check bot connection status

### GET /api/channels
List all channels you admin

### GET /api/channel/:channelId
Get specific channel information

### POST /api/send
Send text message to channel

Body:
```json
{
  "channelId": "string",
  "message": "string"
}
```

### POST /api/send-image
Send image to channel

Body:
```json
{
  "channelId": "string",
  "imageUrl": "string",
  "caption": "string (optional)"
}
```

## Development

### Run in Development Mode

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Troubleshooting

### QR Code Not Appearing
- Make sure terminal supports displaying QR codes
- Check if port 3000 is not already in use
- Delete `auth_info` folder and restart

### Connection Keeps Closing
- WhatsApp may have detected automation
- Try using a different phone number
- Wait a few hours before reconnecting
- Ensure stable internet connection

### Cannot Send to Channel
- Verify you are an admin of the channel
- Check channel ID format: `123456789@newsletter`
- Ensure bot is connected (check `/api/status`)

### Session Expired
- Delete `auth_info` folder
- Restart application
- Scan QR code again

## Finding Your Channel ID

1. Start the bot and scan QR code
2. Call `GET /api/channels` endpoint
3. Look for the `id` field in the response
4. Channel IDs are in format: `123456789@newsletter`

## Security Notes

- Never commit `auth_info` folder to Git
- Keep `.env` file private
- Use HTTPS in production
- Implement rate limiting for API endpoints
- Add authentication for production use

## Limitations

- Can only send to channels where you are admin
- Subject to WhatsApp's rate limits
- Unofficial API - may break with WhatsApp updates
- Risk of account ban

## License

MIT

## Disclaimer

This project is for educational purposes only. The authors are not responsible for any misuse or for any accounts that may be banned as a result of using this code.

## Support

For issues and questions, please open an issue on GitHub.

## Contributing

Pull requests are welcome! Please read CONTRIBUTING.md first.