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

### ✅ IMPLEMENTED (Currently Working)

| Feature | Status | Description |
|---------|--------|-------------|
| **Multi-Device Connection** | ✅ Done | WhatsApp session persistence using multi-file auth state |
| **Broadcast to ALL Groups** | ✅ Done | Send messages to all connected WhatsApp groups at once |
| **Scheduled Messages** | ✅ Done | Auto-send motivation (7am) and tips (12pm, 6pm) WAT |
| **FAQ Auto-Reply** | ✅ Done | Keyword matching for common TGR questions |
| **Group Storage** | ✅ Done | Stores group JIDs in JSON file |
| **Web Dashboard** | ✅ Done | Admin UI served by Express |
| **REST API** | ✅ Done | Endpoints for send, config, content, groups, schedules |

### ❌ NOT IMPLEMENTED (Planned)

| Feature | Status | Description |
|---------|--------|-------------|
| **Selective Broadcasting** | ✅ Done | `broadcast 1,3,5 Hello` - send to specific groups |
| **Add/Remove Groups** | ✅ Done | `addgroup`, `removegroup` commands |
| **Auto-detect New Groups** | ✅ Done | Notifies admin when bot added to new group |
| **Error Handling** | ✅ Done | 3 retries with backoff, admin alerts on failure |
| **Rate Limiting** | ✅ Done | 2-second delay between messages (configurable) |
| **Health Check Endpoint** | ✅ Done | `/health` returns status, uptime, connection info |
| **Session Backup** | ✅ Done | Export/import session via API - no more QR rescans |
| **Rich Media** | ❌ Not Done | Text only - no images, videos, or documents |
| **Dashboard Auth** | ❌ Not Done | Dashboard is publicly accessible |
| **Proper Logging** | ❌ Not Done | Only console.log - no structured logging |

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

### ✅ CURRENT WhatsApp Commands (Working)

Send these to the bot from your registered admin number:

| Command | Status | Description |
|---------|--------|-------------|
| `broadcast <message>` | ✅ Works | Send message to **ALL** groups |
| `broadcast 1,3,5 <msg>` | ✅ Works | Send to SPECIFIC groups by index |
| `broadcast all <message>` | ✅ Works | Explicitly send to all groups |
| `addgroup <name> <jid>` | ✅ Works | Add a group to the list |
| `removegroup <number>` | ✅ Works | Remove a group by index |
| `addmotivation <text>` | ✅ Works | Add new morning motivation |
| `addtip <text>` | ✅ Works | Add new daily tip |
| `groups` | ✅ Works | List all tracked groups with index |
| `help` | ✅ Works | Show available commands |

### ❌ MISSING Commands (Need to Build)

| Command | Status | Description |
|---------|--------|-------------|
| `schedule <time> <msg>` | ❌ Not Done | Schedule a message |
| `status` | ❌ Not Done | Show bot status |

### ✅ Auto Group Detection

Bot automatically detects when added to a new group and notifies admin.

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

| Method | Endpoint | Status | Description |
|--------|----------|--------|-------------|
| GET | `/api/groups` | ✅ Works | List all tracked groups |
| POST | `/api/groups` | ❌ Not Done | Add new group |
| DELETE | `/api/groups/:id` | ❌ Not Done | Remove group |

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

| Method | Endpoint | Status | Description |
|--------|----------|--------|-------------|
| GET | `/api/status` | ✅ Works | Bot connection status |
| GET | `/api/health` | ❌ Not Done | Health check for monitoring |

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

| # | Issue | Status |
|---|-------|--------|
| 1 | **Error Handling** | ✅ Done |
| 2 | **Rate Limiting** | ✅ Done |
| 3 | **Health Check Endpoint** | ✅ Done |
| 4 | **Session Backup** | ✅ Done |
| 5 | **Migrate to Fly.io** | ❌ Pending |

### Priority 2 - Important

| # | Issue | Description |
|---|-------|-------------|
| 7 | **Text-Only Messages** | Currently supports text only; should add image/video/document broadcasting |
| 8 | **Plain JSON Storage** | Using JSON files limits scalability; should migrate to SQLite or PostgreSQL |
| 9 | **No Proper Logging** | Only console.log; should add structured logging (winston/pino) |
| 10 | **Dashboard Has No Auth** | The web dashboard (`index.html`) is publicly accessible; needs login protection |

### Priority 3 - Nice to Have

| # | Feature | Description |
|---|---------|-------------|
| 11 | **Interactive Messages** | Use Baileys buttons/lists for better user experience |
| 12 | **Message Templates** | Pre-built rich messages for common broadcasts |
| 13 | **Analytics Dashboard** | Track message delivery, group engagement |
| 14 | **Multi-Admin Support** | Allow multiple admin numbers |
| 15 | **Telegram Integration** | Bridge WhatsApp groups to Telegram |
| 16 | **Voice Notes** | Support audio broadcasting |

---

## 📍 Detailed Roadmap

### Phase 1: Foundation (Critical)
*Make the bot reliable and usable*

1. **Group Management** 
   - Add commands to add/remove groups
   - Auto-detect when bot is added to new group
   - **SELECT GROUPS** for each broadcast (not just all)
   - API: `POST/DELETE /api/groups`

2. **Error Handling**
   - Retry failed messages (3 attempts)
   - Alert admin when broadcast fails
   - Log all failures to file

3. **Rate Limiting**
   - Add 2-3 second delay between messages
   - Queue system for broadcasts

4. **Health Check**
   - Add `/health` endpoint
   - Return connection status, group count

5. **Migrate to Fly.io**
   - Deploy on Fly.io for persistent hosting

### Phase 2: Features (Important)
*Add rich functionality*

6. **Rich Media Support**
   - Image broadcasting
   - Video broadcasting
   - Document sharing

7. **Dashboard Auth**
   - Basic password protection
   - Login page

8. **Database Migration**
   - Move from JSON files to SQLite/PostgreSQL
   - Better data integrity

9. **Structured Logging**
   - Use Winston or Pino
   - Log rotation

### Phase 3: Polish (Nice to Have)
*Make it premium*

10. **Interactive Messages**
    - Use WhatsApp buttons
    - Use WhatsApp lists

11. **Message Templates**
    - Save reusable messages
    - Quick-send buttons

12. **Analytics**
    - Track delivery rates
    - Group engagement metrics

13. **Multi-Admin**
    - Multiple admin numbers
    - Role-based access

14. **Telegram Bridge**
    - Forward WhatsApp to Telegram
    - Control bot from Telegram

15. **Voice Notes**
    - Audio broadcasting

---

## 📊 Current Architecture

```
                    ┌─────────────────┐
                    │   WhatsApp      │
                    │   (Baileys)     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   bot.js        │
                    │   (Node.js)     │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
┌────────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│  Scheduled Jobs │  │  REST API   │  │  Web Dashboard │
│  (node-cron)    │  │  (Express)  │  │  (index.html)  │
└────────┬────────┘  └──────┬──────┘  └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────▼────────┐
                    │   JSON Files   │
                    │   /data/       │
                    └─────────────────┘
```

---

## License

ISC - Engr. Dammie Optimus

---

## Support

For issues or questions about TGR:
- 📧 Email: dammieoptimus@gmail.com
- 🌐 Website: https://www.topupandgetreward.com
- 🆔 Referral ID: DammieOptimus2