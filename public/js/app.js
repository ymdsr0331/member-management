// ========== アプリケーション本体 ==========

document.addEventListener("DOMContentLoaded", async () => {
  // 認証チェック
  if (!API.isLoggedIn() || !(await API.verifyToken())) {
    showLogin();
    return;
  }
  showApp();
});

// ========== イベントバインド ==========
function bindStaticEvents() {
  // ログイン
  document.getElementById("btn-login").addEventListener("click", handleLogin);
  document.getElementById("login-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
  });

  // ヘッダー
  document.getElementById("btn-demo").addEventListener("click", loadDemo);
  document.getElementById("btn-logout").addEventListener("click", handleLogout);

  // メンバー・イベント作成ボタン
  document.getElementById("btn-add-member").addEventListener("click", () => openMemberModal());
  document.getElementById("btn-create-event").addEventListener("click", openEventModal);

  // モーダル保存ボタン
  document.getElementById("btn-save-member").addEventListener("click", saveMember);
  document.getElementById("btn-save-event").addEventListener("click", saveEvent);
  document.getElementById("btn-save-responses").addEventListener("click", saveScheduleResponses);
  document.getElementById("btn-add-candidate").addEventListener("click", addCandidateDate);

  // モーダル閉じる（data-close属性）
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById(btn.dataset.close).classList.remove("open");
    });
  });

  // モーダルオーバーレイクリックで閉じる
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("open");
    });
  });

  // 動的要素のイベント委譲
  document.getElementById("members-list").addEventListener("click", handleMembersListClick);
  document.getElementById("schedule-list").addEventListener("click", handleScheduleListClick);
  document.getElementById("attendance-list").addEventListener("change", handleAttendanceChange);
}

// ログインボタンだけは即座にバインド（showApp前に必要）
document.getElementById("btn-login").addEventListener("click", handleLogin);
document.getElementById("login-password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLogin();
});

// ========== 動的要素のイベント委譲ハンドラ ==========
function handleMembersListClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === "edit") editMember(id);
  if (btn.dataset.action === "delete") deleteMember(id);
}

function handleScheduleListClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === "respond") openScheduleResponse(id);
  if (btn.dataset.action === "delete-event") deleteEvent(id);
}

function handleAttendanceChange(e) {
  const select = e.target.closest(".attendance-select");
  if (!select) return;
  onAttendanceChange(select);
}

// ========== 認証画面 ==========
function showLogin() {
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("app-main").style.display = "none";
}

function showApp() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app-main").style.display = "block";
  bindStaticEvents();
  initTabs();
  renderDashboard();
}

async function handleLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = "";

  if (!username || !password) {
    errorEl.textContent = "ユーザー名とパスワードを入力してください";
    return;
  }

  try {
    await API.login(username, password);
    showApp();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

function handleLogout() {
  if (confirm("ログアウトしますか？")) {
    API.logout();
  }
}

// ========== タブ切り替え ==========
function initTabs() {
  const btns = document.querySelectorAll(".tab-btn");
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      btns.forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      target.classList.add("active");

      const renderers = {
        "tab-dashboard": renderDashboard,
        "tab-schedule": renderSchedule,
        "tab-attendance": renderAttendance,
        "tab-members": renderMembers,
      };
      if (renderers[btn.dataset.tab]) renderers[btn.dataset.tab]();
    });
  });
}

