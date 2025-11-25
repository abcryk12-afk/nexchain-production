require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db;
let isConnecting = false;

async function initDB() {
  if (db) {
    return db;
  }
  if (isConnecting) {
    // Wait for connection to complete
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return db;
  }
  
  isConnecting = true;
  try {
    db = await open({
      filename: path.join(__dirname, '../nexchain_usdt.db'),
      driver: sqlite3.Database
    });
    console.log('✅ SQLite database connected');
    return db;
  } finally {
    isConnecting = false;
  }
}

// SQLite compatible pool wrapper
const pool = {
  async execute(sql, params = []) {
    const database = await initDB();
    
    if (sql.trim().startsWith('SELECT') || sql.trim().startsWith('SHOW')) {
      const rows = await database.all(sql, params);
      return [rows];
    } else {
      const result = await database.run(sql, params);
      return [{ insertId: result.lastID, affectedRows: result.changes }];
    }
  },
  
  async getConnection() {
    return {
      execute: this.execute.bind(this),
      release: () => {}
    };
  },
  
  async end() {
    if (db) {
      await db.close();
      db = null;
    }
  }
};

module.exports = pool;