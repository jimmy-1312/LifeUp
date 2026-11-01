/*
  資料模型：每個 category 直接持有 achievements；成就完成時寫入 unlockedAt。
  最近動態不是手動排序，而是取每個分類最新的 unlockedAt 後排序，因此切換
  成就狀態後，首頁會自動把相關系列移到最上方。
*/
const STORAGE_KEY = "lifeup-prototype-v1";
const RECENT_CATEGORY_LIMIT = 4;

const seedCategories = [
  {
    id: "campus-side-quests", title: "校園支線任務", symbol: "🎒", tone: "linear-gradient(135deg, #2eb4c4, #3d66b7)",
    description: "課表以外，才是大學真正的地圖。", source: "official",
    achievements: [
      { id: "seat", icon: "🪑", title: "最後一排觀察家", description: "至少一次把座位選在教室最後一排。", xp: 40, unlockedAt: "2026-10-31T09:34:00+08:00" },
      { id: "office-hour", icon: "☕", title: "教授辦公室勇者", description: "主動問教授一個你真的想知道的問題。", xp: 85, unlockedAt: "2026-10-18T15:12:00+08:00" },
      { id: "club", icon: "🎪", title: "社團試吃員", description: "在招生活動中停下來聊超過五分鐘。", xp: 55, unlockedAt: null },
      { id: "deadline", icon: "🕛", title: "壓線交件藝術家", description: "在截止前十分鐘內安全送出作業。", xp: 45, unlockedAt: "2026-09-27T23:51:00+08:00" },
      { id: "library", icon: "📚", title: "圖書館遊牧者", description: "一天內在三個不同樓層念書。", xp: 55, unlockedAt: null },
      { id: "presentation", icon: "🎙️", title: "小組報告倖存者", description: "完成一次所有人都有開麥的分工。", xp: 75, unlockedAt: null }
    ]
  },
  {
    id: "small-talk-lab", title: "社交小實驗室", symbol: "🫧", tone: "linear-gradient(135deg, #9e69d7, #4369b9)",
    description: "給不擅長破冰的人，一些可重播的小練習。", source: "official",
    achievements: [
      { id: "first-question", icon: "👋", title: "第一句不是你好", description: "用一個有內容的問題開啟一段對話。", xp: 70, unlockedAt: "2026-10-29T18:42:00+08:00" },
      { id: "name-memory", icon: "🧠", title: "名字記憶術", description: "第二次見面時喊對對方的名字。", xp: 60, unlockedAt: "2026-10-11T13:30:00+08:00" },
      { id: "meal", icon: "🍜", title: "一起吃飯就不算陌生", description: "主動約一位剛認識的同學吃午餐。", xp: 95, unlockedAt: null },
      { id: "reaction", icon: "💬", title: "表情包翻譯機", description: "用一張剛好的迷因救回尷尬聊天室。", xp: 45, unlockedAt: "2026-09-21T21:04:00+08:00" },
      { id: "voice", icon: "🎧", title: "語音房探險", description: "在群組語音中開口說超過一句話。", xp: 75, unlockedAt: null },
      { id: "follow-up", icon: "📮", title: "後續訊息發送成功", description: "聚會結束後傳出一則真誠的 follow-up。", xp: 80, unlockedAt: null }
    ]
  },
  {
    id: "outdoor-detour", title: "戶外與生活冒險", symbol: "⛰️", tone: "linear-gradient(135deg, #dd9953, #a94c69)",
    description: "把人生地圖縮小一點，路就會多一點。", source: "official",
    achievements: [
      { id: "lost", icon: "🗺️", title: "方向感絕緣體", description: "拿著地圖導航，反而離目的地更遠。", xp: 45, unlockedAt: "2026-10-28T16:20:00+08:00" },
      { id: "trip", icon: "🚆", title: "說走就走的旅行", description: "學期中突然心血來潮，立刻出發去旅行。", xp: 120, unlockedAt: "2026-10-05T08:40:00+08:00" },
      { id: "sunrise", icon: "🌅", title: "日出收藏家", description: "為了日出而早起，並真的看到太陽。", xp: 85, unlockedAt: null },
      { id: "market", icon: "🥟", title: "巷弄味蕾探測器", description: "獨自走進一間從沒吃過的小店。", xp: 55, unlockedAt: "2026-09-15T12:20:00+08:00" },
      { id: "walk", icon: "🚶", title: "耳機以外的世界", description: "散步二十分鐘，沒有戴耳機。", xp: 50, unlockedAt: null },
      { id: "rain", icon: "☔", title: "雨天計畫 B", description: "遇上突如其來的大雨，仍然玩得很開心。", xp: 65, unlockedAt: null }
    ]
  },
  {
    id: "tiny-comforts", title: "小小充電站", symbol: "🫖", tone: "linear-gradient(135deg, #e37e87, #9056bc)",
    description: "休息不是離線，是替下一次出發存檔。", source: "official",
    achievements: [
      { id: "nap", icon: "😴", title: "午睡不用愧疚", description: "好好睡完一場二十分鐘的午覺。", xp: 35, unlockedAt: "2026-10-25T14:05:00+08:00" },
      { id: "playlist", icon: "🎶", title: "專屬歌單調酒師", description: "做一張只屬於這週心情的歌單。", xp: 50, unlockedAt: "2026-10-21T23:08:00+08:00" },
      { id: "nope", icon: "🛑", title: "禮貌拒絕練習", description: "說一次不，並保留自己的晚上。", xp: 95, unlockedAt: null },
      { id: "desk", icon: "🕯️", title: "桌面重置術", description: "把混亂的書桌整理到能深呼吸。", xp: 55, unlockedAt: null },
      { id: "cooking", icon: "🍳", title: "深夜煮麵哲學家", description: "為自己煮一餐，不是只叫外賣。", xp: 55, unlockedAt: "2026-10-12T00:18:00+08:00" },
      { id: "offline", icon: "📵", title: "通知靜音一小時", description: "把手機放遠一小時，沒有立刻回訊息。", xp: 65, unlockedAt: null }
    ]
  },
  {
    id: "creative-drawer", title: "靈感抽屜", symbol: "🖍️", tone: "linear-gradient(135deg, #786dec, #d260a7)",
    description: "不必厲害才開始，先留下第一個版本。", source: "official",
    achievements: [
      { id: "draft", icon: "📝", title: "爛草稿守護者", description: "寫下一個很爛但確實存在的初稿。", xp: 55, unlockedAt: "2026-10-20T19:16:00+08:00" },
      { id: "photo", icon: "📷", title: "光影捕捉者", description: "拍下一張自己想留住的平凡瞬間。", xp: 45, unlockedAt: null },
      { id: "share", icon: "🪩", title: "作品見光了", description: "把一個創作分享給至少一位朋友。", xp: 95, unlockedAt: null },
      { id: "doodle", icon: "✏️", title: "課堂邊角塗鴉", description: "在筆記旁畫下今天的心情。", xp: 35, unlockedAt: "2026-09-10T11:35:00+08:00" },
      { id: "book", icon: "📖", title: "故事進度條", description: "讀完一本不是課本的書。", xp: 85, unlockedAt: null },
      { id: "idea", icon: "💡", title: "靈光一現存檔", description: "將一個半夜出現的點子記下來。", xp: 45, unlockedAt: "2026-10-01T02:10:00+08:00" }
    ]
  },
  {
    id: "adulting-beta", title: "大人模式 Beta", symbol: "🧾", tone: "linear-gradient(135deg, #65af91, #386da2)",
    description: "沒有說明書的副本，也能慢慢通關。", source: "official",
    achievements: [
      { id: "budget", icon: "💸", title: "月底還有餘額", description: "這個月第一次記帳，而且沒有半途而廢。", xp: 85, unlockedAt: null },
      { id: "laundry", icon: "🧺", title: "洗衣不再靠天意", description: "在衣服用完前完成洗衣、曬衣、收衣。", xp: 55, unlockedAt: "2026-10-07T17:15:00+08:00" },
      { id: "call", icon: "☎️", title: "客服通話者", description: "主動打電話處理一件生活大小事。", xp: 100, unlockedAt: null },
      { id: "form", icon: "📋", title: "表格填答專家", description: "沒有拖到最後一天就填完行政表單。", xp: 65, unlockedAt: null },
      { id: "plant", icon: "🪴", title: "植物室友還活著", description: "連續照顧一株植物超過三週。", xp: 75, unlockedAt: null },
      { id: "repair", icon: "🔧", title: "自己先試著修", description: "自己解決一個小小的居家故障。", xp: 70, unlockedAt: null }
    ]
  }
];

