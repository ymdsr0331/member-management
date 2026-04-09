// ========== アプリケーション本体 ==========

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  renderDashboard();
});

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

      // タブ切り替え時にコンテンツを再描画
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
function renderDashboard() {
  const members = DB.getMembers();
  const events = DB.getEvents();

  document.getElementById("stat-members").textContent = members.length;
  document.getElementById("stat-events").textContent = events.length;

  // 全体出席率
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

  // 次回イベント
  const upcoming = events.find((ev) => new Date(ev.date) >= new Date(new Date().toDateString()));
  document.getElementById("stat-next").textContent = upcoming ? upcoming.title : "なし";

  // ランキング
  renderRanking();
}

function renderRanking() {
  const container = document.getElementById("ranking-list");
  const ranking = DB.getAttendanceRanking();

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
function renderMembers() {
  const members = DB.getMembers();
  const container = document.getElementById("members-list");

  if (members.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>メンバーが登録されていません</p><p>「メンバー追加」から登録してください</p></div>';
    return;
  }

  const rows = members
    .map((m) => {
      const stats = DB.getMemberAttendanceStats(m.id);
      return `
      <tr>
        <td><strong>${esc(m.name)}</strong></td>
        <td>${m.role ? `<span class="badge badge-role">${esc(m.role)}</span>` : "-"}</td>
        <td>${esc(m.year || "-")}</td>
        <td>${esc(m.note || "-")}</td>
        <td>
          <div class="rate-bar">
            <div class="rate-track">
              <div class="rate-fill" style="width:${stats.rate}%;background:${rateColor(stats.rate)}"></div>
            </div>
            <span class="rate-text" style="color:${rateColor(stats.rate)}">${stats.rate}%</span>
          </div>
        </td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline" onclick="editMember(${m.id})">編集</button>
            <button class="btn btn-sm btn-danger" onclick="deleteMember(${m.id})">削除</button>
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

function closeMemberModal() {
  document.getElementById("modal-member").classList.remove("open");
}

function saveMember() {
  const name = document.getElementById("member-name").value.trim();
  if (!name) { alert("名前を入力してください"); return; }

  const data = {
    name,
    role: document.getElementById("member-role").value.trim(),
    year: document.getElementById("member-year").value,
    note: document.getElementById("member-note").value.trim(),
  };

  const id = document.getElementById("member-id").value;
  if (id) {
    DB.updateMember(Number(id), data);
  } else {
    DB.addMember(data);
  }
  closeMemberModal();
  renderMembers();
}

function editMember(id) {
  const member = DB.getMembers().find((m) => m.id === id);
  if (member) openMemberModal(member);
}

function deleteMember(id) {
  const member = DB.getMembers().find((m) => m.id === id);
  if (!member) return;
  if (!confirm(`${member.name} を削除しますか？\n関連する出席データも削除されます。`)) return;
  DB.deleteMember(id);
  renderMembers();
}

// ========== イベント・日程調整 ==========
let tempCandidateDates = [];

function renderSchedule() {
  const events = DB.getEvents();
  const container = document.getElementById("schedule-list");

  if (events.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>イベントがありません</p><p>「イベント作成」から追加してください</p></div>';
    return;
  }

  container.innerHTML = events
    .map((ev) => {
      const hasCandidates = ev.candidateDates && ev.candidateDates.length > 0;
      return `
      <div class="card">
        <div class="card-header">
          <h2>${esc(ev.title)}</h2>
          <div class="btn-group">
            ${hasCandidates ? `<button class="btn btn-sm btn-primary" onclick="openScheduleResponse(${ev.id})">回答する</button>` : ""}
            <button class="btn btn-sm btn-danger" onclick="deleteEvent(${ev.id})">削除</button>
          </div>
        </div>
        <p style="color:var(--text-light);font-size:0.9rem;margin-bottom:12px;">
          開催日: ${formatDate(ev.date)}
          ${hasCandidates ? " | 候補日: " + ev.candidateDates.length + "件" : ""}
        </p>
        ${hasCandidates ? renderScheduleTable(ev) : '<p style="color:var(--text-light);font-size:0.88rem;">候補日なし（出席管理タブで出欠を記録できます）</p>'}
      </div>`;
    })
    .join("");
}

function renderScheduleTable(event) {
  const members = DB.getMembers();
  if (members.length === 0) return '<p style="color:var(--text-light)">メンバーを先に登録してください</p>';

  const dates = event.candidateDates;
  const responses = event.responses || [];

  // 各日付の参加可能人数を集計
  const dateCounts = dates.map((d) => {
    return responses.filter((r) => r.availableDates.includes(d)).length;
  });
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

function closeEventModal() {
  document.getElementById("modal-event").classList.remove("open");
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

function removeCandidateDate(date) {
  tempCandidateDates = tempCandidateDates.filter((d) => d !== date);
  renderCandidateTags();
}

function renderCandidateTags() {
  const container = document.getElementById("candidate-tags");
  container.innerHTML = tempCandidateDates
    .map((d) => `<span class="date-tag">${formatDateShort(d)}<button onclick="removeCandidateDate('${d}')">&times;</button></span>`)
    .join("");
}

function saveEvent() {
  const title = document.getElementById("event-title").value.trim();
  const date = document.getElementById("event-date").value;
  if (!title || !date) { alert("タイトルと開催日を入力してください"); return; }

  DB.addEvent({
    title,
    date,
    type: "meeting",
    candidateDates: [...tempCandidateDates],
  });
  closeEventModal();
  renderSchedule();
}

function deleteEvent(id) {
  if (!confirm("このイベントを削除しますか？")) return;
  DB.deleteEvent(id);
  renderSchedule();
}

// --- 日程回答モーダル ---
let currentScheduleEventId = null;

function openScheduleResponse(eventId) {
  currentScheduleEventId = eventId;
  const event = DB.getEvents().find((e) => e.id === eventId);
  const members = DB.getMembers();
  if (!event || members.length === 0) return;

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
}

function closeResponseModal() {
  document.getElementById("modal-response").classList.remove("open");
}

function saveScheduleResponses() {
  if (!currentScheduleEventId) return;
  const checks = document.querySelectorAll("#response-form .schedule-check");
  const memberDates = {};

  checks.forEach((cb) => {
    const mId = Number(cb.dataset.member);
    const date = cb.dataset.date;
    if (!memberDates[mId]) memberDates[mId] = [];
    if (cb.checked) memberDates[mId].push(date);
  });

  Object.entries(memberDates).forEach(([mId, dates]) => {
    DB.setScheduleResponse(currentScheduleEventId, Number(mId), dates);
  });

  closeResponseModal();
  renderSchedule();
}

// ========== 出席管理 ==========
function renderAttendance() {
  const events = DB.getEvents();
  const members = DB.getMembers();
  const container = document.getElementById("attendance-list");

  if (events.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>イベントがありません</p></div>';
    return;
  }

  if (members.length === 0) {
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
              <select class="attendance-select" data-event="${ev.id}" data-member="${m.id}" onchange="onAttendanceChange(this)">
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
}

function onAttendanceChange(select) {
  const eventId = Number(select.dataset.event);
  const memberId = Number(select.dataset.member);
  const status = select.value;

  if (status === "none") {
    // 記録を消す
    const events = DB.getEvents();
    const ev = events.find((e) => e.id === eventId);
    if (ev) {
      ev.attendance = (ev.attendance || []).filter((a) => a.memberId !== memberId);
      DB.saveEvents(events);
    }
  } else {
    DB.setAttendance(eventId, memberId, status);
  }
  renderAttendance();
}

// ========== デモデータ ==========
function loadDemo() {
  if (DB.getMembers().length > 0) {
    if (!confirm("既存データを上書きしますか？")) return;
    localStorage.removeItem("bibe_members");
    localStorage.removeItem("bibe_events");
  }
  DB.loadDemoData();
  renderDashboard();
  alert("デモデータを読み込みました");
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
