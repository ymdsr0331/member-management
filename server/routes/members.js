// ========== メンバーAPIルート ==========
const express = require("express");
const auth = require("../middleware/auth");
const { validateMember } = require("../middleware/validate");
const { encryptMember, decryptMember } = require("../crypto");
const { pool } = require("../db");
const router = express.Router();

// GET /api/members
router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM members ORDER BY id");
    const members = result.rows.map((row) => decryptMember({
      id: row.id,
      name: row.name,
      role: row.role,
      year: row.year,
      note: row.note,
      _encrypted: row.encrypted,
    }));
    res.json(members);
  } catch (err) {
    console.error("メンバー取得エラー:", err.message);
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
});

// POST /api/members
router.post("/", auth, validateMember, async (req, res) => {
  try {
    const member = {
      id: Date.now(),
      name: req.body.name,
      role: req.body.role || "",
      year: req.body.year || "",
      note: req.body.note || "",
    };
    const encrypted = encryptMember(member);

    await pool.query(
      "INSERT INTO members (id, name, role, year, note, encrypted) VALUES ($1, $2, $3, $4, $5, $6)",
      [encrypted.id, encrypted.name, encrypted.role, encrypted.year, encrypted.note, encrypted._encrypted || false]
    );

    res.status(201).json(member);
  } catch (err) {
    console.error("メンバー作成エラー:", err.message);
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
});

// PUT /api/members/:id
router.put("/:id", auth, validateMember, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const existing = await pool.query("SELECT * FROM members WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "メンバーが見つかりません" });
    }

    const updated = {
      id,
      name: req.body.name,
      role: req.body.role || "",
      year: req.body.year || "",
      note: req.body.note || "",
    };
    const encrypted = encryptMember(updated);

    await pool.query(
      "UPDATE members SET name = $1, role = $2, year = $3, note = $4, encrypted = $5 WHERE id = $6",
      [encrypted.name, encrypted.role, encrypted.year, encrypted.note, encrypted._encrypted || false, id]
    );

    res.json(updated);
  } catch (err) {
    console.error("メンバー更新エラー:", err.message);
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
});

// DELETE /api/members/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await pool.query("DELETE FROM members WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "メンバーが見つかりません" });
    }

    // 関連する出席・日程回答も削除
    await pool.query("DELETE FROM attendance WHERE member_id = $1", [id]);
    await pool.query("DELETE FROM responses WHERE member_id = $1", [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("メンバー削除エラー:", err.message);
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
});

module.exports = router;