const profile = {
  name: "夏知念", pronoun: "她 / 她", intro: "慢熟型人類，正在把日常收集成可分享的支線任務。喜歡深夜散步、圖書館角落，和剛剛好的對話。", tags: ["#慢熟玩家", "#社交練習中", "#夜行性", "#INFJ-ish"]
};

const badgeDefinitions = [
  { id: "starter", icon: "🌱", title: "序章玩家", description: "解鎖第一項人生小成就。", xp: 80, rule: state => totalUnlocked(state) >= 1 },
  { id: "conversation", icon: "🫧", title: "破冰預備員", description: "完成三項社交小實驗室的任務。", xp: 160, rule: state => completedIn(state, "small-talk-lab") >= 3 },
  { id: "wanderer", icon: "🧭", title: "偶遇收藏家", description: "完成三項戶外與生活冒險。", xp: 150, rule: state => completedIn(state, "outdoor-detour") >= 3 },
  { id: "steady", icon: "🫖", title: "溫柔續航", description: "完成三項小小充電站任務。", xp: 130, rule: state => completedIn(state, "tiny-comforts") >= 3 },
  { id: "curious", icon: "🔍", title: "好奇心不下線", description: "在四個不同系列留下足跡。", xp: 210, rule: state => state.filter(c => c.achievements.some(a => a.unlockedAt)).length >= 4 },
  { id: "collector", icon: "🏆", title: "成就櫃管理員", description: "累積解鎖 15 個成就。", xp: 280, rule: state => totalUnlocked(state) >= 15 },
  { id: "self-made", icon: "✨", title: "自訂宇宙", description: "建立自己的系列，記錄想成為的人。", xp: 180, rule: state => state.some(c => c.source === "custom") },
  { id: "completionist", icon: "👑", title: "一頁全亮", description: "完成任一系列的所有成就。", xp: 300, rule: state => state.some(c => c.achievements.length && c.achievements.every(a => a.unlockedAt)) },
  { id: "legend", icon: "🌌", title: "生活傳說", description: "解鎖所有官方系列的一半成就。", xp: 500, rule: state => { const official = state.filter(c => c.source === "official"); return totalUnlocked(official) >= Math.ceil(totalAchievements(official) / 2); } }
];

