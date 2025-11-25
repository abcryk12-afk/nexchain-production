const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db;

async function initDB() {
  if (!db) {
    db = await open({
      filename: path.join(__dirname, '../nexchain_usdt.db'),
      driver: sqlite3.Database
    });
  }
  return db;
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
