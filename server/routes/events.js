// ========== イベントAPIルート ==========
const express = require("express");
const auth = require("../middleware/auth");
const { validateEvent, validateAttendance, validateScheduleResponse } = require("../middleware/validate");
const { pool } = require("../db");
const router = express.Router();

// イベント行をフロントエンド形式に変換
async function buildEvent(row) {
  const attResult = await pool.query(
    "SELECT member_id AS \"memberId\", status FROM attendance WHERE event_id = $1", [row.id]
  );
  const resResult = await pool.query(
    "SELECT member_id AS \"memberId\", available_dates AS \"availableDates\" FROM responses WHERE event_id = $1", [row.id]
  );
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    date: row.date,
    candidateDates: row.candidate_dates || [],
    attendance: attResult.rows,
    responses: resResult.rows,
  };
}

// GET /api/events
router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM events ORDER BY id DESC");
    const events = [];
    for (const row of result.rows) {
      events.push(await buildEvent(row));
    }
    res.json(events);
  } catch (err) {
    console.error("イベント取得エラー:", err.message);
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
});

// POST /api/events
router.post("/", auth, validateEvent, async (req, res) => {
  try {
    const event = {
      id: Date.now(),
      title: req.body.title,
      type: "meeting",
      date: req.body.date,
      candidateDates: req.body.candidateDates || [],
    };

    await pool.query(
      "INSERT INTO events (id, title, type, date, candidate_dates) VALUES ($1, $2, $3, $4, $5)",
      [event.id, event.title, event.type, event.date, JSON.stringify(event.candidateDates)]
    );

    res.status(201).json({ ...event, attendance: [], responses: [] });
  } catch (err) {
    console.error("イベント作成エラー:", err.message);
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
});

// DELETE /api/events/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await pool.query("DELETE FROM events WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "イベントが見つかりません" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("イベント削除エラー:", err.message);
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
});

// POST /api/events/:id/attendance
router.post("/:id/attendance", auth, validateAttendance, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { memberId, status } = req.body;

    const ev = await pool.query("SELECT * FROM events WHERE id = $1", [id]);
    if (ev.rows.length === 0) {
      return res.status(404).json({ error: "イベントが見つかりません" });
    }

    if (status === "none") {
      await pool.query("DELETE FROM attendance WHERE event_id = $1 AND member_id = $2", [id, memberId]);
    } else {
      await pool.query(
        `INSERT INTO attendance (event_id, member_id, status) VALUES ($1, $2, $3)
         ON CONFLICT (event_id, member_id) DO UPDATE SET status = $3`,
        [id, memberId, status]
      );
    }

    const updated = await buildEvent(ev.rows[0]);
    res.json(updated);
  } catch (err) {
    console.error("出席記録エラー:", err.message);
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
});

// POST /api/events/:id/responses
router.post("/:id/responses", auth, validateScheduleResponse, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { memberId, availableDates } = req.body;

    const ev = await pool.query("SELECT * FROM events WHERE id = $1", [id]);
    if (ev.rows.length === 0) {
      return res.status(404).json({ error: "イベントが見つかりません" });
    }

    await pool.query(
      `INSERT INTO responses (event_id, member_id, available_dates) VALUES ($1, $2, $3)
       ON CONFLICT (event_id, member_id) DO UPDATE SET available_dates = $3`,
      [id, memberId, JSON.stringify(availableDates)]
    );

    const updated = await buildEvent(ev.rows[0]);
    res.json(updated);
  } catch (err) {
    console.error("日程回答エラー:", err.message);
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
});

// GET /api/stats
router.get("/stats", auth, async (req, res) => {
  try {
    const members = await pool.query("SELECT id FROM members");
    const memberStats = [];

    for (const m of members.rows) {
      const stats = await pool.query(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present
         FROM attendance WHERE member_id = $1`,
        [m.id]
      );
      const total = parseInt(stats.rows[0].total) || 0;
      const present = parseInt(stats.rows[0].present) || 0;
      memberStats.push({
        memberId: m.id,
        total,
        present,
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
      });
    }

    res.json({ memberStats });
  } catch (err) {
    console.error("統計取得エラー:", err.message);
    res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
});

module.exports = router;