let categories = loadState();
let currentFilter = "all";
let pendingDialog = null;

function cloneSeed() { return JSON.parse(JSON.stringify(seedCategories)); }
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) && saved.length ? saved : cloneSeed();
  } catch { return cloneSeed(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(categories)); }
function allAchievements(state = categories) { return state.flatMap(c => c.achievements.map(a => ({ ...a, category: c }))); }
function totalUnlocked(state = categories) { return allAchievements(state).filter(a => a.unlockedAt).length; }
function totalAchievements(state = categories) { return state.reduce((sum, c) => sum + c.achievements.length, 0); }
function completedIn(state, categoryId) { return (state.find(c => c.id === categoryId)?.achievements || []).filter(a => a.unlockedAt).length; }
function earnedBadges(state = categories) { return badgeDefinitions.filter(badge => badge.rule(state)); }
function xpTotal(state = categories) {
  const achievementXp = allAchievements(state).filter(a => a.unlockedAt).reduce((sum, a) => sum + Number(a.xp || 0), 0);
  const badgeXp = earnedBadges(state).reduce((sum, b) => sum + b.xp, 0);
  return achievementXp + badgeXp;
}
function levelInfo(state = categories) {
  const xp = xpTotal(state);
  const level = Math.floor(Math.sqrt(xp / 95)) + 1;
  const currentFloor = 95 * (level - 1) ** 2;
  const nextFloor = 95 * level ** 2;
  return { xp, level, currentFloor, nextFloor, progress: ((xp - currentFloor) / (nextFloor - currentFloor)) * 100 };
}
function categoryStats(category) {
  const count = category.achievements.filter(a => a.unlockedAt).length;
  const total = category.achievements.length;
  const latest = category.achievements.filter(a => a.unlockedAt).sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))[0];
  return { count, total, progress: total ? (count / total) * 100 : 0, latest };
}
function relativeTime(date) {
  if (!date) return "尚未開始探索";
  const milliseconds = Date.now() - new Date(date).getTime();
  const minutes = Math.max(0, Math.round(milliseconds / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)} 分鐘前解鎖`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小時前解鎖`;
  const days = Math.round(hours / 24);
  return `${days} 天前解鎖`;
}
function dateLabel(date) {
  if (!date) return "未解鎖";
  return new Intl.DateTimeFormat("zh-Hant", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}
function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[char]); }
function slugify(text) { return `${text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`; }

