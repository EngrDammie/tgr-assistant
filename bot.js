/**
 * TGR WhatsApp Assistant Bot
 * Full-featured bot for TGR team management
 * Now using SQLite for data storage
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

// Database module
const db = require('./database');
const logger = require('./logger');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// QR Code endpoint for browser display
app.get('/api/qr', (req, res) => {
  if (currentQR) {
    res.json({ qr: currentQR });
  } else {
    res.json({ qr: null, message: 'No QR code available. Restart the bot to get a new one.' });
  }
});

// Configuration
const SESSION_DIR = path.join(__dirname, 'sessions');

// Ensure directories exist
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Data variables (will be initialized async)
let config = {};
let schedules = [];
let groups = [];
let content = { morningMotivation: [], tips: [], faqs: {} };

// Initialize database and load data
async function initData() {
  // Initialize database and migrate from JSON if exists
  await db.initDatabase();
  db.migrateFromJSON();

  // Load config from SQLite
  config = db.getAllConfig();

  // Set defaults if not present
  const defaultConfig = {
    ownerNumber: null,
    botName: 'TGR Assistant',
    adminNumber: null,
    telegramBotToken: null,
    messageDelayMs: 2000,
    dashboardPassword: null
  };

  for (const [key, value] of Object.entries(defaultConfig)) {
    if (config[key] === undefined) {
      config[key] = value;
      db.setConfig(key, value);
    }
  }

  // Load other data from SQLite
  schedules = db.getSchedules();
  groups = db.getGroups();
  content = db.getContent();
  
  logger.info('Data initialized from SQLite');
}

// Simple auth middleware
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization || req.query.token;
  if (!config.dashboardPassword) {
    // No password set - allow access (first time setup)
    return next();
  }
  if (token === config.dashboardPassword) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

let sock = null;
let isConnected = false;

// In-memory cache refresh functions (for backward compatibility)
const refreshData = () => {
  schedules = db.getSchedules();
  groups = db.getGroups();
  content = db.getContent();
};

// Save functions - now update SQLite directly
const saveConfig = () => {
  // Config is saved immediately via setConfig, no-op here for backward compat
  refreshData();
};

const saveSchedules = () => refreshData();
const saveGroups = () => refreshData();
const saveContent = () => refreshData();

// WhatsApp Connection
let currentQR = null;

async function connectWA() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  
  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: 'Ubuntu' // Explicit browser
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      currentQR = await QRCode.toDataURL(qr);
      console.log('\n📱 SCAN THIS QR CODE WITH WHATSAPP:\n');
      console.log(qr);
      console.log('\n💡 Or open http://localhost:3000 in your browser to see the QR code\n');
    }
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      logger.warn({ reason }, 'Connection closed');
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
  // Check if group already exists in database
  if (db.groupExists(group.id)) return;

  const groupName = group.subject || 'Unknown Group';
  console.log(`🆕 New group detected: ${groupName} (${group.id})`);

  // Add to database
  db.addGroup(groupName, group.id);
  refreshData();

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

  // Image broadcast: image <url> <caption>
  if (cmd.startsWith('image ')) {
    const rest = body.substring(6);
    // Check for selective groups: image 1,3,5 <url> <caption>
    const selectiveMatch = rest.match(/^(\d+(?:,\d+)*)\s+(.+)$/);
    
    let targetIndices = null;
    let contentStr = rest;
    
    if (selectiveMatch) {
      targetIndices = selectiveMatch[1].split(',').map(n => parseInt(n) - 1);
      contentStr = selectiveMatch[2];
    }
    
    // Parse URL and caption (last quoted string is caption)
    const urlMatch = contentStr.match(/(https?:\/\/[^\s]+)\s*(.*)$/);
    
    if (urlMatch) {
      const url = urlMatch[1];
      const caption = urlMatch[2] || null;
      
      await broadcastMediaToGroups('image', url, { caption }, targetIndices);
      const count = targetIndices ? targetIndices.length : groups.length;
      await sock.sendMessage(jid, { text: `🖼️ Image sent to ${count} group(s)!` });
    } else {
      await sock.sendMessage(jid, { text: '❌ Usage: image <url> <caption>\nExample: image https://example.com/image.jpg Check this out!' });
    }
    return;
  }

  // Video broadcast: video <url> <caption>
  if (cmd.startsWith('video ')) {
    const rest = body.substring(6);
    const selectiveMatch = rest.match(/^(\d+(?:,\d+)*)\s+(.+)$/);
    
    let targetIndices = null;
    let contentStr = rest;
    
    if (selectiveMatch) {
      targetIndices = selectiveMatch[1].split(',').map(n => parseInt(n) - 1);
      contentStr = selectiveMatch[2];
    }
    
    const urlMatch = contentStr.match(/(https?:\/\/[^\s]+)\s*(.*)$/);
    
    if (urlMatch) {
      const url = urlMatch[1];
      const caption = urlMatch[2] || null;
      
      await broadcastMediaToGroups('video', url, { caption }, targetIndices);
      const count = targetIndices ? targetIndices.length : groups.length;
      await sock.sendMessage(jid, { text: `🎬 Video sent to ${count} group(s)!` });
    } else {
      await sock.sendMessage(jid, { text: '❌ Usage: video <url> <caption>\nExample: video https://example.com/video.mp4 Check this!' });
    }
    return;
  }

  // Document broadcast: document <url> <filename>
  if (cmd.startsWith('document ')) {
    const rest = body.substring(9);
    const selectiveMatch = rest.match(/^(\d+(?:,\d+)*)\s+(.+)$/);
    
    let targetIndices = null;
    let contentStr = rest;
    
    if (selectiveMatch) {
      targetIndices = selectiveMatch[1].split(',').map(n => parseInt(n) - 1);
      contentStr = selectiveMatch[2];
    }
    
    // Format: <url> <filename> or just <url> (will auto-generate filename)
    const urlMatch = contentStr.match(/(https?:\/\/[^\s]+)\s+(.+)$/);
    
    if (urlMatch) {
      const url = urlMatch[1];
      const fileName = urlMatch[2];
      
      await broadcastMediaToGroups('document', url, { fileName }, targetIndices);
      const count = targetIndices ? targetIndices.length : groups.length;
      await sock.sendMessage(jid, { text: `📄 Document "${fileName}" sent to ${count} group(s)!` });
    } else {
      await sock.sendMessage(jid, { text: '❌ Usage: document <url> <filename>\nExample: document https://example.com/file.pdf Report.pdf' });
    }
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
      
      // Check if already exists
      if (db.groupExists(groupJid)) {
        await sock.sendMessage(jid, { text: '❌ Group already exists!' });
        return;
      }
      
      db.addGroup(name, groupJid);
      refreshData();
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
    
    const removed = db.removeGroup(num);
    refreshData();
    await sock.sendMessage(jid, { text: `✅ Group "${removed.name}" removed! Total: ${groups.length}` });
    return;
  }

  // Set morning motivation
  if (cmd.startsWith('addmotivation ')) {
    const mot = body.substring(14);
    db.addContent('motivation', mot);
    refreshData();
    await sock.sendMessage(jid, { text: '✅ Motivation added!' });
    return;
  }

  // Add tip
  if (cmd.startsWith('addtip ')) {
    const tip = body.substring(7);
    db.addContent('tip', tip);
    refreshData();
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

  // Schedule message via WhatsApp command
  // Format: schedule <time> <message> OR schedule <cron expression> <message>
  // Example: schedule 9am Good morning! OR schedule 0 7 * * * Morning message
  if (cmd.startsWith('schedule ')) {
    const rest = body.substring(9).trim();
    
    // Parse: could be "9am message" or "0 7 * * * message"
    const parts = rest.split(' ');
    
    // Check if it's a cron expression (5+ parts)
    if (parts.length >= 5) {
      // It's a cron expression: schedule 0 7 * * * Morning
      const cronExpr = parts.slice(0, 5).join(' ');
      const message = parts.slice(5).join(' ');
      
      // Validate cron expression
      if (!cron.validate(cronExpr)) {
        await sock.sendMessage(jid, { text: '❌ Invalid cron expression.\nExample: schedule 0 7 * * * Morning message' });
        return;
      }
      
      const scheduleId = uuidv4();
      db.addSchedule(scheduleId, message, cronExpr, 'recurring');
      refreshData();
      
      await sock.sendMessage(jid, { text: `✅ Recurring schedule created!\n⏰ Time: ${cronExpr}\n📝 Message: ${message}\n🆔 ID: ${scheduleId}` });
      return;
    }
    
    // Simple time format: schedule 9am Good morning!
    // Parse time like "9am", "12pm", "7am", etc.
    const timeMatch = rest.match(/^(\d{1,2})(am|pm)\s+(.+)$/i);
    
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const period = timeMatch[2].toLowerCase();
      const message = timeMatch[3];
      
      // Convert to 24-hour format
      if (period === 'am') {
        if (hour === 12) hour = 0; // 12am = 0
      } else {
        if (hour !== 12) hour += 12; // 1pm = 13
      }
      
      const cronExpr = `0 ${hour} * * *`; // Daily at specified hour
      
      const scheduleId = uuidv4();
      db.addSchedule(scheduleId, message, cronExpr, 'daily');
      refreshData();
      
      await sock.sendMessage(jid, { text: `✅ Daily schedule created!\n⏰ Time: ${hour}:00 daily\n📝 Message: ${message}\n🆔 ID: ${scheduleId}` });
      return;
    }
    
    await sock.sendMessage(jid, { text: '❌ Invalid format.\n\nUse:\n• schedule 9am <message> - Daily at 9am\n• schedule 0 7 * * * <message> - Cron format\n\nExamples:\n• schedule 7am Good morning everyone!\n• schedule 0 14 * * * Daily tip' });
    return;
  }
  
  // Show bot status
  if (cmd === 'status') {
    const statusText = `📊 TGR Assistant Status:

🔗 Connection: ${isConnected ? '✅ Connected' : '❌ Disconnected'}
👥 Groups: ${groups.length}
📅 Active Schedules: ${schedules.length}
💾 Database: ✅ SQLite
⏱️ Uptime: ${Math.floor(process.uptime() / 60)} minutes

📝 Quick Stats:
• Morning motivations: ${content.morningMotivation?.length || 0}
• Tips: ${content.tips?.length || 0}
• FAQs: ${Object.keys(content.faqs || {}).length}`;
    
    await sock.sendMessage(jid, { text: statusText });
    return;
  }

  // Help
  await sock.sendMessage(jid, {
    text: `🐝 TGR Assistant Commands:

📢 broadcast <message> - Send to ALL groups
📢 broadcast all <message> - Send to ALL groups
📢 broadcast 1,3,5 <msg> - Send to SELECTED groups

🖼️ image <url> <caption> - Send IMAGE to groups
🎬 video <url> <caption> - Send VIDEO to groups
📄 document <url> <file> - Send DOCUMENT to groups

👥 addgroup <name> <jid> - Add group manually
❌ removegroup <number> - Remove group by number
📋 groups - List all groups (with numbers)

💡 addmotivation <text> - Add morning message
💡 addtip <text> - Add daily tip
📅 schedule 9am <msg> - Schedule daily message
📅 schedule 0 7 * * * <msg> - Cron schedule

🔍 status - Show bot status

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

// Broadcast rich media to groups (reuses broadcast logic structure)
async function broadcastMediaToGroups(mediaType, mediaUrl, options = {}, targetIndices = null) {
  let targetGroups = groups;
  
  if (targetIndices && Array.isArray(targetIndices)) {
    targetGroups = targetIndices.map(i => groups[i]).filter(g => g);
    console.log(`📸 Selective ${mediaType} broadcast to ${targetGroups.length} groups`);
  } else {
    console.log(`📸 Broadcasting ${mediaType} to all ${groups.length} groups`);
  }

  const results = { success: [], failed: [] };
  const maxRetries = 3;
  const delayMs = config.messageDelayMs || 2000;
  
  // Build message object based on media type
  const buildMediaMessage = () => {
    const baseMessage = {};
    
    switch (mediaType) {
      case 'image':
        return { image: { url: mediaUrl }, caption: options.caption || null };
      case 'video':
        return { video: { url: mediaUrl }, caption: options.caption || null };
      case 'document':
        return { document: { url: mediaUrl }, fileName: options.fileName || 'document' };
      default:
        return { text: 'Unknown media type' };
    }
  };
  
  for (let i = 0; i < targetGroups.length; i++) {
    const group = targetGroups[i];
    let sent = false;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const mediaMessage = buildMediaMessage();
        await sock.sendMessage(group.jid, mediaMessage);
        results.success.push(group.name);
        console.log(`📸 Sent ${mediaType} to ${group.name}`);
        sent = true;
        break;
      } catch (e) {
        console.log(`⚠️ Attempt ${attempt}/${maxRetries} failed for ${group.name}: ${e.message}`);
        if (attempt < maxRetries) {
          const backoffMs = 1000 * attempt;
          await sleep(backoffMs);
        }
      }
    }
    
    if (!sent) {
      results.failed.push(group.name);
      console.log(`❌ All retries exhausted for ${group.name}`);
    }
    
    if (i < targetGroups.length - 1) {
      await sleep(delayMs);
    }
  }
  
  // Report to admin
  if (results.failed.length > 0 && config.adminNumber) {
    const adminJid = config.adminNumber + '@s.whatsapp.net';
    await sock.sendMessage(adminJid, {
      text: `⚠️ ${mediaType.toUpperCase()} broadcast partial failure!\n\n✅ Sent: ${results.success.length}\n❌ Failed: ${results.failed.join(', ')}`
    });
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

// Send image to groups
app.post('/api/send/image', async (req, res) => {
  const { url, caption, groups: targetGroups } = req.body;
  
  if (!url) return res.status(400).json({ error: 'Image URL required' });
  
  let targetIndices = null;
  if (targetGroups && Array.isArray(targetGroups)) {
    targetIndices = targetGroups.map(n => n - 1);
  }
  
  try {
    const results = await broadcastMediaToGroups('image', url, { caption }, targetIndices);
    res.json({ success: true, sent: results.success.length, failed: results.failed.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send video to groups
app.post('/api/send/video', async (req, res) => {
  const { url, caption, groups: targetGroups } = req.body;
  
  if (!url) return res.status(400).json({ error: 'Video URL required' });
  
  let targetIndices = null;
  if (targetGroups && Array.isArray(targetGroups)) {
    targetIndices = targetGroups.map(n => n - 1);
  }
  
  try {
    const results = await broadcastMediaToGroups('video', url, { caption }, targetIndices);
    res.json({ success: true, sent: results.success.length, failed: results.failed.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send document to groups
app.post('/api/send/document', async (req, res) => {
  const { url, filename, groups: targetGroups } = req.body;
  
  if (!url) return res.status(400).json({ error: 'Document URL required' });
  
  let targetIndices = null;
  if (targetGroups && Array.isArray(targetGroups)) {
    targetIndices = targetGroups.map(n => n - 1);
  }
  
  try {
    const results = await broadcastMediaToGroups('document', url, { fileName: filename || 'document' }, targetIndices);
    res.json({ success: true, sent: results.success.length, failed: results.failed.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/schedule', (req, res) => {
  const { message, time, type } = req.body;
  if (!message || !time) return res.status(400).json({ error: 'Message and time required' });
  
  const scheduleId = uuidv4();
  db.addSchedule(scheduleId, message, time, type || 'onetime');
  refreshData();
  
  res.json({ success: true, schedule: { id: scheduleId, message, time, type: type || 'onetime' } });
});

app.get('/api/groups', (req, res) => {
  res.json(groups);
});

// Add a new group
app.post('/api/groups', (req, res) => {
  const { name, jid } = req.body;
  if (!name || !jid) return res.status(400).json({ error: 'Name and JID required' });
  
  // Check if already exists
  if (db.groupExists(jid)) {
    return res.status(400).json({ error: 'Group already exists' });
  }
  
  db.addGroup(name, jid);
  refreshData();
  res.json({ success: true, groups });
});

// Remove a group by index (1-based)
app.delete('/api/groups/:index', (req, res) => {
  const index = parseInt(req.params.index); // 1-based from URL
  
  if (isNaN(index) || index < 1) {
    return res.status(400).json({ error: 'Invalid index' });
  }
  
  // Get the group at that index
  const groupList = db.getGroups();
  if (index > groupList.length) {
    return res.status(400).json({ error: 'Invalid index' });
  }
  
  const removed = db.removeGroup(index);
  refreshData();
  res.json({ success: true, removed, groups });
});

app.post('/api/config', (req, res) => {
  const { adminNumber, botName, dashboardPassword, messageDelayMs } = req.body;
  if (adminNumber !== undefined) {
    config.adminNumber = adminNumber;
    db.setConfig('adminNumber', adminNumber);
  }
  if (botName !== undefined) {
    config.botName = botName;
    db.setConfig('botName', botName);
  }
  if (dashboardPassword !== undefined) {
    config.dashboardPassword = dashboardPassword;
    db.setConfig('dashboardPassword', dashboardPassword);
  }
  if (messageDelayMs !== undefined) {
    config.messageDelayMs = messageDelayMs;
    db.setConfig('messageDelayMs', messageDelayMs);
  }
  res.json({ success: true });
});

app.get('/api/content', (req, res) => {
  res.json(content);
});

app.post('/api/content', (req, res) => {
  const { morningMotivation, tips, faqs } = req.body;
  
  // For content, we need to handle differently since it's stored by type
  // Clear existing and re-add (or we could add a bulk insert)
  if (morningMotivation && Array.isArray(morningMotivation)) {
    // Remove existing motivations and add new ones
    db.deleteContentByType('motivation');
    for (const m of morningMotivation) {
      db.addContent('motivation', m);
    }
  }
  
  if (tips && Array.isArray(tips)) {
    db.deleteContentByType('tip');
    for (const t of tips) {
      db.addContent('tip', t);
    }
  }
  
  if (faqs && typeof faqs === 'object') {
    // Store FAQs as JSON
    db.deleteContentByType('faq');
    db.addContent('faq', JSON.stringify(faqs));
  }
  
  refreshData();
  res.json({ success: true });
});

app.get('/api/status', (req, res) => {
  res.json({ connected: isConnected, groups: groups.length, schedules: schedules.length });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  // If no password set, allow access (first-time setup mode)
  if (!config.dashboardPassword) {
    return res.json({ success: true, token: null, message: 'No password configured - access granted' });
  }
  if (password === config.dashboardPassword) {
    res.json({ success: true, token: config.dashboardPassword });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
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

// Health check endpoint (API version)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    connected: isConnected,
    uptime: process.uptime(),
    groups: groups.length,
    schedules: schedules.length,
    content: {
      motivations: content.morningMotivation?.length || 0,
      tips: content.tips?.length || 0,
      faqs: Object.keys(content.faqs || {}).length
    },
    timestamp: new Date().toISOString()
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
  // Initialize data from SQLite first
  await initData();
  
  app.listen(PORT, () => {
    console.log(`🌐 Admin API running on port ${PORT}`);
  });
  
  initSchedules();
  await connectWA();
  
  // Auto-save reminder on startup
  console.log('💾 Tip: Download your session at /api/session/export and save it safely!');
}

start().catch(console.error);