// ========== ダッシュボード ==========
async function renderDashboard() {
  try {
    const [members, events] = await Promise.all([API.getMembers(), API.getEvents()]);
    if (!members || !events) return;

    document.getElementById("stat-members").textContent = members.length;
    document.getElementById("stat-events").textContent = events.length;

    let totalRecords = 0;
    let totalPresent = 0;
    events.forEach((ev) => {
      (ev.attendance || []).forEach((a) => {
        totalRecords++;
        if (a.status === "present") totalPresent++;
      });
    });
    const overallRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
    document.getElementById("stat-rate").textContent = overallRate + "%";

    const upcoming = events.find((ev) => new Date(ev.date) >= new Date(new Date().toDateString()));
    document.getElementById("stat-next").textContent = upcoming ? upcoming.title : "なし";

    renderRanking(members, events);
  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

function renderRanking(members, events) {
  const container = document.getElementById("ranking-list");

  const ranking = members
    .map((m) => {
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
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return { ...m, total, present, rate };
    })
    .sort((a, b) => b.present - a.present || b.rate - a.rate);

  if (ranking.length === 0 || ranking.every((r) => r.total === 0)) {
    container.innerHTML = '<div class="empty-state"><p>まだ出席データがありません</p></div>';
    return;
  }

  container.innerHTML = ranking
    .filter((m) => m.total > 0)
    .map((m, i) => {
      const rankClass = i < 3 ? `rank-${i + 1}` : "rank-other";
      return `
      <div class="ranking-item">
        <div class="rank-num ${rankClass}">${i + 1}</div>
        <div class="rank-info">
          <div class="rank-name">${esc(m.name)}</div>
          <div class="rank-detail">出席 ${m.present}/${m.total}回（${m.rate}%）</div>
        </div>
        <div class="rate-bar">
          <div class="rate-track">
            <div class="rate-fill" style="width:${m.rate}%;background:${rateColor(m.rate)}"></div>
          </div>
          <span class="rate-text" style="color:${rateColor(m.rate)}">${m.rate}%</span>
        </div>
      </div>`;
    })
    .join("");
}

// ========== メンバー管理 ==========
async function renderMembers() {
  try {
    const members = await API.getMembers();
    const events = await API.getEvents();
    const container = document.getElementById("members-list");

    if (!members || members.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>メンバーが登録されていません</p><p>「メンバー追加」から登録してください</p></div>';
      return;
    }

    const rows = members
      .map((m) => {
        let total = 0, present = 0;
        events.forEach((ev) => {
          if (!ev.attendance) return;
          const record = ev.attendance.find((a) => a.memberId === m.id);
          if (record) { total++; if (record.status === "present") present++; }
        });
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;
        return `
        <tr>
          <td><strong>${esc(m.name)}</strong></td>
          <td>${m.role ? `<span class="badge badge-role">${esc(m.role)}</span>` : "-"}</td>
          <td>${esc(m.year || "-")}</td>
          <td>${esc(m.note || "-")}</td>
          <td>
            <div class="rate-bar">
              <div class="rate-track">
                <div class="rate-fill" style="width:${rate}%;background:${rateColor(rate)}"></div>
              </div>
              <span class="rate-text" style="color:${rateColor(rate)}">${rate}%</span>
            </div>
          </td>
          <td>
            <div class="btn-group">
              <button class="btn btn-sm btn-outline" data-action="edit" data-id="${m.id}">編集</button>
              <button class="btn btn-sm btn-danger" data-action="delete" data-id="${m.id}">削除</button>
            </div>
          </td>
        </tr>`;
      })
      .join("");

    container.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>名前</th><th>役職</th><th>学年</th><th>備考</th><th>出席率</th><th>操作</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (err) {
    console.error("Members error:", err);
  }
}

function openMemberModal(member) {
  document.getElementById("modal-member-title").textContent = member ? "メンバー編集" : "メンバー追加";
  document.getElementById("member-id").value = member ? member.id : "";
  document.getElementById("member-name").value = member ? member.name : "";
  document.getElementById("member-role").value = member ? member.role || "" : "";
  document.getElementById("member-year").value = member ? member.year || "" : "";
  document.getElementById("member-note").value = member ? member.note || "" : "";
  document.getElementById("modal-member").classList.add("open");
}

async function saveMember() {
  const name = document.getElementById("member-name").value.trim();
  if (!name) { alert("名前を入力してください"); return; }

  const data = {
    name,
    role: document.getElementById("member-role").value.trim(),
    year: document.getElementById("member-year").value,
    note: document.getElementById("member-note").value.trim(),
  };

  try {
    const id = document.getElementById("member-id").value;
    if (id) {
      await API.updateMember(Number(id), data);
    } else {
      await API.addMember(data);
    }
    document.getElementById("modal-member").classList.remove("open");
    renderMembers();
  } catch (err) {
    alert(err.message);
  }
}

async function editMember(id) {
  try {
    const members = await API.getMembers();
    const member = members.find((m) => m.id === id);
    if (member) openMemberModal(member);
  } catch (err) {
    alert(err.message);
  }
}

async function deleteMember(id) {
  try {
    const members = await API.getMembers();
    const member = members.find((m) => m.id === id);
    if (!member) return;
    if (!confirm(`${member.name} を削除しますか？\n関連する出席データも削除されます。`)) return;
    await API.deleteMember(id);
    renderMembers();
  } catch (err) {
    alert(err.message);
  }
}

// ========== イベント・日程調整 ==========
let tempCandidateDates = [];

async function renderSchedule() {
  try {
    const events = await API.getEvents();
    const container = document.getElementById("schedule-list");

    if (!events || events.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>イベントがありません</p><p>「イベント作成」から追加してください</p></div>';
      return;
    }

    const members = await API.getMembers();

    container.innerHTML = events
      .map((ev) => {
        const hasCandidates = ev.candidateDates && ev.candidateDates.length > 0;
        return `
        <div class="card">
          <div class="card-header">
            <h2>${esc(ev.title)}</h2>
            <div class="btn-group">
              ${hasCandidates ? `<button class="btn btn-sm btn-primary" data-action="respond" data-id="${ev.id}">回答する</button>` : ""}
              <button class="btn btn-sm btn-danger" data-action="delete-event" data-id="${ev.id}">削除</button>
            </div>
          </div>
          <p style="color:var(--text-light);font-size:0.9rem;margin-bottom:12px;">
            開催日: ${formatDate(ev.date)}
            ${hasCandidates ? " | 候補日: " + ev.candidateDates.length + "件" : ""}
          </p>
          ${hasCandidates ? renderScheduleTable(ev, members) : '<p style="color:var(--text-light);font-size:0.88rem;">候補日なし（出席管理タブで出欠を記録できます）</p>'}
        </div>`;
      })
      .join("");
  } catch (err) {
    console.error("Schedule error:", err);
  }
}

function renderScheduleTable(event, members) {
  if (!members || members.length === 0) return '<p style="color:var(--text-light)">メンバーを先に登録してください</p>';

  const dates = event.candidateDates;
  const responses = event.responses || [];

  const dateCounts = dates.map((d) => responses.filter((r) => r.availableDates.includes(d)).length);
  const maxCount = Math.max(...dateCounts, 0);

  const headerCells = dates
    .map((d, i) => {
      const isMax = dateCounts[i] === maxCount && maxCount > 0;
      return `<th style="${isMax ? "background:#e8f5e9;color:var(--success);" : ""}">
        ${formatDateShort(d)}<div class="date-count"><strong>${dateCounts[i]}</strong>/${members.length}人</div>
      </th>`;
    })
    .join("");

  const rows = members
    .map((m) => {
      const resp = responses.find((r) => r.memberId === m.id);
      const available = resp ? resp.availableDates : [];
      const cells = dates
        .map((d) => {
          const checked = available.includes(d);
          return `<td style="text-align:center">${checked ? '<span style="color:var(--success);font-size:1.2rem;font-weight:700">&#9675;</span>' : '<span style="color:#ccc">&#10005;</span>'}</td>`;
        })
        .join("");
      return `<tr><td class="name-col">${esc(m.name)}</td>${cells}</tr>`;
    })
    .join("");

  return `
    <div class="table-wrapper">
      <table class="schedule-table">
        <thead><tr><th class="name-col">メンバー</th>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function openEventModal() {
  tempCandidateDates = [];
  document.getElementById("event-title").value = "";
  document.getElementById("event-date").value = "";
  renderCandidateTags();
  document.getElementById("modal-event").classList.add("open");
}

function addCandidateDate() {
  const input = document.getElementById("candidate-date");
  const date = input.value;
  if (!date) return;
  if (tempCandidateDates.includes(date)) { input.value = ""; return; }
  tempCandidateDates.push(date);
  tempCandidateDates.sort();
  input.value = "";
  renderCandidateTags();
}

function renderCandidateTags() {
  const container = document.getElementById("candidate-tags");
  container.innerHTML = tempCandidateDates
    .map((d) => `<span class="date-tag">${formatDateShort(d)}<button class="candidate-remove" data-date="${d}">&times;</button></span>`)
    .join("");

  // 候補日削除ボタンのバインド
  container.querySelectorAll(".candidate-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      tempCandidateDates = tempCandidateDates.filter((dd) => dd !== btn.dataset.date);
      renderCandidateTags();
    });
  });
}

async function saveEvent() {
  const title = document.getElementById("event-title").value.trim();
  const date = document.getElementById("event-date").value;
  if (!title || !date) { alert("タイトルと開催日を入力してください"); return; }

  try {
    await API.addEvent({
      title,
      date,
      type: "meeting",
      candidateDates: [...tempCandidateDates],
    });
    document.getElementById("modal-event").classList.remove("open");
    renderSchedule();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteEvent(id) {
  if (!confirm("このイベントを削除しますか？")) return;
  try {
    await API.deleteEvent(id);
    renderSchedule();
  } catch (err) {
    alert(err.message);
  }
}

// --- 日程回答モーダル ---
let currentScheduleEventId = null;

async function openScheduleResponse(eventId) {
  currentScheduleEventId = eventId;
  try {
    const [events, members] = await Promise.all([API.getEvents(), API.getMembers()]);
    const event = events.find((e) => e.id === eventId);
    if (!event || !members || members.length === 0) return;

    document.getElementById("response-event-title").textContent = event.title;

    const container = document.getElementById("response-form");
    container.innerHTML = members
      .map((m) => {
        const resp = (event.responses || []).find((r) => r.memberId === m.id);
        const available = resp ? resp.availableDates : [];
        const checks = event.candidateDates
          .map((d) => `
            <label style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:0.88rem;">
              <input type="checkbox" class="schedule-check" data-member="${m.id}" data-date="${d}" ${available.includes(d) ? "checked" : ""}>
              ${formatDateShort(d)}
            </label>`)
          .join("");
        return `<div style="margin-bottom:12px;padding:8px 0;border-bottom:1px solid var(--border);">
          <strong>${esc(m.name)}</strong><br>${checks}
        </div>`;
      })
      .join("");

    document.getElementById("modal-response").classList.add("open");
  } catch (err) {
    alert(err.message);
  }
}

async function saveScheduleResponses() {
  if (!currentScheduleEventId) return;
  const checks = document.querySelectorAll("#response-form .schedule-check");
  const memberDates = {};

  checks.forEach((cb) => {
    const mId = Number(cb.dataset.member);
    const date = cb.dataset.date;
    if (!memberDates[mId]) memberDates[mId] = [];
    if (cb.checked) memberDates[mId].push(date);
  });

  try {
    for (const [mId, dates] of Object.entries(memberDates)) {
      await API.setScheduleResponse(currentScheduleEventId, Number(mId), dates);
    }
    document.getElementById("modal-response").classList.remove("open");
    renderSchedule();
  } catch (err) {
    alert(err.message);
  }
}

// ========== 出席管理 ==========
async function renderAttendance() {
  try {
    const [events, members] = await Promise.all([API.getEvents(), API.getMembers()]);
    const container = document.getElementById("attendance-list");

    if (!events || events.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>イベントがありません</p></div>';
      return;
    }

    if (!members || members.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>メンバーを先に登録してください</p></div>';
      return;
    }

    container.innerHTML = events
      .map((ev) => {
        const attendance = ev.attendance || [];
        const presentCount = attendance.filter((a) => a.status === "present").length;
        const rows = members
          .map((m) => {
            const record = attendance.find((a) => a.memberId === m.id);
            const status = record ? record.status : "none";
            return `
            <tr>
              <td><strong>${esc(m.name)}</strong></td>
              <td>
                <select class="attendance-select" data-event="${ev.id}" data-member="${m.id}">
                  <option value="none" ${status === "none" ? "selected" : ""}>未記録</option>
                  <option value="present" ${status === "present" ? "selected" : ""}>出席</option>
                  <option value="absent" ${status === "absent" ? "selected" : ""}>欠席</option>
                </select>
              </td>
              <td>
                ${status === "present" ? '<span class="badge badge-present">出席</span>' : ""}
                ${status === "absent" ? '<span class="badge badge-absent">欠席</span>' : ""}
                ${status === "none" ? '<span style="color:#aaa">-</span>' : ""}
              </td>
            </tr>`;
          })
          .join("");

        return `
        <div class="card">
          <div class="card-header">
            <h2>${esc(ev.title)}</h2>
            <span style="color:var(--text-light);font-size:0.88rem;">${formatDate(ev.date)} | 出席: ${presentCount}/${members.length}人</span>
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>名前</th><th>記録</th><th>状態</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
      })
      .join("");
  } catch (err) {
    console.error("Attendance error:", err);
  }
}

async function onAttendanceChange(select) {
  const eventId = Number(select.dataset.event);
  const memberId = Number(select.dataset.member);
  const status = select.value;

  try {
    await API.setAttendance(eventId, memberId, status);
    renderAttendance();
  } catch (err) {
    alert(err.message);
  }
}

// ========== デモデータ ==========
async function loadDemo() {
  try {
    const members = await API.getMembers();
    if (members && members.length > 0) {
      if (!confirm("既存データを上書きしますか？")) return;
    }
    await API.loadDemoData();
    renderDashboard();
    alert("デモデータを読み込みました");
  } catch (err) {
    alert(err.message);
  }
}

// ========== ユーティリティ ==========
function esc(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

function rateColor(rate) {
  if (rate >= 80) return "var(--success)";
  if (rate >= 50) return "var(--warning)";
  return "var(--danger)";
}
