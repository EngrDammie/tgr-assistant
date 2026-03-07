# 🐝 TGR WhatsApp Assistant

A full-featured WhatsApp bot for managing your TGR team groups.

## Features

- 📢 **Broadcast** - Send messages to all groups instantly
- ⏰ **Scheduled Messages** - Morning motivation, tips at set times
- 📍 **Meeting Reminders** - Zoom/Telegram/WhatsApp/Physical with alerts
- ❓ **FAQ Auto-Reply** - Common questions answered automatically
- 👥 **Multi-Group** - Manage multiple WhatsApp groups

## Deploy to Railway (Recommended)

1. Create a new project on Railway: https://railway.app/new
2. Connect your GitHub and select this repository
3. Add environment variables:
   - `PORT` = 3000
4. Deploy!

## Local Development

```bash
npm install
npm start
```

Scan the QR code with your WhatsApp to connect.

## Usage

### Commands (send to bot):
- `broadcast <message>` - Send to all groups
- `addmotivation <text>` - Add morning motivation
- `addtip <text>` - Add daily tip
- `groups` - List connected groups

## Admin Dashboard

Access the web dashboard at your deployment URL to:
- Send broadcasts
- Schedule messages & meetings
- Manage content (motivations, tips, FAQs)
- View connected groups

## Meeting Types Supported

- 🎥 Zoom Meetings
- 📱 WhatsApp Call
- 💬 Telegram Voice Chat  
- 📍 Physical/Offline Events

## License

ISC