function setRoute(route) { window.location.hash = route; }
function route() { return window.location.hash.slice(1) || "/profile"; }
function getCategory(id) { return categories.find(category => category.id === id); }
function navMarkup(active) {
  document.querySelectorAll("[data-nav]").forEach(link => link.classList.toggle("active", link.dataset.nav === active));
}
function iconButton(label, action, icon = "+") { return `<button type="button" class="primary-button" data-action="${action}">${icon} ${label}</button>`; }
function progressMarkup(progress) { return `<div class="progress-track" aria-label="進度 ${Math.round(progress)}%"><div class="progress-fill" style="width:${Math.max(0, Math.min(100, progress))}%"></div></div>`; }
function categoryArt(category, className = "category-art") { return `<div class="${className}" style="background:${category.tone}">${escapeHtml(category.symbol || "✦")}</div>`; }

function profilePage() {
  navMarkup("profile");
  const level = levelInfo();
  const recentlyActive = [...categories].sort((a, b) => {
    const aTime = categoryStats(a).latest?.unlockedAt || "";
    const bTime = categoryStats(b).latest?.unlockedAt || "";
    return new Date(bTime || 0) - new Date(aTime || 0);
  }).slice(0, RECENT_CATEGORY_LIMIT);
  const previewBadges = badgeDefinitions.slice(0, 6);
  return `
    <section class="hero">
      <div class="profile-block">
        <div class="avatar" role="img" aria-label="夏知念的頭像"></div>
        <div class="profile-copy">
          <div class="status-line"><span class="status-dot"></span>本週正在收集生活碎片</div>
          <div class="name-line"><h1>${profile.name}</h1><span class="pronoun">${profile.pronoun}</span></div>
          <p class="intro">${profile.intro}</p>
          <div class="tags">${profile.tags.map(tag => `<span class="tag">${tag}</span>`).join("")}</div>
        </div>
      </div>
      <section class="level-panel" aria-label="玩家等級">
        <div class="level-heading"><span>目前等級</span><strong>LV. ${level.level}</strong></div>
        <p class="xp-copy"><strong>${level.xp.toLocaleString()}</strong> XP · 解鎖 ${totalUnlocked()} 項成就</p>
        ${progressMarkup(level.progress)}
        <p class="level-hint">距離 LV. ${level.level + 1} 還差 ${(level.nextFloor - level.xp).toLocaleString()} XP</p>
      </section>
    </section>
    <div class="content-layout">
      <section class="section-card">
        <div class="section-title"><div><h2>最新動態</h2><p>依最近解鎖時間排列 · 顯示最近 ${RECENT_CATEGORY_LIMIT} 個系列</p></div><a class="text-link" href="#/collection">查看全部 →</a></div>
        <div class="activity-list">
          ${recentlyActive.map(category => {
            const stats = categoryStats(category);
            const preview = category.achievements.slice(0, 4);
            return `<a href="#/category/${encodeURIComponent(category.id)}" class="activity-card" aria-label="開啟 ${escapeHtml(category.title)} 成就">
              ${categoryArt(category)}
              <div>
                <div class="activity-title"><h3>${escapeHtml(category.title)}</h3>${category.source === "custom" ? '<span class="custom-chip">自訂</span>' : ""}</div>
                <p class="activity-time">${stats.latest ? `${escapeHtml(stats.latest.title)} · ${relativeTime(stats.latest.unlockedAt)}` : "還沒有解鎖紀錄"}</p>
                <div class="category-progress">${progressMarkup(stats.progress)}<span>${stats.count} / ${stats.total}</span></div>
              </div>
              <div class="tiny-achievements" aria-hidden="true">${preview.map(a => `<span class="tiny-achievement ${a.unlockedAt ? "" : "locked"}">${a.unlockedAt ? escapeHtml(a.icon) : "?"}</span>`).join("")}</div>
            </a>`;
          }).join("")}
        </div>
      </section>
      <aside class="aside-stack">
        <section class="section-card"><div class="section-title"><div><h2>靈魂徽章</h2><p>${earnedBadges().length} / ${badgeDefinitions.length} 已獲得</p></div><a class="text-link" href="#/badges">全部 →</a></div>
          <div class="badges-preview"><div class="badge-preview-grid">${previewBadges.map(badge => `<div class="badge-mini ${badge.rule(categories) ? "" : "locked"}" title="${escapeHtml(badge.title)}">${badge.rule(categories) ? badge.icon : "🔒"}</div>`).join("")}</div></div>
        </section>
        <section class="section-card side-stat"><dl><dt>探索系列</dt><dd>${categories.length}</dd><dt>完成成就</dt><dd>${totalUnlocked()} / ${totalAchievements()}</dd><dt>總經驗值</dt><dd>${level.xp.toLocaleString()} XP</dd></dl></section>
        <aside class="side-quote"><strong>今日遊戲提示</strong>不用把每件事變成任務；願意記住小事，就已經很厲害了。</aside>
      </aside>
    </div>`;
}

