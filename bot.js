/**
 * TGR WhatsApp Assistant Bot
 * Full-featured bot for TGR team management
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');
const express = require('express');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());
app.use(express.static('.'));

// Configuration
const DATA_DIR = path.join(__dirname, 'data');
const SESSION_DIR = path.join(__dirname, 'sessions');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');

// Ensure data directories exist
[DATA_DIR, SESSION_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Initialize data files
const initDataFile = (file, defaultData) => {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

let config = initDataFile(CONFIG_FILE, {
  ownerNumber: null,
  botName: 'TGR Assistant',
  adminNumber: null,
  telegramBotToken: null
});

let schedules = initDataFile(SCHEDULES_FILE, []);
let groups = initDataFile(GROUPS_FILE, []);
let content = initDataFile(CONTENT_FILE, {
  morningMotivation: [
    "🌅 Good Morning TGR Family! Today is another opportunity to win! Remember: Success is not final, failure is not fatal. Keep pushing! 💪",
    "🌟 Rise and Grind! Your success story starts today. Every recharge = ₦₦₦ in your pocket! Let's go! 🚀",
    "💰 Good Morning! The wealth is in the network. Keep building, keep growing! TGR go make we rich! 🎯"
  ],
  tips: [
    "💡 TIP: Share your referral link daily! The more people see it, the more they register!",
    "💡 TIP: Your level 2-10 earnings add up! Help your downlines succeed and watch your commission grow!",
    "💡 TIP: Fund your wallet with ₦10,000+ to unlock higher transaction limits!",
    "💡 TIP: The best time to post TGR was yesterday. The next best time is NOW! 📱"
  ],
  faqs: {
    "how to register": "To register: 1. Visit topupandgetreward.com 2. Click Register 3. Use referral ID: DammieOptimus2 4. Choose package & pay",
    "how to fund wallet": "Fund wallet: 1. Login to TGR 2. Go to Fund Wallet 3. Use Sterling OnePay or manual transfer",
    "how to buy data": "Buy data: 1. Login 2. Go to Buy Data 3. Enter phone & network 4. Confirm payment"
  }
});

let sock = null;
let isConnected = false;

// Save functions
const saveConfig = () => fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
const saveSchedules = () => fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
const saveGroups = () => fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
const saveContent = () => fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2));

// WhatsApp Connection
async function connectWA() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: console
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('📱 QR Code received. Scan with WhatsApp!');
    }
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log('Connection closed:', reason);
      if (reason !== DisconnectReason.loggedOut) {
        connectWA();
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp Connected!');
      isConnected = true;
    }
  });

  // Handle messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      await handleMessage(msg);
    }
  });
}

// Message Handler
async function handleMessage(msg) {
  const jid = msg.key.remoteJid;
  const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  const isGroup = jid.endsWith('@g.us');
  
  console.log(`📩 From ${jid}: ${body.substring(0, 50)}`);

  // Check if admin command
  if (config.adminNumber && jid === config.adminNumber + '@s.whatsapp.net') {
    await handleAdminCommand(msg, body);
    return;
  }

  // Auto-reply to FAQs
  const lowerBody = body.toLowerCase();
  for (const [key, answer] of Object.entries(content.faqs)) {
    if (lowerBody.includes(key)) {
      await sock.sendMessage(jid, { text: answer });
      return;
    }
  }
}

// Admin Commands
async function handleAdminCommand(msg, body) {
  const jid = msg.key.remoteJid;
  const cmd = body.toLowerCase().trim();

  // Broadcast to all groups
  if (cmd.startsWith('broadcast ')) {
    const message = body.substring(10);
    await broadcastToGroups(message);
    await sock.sendMessage(jid, { text: `✅ Broadcast sent to ${groups.length} groups!` });
    return;
  }

  // Set morning motivation
  if (cmd.startsWith('addmotivation ')) {
    const mot = body.substring(14);
    content.morningMotivation.push(mot);
    saveContent();
    await sock.sendMessage(jid, { text: '✅ Motivation added!' });
    return;
  }

  // Add tip
  if (cmd.startsWith('addtip ')) {
    const tip = body.substring(7);
    content.tips.push(tip);
    saveContent();
    await sock.sendMessage(jid, { text: '✅ Tip added!' });
    return;
  }

  // List groups
  if (cmd === 'groups') {
    let text = '📋 Your Groups:\n\n';
    groups.forEach((g, i) => {
      text += `${i + 1}. ${g.name}\n`;
    });
    await sock.sendMessage(jid, { text });
    return;
  }

  // Schedule message
  if (cmd.startsWith('schedule ')) {
    // Format: schedule <time> <message>
    // Example: schedule 7am Good morning!
    await sock.sendMessage(jid, { text: '📅 Schedule feature coming soon! Use the web dashboard for now.' });
    return;
  }

  // Help
  await sock.sendMessage(jid, {
    text: `🐝 TGR Assistant Commands:

📢 broadcast <message> - Send to all groups
💡 addmotivation <text> - Add morning message
💡 addtip <text> - Add daily tip
📋 groups - List your groups
📅 schedule - Use dashboard for now

🔗 Link group - Send group invite link`
  });
}

// Broadcast to all groups
async function broadcastToGroups(message) {
  for (const group of groups) {
    try {
      await sock.sendMessage(group.jid, { text: message });
      console.log(`📢 Sent to ${group.name}`);
    } catch (e) {
      console.log(`❌ Failed to send to ${group.name}`);
    }
  }
}

// Schedule Cron Jobs
function initSchedules() {
  // Morning motivation - 7 AM WAT (6 AM UTC)
  cron.schedule('0 6 * * *', async () => {
    const mot = content.morningMotivation[Math.floor(Math.random() * content.morningMotivation.length)];
    await broadcastToGroups(mot);
  });

  // Tips - 12 PM WAT (11 AM UTC)
  cron.schedule('0 11 * * *', async () => {
    const tip = content.tips[Math.floor(Math.random() * content.tips.length)];
    await broadcastToGroups(tip);
  });

  // Evening tip - 6 PM WAT (5 PM UTC)
  cron.schedule('0 17 * * *', async () => {
    const tip = content.tips[Math.floor(Math.random() * content.tips.length)];
    await broadcastToGroups(tip);
  });

  console.log('⏰ Scheduled jobs initialized');
}

// Express API for admin control
app.post('/api/send', async (req, res) => {
  const { message, type } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  
  await broadcastToGroups(message);
  res.json({ success: true, groups: groups.length });
});

app.post('/api/schedule', (req, res) => {
  const { message, time, type } = req.body;
  if (!message || !time) return res.status(400).json({ error: 'Message and time required' });
  
  const schedule = {
    id: uuidv4(),
    message,
    time,
    type: type || 'onetime',
    createdAt: new Date().toISOString()
  };
  
  schedules.push(schedule);
  saveSchedules();
  
  // Parse time and schedule
  // This is simplified - would need proper cron parsing
  res.json({ success: true, schedule });
});

app.get('/api/groups', (req, res) => {
  res.json(groups);
});

app.post('/api/config', (req, res) => {
  const { adminNumber, botName } = req.body;
  if (adminNumber) config.adminNumber = adminNumber;
  if (botName) config.botName = botName;
  saveConfig();
  res.json({ success: true });
});

app.get('/api/content', (req, res) => {
  res.json(content);
});

app.post('/api/content', (req, res) => {
  const { morningMotivation, tips, faqs } = req.body;
  if (morningMotivation) content.morningMotivation = morningMotivation;
  if (tips) content.tips = tips;
  if (faqs) content.faqs = { ...content.faqs, ...faqs };
  saveContent();
  res.json({ success: true });
});

app.get('/api/status', (req, res) => {
  res.json({ connected: isConnected, groups: groups.length, schedules: schedules.length });
});

// Start
const PORT = process.env.PORT || 3000;

async function start() {
  app.listen(PORT, () => {
    console.log(`🌐 Admin API running on port ${PORT}`);
  });
  
  initSchedules();
  await connectWA();
}

start().catch(console.error);
