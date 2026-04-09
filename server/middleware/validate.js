// ========== バリデーション・サニタイズ ==========
const validator = require("validator");

// HTMLタグ・不正文字の除去
function sanitize(str) {
  if (typeof str !== "string") return str;
  return validator.escape(validator.stripLow(str.trim()));
}

// 日付形式チェック (YYYY-MM-DD)
function isValidDate(str) {
  return typeof str === "string" && validator.isDate(str, { format: "YYYY-MM-DD", strictMode: true });
}

// 出席ステータスチェック
function isValidAttendanceStatus(status) {
  return ["present", "absent", "none"].includes(status);
}

// メンバー入力バリデーション
function validateMember(req, res, next) {
  const { name, role, year, note } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "名前は必須です" });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ error: "名前は100文字以内にしてください" });
  }

  req.body.name = sanitize(name);
  req.body.role = role ? sanitize(String(role)) : "";
  req.body.note = note ? sanitize(String(note)) : "";

  const validYears = ["", "1年", "2年", "3年", "4年", "院1年", "院2年"];
  if (year && !validYears.includes(year)) {
    return res.status(400).json({ error: "学年の値が不正です" });
  }

  next();
}

// イベント入力バリデーション
function validateEvent(req, res, next) {
  const { title, date, candidateDates } = req.body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({ error: "タイトルは必須です" });
  }
  if (title.trim().length > 200) {
    return res.status(400).json({ error: "タイトルは200文字以内にしてください" });
  }
  if (!date || !isValidDate(date)) {
    return res.status(400).json({ error: "有効な日付を入力してください (YYYY-MM-DD)" });
  }

  req.body.title = sanitize(title);

  if (candidateDates) {
    if (!Array.isArray(candidateDates)) {
      return res.status(400).json({ error: "候補日はリスト形式にしてください" });
    }
    for (const d of candidateDates) {
      if (!isValidDate(d)) {
        return res.status(400).json({ error: `候補日の形式が不正です: ${d}` });
      }
    }
  }

  next();
}

// 出席入力バリデーション
function validateAttendance(req, res, next) {
  const { memberId, status } = req.body;

  if (!memberId || typeof memberId !== "number") {
    return res.status(400).json({ error: "メンバーIDが不正です" });
  }
  if (!isValidAttendanceStatus(status)) {
    return res.status(400).json({ error: "出席ステータスが不正です (present/absent/none)" });
  }

  next();
}

// 日程回答バリデーション
function validateScheduleResponse(req, res, next) {
  const { memberId, availableDates } = req.body;

  if (!memberId || typeof memberId !== "number") {
    return res.status(400).json({ error: "メンバーIDが不正です" });
  }
  if (!Array.isArray(availableDates)) {
    return res.status(400).json({ error: "日付リストが不正です" });
  }
  for (const d of availableDates) {
    if (!isValidDate(d)) {
      return res.status(400).json({ error: `日付形式が不正です: ${d}` });
    }
  }

  next();
}

module.exports = {
  sanitize,
  isValidDate,
  validateMember,
  validateEvent,
  validateAttendance,
  validateScheduleResponse,
};
