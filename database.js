/**
 * SQLite Database Module for TGR Assistant
 * Uses sql.js (pure JavaScript SQLite) for cross-platform compatibility
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'tgr.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;
let SQL = null;

// Initialize database
async function initDatabase() {
  SQL = await initSqlJs();
  
  // Load existing database or create new
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✅ SQLite database loaded from file');
  } else {
    db = new SQL.Database();
    console.log('✅ New SQLite database created');
  }
  
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      jid TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      time TEXT NOT NULL,
      type TEXT DEFAULT 'onetime',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  saveToFile();
  console.log('✅ SQLite tables initialized');
}

// Save database to file
function saveToFile() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Migration functions
function migrateFromJSON() {
  const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
  const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');
  const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
  const CONTENT_FILE = path.join(DATA_DIR, 'content.json');

  // Check if JSON files exist and have data
  const hasConfig = fs.existsSync(CONFIG_FILE) && fs.statSync(CONFIG_FILE).size > 0;
  const hasSchedules = fs.existsSync(SCHEDULES_FILE) && fs.statSync(SCHEDULES_FILE).size > 0;
  const hasGroups = fs.existsSync(GROUPS_FILE) && fs.statSync(GROUPS_FILE).size > 0;
  const hasContent = fs.existsSync(CONTENT_FILE) && fs.statSync(CONTENT_FILE).size > 0;

  if (!hasConfig && !hasSchedules && !hasGroups && !hasContent) {
    console.log('📄 No existing JSON data found, starting fresh');
    return;
  }

  console.log('🔄 Migrating data from JSON files to SQLite...');

  // Migrate config
  if (hasConfig) {
    try {
      const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      for (const [key, value] of Object.entries(configData)) {
        db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
      }
      console.log('✅ Config migrated');
    } catch (e) {
      console.log('⚠️ Config migration skipped:', e.message);
    }
  }

  // Migrate groups
  if (hasGroups) {
    try {
      const groupsData = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
      for (const group of groupsData) {
        db.run('INSERT OR IGNORE INTO groups (name, jid) VALUES (?, ?)', [group.name, group.jid]);
      }
      console.log(`✅ ${groupsData.length} groups migrated`);
    } catch (e) {
      console.log('⚠️ Groups migration skipped:', e.message);
    }
  }

  // Migrate content
  if (hasContent) {
    try {
      const contentData = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
      
      if (contentData.morningMotivation && Array.isArray(contentData.morningMotivation)) {
        for (const mot of contentData.morningMotivation) {
          db.run('INSERT INTO content (type, content) VALUES (?, ?)', ['motivation', mot]);
        }
        console.log(`✅ ${contentData.morningMotivation.length} motivations migrated`);
      }
      
      if (contentData.tips && Array.isArray(contentData.tips)) {
        for (const tip of contentData.tips) {
          db.run('INSERT INTO content (type, content) VALUES (?, ?)', ['tip', tip]);
        }
        console.log(`✅ ${contentData.tips.length} tips migrated`);
      }
      
      if (contentData.faqs && typeof contentData.faqs === 'object') {
        db.run('INSERT INTO content (type, content) VALUES (?, ?)', ['faq', JSON.stringify(contentData.faqs)]);
        console.log('✅ FAQs migrated');
      }
    } catch (e) {
      console.log('⚠️ Content migration skipped:', e.message);
    }
  }

  // Migrate schedules
  if (hasSchedules) {
    try {
      const schedulesData = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf8'));
      for (const sched of schedulesData) {
        db.run('INSERT OR REPLACE INTO schedules (id, message, time, type, created_at) VALUES (?, ?, ?, ?, ?)', 
          [sched.id, sched.message, sched.time, sched.type || 'onetime', sched.createdAt || new Date().toISOString()]);
      }
      console.log(`✅ ${schedulesData.length} schedules migrated`);
    } catch (e) {
      console.log('⚠️ Schedules migration skipped:', e.message);
    }
  }

  saveToFile();
  console.log('✅ JSON to SQLite migration complete');
}

// Config operations
function getConfig(key) {
  const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
  stmt.bind([key]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }
  stmt.free();
  return null;
}

function setConfig(key, value) {
  db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
  saveToFile();
}

function getAllConfig() {
  const results = [];
  const stmt = db.prepare('SELECT key, value FROM config');
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  
  const config = {};
  for (const row of results) {
    try {
      config[row.key] = JSON.parse(row.value);
    } catch {
      config[row.key] = row.value;
    }
  }
  return config;
}

// Groups operations
function getGroups() {
  const results = [];
  const stmt = db.prepare('SELECT id, name, jid, created_at FROM groups ORDER BY id');
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function addGroup(name, jid) {
  db.run('INSERT INTO groups (name, jid) VALUES (?, ?)', [name, jid]);
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveToFile();
  return { id: lastId, name, jid };
}

function removeGroup(id) {
  const stmt = db.prepare('SELECT * FROM groups WHERE id = ?');
  stmt.bind([id]);
  let group = null;
  if (stmt.step()) {
    group = stmt.getAsObject();
  }
  stmt.free();
  
  if (group) {
    db.run('DELETE FROM groups WHERE id = ?', [id]);
    saveToFile();
  }
  return group;
}

function groupExists(jid) {
  const stmt = db.prepare('SELECT 1 FROM groups WHERE jid = ?');
  stmt.bind([jid]);
  const exists = stmt.step();
  stmt.free();
  return exists;
}

// Content operations
function getContent(type = null) {
  let results = [];
  
  if (type) {
    const stmt = db.prepare('SELECT id, type, content, created_at FROM content WHERE type = ?');
    stmt.bind([type]);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
  } else {
    const stmt = db.prepare('SELECT id, type, content, created_at FROM content');
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
  }
  
  if (type) {
    return results.map(r => {
      if (r.type === 'faq') {
        try { r.content = JSON.parse(r.content); } catch {}
      }
      return r;
    });
  }
  
  const content = { morningMotivation: [], tips: [], faqs: {} };
  for (const row of results) {
    if (row.type === 'motivation') content.morningMotivation.push(row.content);
    else if (row.type === 'tip') content.tips.push(row.content);
    else if (row.type === 'faq') {
      try { content.faqs = JSON.parse(row.content); } catch { content.faqs = {}; }
    }
  }
  return content;
}

function addContent(type, text) {
  db.run('INSERT INTO content (type, content) VALUES (?, ?)', [type, text]);
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveToFile();
  return { id: lastId, type, content: text };
}

// Schedules operations
function getSchedules() {
  const results = [];
  const stmt = db.prepare('SELECT * FROM schedules ORDER BY created_at');
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function addSchedule(id, message, time, type = 'onetime') {
  db.run('INSERT OR REPLACE INTO schedules (id, message, time, type) VALUES (?, ?, ?, ?)', [id, message, time, type]);
  saveToFile();
}

function removeSchedule(id) {
  const stmt = db.prepare('SELECT * FROM schedules WHERE id = ?');
  stmt.bind([id]);
  let sched = null;
  if (stmt.step()) {
    sched = stmt.getAsObject();
  }
  stmt.free();
  
  if (sched) {
    db.run('DELETE FROM schedules WHERE id = ?', [id]);
    saveToFile();
  }
  return sched;
}

// Delete content by type
function deleteContentByType(type) {
  db.run('DELETE FROM content WHERE type = ?', [type]);
  saveToFile();
}

// Delete content by ID
function deleteContentById(id) {
  db.run('DELETE FROM content WHERE id = ?', [id]);
  saveToFile();
}

// Export the db object for direct access if needed
function getDb() {
  return db;
}

// Export everything
module.exports = {
  initDatabase,
  migrateFromJSON,
  getConfig,
  setConfig,
  getAllConfig,
  getGroups,
  addGroup,
  removeGroup,
  groupExists,
  getContent,
  addContent,
  getSchedules,
  addSchedule,
  removeSchedule,
  deleteContentByType,
  deleteContentById,
  db,
  getDb,
  saveToFile
};
