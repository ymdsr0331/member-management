// ========== イベントAPIルート ==========
const express = require("express");
const fs = require("fs");
const path = require("path");
const auth = require("../middleware/auth");
const { validateEvent, validateAttendance, validateScheduleResponse } = require("../middleware/validate");
const router = express.Router();

const EVENTS_FILE = path.join(__dirname, "../data/events.json");
const MEMBERS_FILE = path.join(__dirname, "../data/members.json");

function loadEvents() {
  if (!fs.existsSync(EVENTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(EVENTS_FILE, "utf8"));
}

function saveEvents(events) {
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), "utf8");
}

function loadMembers() {
  if (!fs.existsSync(MEMBERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(MEMBERS_FILE, "utf8"));
}

// GET /api/events
router.get("/", auth, (req, res) => {
  res.json(loadEvents());
});

// POST /api/events
router.post("/", auth, validateEvent, (req, res) => {
  const events = loadEvents();
  const event = {
    id: Date.now(),
    title: req.body.title,
    type: "meeting",
    date: req.body.date,
    candidateDates: req.body.candidateDates || [],
    attendance: [],
    responses: [],
  };
  events.unshift(event);
  saveEvents(events);
  res.status(201).json(event);
});

// DELETE /api/events/:id
router.delete("/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const events = loadEvents();
  const filtered = events.filter((e) => e.id !== id);
  if (filtered.length === events.length) {
    return res.status(404).json({ error: "イベントが見つかりません" });
  }
  saveEvents(filtered);
  res.json({ success: true });
});

// POST /api/events/:id/attendance
router.post("/:id/attendance", auth, validateAttendance, (req, res) => {
  const id = Number(req.params.id);
  const { memberId, status } = req.body;
  const events = loadEvents();
  const ev = events.find((e) => e.id === id);
  if (!ev) return res.status(404).json({ error: "イベントが見つかりません" });

  if (!ev.attendance) ev.attendance = [];

  if (status === "none") {
    ev.attendance = ev.attendance.filter((a) => a.memberId !== memberId);
  } else {
    const existing = ev.attendance.find((a) => a.memberId === memberId);
    if (existing) {
      existing.status = status;
    } else {
      ev.attendance.push({ memberId, status });
    }
  }

  saveEvents(events);
  res.json(ev);
});

// POST /api/events/:id/responses
router.post("/:id/responses", auth, validateScheduleResponse, (req, res) => {
  const id = Number(req.params.id);
  const { memberId, availableDates } = req.body;
  const events = loadEvents();
  const ev = events.find((e) => e.id === id);
  if (!ev) return res.status(404).json({ error: "イベントが見つかりません" });

  if (!ev.responses) ev.responses = [];

  const existing = ev.responses.find((r) => r.memberId === memberId);
  if (existing) {
    existing.availableDates = availableDates;
  } else {
    ev.responses.push({ memberId, availableDates });
  }

  saveEvents(events);
  res.json(ev);
});

// GET /api/stats
router.get("/stats", auth, (req, res) => {
  const events = loadEvents();
  const members = loadMembers();

  // 出席統計
  const memberStats = members.map((m) => {
    let total = 0;
    let present = 0;
    events.forEach((ev) => {
      if (!ev.attendance) return;
      const record = ev.attendance.find((a) => a.memberId === m.id);
      if (record) {
        total++;
        if (record.status === "present") present++;
      }
    });
    return {
      memberId: m.id,
      total,
      present,
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  });

  res.json({ memberStats });
});

module.exports = router;
