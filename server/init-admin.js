// ========== 管理者ユーザー初期化スクリプト ==========
// 使い方: node server/init-admin.js
require("dotenv").config();
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const USERS_FILE = path.join(__dirname, "data/users.json");
const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log("=== BIBE 管理者アカウント作成 ===\n");

  const username = await ask("ユーザー名: ");
  const password = await ask("パスワード: ");

  if (!username || !password) {
    console.error("ユーザー名とパスワードは必須です");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("パスワードは8文字以上にしてください");
    process.exit(1);
  }

  const users = fs.existsSync(USERS_FILE)
    ? JSON.parse(fs.readFileSync(USERS_FILE, "utf8"))
    : [];

  if (users.find((u) => u.username === username)) {
    console.error("そのユーザー名は既に存在します");
    process.exit(1);
  }

  const hashedPassword = bcrypt.hashSync(password, 12);

  users.push({
    id: Date.now(),
    username,
    password: hashedPassword,
    role: "admin",
    createdAt: new Date().toISOString(),
  });

  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  console.log(`\n管理者 "${username}" を作成しました。`);
  console.log("サーバーを起動してログインしてください: npm start");

  rl.close();
}

main();
