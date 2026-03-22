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
  telegramBotToken: null,
  messageDelayMs: 2000  // Default 2 seconds between messages
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

  // Handle group updates (new groups, participant changes)
  sock.ev.on('groups.upsert', async (groupUpdates) => {
    console.log('📥 Group upsert detected:', groupUpdates.length);
    for (const group of groupUpdates) {
      await handleNewGroup(group);
    }
  });

  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    console.log(`👥 Group ${id} update: ${action}`, participants);
    // Bot was added to a group
    if (action === 'add' && sock.user && participants.includes(sock.user.id)) {
      const groupInfo = { id, subject: 'Unknown Group' };
      try {
        const metadata = await sock.groupMetadata(id);
        groupInfo.subject = metadata.subject;
      } catch (e) {}
      await handleNewGroup(groupInfo);
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

// Handle new group detection
async function handleNewGroup(group) {
  // Check if group already exists
  const exists = groups.find(g => g.jid === group.id);
  if (exists) return;

  const groupName = group.subject || 'Unknown Group';
  console.log(`🆕 New group detected: ${groupName} (${group.id})`);

  // Notify admin
  if (config.adminNumber) {
    const adminJid = config.adminNumber + '@s.whatsapp.net';
    await sock.sendMessage(adminJid, {
      text: `🆕 Bot added to new group!\n\n📛 Name: ${groupName}\n🆔 JID: ${group.id}\n\nReply with:\n• "yes" to add to broadcast list\n• "no" to ignore`
    });
  }
}

// Admin Commands
async function handleAdminCommand(msg, body) {
  const jid = msg.key.remoteJid;
  const cmd = body.toLowerCase().trim();

  // Handle response to new group prompt
  if (cmd === 'yes' || cmd === 'no') {
    // This would need more context - skip for now
  }

  // Selective or all groups broadcast
  // Format: broadcast 1,3,5 <message> OR broadcast all <message>
  if (cmd.startsWith('broadcast ')) {
    const rest = body.substring(10);
    
    // Check if starts with "all"
    if (rest.startsWith('all ')) {
      const message = rest.substring(4);
      await broadcastToGroups(message);
      await sock.sendMessage(jid, { text: `✅ Broadcast sent to ALL ${groups.length} groups!` });
      return;
    }
    
    // Check for number list: broadcast 1,3,5 <message>
    const numberMatch = rest.match(/^(\d+(?:,\d+)*)\s+(.+)$/);
    if (numberMatch) {
      const indices = numberMatch[1].split(',').map(n => parseInt(n) - 1); // Convert to 0-indexed
      const message = numberMatch[2];
      await broadcastToGroups(message, indices);
      await sock.sendMessage(jid, { text: `✅ Broadcast sent to ${indices.length} selected group(s)!` });
      return;
    }
    
    // Fallback: broadcast all
    await broadcastToGroups(rest);
    await sock.sendMessage(jid, { text: `✅ Broadcast sent to ALL ${groups.length} groups!` });
    return;
  }

  // Add group manually
  // Format: addgroup <name> <jid>
  if (cmd.startsWith('addgroup ')) {
    const rest = body.substring(9);
    const parts = rest.split(' ');
    
    if (parts.length >= 2) {
      const name = parts.slice(0, -1).join(' ');
      const groupJid = parts[parts.length - 1];
      
      // Validate JID format
      if (!groupJid.includes('@g.us')) {
        await sock.sendMessage(jid, { text: '❌ Invalid group JID. Use format: addgroup <name> <jid@group.us>' });
        return;
      }
      
      groups.push({ name, jid: groupJid });
      saveGroups();
      await sock.sendMessage(jid, { text: `✅ Group "${name}" added! Total: ${groups.length}` });
    } else {
      await sock.sendMessage(jid, { text: '❌ Usage: addgroup <name> <jid@group.us>\nExample: addgroup TGR Team 123456789-123456@g.us' });
    }
    return;
  }

  // Remove group by number
  // Format: removegroup <number>
  if (cmd.startsWith('removegroup ')) {
    const num = parseInt(body.substring(12));
    
    if (isNaN(num) || num < 1 || num > groups.length) {
      await sock.sendMessage(jid, { text: `❌ Invalid group number. Use 1-${groups.length}` });
      return;
    }
    
    const removed = groups.splice(num - 1, 1)[0];
    saveGroups();
    await sock.sendMessage(jid, { text: `✅ Group "${removed.name}" removed! Total: ${groups.length}` });
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

  // List groups with index numbers
  if (cmd === 'groups') {
    if (groups.length === 0) {
      await sock.sendMessage(jid, { text: '📋 No groups added yet.\n\nAdd groups with: addgroup <name> <jid>' });
      return;
    }
    let text = '📋 Your Groups:\n\n';
    groups.forEach((g, i) => {
      text += `${i + 1}. ${g.name}\n`;
    });
    text += '\n💡 Use numbers for selective broadcast:\n• broadcast 1,3,5 Hello\n• broadcast all Hello';
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

📢 broadcast <message> - Send to ALL groups
📢 broadcast all <message> - Send to ALL groups
📢 broadcast 1,3,5 <msg> - Send to SELECTED groups
👥 addgroup <name> <jid> - Add group manually
❌ removegroup <number> - Remove group by number
📋 groups - List all groups (with numbers)

💡 addmotivation <text> - Add morning message
💡 addtip <text> - Add daily tip
📅 schedule - Use dashboard for now

🔗 Link group - Send group invite link`
  });
}

// Helper sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Broadcast to all groups or selective groups with retry logic and rate limiting
async function broadcastToGroups(message, targetIndices = null) {
  let targetGroups = groups;
  
  // If specific indices provided, filter groups
  if (targetIndices && Array.isArray(targetIndices)) {
    targetGroups = targetIndices.map(i => groups[i]).filter(g => g);
    console.log(`📢 Selective broadcast to ${targetGroups.length} groups`);
  } else {
    console.log(`📢 Broadcasting to all ${groups.length} groups`);
  }

  const results = { success: [], failed: [] };
  const maxRetries = 3;
  const delayMs = config.messageDelayMs || 2000;
  
  for (let i = 0; i < targetGroups.length; i++) {
    const group = targetGroups[i];
    let sent = false;
    
    // Retry logic with exponential backoff
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await sock.sendMessage(group.jid, { text: message });
        results.success.push(group.name);
        console.log(`📢 Sent to ${group.name}`);
        sent = true;
        break;
      } catch (e) {
        console.log(`⚠️ Attempt ${attempt}/${maxRetries} failed for ${group.name}: ${e.message}`);
        if (attempt < maxRetries) {
          const backoffMs = 1000 * attempt; // 1s, 2s, 3s exponential backoff
          await sleep(backoffMs);
        }
      }
    }
    
    if (!sent) {
      results.failed.push(group.name);
      console.log(`❌ All retries exhausted for ${group.name}`);
    }
    
    // Rate limiting - delay between messages (skip delay after last message)
    if (i < targetGroups.length - 1) {
      await sleep(delayMs);
    }
  }
  
  // Report to admin if there were failures
  if (results.failed.length > 0 && config.adminNumber) {
    const adminJid = config.adminNumber + '@s.whatsapp.net';
    const failedList = results.failed.join(', ');
    await sock.sendMessage(adminJid, {
      text: `⚠️ Broadcast partial failure!\n\n✅ Sent: ${results.success.length}\n❌ Failed: ${failedList}`
    });
    console.log(`📋 Admin notified: ${results.failed.length} groups failed`);
  }
  
  return results;
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
// Enhanced send with selective group targeting
app.post('/api/send', async (req, res) => {
  const { message, type, groups: targetGroups } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  
  let targetIndices = null;
  if (targetGroups && Array.isArray(targetGroups)) {
    // Convert 1-based to 0-based indices
    targetIndices = targetGroups.map(n => n - 1);
  }
  
  await broadcastToGroups(message, targetIndices);
  const count = targetIndices ? targetIndices.length : groups.length;
  res.json({ success: true, groups: count });
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

// Add a new group
app.post('/api/groups', (req, res) => {
  const { name, jid } = req.body;
  if (!name || !jid) return res.status(400).json({ error: 'Name and JID required' });
  
  // Check if already exists
  if (groups.find(g => g.jid === jid)) {
    return res.status(400).json({ error: 'Group already exists' });
  }
  
  groups.push({ name, jid });
  saveGroups();
  res.json({ success: true, groups });
});

// Remove a group by index (1-based)
app.delete('/api/groups/:index', (req, res) => {
  const index = parseInt(req.params.index) - 1; // Convert to 0-based
  
  if (isNaN(index) || index < 0 || index >= groups.length) {
    return res.status(400).json({ error: 'Invalid index' });
  }
  
  const removed = groups.splice(index, 1)[0];
  saveGroups();
  res.json({ success: true, removed, groups });
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connected: isConnected,
    uptime: process.uptime(),
    groups: groups.length
  });
});

// Session Export - Download session data for backup
app.get('/api/session/export', (req, res) => {
  try {
    const sessionFiles = {};
    const files = fs.readdirSync(SESSION_DIR);
    
    for (const file of files) {
      const filePath = path.join(SESSION_DIR, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile()) {
        const content = fs.readFileSync(filePath);
        // Store as base64 to preserve binary data (creds.json may have special chars)
        sessionFiles[file] = content.toString('base64');
      }
    }
    
    res.json({
      success: true,
      exportedAt: new Date().toISOString(),
      files: sessionFiles,
      fileCount: Object.keys(sessionFiles).length
    });
  } catch (error) {
    console.error('Session export error:', error);
    res.status(500).json({ error: 'Failed to export session: ' + error.message });
  }
});

// Session Import - Restore session from backup
app.post('/api/session/import', async (req, res) => {
  try {
    const { files } = req.body;
    
    if (!files || typeof files !== 'object') {
      return res.status(400).json({ error: 'Invalid session data. Expected { files: { "filename": "base64..." } }' });
    }
    
    // Write each file to sessions directory
    for (const [filename, base64Content] of Object.entries(files)) {
      const filePath = path.join(SESSION_DIR, filename);
      const buffer = Buffer.from(base64Content, 'base64');
      fs.writeFileSync(filePath, buffer);
    }
    
    console.log('📥 Session imported successfully. Reconnecting...');
    
    // Reconnect to WhatsApp with new session
    if (sock) {
      sock.end(undefined);
    }
    
    setTimeout(async () => {
      await connectWA();
    }, 1000);
    
    res.json({ 
      success: true, 
      message: 'Session imported. Bot is reconnecting...',
      filesImported: Object.keys(files).length
    });
  } catch (error) {
    console.error('Session import error:', error);
    res.status(500).json({ error: 'Failed to import session: ' + error.message });
  }
});

// Start
const PORT = process.env.PORT || 3000;

async function start() {
  app.listen(PORT, () => {
    console.log(`🌐 Admin API running on port ${PORT}`);
  });
  
  initSchedules();
  await connectWA();
  
  // Auto-save reminder on startup
  console.log('💾 Tip: Download your session at /api/session/export and save it safely!');
}

start().catch(console.error);
