// ========== BIBE 団体管理サーバー ==========
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool, initDB } = require("./db");

const app = express();
const PORT = process.env.PORT || 3002;

// ========== セキュリティミドルウェア ==========
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));

app.use(cors({ origin: false }));
app.use(express.json({ limit: "1mb" }));

// Render等のプロキシ環境対応
app.set("trust proxy", 1);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "ログイン試行回数が多すぎます。15分後に再試行してください" },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
});

// ========== 静的ファイル配信 ==========
app.use(express.static(path.join(__dirname, "../public")));

// ========== APIルート ==========
app.use("/api/auth", loginLimiter, require("./routes/auth"));
app.use("/api/members", apiLimiter, require("./routes/members"));
app.use("/api/events", apiLimiter, require("./routes/events"));

// SPAフォールバック
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ========== エラーハンドラ ==========
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(500).json({ error: "サーバーエラーが発生しました" });
});

// ========== 管理者自動作成 ==========
async function ensureAdmin() {
  for (let i = 1; i <= 10; i++) {
    const usernameKey = i === 1 ? "ADMIN_USERNAME" : `ADMIN_USERNAME_${i}`;
    const passwordKey = i === 1 ? "ADMIN_PASSWORD" : `ADMIN_PASSWORD_${i}`;

    const adminUser = process.env[usernameKey];
    const adminPass = process.env[passwordKey];

    if (!adminUser || !adminPass) continue;

    const existing = await pool.query("SELECT id FROM users WHERE username = $1", [adminUser]);
    if (existing.rows.length > 0) continue;

    const hashed = bcrypt.hashSync(adminPass, 12);
    await pool.query(
      "INSERT INTO users (id, username, password, role, created_at) VALUES ($1, $2, $3, $4, NOW())",
      [Date.now() + i, adminUser, hashed, "admin"]
    );
    console.log(`管理者 "${adminUser}" を自動作成しました`);
  }
}

// ========== サーバー起動 ==========
async function start() {
  await initDB();
  await ensureAdmin();
  app.listen(PORT, () => {
    console.log(`団体管理サーバー起動: http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("起動エラー:", err.message);
  process.exit(1);
});
