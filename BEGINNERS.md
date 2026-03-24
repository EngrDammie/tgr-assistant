# TGR WhatsApp Assistant Bot - Complete Beginner's Guide

*Don't know anything about bots or code? This guide is for you!*

---

## 🤔 What Is This?

Think of this bot as your **WhatsApp helper**. It can:
- 📢 Send messages to all your TGR team groups at once (no more manually forwarding!)
- 📅 Automatically send good morning messages every day
- 🤖 Answer common questions automatically (like "how do I register?")
- 🖼️ Send pictures, videos, or documents to all groups

---

## 🏁 Quick Start (5 Minutes!)

### Step 1: Install Node.js

1. Go to [nodejs.org](https://nodejs.org)
2. Click the **LTS** button (the left one - it says "Recommended For Most Users")
3. Download and run the installer
4. When done, open your terminal/command prompt and type:
   ```
   node --version
   ```
   You should see a number like `18.x.x` or `20.x.x`

### Step 2: Get the Code

1. Create a new folder on your computer (e.g., `TGRBot`)
2. Go to: https://github.com/EngrDammie/tgr-assistant
3. Click the green **Code** button
4. Click **Download ZIP**
5. Extract the ZIP file into your folder

### Step 3: Install Dependencies

1. Open your terminal/command prompt
2. Navigate to the folder:
   - Windows: `cd C:\Users\YourName\Downloads\TGRBot\tgr-assistant-master`
   - Mac/Linux: `cd ~/Downloads/TGRBot/tgr-assistant-master`
3. Install everything with one command:
   ```
   npm install
   ```
   Wait for it to finish (might take 1-2 minutes)

### Step 4: Start the Bot!

1. Run:
   ```
   npm start
   ```
2. You'll see a **QR code** (like a weird square barcode) appear in your terminal
3. Open WhatsApp on your phone:
   - Go to **Settings** → **Linked Devices**
   - Tap **Link a Device**
   - Scan the QR code on your computer screen
4. 🎉 You're connected! The bot is now online.

### Step 5: Set Your Admin Number

1. Send a message to the bot from your WhatsApp
2. The bot will remember your number automatically
3. Send:
   ```
   help
   ```
   to see all available commands

---

## 📱 How to Use (WhatsApp Commands)

*Just send these messages to the bot on WhatsApp!*

### 📢 Send to Everyone

```
broadcast Hello TGR Family!
```
→ Sends "Hello TGR Family!" to ALL groups you manage

### 📢 Send to Specific Groups

```
broadcast 1,3,5 Hello team 1, 3 and 5!
```
→ Only sends to groups 1, 3, and 5 (use `groups` command to see numbers)

### 🖼️ Send a Picture

```
image https://example.com/promo.jpg Check out this deal!
```
→ Sends the image with caption to all groups

### 🎬 Send a Video

```
video https://example.com/video.mp4 Watch this!
```
→ Sends the video to all groups

### 📄 Send a Document

```
document https://example.com/pricelist.pdf Price List
```
→ Sends the PDF file to all groups

### 👥 See Your Groups

```
groups
```
→ Shows all groups with their numbers

### 📅 Schedule a Message

```
schedule 9am Good morning everyone!
```
→ Every day at 9am, this message will be sent automatically

```
schedule 2pm Team update
```
→ Every day at 2pm, sends "Team update"

### 🔍 Check Status

```
status
```
→ Shows if bot is online, how many groups, etc.

### ❓ Get Help

```
help
```
→ Shows all available commands

---

## 💻 Using the Web Dashboard

Instead of using WhatsApp commands, you can use the **beautiful web dashboard**:

1. Make sure the bot is running (`npm start`)
2. Open your browser (Chrome, Safari, etc.)
3. Go to: `http://localhost:3000`
4. Enter your dashboard password (set it via API or ask the admin)
5. 🎉 You can now:
   - See if bot is online
   - Send broadcasts with a click
   - Upload images/videos
   - Manage schedules
   - Edit content (motivations, tips)

---

## 🔧 Setting Up Password Protection

### Set Dashboard Password

You need to set a password to protect the web dashboard. Ask your admin to run:

```bash
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{"dashboardPassword": "your_secret_password"}'
```

Or use the bot via WhatsApp - there's a settings option in the dashboard.

---

## 🔧 Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| Bot won't start | Make sure you ran `npm install` first |
| QR code won't scan | Try logging out of WhatsApp web first: Settings → Linked Devices → Log out all devices |
| Messages not sending | Check bot shows "Online" in dashboard |
| Forgot password | Ask admin to reset via config |
| Nothing happens when I send commands | Make sure you set your admin number first |
| Connection closed (405) | Delete the sessions folder and restart: `rm -rf sessions/` then `npm start` |

---

## 💾 How to Backup & Restore Your Session

After scanning the QR code once, you can save your session. This way, you won't need to scan QR again if the bot restarts!

### 1. Backup (After First Connection)

**Option A: Download via Browser**
1. Open: `http://localhost:3000/api/session/export`
2. Save the JSON file to your computer (e.g., `session-backup.json`)

**Option B: Via Command Line**
```bash
curl -o session-backup.json http://localhost:3000/api/session/export
```

### 2. Restore (When Needed)

1. Copy `session-backup.json` to the `sessions/` folder
2. Make sure the filename matches what the bot expects
3. Restart: `npm start`

No QR scanning needed!

### ⚠️ Important Notes
- The session file is in your `sessions/` folder
- If you log out from WhatsApp Web, the session becomes invalid
- If session expires, just delete `sessions/` folder and scan QR again

---

## ⚡ Can I Use It Without Fly.io?

**Yes! Totally optional.**

| How You Run It | What Happens |
|----------------|--------------|
| **On your PC** | Works perfectly! Just run `npm start` |
| **On Fly.io** | 24/7 (runs on their servers, no PC needed) |

**On your PC (FREE):**
- Run `npm start` → bot goes online
- Use WhatsApp commands → works great
- Close terminal → bot stops

**On Fly.io (24/7 FREE):**
- Deploy once → bot runs forever
- Access from anywhere

---

## 🚀 Want to Run 24/7?

The above runs on your computer. To run **24/7** (even when your computer is off), deploy to **Fly.io**:

```bash
# Install Fly CLI (Mac)
brew install flyctl/flyctl/flyctl

# Install Fly CLI (Windows)
iwr https://fly.io/install.ps1 | iex

# Login
fly auth login

# Launch
cd tgr-assistant
fly launch

# Set port
fly secrets set PORT=3000

# Deploy
fly deploy
```

Then open `fly open` to see your live bot running on the internet!

---

## 📞 Getting Help

- 📧 Email: dammieoptimus@gmail.com
- 🌐 Website: https://www.topupandgetreward.com
- 🆔 Referral ID: DammieOptimus2

---

*Created by Engr. Dammie Optimus* 🐝