function collectionPage() {
  navMarkup("collection");
  const completed = totalUnlocked();
  return `
    <section class="page-banner">
      <div><div class="breadcrumb"><a href="#/profile">我的展櫃</a><span>/</span><span>成就圖鑑</span></div><h1>成就圖鑑</h1><p>官方系列提供一些可愛的生活提示；也可以建立只屬於你的關卡。每次點亮，都是和自己打過招呼。</p></div>
      <div class="banner-total"><strong>${completed} / ${totalAchievements()}</strong><span>已解鎖成就</span></div>
    </section>
    <div class="collection-toolbar"><span class="category-count">${categories.length} 個系列 · 依最近解鎖時間整理</span>${iconButton("建立我的系列", "add-category")}</div>
    <section class="category-grid">
      ${[...categories].sort((a, b) => new Date(categoryStats(b).latest?.unlockedAt || 0) - new Date(categoryStats(a).latest?.unlockedAt || 0)).map(category => {
        const stats = categoryStats(category);
        return `<a href="#/category/${encodeURIComponent(category.id)}" class="collection-card" data-symbol="${escapeHtml(category.symbol)}">
          <div class="collection-top">${categoryArt(category, "collection-art")}<span class="custom-chip">${category.source === "custom" ? "自訂系列" : "官方系列"}</span></div>
          <h2>${escapeHtml(category.title)}</h2><p>${escapeHtml(category.description)}</p>
          <div class="category-progress">${progressMarkup(stats.progress)}<span>${stats.count} / ${stats.total}</span></div>
        </a>`;
      }).join("")}
    </section>`;
}

