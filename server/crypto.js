// ========== 暗号化ユーティリティ ==========
const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY is not set in .env");
  // 32バイトに正規化
  return crypto.createHash("sha256").update(key).digest();
}

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(String(text), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return iv.toString("hex") + ":" + authTag + ":" + encrypted;
}

function decrypt(encryptedText) {
  if (!encryptedText || !encryptedText.includes(":")) return encryptedText;
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encryptedText;
  }
}

function encryptMember(member) {
  return {
    ...member,
    name: encrypt(member.name),
    note: member.note ? encrypt(member.note) : "",
    _encrypted: true,
  };
}

function decryptMember(member) {
  if (!member._encrypted) return member;
  return {
    ...member,
    name: decrypt(member.name),
    note: member.note ? decrypt(member.note) : "",
    _encrypted: undefined,
  };
}

module.exports = { encrypt, decrypt, encryptMember, decryptMember };
