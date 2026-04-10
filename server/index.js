// ========== BIBE 団体管理サーバー ==========
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3002;

// データディレクトリ確保
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

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
function ensureAdmin() {
  const bcrypt = require("bcryptjs");
  const usersFile = path.join(__dirname, "data/users.json");

  let users = [];
  if (fs.existsSync(usersFile)) {
    users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
  }

  // 複数の管理者を環境変数から作成
  let adminCount = 0;
  for (let i = 1; i <= 10; i++) {
    const usernameKey = i === 1 ? "ADMIN_USERNAME" : `ADMIN_USERNAME_${i}`;
    const passwordKey = i === 1 ? "ADMIN_PASSWORD" : `ADMIN_PASSWORD_${i}`;

    const adminUser = process.env[usernameKey];
    const adminPass = process.env[passwordKey];

    if (adminUser && adminPass && !users.find((u) => u.username === adminUser)) {
      users.push({
        id: Date.now() + i,
        username: adminUser,
        password: bcrypt.hashSync(adminPass, 12),
        role: "admin",
        createdAt: new Date().toISOString(),
      });
      console.log(`管理者 "${adminUser}" を自動作成しました`);
      adminCount++;
    }
  }

  if (adminCount > 0) {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf8");
  }
}

ensureAdmin();

app.listen(PORT, () => {
  console.log(`団体管理サーバー起動: http://localhost:${PORT}`);
});