function categoryPage(categoryId) {
  const category = getCategory(categoryId);
  if (!category) return notFoundPage();
  navMarkup("collection");
  const stats = categoryStats(category);
  const visible = category.achievements.filter(achievement => currentFilter === "all" || (currentFilter === "unlocked" ? achievement.unlockedAt : !achievement.unlockedAt));
  return `
    <section class="page-banner">
      <div><div class="breadcrumb"><a href="#/profile">我的展櫃</a><span>/</span><a href="#/collection">成就圖鑑</a><span>/</span><span>${escapeHtml(category.title)}</span></div><h1>${escapeHtml(category.symbol)} ${escapeHtml(category.title)}</h1><p>${escapeHtml(category.description)}</p></div>
      <div class="banner-total"><strong>${stats.count} / ${stats.total}</strong><span>解鎖進度</span></div>
    </section>
    <div class="category-detail">
      <div>
        <section class="section-card detail-progress"><div class="detail-progress-row"><span>系列完成度</span><span>${Math.round(stats.progress)}%</span></div>${progressMarkup(stats.progress)}</section>
        <section class="section-card">
          <div class="section-title"><div><h2>成就清單</h2><p>點選卡片即可切換解鎖狀態</p></div>${iconButton("新增成就", "add-achievement", "+")}</div>
          <div class="filters"><button class="filter-button ${currentFilter === "all" ? "active" : ""}" data-filter="all">全部 ${stats.total}</button><button class="filter-button ${currentFilter === "unlocked" ? "active" : ""}" data-filter="unlocked">已解鎖 ${stats.count}</button><button class="filter-button ${currentFilter === "locked" ? "active" : ""}" data-filter="locked">待解鎖 ${stats.total - stats.count}</button></div>
          <div class="achievement-list">${visible.length ? visible.map(achievement => achievementMarkup(achievement, category)).join("") : emptyState("這個篩選還沒有成就", "換一個分頁看看，或新增新的支線。")}</div>
        </section>
      </div>
      <aside class="detail-side">
        <section class="section-card detail-side-card"><h3>這個系列怎麼玩？</h3><p>這裡沒有標準答案。把每個願意嘗試的小瞬間點亮，就能替它留下時間記號。</p><ul><li>點卡片可解鎖／取消解鎖</li><li>解鎖時間會決定首頁排序</li><li>每項任務都會獲得 XP</li></ul></section>
        <section class="section-card detail-side-card"><h3>最近點亮</h3><p>${stats.latest ? `${escapeHtml(stats.latest.icon)} ${escapeHtml(stats.latest.title)}<br><span class="unlock-meta">${dateLabel(stats.latest.unlockedAt)} 解鎖</span>` : "還沒有解鎖紀錄，第一個由你決定。"}</p></section>
      </aside>
    </div>`;
}

function achievementMarkup(achievement, category) {
  return `<button class="achievement-row ${achievement.unlockedAt ? "" : "locked"}" type="button" data-action="toggle-achievement" data-category-id="${escapeHtml(category.id)}" data-achievement-id="${escapeHtml(achievement.id)}" aria-pressed="${Boolean(achievement.unlockedAt)}">
    <span class="achievement-icon">${achievement.unlockedAt ? escapeHtml(achievement.icon) : "🔒"}</span>
    <span class="achievement-info"><h3>${escapeHtml(achievement.title)}</h3><p>${escapeHtml(achievement.description)}</p>${achievement.unlockedAt ? `<span class="unlock-meta">${dateLabel(achievement.unlockedAt)} 解鎖</span>` : ""}</span>
    <span class="achievement-xp">+${achievement.xp} XP</span>
  </button>`;
}

