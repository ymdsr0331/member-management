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

app.use(cors({ origin: false })); // 同一オリジンのみ
app.use(express.json({ limit: "1mb" }));

// ログインは厳しめにレート制限
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 10,
  message: { error: "ログイン試行回数が多すぎます。15分後に再試行してください" },
});

// API全般のレート制限
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分
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

app.listen(PORT, () => {
  console.log(`BIBE 団体管理サーバー起動: http://localhost:${PORT}`);
  console.log(`管理者作成: npm run init-admin`);
});
