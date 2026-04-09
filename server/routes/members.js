// ========== メンバーAPIルート ==========
const express = require("express");
const fs = require("fs");
const path = require("path");
const auth = require("../middleware/auth");
const { validateMember } = require("../middleware/validate");
const { encryptMember, decryptMember } = require("../crypto");
const router = express.Router();

const MEMBERS_FILE = path.join(__dirname, "../data/members.json");
const EVENTS_FILE = path.join(__dirname, "../data/events.json");

function loadMembers() {
  if (!fs.existsSync(MEMBERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(MEMBERS_FILE, "utf8"));
}

function saveMembers(members) {
  fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2), "utf8");
}

function loadEvents() {
  if (!fs.existsSync(EVENTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(EVENTS_FILE, "utf8"));
}

function saveEvents(events) {
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), "utf8");
}

// GET /api/members
router.get("/", auth, (req, res) => {
  const members = loadMembers().map(decryptMember);
  res.json(members);
});

// POST /api/members
router.post("/", auth, validateMember, (req, res) => {
  const members = loadMembers();
  const member = {
    id: Date.now(),
    name: req.body.name,
    role: req.body.role || "",
    year: req.body.year || "",
    note: req.body.note || "",
  };
  members.push(encryptMember(member));
  saveMembers(members);
  res.status(201).json(member);
});

// PUT /api/members/:id
router.put("/:id", auth, validateMember, (req, res) => {
  const members = loadMembers();
  const id = Number(req.params.id);
  const idx = members.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: "メンバーが見つかりません" });

  const updated = {
    ...members[idx],
    name: req.body.name,
    role: req.body.role || "",
    year: req.body.year || "",
    note: req.body.note || "",
  };
  members[idx] = encryptMember({ ...updated, id });
  saveMembers(members);
  res.json(decryptMember(members[idx]));
});

// DELETE /api/members/:id
router.delete("/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const members = loadMembers();
  const filtered = members.filter((m) => m.id !== id);
  if (filtered.length === members.length) {
    return res.status(404).json({ error: "メンバーが見つかりません" });
  }
  saveMembers(filtered);

  // 関連する出席・日程回答も削除
  const events = loadEvents();
  events.forEach((ev) => {
    ev.attendance = (ev.attendance || []).filter((a) => a.memberId !== id);
    ev.responses = (ev.responses || []).filter((r) => r.memberId !== id);
  });
  saveEvents(events);

  res.json({ success: true });
});

module.exports = router;
