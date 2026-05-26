// ========== PostgreSQL データベース接続 ==========
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// テーブル初期化
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS members (
      id BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      role VARCHAR(100) DEFAULT '',
      year VARCHAR(20) DEFAULT '',
      note TEXT DEFAULT '',
      encrypted BOOLEAN DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS events (
      id BIGINT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      type VARCHAR(50) DEFAULT 'meeting',
      date DATE NOT NULL,
      candidate_dates JSONB DEFAULT '[]'::jsonb
    );

    CREATE TABLE IF NOT EXISTS attendance (
      event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
      member_id BIGINT NOT NULL,
      status VARCHAR(20) NOT NULL,
      PRIMARY KEY (event_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS responses (
      event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
      member_id BIGINT NOT NULL,
      available_dates JSONB DEFAULT '[]'::jsonb,
      PRIMARY KEY (event_id, member_id)
    );
  `);
  console.log("データベーステーブルを初期化しました");
}

module.exports = { pool, initDB };
