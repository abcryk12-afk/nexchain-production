// Auto-detect database: MySQL first, SQLite fallback
let db;

try {
  // Try MySQL
  const mysql = require('mysql2/promise');
  require('dotenv').config();

  const mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nexchain_usdt',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Test MySQL connection
  mysqlPool.getConnection().then(conn => {
    console.log('✅ Using MySQL database');
    conn.release();
  }).catch(err => {
    throw err;
  });

  db = mysqlPool;

} catch (error) {
  console.log('❌ MySQL not available, switching to SQLite...');
  
  // SQLite fallback
  const sqlite3 = require('sqlite3').verbose();
  const { open } = require('sqlite');
  const path = require('path');
  
  let sqliteDb;
  
  async function initDB() {
    if (!sqliteDb) {
      sqliteDb = await open({
        filename: path.join(__dirname, '../nexchain_usdt.db'),
        driver: sqlite3.Database
      });
    }
    return sqliteDb;
  }
  
  db = {
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
      if (sqliteDb) {
        await sqliteDb.close();
        sqliteDb = null;
      }
    }
  };
  
  console.log('✅ Using SQLite database (fallback)');
}

module.exports = db;
