# TGR WhatsApp Assistant Bot

A full-featured WhatsApp bot for managing your TGR (Top Up and Get Reward) team groups. Built with Baileys, Express, Node.js, and SQLite.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Deployment](#deployment)
- [WhatsApp Commands](#whatsapp-commands)
- [API Endpoints](#api-endpoints)
- [Dashboard](#dashboard)
- [Configuration](#configuration)
- [Data Storage](#data-storage)
- [Project Structure](#project-structure)

---

## Overview

This bot connects to WhatsApp using the Baileys library and provides:

- 📢 Broadcast messages to all or selected groups
- 📅 Scheduled daily messages (motivation, tips)
- ❓ FAQ auto-reply for common TGR questions
- 🎨 Rich media broadcasting (images, videos, documents)
- 🔄 Session backup/restore (no QR rescan needed)
- 📊 Admin dashboard with metrics
- 🔐 Password-protected dashboard
- 💾 SQLite database for scalability

---

## Features

### Core Broadcasting

| Feature | Description |
|---------|-------------|
| **Broadcast All** | Send message to all tracked groups |
| **Selective Broadcast** | Send to specific groups: `broadcast 1,3,5 Hello` |
| **Rich Media** | Send images, videos, documents via URL |
| **Retry Logic** | 3 retries with exponential backoff on failure |
| **Rate Limiting** | Configurable delay between messages |

### Beautiful Dashboard

| Feature | Description |
|---------|-------------|
| **Stunning UI** | Modern dark theme with orange glow effects |
| **Responsive Design** | Works perfectly on desktop & mobile |
| **Real-time Status** | Live connection, groups, schedules, messages |
| **One-click Broadcast** | Send to all or selected groups |
| **Media Broadcasting** | Send images, videos, documents from dashboard |
| **Content Management** | Edit motivations, tips, FAQs |
| **Settings Panel** | Configure bot, admin, passwords |
| **Toast Notifications** | Beautiful success/error feedback |

### Group Management

| Feature | Description |
|---------|-------------|
| **Add Group** | `addgroup <name> <jid>` - Manually add a group |
| **Remove Group** | `removegroup <number>` - Remove by index |
| **List Groups** | `groups` - Show all groups with numbers |
| **Auto-Detect** | Notifies admin when bot is added to new group |

### Scheduling

| Feature | Description |
|---------|-------------|
| **Built-in Schedules** | Auto-sends motivation at 7am, tips at 12pm & 6pm (WAT) |
| **Custom Schedule** | `schedule 9am <message>` - Daily at specific time |
| **Cron Schedule** | `schedule 0 7 * * * <message>` - Full cron syntax |
| **API Schedules** | Create/edit schedules via REST API |

### Bot Commands

| Command | Description |
|---------|-------------|
| `broadcast <msg>` | Send to ALL groups |
| `broadcast all <msg>` | Explicitly send to all groups |
| `broadcast 1,3,5 <msg>` | Send to specific groups by index |
| `image <url> <caption>` | Send image to groups |
| `video <url> <caption>` | Send video to groups |
| `document <url> <file>` | Send document to groups |
| `addgroup <name> <jid>` | Add group manually |
| `removegroup <number>` | Remove group by number |
| `groups` | List all groups with index numbers |
| `addmotivation <text>` | Add morning motivation |
| `addtip <text>` | Add daily tip |
| `schedule 9am <msg>` | Schedule daily message |
| `schedule 0 7 * * * <msg>` | Schedule with cron |
| `status` | Show bot status and stats |
| `help` | Show all available commands |

### Database & Storage

| Feature | Description |
|---------|-------------|
| **SQLite** | Persistent data storage |
| **Session Backup** | Export/import WhatsApp session via API |
| **Config Storage** | Bot settings persisted in SQLite |

### Dashboard & API

| Feature | Description |
|---------|-------------|
| **Web Dashboard** | Admin UI served at root URL |
| **Dashboard Auth** | Password-protected access |
| **REST API** | Full API for programmatic control |
| **Health Check** | `/api/health` for monitoring |

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Baileys** | ^6.10.4 | WhatsApp Web JS library |
| **Express** | ^4.18.2 | Web server & API |
| **node-cron** | ^3.0.3 | Scheduled tasks |
| **better-sqlite3** | ^9.0.0 | SQLite database |
| **qrcode** | ^1.5.3 | QR code generation |
| **uuid** | ^9.0.1 | Unique IDs for schedules |
| **Pino** | ^7.0.0 | Structured logging |

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
3. Session is saved in `/sessions` folder automatically

---

## Deployment

### Fly.io (Recommended)

```bash
# Install Fly CLI
brew install flyctl/flyctl/flyctl

# Authenticate
fly auth login

# Launch
cd tgr-assistant
fly launch

# Set port
fly secrets set PORT=3000

# Deploy
fly deploy

# Open
fly open
```

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

## WhatsApp Commands

All commands sent from your registered admin number:

### Broadcasting

```
broadcast Hello Team!           → Send to ALL groups
broadcast all Hello!            → Explicitly ALL groups
broadcast 1,3,5 Hello           → Send to groups 1, 3, and 5
image https://example.com/img.jpg Check this out!
video https://example.com/video.mp4
document https://example.com/file.pdf Report.pdf
```

### Group Management

```
addgroup My Team 123456789-123456@g.us
removegroup 2
groups
```

### Content

```
addmotivation Today is a great day to succeed!
addtip Remember to follow up with your team members!
```

### Scheduling

```
schedule 9am Good morning everyone!     → Daily at 9am
schedule 2pm Team update                → Daily at 2pm
schedule 0 7 * * * Morning message      → Cron format
```

### Info

```
status          → Show bot connection & stats
help            → Show all commands
```

---

## API Endpoints

### Broadcast

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/send` | Broadcast to all groups |
| POST | `/api/send/image` | Send image |
| POST | `/api/send/video` | Send video |
| POST | `/api/send/document` | Send document |

**Request (send):**
```json
{
  "message": "Hello TGR Family!",
  "groups": [1, 3, 5]  // optional, sends to all if omitted
}
```

### Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | List all groups |
| POST | `/api/groups` | Add new group |
| DELETE | `/api/groups/:index` | Remove group |

### Schedules

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedule` | List all schedules |
| POST | `/api/schedule` | Create schedule |

### Content

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/content` | Get motivations, tips, FAQs |
| POST | `/api/content` | Update content |

### Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Get config |
| POST | `/api/config` | Update config |

### Status & Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Bot connection status |
| GET | `/api/health` | Health check for monitoring |

### Session Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/session/export` | Export session backup |
| POST | `/api/session/import` | Restore session |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Dashboard login |

---

## Dashboard

Access at `http://localhost:3000` (or your deployed URL).

### Features
- View connected groups
- Send broadcasts
- Manage content (motivations, tips, FAQs)
- View bot status
- Configure settings

### Authentication
1. Set dashboard password via API:
```bash
curl -X POST https://your-bot-url/api/config \
  -H "Content-Type: application/json" \
  -d '{"dashboardPassword": "your_secure_password"}'
```
2. Login at the dashboard URL

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | Server port |

### Config Options (via API)

```bash
# Set admin number
curl -X POST /api/config \
  -H "Content-Type: application/json" \
  -d '{"adminNumber": "2348012345678"}'

# Set bot name
curl -X POST /api/config \
  -H "Content-Type: application/json" \
  -d '{"botName": "TGR Assistant"}'

# Set message delay (ms)
curl -X POST /api/config \
  -H "Content-Type: application/json" \
  -d '{"messageDelayMs": 2000}'

# Set dashboard password
curl -X POST /api/config \
  -H "Content-Type: application/json" \
  -d '{"dashboardPassword": "secret123"}'
```

---

## Data Storage

### SQLite Database

The bot uses SQLite (`tgr.db`) for persistent storage:

| Table | Contents |
|-------|----------|
| `config` | Bot configuration |
| `groups` | Tracked WhatsApp groups |
| `schedules` | Custom schedules |
| `content` | Motivations, tips, FAQs |

### Session Storage

WhatsApp authentication is in `/sessions` folder (auto-created).

⚠️ **Important:** The `/sessions` folder is gitignored to protect your WhatsApp session.

---

## Project Structure

```
tgr-assistant/
├── bot.js              # Main application
├── database.js         # SQLite database module
├── logger.js           # Pino logging
├── index.html          # Admin dashboard (beautifully designed)
├── login.html          # Dashboard login (beautifully designed)
├── package.json        # Dependencies
├── Dockerfile          # Docker config
├── fly.toml            # Fly.io config
├── .gitignore          # Ignores sessions/node_modules
├── sessions/           # WhatsApp auth (gitignored)
│   └── *.json
└── data/               # SQLite database (gitignored)
    └── tgr.db
```

---

## License

ISC - Engr. Dammie Optimus

---

## Support

- 📧 Email: dammieoptimus@gmail.com
- 🌐 Website: https://www.topupandgetreward.com
- 🆔 Referral ID: DammieOptimus2
