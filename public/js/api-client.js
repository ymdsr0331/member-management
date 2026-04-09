// ========== APIクライアント（localStorageの代替） ==========
const API = {
  _token: sessionStorage.getItem("bibe_token") || null,

  _headers() {
    const h = { "Content-Type": "application/json" };
    if (this._token) h["Authorization"] = "Bearer " + this._token;
    return h;
  },

  async _fetch(url, options = {}) {
    options.headers = this._headers();
    const res = await fetch(url, options);
    if (res.status === 401) {
      this.logout();
      return null;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "エラーが発生しました" }));
      throw new Error(err.error || "エラーが発生しました");
    }
    return res.json();
  },

  // --- 認証 ---
  isLoggedIn() {
    return !!this._token;
  },

  async login(username, password) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    this._token = data.token;
    sessionStorage.setItem("bibe_token", data.token);
    return data.user;
  },

  logout() {
    this._token = null;
    sessionStorage.removeItem("bibe_token");
    location.reload();
  },

  async verifyToken() {
    if (!this._token) return false;
    try {
      await this._fetch("/api/auth/me");
      return true;
    } catch {
      this._token = null;
      sessionStorage.removeItem("bibe_token");
      return false;
    }
  },

  // --- メンバー ---
  async getMembers() {
    return (await this._fetch("/api/members")) || [];
  },

  async addMember(data) {
    return this._fetch("/api/members", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateMember(id, data) {
    return this._fetch("/api/members/" + id, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteMember(id) {
    return this._fetch("/api/members/" + id, { method: "DELETE" });
  },

  // --- イベント ---
  async getEvents() {
    return (await this._fetch("/api/events")) || [];
  },

  async addEvent(data) {
    return this._fetch("/api/events", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteEvent(id) {
    return this._fetch("/api/events/" + id, { method: "DELETE" });
  },

  // --- 出席 ---
  async setAttendance(eventId, memberId, status) {
    return this._fetch("/api/events/" + eventId + "/attendance", {
      method: "POST",
      body: JSON.stringify({ memberId, status }),
    });
  },

  // --- 日程回答 ---
  async setScheduleResponse(eventId, memberId, availableDates) {
    return this._fetch("/api/events/" + eventId + "/responses", {
      method: "POST",
      body: JSON.stringify({ memberId, availableDates }),
    });
  },

  // --- 統計 ---
  async getStats() {
    return this._fetch("/api/events/stats");
  },

  // --- デモ ---
  async loadDemoData() {
    return this._fetch("/api/events/demo", { method: "POST" });
  },
};
