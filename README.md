# TGR WhatsApp Assistant Bot

A full-featured WhatsApp bot for managing your TGR (Top Up and Get Reward) team groups. Built with Baileys, Express, and Node.js.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Deployment](#deployment)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Data Storage](#data-storage)
- [Project Structure](#project-structure)
- [Known Issues \& Improvements](#known-issues--improvements)

---

## Overview

This bot connects to WhatsApp using the Baileys library and provides:

- Broadcast messages to all managed groups
- Scheduled daily messages (motivation, tips)
- FAQ auto-reply for common questions
- Admin dashboard for managing content
- REST API for programmatic control

---

## Features

### ✅ Implemented

| Feature | Description |
|---------|-------------|
| **Multi-Device Connection** | WhatsApp session persistence using multi-file auth state |
| **Broadcast to Groups** | Send messages to all connected WhatsApp groups |
| **Scheduled Messages** | Auto-send motivation (7am) and tips (12pm, 6pm) WAT |
| **FAQ Auto-Reply** | Keyword matching for common TGR questions |
| **Group Tracking** | Store and manage multiple WhatsApp groups |
| **Web Dashboard** | Admin UI served by Express |
| **REST API** | Full CRUD for messages, schedules, groups, config |

### 📅 Scheduled Broadcasts (WAT - West Africa Time)

| Time | Content |
|------|---------|
| 7:00 AM | Morning motivation |
| 12:00 PM | Daily tip |
| 6:00 PM | Evening tip |

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Baileys** | ^6.10.4 | WhatsApp Web JS library |
| **Express** | ^4.18.2 | Web server & API |
| **node-cron** | ^3.0.3 | Scheduled tasks |
| **qrcode** | ^1.5.3 | QR code generation |
| **uuid** | ^9.0.1 | Unique IDs for schedules |
| **dotenv** | ^16.3.1 | Environment variables |

---

## Installation

### Local Development

```bash
# Clone the repository
git clone https://github.com/EngrDammie/tgr-assistant.git
cd tgr-assistant

# Install dependencies
npm install

# Start the bot
npm start
```

### First Run

1. Run `npm start`
2. Scan the QR code with your WhatsApp
3. The session will be saved in `/sessions` folder

---

## Deployment

### Railway (Recommended)

1. Create a new project on [Railway](https://railway.app/new)
2. Connect your GitHub and select this repository
3. Add environment variables:
   ```
   PORT = 3000
   ```
4. Deploy!

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Usage

### WhatsApp Commands (Admin)

Send these to the bot from your registered admin number:

| Command | Description |
|---------|-------------|
| `broadcast <message>` | Send message to all groups |
| `addmotivation <text>` | Add new morning motivation |
| `addtip <text>` | Add new daily tip |
| `groups` | List all connected groups |
| `help` | Show available commands |

### Linking a Group

1. Add the bot to your WhatsApp group
2. Send the group link to the bot
3. The bot will store the group JID for future broadcasts

---

## API Endpoints

### Broadcast

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/send` | Broadcast message to all groups |

**Request:**
```json
{
  "message": "Hello TGR Family!",
  "type": "motivation" // optional
}
```

**Response:**
```json
{
  "success": true,
  "groups": 5
}
```

### Schedule

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedule` | List all schedules |
| POST | `/api/schedule` | Create new schedule |

### Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | List all tracked groups |

### Content Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/content` | Get all content (motivation, tips, FAQs) |
| POST | `/api/content` | Update content |

### Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Get bot config |
| POST | `/api/config` | Update bot config |

### Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Bot connection status |

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |

### Admin Setup

1. Start the bot
2. Send a message from your WhatsApp number
3. The bot will recognize your number
4. Use `/api/config` to set your number as admin:

```bash
curl -X POST https://your-bot-url/api/config \
  -H "Content-Type: application/json" \
  -d '{"adminNumber": "2348012345678"}'
```

---

## Data Storage

Data is stored in JSON files in the `/data` folder:

| File | Contents |
|------|----------|
| `config.json` | Owner number, bot name, admin number |
| `schedules.json` | Scheduled messages |
| `groups.json` | Tracked WhatsApp groups |
| `content.json` | Motivations, tips, FAQs |

### Session Storage

WhatsApp authentication is persisted in `/sessions` folder.

⚠️ **Important:** Add `/sessions` to `.gitignore` if you plan to commit!

---

## Project Structure

```
tgr-assistant/
├── bot.js              # Main application (Baileys + Express)
├── index.html          # Admin dashboard
├── package.json        # Dependencies
├── .gitignore          # Ignore sessions/node_modules
├── data/               # JSON data storage (created on first run)
│   ├── config.json
│   ├── schedules.json
│   ├── groups.json
│   └── content.json
└── sessions/           # WhatsApp auth state (created on first run)
```

---

## Known Issues & Improvements

### Priority 1 - Critical

| # | Issue | Description |
|---|-------|-------------|
| 1 | **No Error Handling in Broadcast** | `broadcastToGroups()` fails silently; no retry queue or admin alerts when messages fail |
| 2 | **No Rate Limiting** | WhatsApp can ban accounts for sending too many messages too quickly; needs delay between sends |
| 3 | **No Session Backup** | If server dies, you need to re-scan QR code; sessions should be backed up to cloud |
| 4 | **No Health Check Endpoint** | Railway may kill idle instances; needs `/health` endpoint for monitoring |
| 5 | **Migrate to Fly.io** | Railway free tier is limited; migrate to Fly.io for persistent 24/7 bot hosting |

### Priority 2 - Important

| # | Issue | Description |
|---|-------|-------------|
| 5 | **Text-Only Messages** | Currently supports text only; should add image/video/document broadcasting |
| 6 | **Plain JSON Storage** | Using JSON files limits scalability; should migrate to SQLite or PostgreSQL |
| 7 | **No Proper Logging** | Only console.log; should add structured logging (winston/pino) |
| 8 | **Dashboard Has No Auth** | The web dashboard (`index.html`) is publicly accessible; needs login protection |

### Priority 3 - Nice to Have

| # | Feature | Description |
|---|---------|-------------|
| 9 | **Interactive Messages** | Use Baileys buttons/lists for better user experience |
| 10 | **Message Templates** | Pre-built rich messages for common broadcasts |
| 11 | **Analytics Dashboard** | Track message delivery, group engagement |
| 12 | **Multi-Admin Support** | Allow multiple admin numbers |
| 13 | **Telegram Integration** | Bridge WhatsApp groups to Telegram |
| 14 | **Voice Notes** | Support audio broadcasting |

---

---

## License

ISC - Engr. Dammie Optimus

---

## Support

For issues or questions about TGR:
- 📧 Email: dammieoptimus@gmail.com
- 🌐 Website: https://www.topupandgetreward.com
- 🆔 Referral ID: DammieOptimus2