function badgesPage() {
  navMarkup("badges");
  const level = levelInfo();
  const unlocked = earnedBadges();
  return `
    <section class="page-banner">
      <div><div class="breadcrumb"><a href="#/profile">我的展櫃</a><span>/</span><span>靈魂徽章</span></div><h1>靈魂徽章</h1><p>徽章不是分數，而是那些你曾經跨出去、也曾好好照顧自己的證明。</p></div>
      <div class="badge-level"><div class="level-orb">${level.level}</div><div><h2>等級 ${level.level}</h2><p>${level.xp.toLocaleString()} XP · ${unlocked.length} 枚徽章</p></div></div>
    </section>
    <section class="badges-grid">
      ${badgeDefinitions.map(badge => {
        const hasBadge = badge.rule(categories);
        return `<article class="badge-card ${hasBadge ? "" : "locked"}"><span class="badge-lock">${hasBadge ? "已獲得" : "🔒"}</span><div class="badge-icon">${hasBadge ? badge.icon : "?"}</div><h2>${escapeHtml(badge.title)}</h2><p>${escapeHtml(badge.description)}</p><footer><span>${hasBadge ? "收藏成功" : "等待解鎖"}</span><span>+${badge.xp} XP</span></footer></article>`;
      }).join("")}
    </section>`;
}

function notFoundPage() {
  navMarkup("");
  return `<section class="section-card"><div class="empty-state"><span class="empty-icon">?</span><h2>這個頁面還沒被解鎖</h2><p>也許它藏在別的系列裡。</p><a class="primary-button" href="#/profile">回到我的展櫃</a></div></section>`;
}
function emptyState(title, description) { return `<div class="empty-state"><span class="empty-icon">✦</span><h2>${title}</h2><p>${description}</p></div>`; }

function render() {
  const path = route();
  const app = document.getElementById("app");
  if (path === "/profile") app.innerHTML = profilePage();
  else if (path === "/collection") app.innerHTML = collectionPage();
  else if (path === "/badges") app.innerHTML = badgesPage();
  else if (path.startsWith("/category/")) app.innerHTML = categoryPage(decodeURIComponent(path.split("/").slice(2).join("/")));
  else app.innerHTML = notFoundPage();
  app.focus({ preventScroll: true });
}

function showToast(message) {
  const region = document.getElementById("toastRegion");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  region.append(toast);
  setTimeout(() => toast.remove(), 3100);
}

