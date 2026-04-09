// ========== データ管理層 ==========
// localStorageでデータを永続化

const DB = {
  _get(key) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  },
  _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  // --- メンバー ---
  getMembers() {
    return this._get("bibe_members") || [];
  },
  saveMembers(members) {
    this._set("bibe_members", members);
  },
  addMember(member) {
    const members = this.getMembers();
    member.id = Date.now();
    members.push(member);
    this.saveMembers(members);
    return member;
  },
  updateMember(id, updates) {
    const members = this.getMembers();
    const idx = members.findIndex((m) => m.id === id);
    if (idx !== -1) {
      Object.assign(members[idx], updates);
      this.saveMembers(members);
    }
  },
  deleteMember(id) {
    this.saveMembers(this.getMembers().filter((m) => m.id !== id));
    // 関連する出席・日程回答も削除
    const events = this.getEvents();
    events.forEach((ev) => {
      ev.attendance = (ev.attendance || []).filter((a) => a.memberId !== id);
      ev.responses = (ev.responses || []).filter((r) => r.memberId !== id);
    });
    this.saveEvents(events);
  },

  // --- イベント ---
  getEvents() {
    return this._get("bibe_events") || [];
  },
  saveEvents(events) {
    this._set("bibe_events", events);
  },
  addEvent(event) {
    const events = this.getEvents();
    event.id = Date.now();
    event.attendance = [];
    event.responses = [];
    events.unshift(event);
    this.saveEvents(events);
    return event;
  },
  updateEvent(id, updates) {
    const events = this.getEvents();
    const idx = events.findIndex((e) => e.id === id);
    if (idx !== -1) {
      Object.assign(events[idx], updates);
      this.saveEvents(events);
    }
  },
  deleteEvent(id) {
    this.saveEvents(this.getEvents().filter((e) => e.id !== id));
  },

  // --- 出席 ---
  setAttendance(eventId, memberId, status) {
    const events = this.getEvents();
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    if (!ev.attendance) ev.attendance = [];
    const existing = ev.attendance.find((a) => a.memberId === memberId);
    if (existing) {
      existing.status = status;
    } else {
      ev.attendance.push({ memberId, status });
    }
    this.saveEvents(events);
  },

  // --- 日程回答 ---
  setScheduleResponse(eventId, memberId, availableDates) {
    const events = this.getEvents();
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    if (!ev.responses) ev.responses = [];
    const existing = ev.responses.find((r) => r.memberId === memberId);
    if (existing) {
      existing.availableDates = availableDates;
    } else {
      ev.responses.push({ memberId, availableDates });
    }
    this.saveEvents(events);
  },

  // --- 統計 ---
  getMemberAttendanceStats(memberId) {
    const events = this.getEvents();
    let total = 0;
    let present = 0;
    events.forEach((ev) => {
      if (!ev.attendance) return;
      const record = ev.attendance.find((a) => a.memberId === memberId);
      if (record) {
        total++;
        if (record.status === "present") present++;
      }
    });
    return { total, present, rate: total > 0 ? Math.round((present / total) * 100) : 0 };
  },

  getAttendanceRanking() {
    const members = this.getMembers();
    return members
      .map((m) => {
        const stats = this.getMemberAttendanceStats(m.id);
        return { ...m, ...stats };
      })
      .sort((a, b) => b.present - a.present || b.rate - a.rate);
  },

  // --- デモデータ ---
  loadDemoData() {
    if (this.getMembers().length > 0) return false;

    const now = Date.now();
    const members = [
      { id: now + 1, name: "田中 太郎", role: "代表", year: "3年", note: "経済学部" },
      { id: now + 2, name: "鈴木 花子", role: "副代表", year: "3年", note: "文学部" },
      { id: now + 3, name: "佐藤 健", role: "会計", year: "2年", note: "工学部" },
      { id: now + 4, name: "山田 美咲", role: "広報", year: "2年", note: "教育学部" },
      { id: now + 5, name: "中村 翔太", role: "", year: "1年", note: "理学部" },
      { id: now + 6, name: "小林 愛", role: "", year: "1年", note: "法学部" },
    ];
    this.saveMembers(members);

    const events = [
      {
        id: now + 100,
        title: "4月 定例ミーティング",
        type: "meeting",
        date: "2026-04-10",
        candidateDates: ["2026-04-10", "2026-04-12", "2026-04-14"],
        attendance: [
          { memberId: now + 1, status: "present" },
          { memberId: now + 2, status: "present" },
          { memberId: now + 3, status: "present" },
          { memberId: now + 4, status: "absent" },
          { memberId: now + 5, status: "present" },
          { memberId: now + 6, status: "present" },
        ],
        responses: [
          { memberId: now + 1, availableDates: ["2026-04-10", "2026-04-14"] },
          { memberId: now + 2, availableDates: ["2026-04-10", "2026-04-12"] },
          { memberId: now + 3, availableDates: ["2026-04-10", "2026-04-12", "2026-04-14"] },
          { memberId: now + 4, availableDates: ["2026-04-12"] },
          { memberId: now + 5, availableDates: ["2026-04-10", "2026-04-14"] },
          { memberId: now + 6, availableDates: ["2026-04-10"] },
        ],
      },
      {
        id: now + 101,
        title: "新歓イベント打ち合わせ",
        type: "meeting",
        date: "2026-03-25",
        candidateDates: [],
        attendance: [
          { memberId: now + 1, status: "present" },
          { memberId: now + 2, status: "present" },
          { memberId: now + 3, status: "absent" },
          { memberId: now + 4, status: "present" },
          { memberId: now + 5, status: "present" },
          { memberId: now + 6, status: "absent" },
        ],
        responses: [],
      },
      {
        id: now + 102,
        title: "3月 定例ミーティング",
        type: "meeting",
        date: "2026-03-10",
        candidateDates: [],
        attendance: [
          { memberId: now + 1, status: "present" },
          { memberId: now + 2, status: "absent" },
          { memberId: now + 3, status: "present" },
          { memberId: now + 4, status: "present" },
          { memberId: now + 5, status: "absent" },
          { memberId: now + 6, status: "present" },
        ],
        responses: [],
      },
    ];
    this.saveEvents(events);
    return true;
  },
};