function openDialog(type, categoryId = null) {
  const dialog = document.getElementById("entryDialog");
  const fields = document.getElementById("formFields");
  const title = document.getElementById("dialogTitle");
  const eyebrow = document.getElementById("dialogEyebrow");
  pendingDialog = { type, categoryId };
  if (type === "category") {
    eyebrow.textContent = "我的自訂系列";
    title.textContent = "建立一個新關卡";
    fields.innerHTML = `
      <div class="form-field"><label for="categoryTitle">系列名稱</label><input id="categoryTitle" name="title" maxlength="22" required placeholder="例如：我的交換日記"></div>
      <div class="form-field"><label for="categoryDescription">一句關於它的話</label><textarea id="categoryDescription" name="description" maxlength="100" required placeholder="這個系列想記錄什麼？"></textarea></div>
      <div class="form-field"><label for="categorySymbol">代表符號</label><input id="categorySymbol" name="symbol" maxlength="3" required value="✨" placeholder="✨"></div>
      <div class="form-field"><label for="categoryTone">展櫃色調</label><select id="categoryTone" name="tone"><option value="linear-gradient(135deg, #786dec, #d260a7)">紫粉星雲</option><option value="linear-gradient(135deg, #2eb4c4, #3d66b7)">藍綠海岸</option><option value="linear-gradient(135deg, #dd9953, #a94c69)">暖橘晚霞</option><option value="linear-gradient(135deg, #65af91, #386da2)">森林湖面</option></select></div>`;
  } else {
    const category = getCategory(categoryId);
    eyebrow.textContent = category?.title || "自訂成就";
    title.textContent = "新增一個小成就";
    fields.innerHTML = `
      <div class="form-field"><label for="achievementTitle">成就名稱</label><input id="achievementTitle" name="title" maxlength="30" required placeholder="例如：第一次自己做便當"></div>
      <div class="form-field"><label for="achievementDescription">解鎖條件</label><textarea id="achievementDescription" name="description" maxlength="130" required placeholder="做到什麼，就算成功？"></textarea></div>
      <div class="form-field"><label for="achievementIcon">代表符號</label><input id="achievementIcon" name="icon" maxlength="3" required value="✦" placeholder="✦"></div>
      <div class="form-field"><label for="achievementXp">經驗值</label><select id="achievementXp" name="xp"><option value="45">45 XP · 小嘗試</option><option value="65">65 XP · 新習慣</option><option value="90" selected>90 XP · 勇敢一步</option><option value="120">120 XP · 隱藏成就</option></select></div>`;
  }
  dialog.showModal();
  setTimeout(() => fields.querySelector("input")?.focus(), 60);
}
function closeDialog() { document.getElementById("entryDialog").close(); pendingDialog = null; }

function submitDialog(event) {
  event.preventDefault();
  if (!pendingDialog) return;
  const form = new FormData(event.currentTarget);
  const title = String(form.get("title") || "").trim();
  const description = String(form.get("description") || "").trim();
  if (!title || !description) return;
  if (pendingDialog.type === "category") {
    const category = { id: slugify(title), title, description, symbol: String(form.get("symbol") || "✨").trim() || "✨", tone: String(form.get("tone")), source: "custom", achievements: [] };
    categories.unshift(category);
    saveState(); closeDialog(); setRoute(`/category/${encodeURIComponent(category.id)}`); showToast("新系列已加入你的展櫃 ✨");
  } else {
    const category = getCategory(pendingDialog.categoryId);
    if (!category) return;
    category.achievements.push({ id: slugify(title), title, description, icon: String(form.get("icon") || "✦").trim() || "✦", xp: Number(form.get("xp")), unlockedAt: null });
    saveState(); closeDialog(); render(); showToast("新的小成就已加入，等你點亮。 ");
  }
}

function toggleAchievement(categoryId, achievementId) {
  const category = getCategory(categoryId);
  const achievement = category?.achievements.find(item => item.id === achievementId);
  if (!achievement) return;
  achievement.unlockedAt = achievement.unlockedAt ? null : new Date().toISOString();
  saveState();
  render();
  showToast(achievement.unlockedAt ? `解鎖「${achievement.title}」！ +${achievement.xp} XP` : `已取消解鎖「${achievement.title}」`);
}

document.addEventListener("click", event => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "add-category") openDialog("category");
  if (action === "add-achievement") openDialog("achievement", route().split("/").pop());
  if (action === "toggle-achievement") {
    const button = event.target.closest("[data-achievement-id]");
    toggleAchievement(button.dataset.categoryId, button.dataset.achievementId);
  }
  const filter = event.target.closest("[data-filter]")?.dataset.filter;
  if (filter) { currentFilter = filter; render(); }
});
document.getElementById("entryForm").addEventListener("submit", submitDialog);
document.getElementById("closeDialog").addEventListener("click", closeDialog);
document.getElementById("cancelDialog").addEventListener("click", closeDialog);
document.getElementById("profileMenu").addEventListener("click", () => showToast("這是單人展櫃原型，內容會儲存在這台瀏覽器。"));
window.addEventListener("hashchange", () => { currentFilter = "all"; render(); });
render();
