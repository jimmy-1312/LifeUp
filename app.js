/*
  資料模型：每個 category 直接持有 achievements；成就完成時寫入 unlockedAt。
  最近動態不是手動排序，而是取每個分類最新的 unlockedAt 後排序，因此切換
  成就狀態後，首頁會自動把相關系列移到最上方。
*/
const RECENT_CATEGORY_LIMIT = 4;
const DEFAULT_BACKGROUND_UNLOCKS = Object.freeze(["cyberpunk", "snow-mountain"]);
const DEFAULT_PROFILE_SETTINGS = Object.freeze({ background: "none", backgroundColor: "#07111f", unlockedBackgrounds: DEFAULT_BACKGROUND_UNLOCKS });
const PROFILE_BACKGROUNDS = Object.freeze({
  none: { label: "預設背景", src: null },
  cyberpunk: { label: "Cyberpunk 夜城", src: "Cyberpunk(靜態).jpg" },
  "snow-mountain": { label: "雪山", src: "雪山(靜態).jpg" },
  wukong: { label: "孫悟空", src: "孫悟空(動態).gif", redeemable: true }
});
const supabaseConfig = window.SUPABASE_CONFIG;
let supabaseClient = null;
let supabaseConfigurationError = "";

if (!window.supabase?.createClient) {
  supabaseConfigurationError = "Supabase SDK 無法載入，請確認網路連線後重新整理。";
} else if (!supabaseConfig?.url || !supabaseConfig?.anonKey || supabaseConfig.url.includes("YOUR_PROJECT_REF") || supabaseConfig.anonKey.includes("YOUR_SUPABASE")) {
  supabaseConfigurationError = "尚未設定 Supabase。請依照 SUPABASE_SETUP.md 建立 supabase-config.js 並填入專案 URL 與 anon/publishable key。";
} else {
  try {
    supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey);
  } catch (error) {
    supabaseConfigurationError = `Supabase 設定無效：${error.message}`;
  }
}

const seedCategories = [
  {
    id: "campus-side-quests", title: "校園 NPC 觀察日誌", symbol: "🎒", tone: "linear-gradient(135deg, #2eb4c4, #3d66b7)",
    description: "記錄校園裡遇見的人、加入的事，和那些不在課表上的精彩支線。", source: "official",
    achievements: [
      { id: "seat", icon: "🪑", title: "座位風水師", description: "找到一個讓你既看得到投影片、又不會被點名點到靈魂出竅的位置。", xp: 40, unlockedAt: "2026-10-31T09:34:00+08:00" },
      { id: "office-hour", icon: "☕", title: "教授對話解鎖", description: "下課後問教授一個真的好奇的問題，不限課業，勇氣先加分。", xp: 85, unlockedAt: "2026-10-18T15:12:00+08:00" },
      { id: "club", icon: "🎪", title: "社團試玩版", description: "參加一次社團活動，看看這群人是不是你的同溫層。", xp: 55, unlockedAt: null },
      { id: "deadline", icon: "🕛", title: "截止線上的舞者", description: "完成一項作業；不論提早或壓線，成功上傳就是勝利。", xp: 45, unlockedAt: "2026-09-27T23:51:00+08:00" },
      { id: "library", icon: "📚", title: "圖書館地圖全開", description: "找到一個你最喜歡的校園讀書角落，也可以是插座旁邊。", xp: 55, unlockedAt: null },
      { id: "presentation", icon: "🎙️", title: "小組報告倖存者", description: "和組員完成一次合作，最後簡報裡真的有放上每個人的名字。", xp: 75, unlockedAt: null }
    ]
  },
  {
    id: "small-talk-lab", title: "社交 DLC：先從一句開始", symbol: "🫧", tone: "linear-gradient(135deg, #9e69d7, #4369b9)",
    description: "不用突然變社交王，只要替下一次聊天多準備一個入口。", source: "official",
    achievements: [
      { id: "first-question", icon: "👋", title: "開場白不是天氣", description: "用一個有內容的問題開啟聊天：最近在聽什麼、看什麼都可以。", xp: 70, unlockedAt: "2026-10-29T18:42:00+08:00" },
      { id: "name-memory", icon: "🧠", title: "名字沒有當場蒸發", description: "第二次見面時叫對對方的名字；大腦記憶體成功擴充。", xp: 60, unlockedAt: "2026-10-11T13:30:00+08:00" },
      { id: "meal", icon: "🍜", title: "午餐組隊成功", description: "約一位同學一起吃飯，順便交換一道彼此的口袋名單。", xp: 95, unlockedAt: null },
      { id: "reaction", icon: "💬", title: "迷因外交官", description: "分享一張你覺得對方也會笑的梗圖，成功開啟新話題。", xp: 45, unlockedAt: "2026-09-21T21:04:00+08:00" },
      { id: "voice", icon: "🎧", title: "語音房簽到", description: "在群組語音裡說出一句話以上，嗯嗯也算勇敢開麥。", xp: 75, unlockedAt: null },
      { id: "follow-up", icon: "📮", title: "聊天續集預告", description: "聊完後傳訊息分享一首歌、一間店，或剛剛聊到的連結。", xp: 80, unlockedAt: null }
    ]
  },
  {
    id: "outdoor-detour", title: "校園半徑外的探險家", symbol: "⛰️", tone: "linear-gradient(135deg, #dd9953, #a94c69)",
    description: "把熟悉路線稍微走歪一點，收集城市、自然和迷路的故事。", source: "official",
    achievements: [
      { id: "lost", icon: "🗺️", title: "地圖說東我往西", description: "去一個沒走過的地方，迷路也可以算作支線劇情。", xp: 45, unlockedAt: "2026-10-28T16:20:00+08:00" },
      { id: "trip", icon: "🚆", title: "一日旅人出發", description: "安排一次小旅行，目的地可以是隔壁區，不必先辭職環遊世界。", xp: 120, unlockedAt: "2026-10-05T08:40:00+08:00" },
      { id: "sunrise", icon: "🌅", title: "早起不是傳說", description: "為一個喜歡的景色早起一次；看日出或早餐店開門都算。", xp: 85, unlockedAt: null },
      { id: "market", icon: "🥟", title: "陌生小店開箱", description: "試一家沒吃過的店，記下最推薦的一道菜。", xp: 55, unlockedAt: "2026-09-15T12:20:00+08:00" },
      { id: "walk", icon: "🚶", title: "散步路線拓荒者", description: "走一條平常不會走的路，沿途找到一個想分享的地方。", xp: 50, unlockedAt: null },
      { id: "rain", icon: "☔", title: "天氣預報只是建議", description: "遇到下雨或行程改變，臨場找到一個還不錯的 B 計畫。", xp: 65, unlockedAt: null }
    ]
  },
  {
    id: "tiny-comforts", title: "人類低電量自救指南", symbol: "🫖", tone: "linear-gradient(135deg, #e37e87, #9056bc)",
    description: "收藏讓自己回電的小事；休息不是偷懶，是系統更新。", source: "official",
    achievements: [
      { id: "nap", icon: "😴", title: "午睡合法化", description: "安排一段真正的休息，不必先把所有待辦清空才有資格。", xp: 35, unlockedAt: "2026-10-25T14:05:00+08:00" },
      { id: "playlist", icon: "🎶", title: "今日心情 DJ", description: "做一份能代表最近心情的歌單，準備好接受朋友點歌。", xp: 50, unlockedAt: "2026-10-21T23:08:00+08:00" },
      { id: "nope", icon: "🛑", title: "拒絕邀約不附論文", description: "婉拒一件不想做的事，並把省下的時間留給自己。", xp: 95, unlockedAt: null },
      { id: "desk", icon: "🕯️", title: "桌面重開機", description: "整理一小塊生活空間，找回消失已久的桌面本人。", xp: 55, unlockedAt: null },
      { id: "cooking", icon: "🍳", title: "自己餵飽自己", description: "親手準備一餐，泡麵加蛋也算有用心的版本。", xp: 55, unlockedAt: "2026-10-12T00:18:00+08:00" },
      { id: "offline", icon: "📵", title: "通知暫停營業", description: "替自己留一段不即時回覆訊息的時間，世界沒有因此停機。", xp: 65, unlockedAt: null }
    ]
  },
  {
    id: "creative-drawer", title: "靈感不保證準時到", symbol: "🖍️", tone: "linear-gradient(135deg, #786dec, #d260a7)",
    description: "畫畫、拍照、寫字或做點小東西，讓別人看到你喜歡怎麼表達。", source: "official",
    achievements: [
      { id: "draft", icon: "📝", title: "草稿先求存在", description: "寫下、畫出或做出第一版；它可以醜，但不能只住在腦中。", xp: 55, unlockedAt: "2026-10-20T19:16:00+08:00" },
      { id: "photo", icon: "📷", title: "日常取景框", description: "拍一張你想留住的瞬間，題材不限，食物也有肖像權。", xp: 45, unlockedAt: null },
      { id: "share", icon: "🪩", title: "作品勇敢出門", description: "把一個創作分享給朋友，收下稱讚或建議都算經驗值。", xp: 95, unlockedAt: null },
      { id: "doodle", icon: "✏️", title: "筆記邊界管理員", description: "在筆記、平板或便利貼上留下自己的塗鴉或小設計。", xp: 35, unlockedAt: "2026-09-10T11:35:00+08:00" },
      { id: "book", icon: "📖", title: "課本以外的世界", description: "讀一篇或一章你自己挑的內容，讓演算法以外的東西推薦你。", xp: 85, unlockedAt: null },
      { id: "idea", icon: "💡", title: "半夜點子有存檔", description: "記下一個突然冒出的點子，明天的你會感謝今天的你。", xp: 45, unlockedAt: "2026-10-01T02:10:00+08:00" }
    ]
  },
  {
    id: "adulting-beta", title: "大人模式 Beta 測試服", symbol: "🧾", tone: "linear-gradient(135deg, #65af91, #386da2)",
    description: "生活技能還在更新中：完成一點點就值得寫進更新日誌。", source: "official",
    achievements: [
      { id: "budget", icon: "💸", title: "錢包狀態已讀", description: "記下一週花費，知道錢錢都搭哪班車離開了。", xp: 85, unlockedAt: null },
      { id: "laundry", icon: "🧺", title: "衣服沒有自己洗", description: "完成一次洗、曬、收全流程；洗衣籃暫時失去人質。", xp: 55, unlockedAt: "2026-10-07T17:15:00+08:00" },
      { id: "call", icon: "☎️", title: "電話客服勇者", description: "自己打電話處理一件生活小事，沒有先寫三頁逐字稿也可以。", xp: 100, unlockedAt: null },
      { id: "form", icon: "📋", title: "表單提前投降", description: "在最後一天之前完成一份行政表單，贏過了拖延小怪。", xp: 65, unlockedAt: null },
      { id: "plant", icon: "🪴", title: "植物室友續約", description: "照顧一株植物一段時間；假如它是塑膠的，請改解鎖別項。", xp: 75, unlockedAt: null },
      { id: "repair", icon: "🔧", title: "生活故障排除中", description: "自己解決一個小問題，或找到願意教你的攻略高手。", xp: 70, unlockedAt: null }
    ]
  },
  {
    id: "soundtrack-shelf", title: "耳機裡的平行宇宙", symbol: "🎧", tone: "linear-gradient(135deg, #4d9ed1, #7157b5)",
    description: "歌單常常比自我介紹誠實；放幾個線索，等同好來認親。", source: "official",
    achievements: [
      { id: "current-song", icon: "🎵", title: "最近單曲循環中", description: "分享一首最近一直重播的歌，附上你喜歡它的理由。", xp: 50, unlockedAt: null },
      { id: "playlist-share", icon: "📻", title: "歌單交換生", description: "和朋友交換歌單，至少聽完對方推薦的一首。", xp: 75, unlockedAt: null },
      { id: "live-music", icon: "🎤", title: "現場音量體驗者", description: "看一場現場演出、校園表演或小型音樂活動。", xp: 100, unlockedAt: null },
      { id: "genre-explorer", icon: "🎼", title: "曲風跨服玩家", description: "試聽一種平常不會主動點開的曲風，找到一首喜歡的歌。", xp: 65, unlockedAt: null },
      { id: "karaoke", icon: "🎙️", title: "KTV 點歌負責人", description: "和朋友唱歌或分享你的必點曲；走音不影響解鎖。", xp: 55, unlockedAt: null }
    ]
  },
  {
    id: "quest-party", title: "手把派對與存檔點", symbol: "🎮", tone: "linear-gradient(135deg, #486bd3, #9b57a9)",
    description: "從桌遊到電玩，記下最近讓你忘記看時間的遊戲世界。", source: "official",
    achievements: [
      { id: "current-game", icon: "🕹️", title: "最近沉迷這一款", description: "分享最近在玩的遊戲，以及你推薦新手先做的第一件事。", xp: 50, unlockedAt: null },
      { id: "co-op", icon: "🤝", title: "合作模式不甩鍋", description: "和朋友玩一次合作遊戲，通關與否不影響隊友情誼。", xp: 85, unlockedAt: null },
      { id: "board-game", icon: "🎲", title: "桌遊規則讀取中", description: "玩一款桌遊或卡牌遊戲，至少成功搞懂一半規則。", xp: 75, unlockedAt: null },
      { id: "new-genre", icon: "🧩", title: "新類型新手村", description: "試玩一個平常不會選的遊戲類型，先玩十分鐘也算。", xp: 65, unlockedAt: null },
      { id: "recommend-game", icon: "⭐", title: "遊戲安利不強迫", description: "推薦一款你喜歡的遊戲，講清楚它適合哪種玩家。", xp: 70, unlockedAt: null }
    ]
  },
  {
    id: "campus-food-map", title: "校園附近吃什麼研究所", symbol: "🍜", tone: "linear-gradient(135deg, #e98d52, #ce5577)",
    description: "把口袋店家整理成地圖，讓下一次「吃什麼」少一點絕望。", source: "official",
    achievements: [
      { id: "pocket-shop", icon: "🥢", title: "口袋店家入庫", description: "推薦一家你常去或剛發現的店，記下必點菜色。", xp: 50, unlockedAt: null },
      { id: "budget-meal", icon: "🪙", title: "學生價格雷達", description: "找到一份吃得滿足又不太傷荷包的餐點。", xp: 60, unlockedAt: null },
      { id: "new-cuisine", icon: "🌶️", title: "菜單新手村", description: "試一種平常不會點的料理，辣度請量力而為。", xp: 75, unlockedAt: null },
      { id: "food-with-friend", icon: "🍱", title: "飯友成功配對", description: "和朋友一起吃飯，交換彼此的必吃清單。", xp: 80, unlockedAt: null },
      { id: "home-meal", icon: "🥘", title: "自己煮的都好吃", description: "做一份簡單的餐點；擺盤可選，吃完最重要。", xp: 65, unlockedAt: null }
    ]
  },
  {
    id: "fandom-lore", title: "興趣考古與冷知識部", symbol: "🔎", tone: "linear-gradient(135deg, #bd65a2, #5b65bd)",
    description: "影集、動畫、運動、書、角色或冷知識，找到你會想聊很久的東西。", source: "official",
    achievements: [
      { id: "current-favorite", icon: "✨", title: "近期本命公開", description: "分享最近喜歡的一部作品、一位創作者或一個主題。", xp: 50, unlockedAt: null },
      { id: "deep-dive", icon: "🕵️", title: "考古挖到凌晨", description: "為興趣查了一個冷知識，並把最有趣的部分講給朋友聽。", xp: 75, unlockedAt: null },
      { id: "recommendation", icon: "📚", title: "安利有備而來", description: "推薦一部作品或一本書，附上「適合什麼心情看」。", xp: 70, unlockedAt: null },
      { id: "fan-creation", icon: "🎨", title: "同人腦內劇場", description: "做一張收藏清單、寫心得或創作一點自己的延伸內容。", xp: 85, unlockedAt: null },
      { id: "fan-community", icon: "🌟", title: "同好訊號接收中", description: "參加一次和興趣有關的社群、活動或討論。", xp: 90, unlockedAt: null }
    ]
  },
  {
    id: "teamwork-chaos", title: "小組合作・奇蹟觀測站", symbol: "🧑‍🤝‍🧑", tone: "linear-gradient(135deg, #43ad9a, #4772bd)",
    description: "社團、志工、球隊和課堂分組：看看你在團隊裡最常是哪一種隊友。", source: "official",
    achievements: [
      { id: "club-contribution", icon: "📣", title: "社團不是只加群組", description: "替社團或團隊完成一件具體的小事，從搬椅子也算貢獻。", xp: 65, unlockedAt: null },
      { id: "volunteer", icon: "🧤", title: "志工新手上線", description: "參加一次志工、服務學習或校園公益活動。", xp: 100, unlockedAt: null },
      { id: "team-credit", icon: "🏅", title: "功勞有記得分", description: "完成合作後，記得說出自己和隊友各做了什麼。", xp: 60, unlockedAt: null },
      { id: "ask-for-help", icon: "🛟", title: "求救訊號已發送", description: "卡關時向隊友求助，讓合作不只剩下已讀不回。", xp: 70, unlockedAt: null },
      { id: "new-people", icon: "🧩", title: "跨圈組隊成功", description: "和一位平常不太會聊天的人一起完成一件事。", xp: 90, unlockedAt: null }
    ]
  },
  {
    id: "newbie-mode", title: "新手村勇者（勇敢一點點）", symbol: "🌱", tone: "linear-gradient(135deg, #75ba75, #34a9ad)",
    description: "不用突然變成另一個人，試一點新東西就能拓展你的自我介紹。", source: "official",
    achievements: [
      { id: "try-class", icon: "🧘", title: "體驗課簽到", description: "試上一堂沒上過的課或活動，先體驗再決定要不要入坑。", xp: 70, unlockedAt: null },
      { id: "go-solo", icon: "🎟️", title: "一個人也能出門", description: "獨自去一間店、看一場電影或參加一個活動。", xp: 90, unlockedAt: null },
      { id: "ask-recommendation", icon: "🗣️", title: "請教一位在地人", description: "問同學推薦一間店、一首歌或一個校園秘境。", xp: 60, unlockedAt: null },
      { id: "learn-skill", icon: "🛠️", title: "技能樹點一格", description: "學會一件新技能，哪怕只是第一次成功煎蛋。", xp: 85, unlockedAt: null },
      { id: "say-yes", icon: "🚪", title: "支線任務接受", description: "答應一個安全、舒服而且有點新鮮的邀請。", xp: 80, unlockedAt: null }
    ]
  }
];

const defaultProfile = {
  name: "玩家", pronoun: "", intro: "", tags: []
};

const badgeDefinitions = [
  { id: "starter", icon: "🌱", title: "序章玩家", description: "解鎖第一項人生小成就。", xp: 80, rule: state => totalUnlocked(state) >= 1 },
  { id: "conversation", icon: "🫧", title: "破冰預備員", description: "完成三項社交 DLC 支線，聊天話題已成功下載。", xp: 160, rule: state => completedIn(state, "small-talk-lab") >= 3 },
  { id: "wanderer", icon: "🧭", title: "偶遇收藏家", description: "完成三項校園半徑外的探險支線。", xp: 150, rule: state => completedIn(state, "outdoor-detour") >= 3 },
  { id: "steady", icon: "🫖", title: "溫柔續航", description: "完成三項低電量自救任務，記得定期回基地。", xp: 130, rule: state => completedIn(state, "tiny-comforts") >= 3 },
  { id: "curious", icon: "🔍", title: "好奇心不下線", description: "在四個不同系列留下足跡。", xp: 210, rule: state => state.filter(c => c.achievements.some(a => a.unlockedAt)).length >= 4 },
  { id: "collector", icon: "🏆", title: "成就櫃管理員", description: "累積解鎖 15 個成就。", xp: 280, rule: state => totalUnlocked(state) >= 15 },
  { id: "self-made", icon: "✨", title: "自訂宇宙", description: "建立自己的系列，記錄想成為的人。", xp: 180, rule: state => state.some(c => c.source === "custom") },
  { id: "completionist", icon: "👑", title: "一頁全亮", description: "完成任一系列的所有成就。", xp: 300, rule: state => state.some(c => c.achievements.length && c.achievements.every(a => a.unlockedAt)) },
  { id: "legend", icon: "🌌", title: "生活傳說", description: "累積解鎖 12 項官方系列成就，支線履歷已經很有料。", xp: 500, rule: state => totalUnlocked(state.filter(c => c.source === "official")) >= 12 },
  { id: "campus", icon: "🎒", title: "校園地圖全開", description: "完成兩項校園支線任務。", xp: 120, rule: state => completedIn(state, "campus-side-quests") >= 2 },
  { id: "maker", icon: "🖍️", title: "草稿敢死隊", description: "完成兩項創作支線，作品先出門再慢慢長大。", xp: 130, rule: state => completedIn(state, "creative-drawer") >= 2 },
  { id: "adulting", icon: "🧾", title: "大人模式已更新", description: "完成兩項生活技能任務，測試服玩家辛苦了。", xp: 130, rule: state => completedIn(state, "adulting-beta") >= 2 },
  { id: "soundtrack", icon: "🎧", title: "耳機借我聽一下", description: "完成兩項音樂支線，交換歌單的邀請已送出。", xp: 130, rule: state => completedIn(state, "soundtrack-shelf") >= 2 },
  { id: "player-two", icon: "🎮", title: "存檔點常客", description: "完成兩項遊戲支線，已找到可以一起組隊的人。", xp: 130, rule: state => completedIn(state, "quest-party") >= 2 },
  { id: "foodie", icon: "🍜", title: "校園美食雷達", description: "完成兩項覓食任務，你的口袋名單正在成形。", xp: 130, rule: state => completedIn(state, "campus-food-map") >= 2 },
  { id: "lorekeeper", icon: "🔎", title: "冷知識本人", description: "完成兩項興趣考古任務，現在可以開始分享你挖到的寶藏。", xp: 130, rule: state => completedIn(state, "fandom-lore") >= 2 },
  { id: "team-player", icon: "🧑‍🤝‍🧑", title: "隊友不是 NPC", description: "完成兩項團隊合作任務，隊伍裡有你真好。", xp: 130, rule: state => completedIn(state, "teamwork-chaos") >= 2 },
  { id: "newbie", icon: "🌱", title: "新手村畢業生", description: "完成兩項新手村支線，舒適圈地圖擴大了一格。", xp: 130, rule: state => completedIn(state, "newbie-mode") >= 2 }
];

let categories = cloneSeed();
let account = null;
let profile = { ...defaultProfile };
let profileSettings = normalizeProfileSettings();
let currentFilter = "all";
let pendingDialog = null;
let authMode = "login";
let authUser = null;
let authReady = false;
let authError = "";
let publicProfile = null;
let publicProfileLoading = false;
let publicProfileError = "";
let publicProfileRequest = 0;
let canEditCurrentProfile = false;

function cloneSeed() { return JSON.parse(JSON.stringify(seedCategories)); }
function starterCategories() {
  const starter = cloneSeed();
  starter.forEach(category => category.achievements.forEach(achievement => { achievement.unlockedAt = null; }));
  return starter;
}
function mergeOfficialCategories(savedCategories) {
  const saved = Array.isArray(savedCategories) ? savedCategories : [];
  const merged = saved.map(category => {
    const template = seedCategories.find(item => item.id === category.id);
    if (!template || category.source === "custom") return category;
    const previousAchievements = Array.isArray(category.achievements) ? category.achievements : [];
    const previousById = new Map(previousAchievements.map(achievement => [achievement.id, achievement]));
    const templateIds = new Set(template.achievements.map(achievement => achievement.id));
    return {
      ...category,
      ...template,
      achievements: [
        ...template.achievements.map(achievement => ({
          ...achievement,
          unlockedAt: previousById.get(achievement.id)?.unlockedAt || null
        })),
        ...previousAchievements.filter(achievement => !templateIds.has(achievement.id))
      ]
    };
  });
  seedCategories.forEach(template => {
    if (!merged.some(category => category.id === template.id)) {
      const category = JSON.parse(JSON.stringify(template));
      category.achievements.forEach(achievement => { achievement.unlockedAt = null; });
      merged.push(category);
    }
  });
  return merged;
}
function normalizeProfileSettings(settings) {
  const unlockedBackgrounds = [...new Set([
    ...DEFAULT_BACKGROUND_UNLOCKS,
    ...(Array.isArray(settings?.unlockedBackgrounds)
      ? settings.unlockedBackgrounds.filter(id => id !== "none" && Object.hasOwn(PROFILE_BACKGROUNDS, id))
      : [])
  ])];
  const color = /^#[0-9a-f]{6}$/i.test(settings?.backgroundColor || "")
    ? settings.backgroundColor
    : DEFAULT_PROFILE_SETTINGS.backgroundColor;
  const background = Object.hasOwn(PROFILE_BACKGROUNDS, settings?.background)
    && (settings.background === "none" || unlockedBackgrounds.includes(settings.background))
    ? settings.background
    : DEFAULT_PROFILE_SETTINGS.background;
  return { background, backgroundColor: color, unlockedBackgrounds };
}
function applyProfileBackground(settings) {
  const normalized = normalizeProfileSettings(settings);
  const background = PROFILE_BACKGROUNDS[normalized.background];
  document.body.style.backgroundColor = normalized.backgroundColor;
  document.body.style.backgroundImage = background.src
    ? `linear-gradient(${normalized.backgroundColor}35, ${normalized.backgroundColor}35), linear-gradient(rgba(7, 17, 31, .3), rgba(7, 17, 31, .4)), url("${encodeURIComponent(background.src)}")`
    : normalized.backgroundColor === DEFAULT_PROFILE_SETTINGS.backgroundColor
      ? "linear-gradient(145deg, #07111f 0%, #0b172a 48%, #10152d 100%)"
      : "none";
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundRepeat = "no-repeat";
  document.body.style.backgroundAttachment = "fixed";
}
async function saveProfile() {
  if (!supabaseClient || !authUser) throw new Error("登入狀態已失效，請重新登入後再試。");
  const { error } = await supabaseClient.from("profiles").upsert({
    id: authUser.id,
    email: authUser.email,
    display_name: profile.name,
    username_slug: profile.usernameSlug,
    intro: profile.intro,
    tags: profile.tags,
    categories,
    profile_settings: normalizeProfileSettings(profileSettings)
  }, { onConflict: "id" });
  if (error) throw error;
}
function saveState() { return saveProfile(); }
function allAchievements(state = categories) { return state.flatMap(c => c.achievements.map(a => ({ ...a, category: c }))); }
function totalUnlocked(state = categories) { return allAchievements(state).filter(a => a.unlockedAt).length; }
function totalAchievements(state = categories) { return state.reduce((sum, c) => sum + c.achievements.length, 0); }
function completedIn(state, categoryId) { return (state.find(c => c.id === categoryId)?.achievements || []).filter(a => a.unlockedAt).length; }
function earnedBadges(state = categories) { return badgeDefinitions.filter(badge => badge.rule(state)); }
function earnedBadgeIds(state = categories) { return new Set(earnedBadges(state).map(badge => badge.id)); }
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

function setRoute(nextRoute) { window.location.hash = nextRoute; }
function route() { return window.location.hash.slice(1) || "/"; }
function getCategory(id) { return categories.find(category => category.id === id); }
function navMarkup(active) {
  document.querySelectorAll("[data-nav]").forEach(link => link.classList.toggle("active", link.dataset.nav === active));
}
function updateHeader() {
  const name = authUser ? profile.name || "玩家" : "訪客";
  document.getElementById("profileMenuName").textContent = name;
  document.getElementById("profileMiniAvatar").textContent = authUser ? name.slice(0, 1) : "L";
  const publicMatch = route().match(/^\/u\/([^/]+)/);
  const viewingOwnPublicProfile = Boolean(publicMatch && publicProfile?.id === authUser?.id);
  const showNav = Boolean(authUser?.id && account?.initialized && (!publicMatch || viewingOwnPublicProfile));
  document.getElementById("topNav").hidden = !showNav;
  document.querySelector('[data-nav="profile"]').href = publicMatch && viewingOwnPublicProfile ? `#${publicRoute(profile.usernameSlug)}` : "#/profile";
  document.querySelector('[data-nav="collection"]').href = publicMatch && viewingOwnPublicProfile ? `#${publicRoute(profile.usernameSlug, "/collection")}` : "#/collection";
  document.querySelector('[data-nav="badges"]').href = publicMatch && viewingOwnPublicProfile ? `#${publicRoute(profile.usernameSlug, "/badges")}` : "#/badges";
  const menu = document.getElementById("accountMenuItems");
  menu.innerHTML = authUser && account?.initialized
    ? `<a href="#/">LifeUp 首頁</a><a href="#/profile">我的展櫃</a><button type="button" data-action="edit-profile">編輯個人檔案</button><button type="button" data-action="copy-profile-link">複製我的公開連結</button><div class="background-redeem"><label for="backgroundRedeemCode">兌換 GIF 背景</label><p>輸入指定名稱解鎖限定背景</p><div><input id="backgroundRedeemCode" type="text" maxlength="20" autocomplete="off" placeholder="兌換名稱"><button type="button" data-action="redeem-background">兌換</button></div></div><button type="button" data-action="sign-out">登出</button>`
    : `<a href="#/">LifeUp 首頁</a><button type="button" data-action="open-login">登入</button><button type="button" data-action="open-register">建立帳號</button>`;
}
function iconButton(label, action, icon = "+") { return `<button type="button" class="primary-button" data-action="${action}">${icon} ${label}</button>`; }
function progressMarkup(progress) { return `<div class="progress-track" aria-label="進度 ${Math.round(progress)}%"><div class="progress-fill" style="width:${Math.max(0, Math.min(100, progress))}%"></div></div>`; }
function categoryArt(category, className = "category-art") { return `<div class="${className}" style="background:${category.tone}">${escapeHtml(category.symbol || "✦")}</div>`; }

function authErrorMessage(error) {
  const message = error?.message || String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "電子郵件或密碼不正確。";
  if (normalized.includes("email not confirmed")) return "請先點擊驗證信中的連結，再登入。";
  if (normalized.includes("user already registered")) return "這個電子郵件已註冊，請直接登入。";
  if (normalized.includes("password should be at least")) return "密碼至少需要 8 個字元。";
  return message;
}

function clearSession() {
  authUser = null;
  account = null;
  profile = { ...defaultProfile };
  profileSettings = normalizeProfileSettings();
  categories = cloneSeed();
}

function usernameSlugify(text) {
  const slug = String(text).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 22).replace(/-+$/g, "");
  return slug || "player";
}

function suggestedUsernameSlug(text, userId = "") {
  const suffix = userId.replace(/-/g, "").slice(0, 6);
  return `${usernameSlugify(text)}${suffix ? `-${suffix}` : ""}`;
}

function publicRoute(slug, page = "") {
  return `/u/${encodeURIComponent(slug)}${page ? `/${page.replace(/^\/+/, "")}` : ""}`;
}

function routeHref(page) {
  const publicMatch = route().match(/^\/u\/([^/]+)/);
  if (!publicMatch) return `#${page === "/" ? "/" : page}`;
  let slug;
  try { slug = decodeURIComponent(publicMatch[1]); } catch { slug = publicMatch[1]; }
  return `#${publicRoute(slug, page === "/profile" ? "" : page)}`;
}

function publicProfileUrl(slug = profile.usernameSlug) {
  return `${window.location.origin}${window.location.pathname}#${publicRoute(slug)}`;
}

async function copyProfileLink() {
  if (!authUser || !account?.initialized || !profile.usernameSlug) {
    showToast("請先完成個人展櫃設定，再分享公開連結。");
    return;
  }
  try {
    await navigator.clipboard.writeText(publicProfileUrl());
    showToast("公開連結已複製，可以貼到你的社群 Bio！");
  } catch (error) {
    showToast(`無法複製連結：${authErrorMessage(error)}`);
  }
}

async function loadUserProfile(user) {
  authUser = user;
  const metadataName = String(user.user_metadata?.display_name || "").trim();
  account = {
    email: user.email || "",
    name: metadataName || (user.email || "玩家").split("@")[0],
    initialized: false
  };
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id,email,username_slug,display_name,intro,tags,categories,profile_settings")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    profile = { ...defaultProfile, name: account.name, usernameSlug: suggestedUsernameSlug(account.name, user.id) };
    profileSettings = normalizeProfileSettings();
    categories = starterCategories();
    return;
  }

  profile = {
    ...defaultProfile,
    name: data.display_name,
    usernameSlug: data.username_slug,
    intro: data.intro,
    tags: Array.isArray(data.tags) ? data.tags : []
  };
  profileSettings = normalizeProfileSettings(data.profile_settings);
  categories = mergeOfficialCategories(Array.isArray(data.categories) ? data.categories : starterCategories());
  account = { ...account, name: profile.name, initialized: true };
}

async function loadPublicProfile(slug) {
  const request = ++publicProfileRequest;
  publicProfileLoading = true;
  publicProfileError = "";
  publicProfile = null;
  render();
  try {
    const { data, error } = await supabaseClient.rpc("get_public_profile", { profile_slug: slug });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (request !== publicProfileRequest) return;
    publicProfile = row ? {
      id: row.id,
      profile: {
        ...defaultProfile,
        name: row.display_name,
        usernameSlug: row.username_slug,
        intro: row.intro,
        tags: Array.isArray(row.tags) ? row.tags : []
      },
      profileSettings: normalizeProfileSettings(row.profile_settings),
      categories: mergeOfficialCategories(Array.isArray(row.categories) ? row.categories : starterCategories())
    } : null;
  } catch (error) {
    if (request !== publicProfileRequest) return;
    publicProfileError = authErrorMessage(error);
  } finally {
    if (request === publicProfileRequest) {
      publicProfileLoading = false;
      render();
    }
  }
}

async function initializeAuth() {
  if (!supabaseClient) {
    authReady = true;
    if (route().startsWith("/u/")) publicProfileError = supabaseConfigurationError;
    render();
    return;
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;
    window.setTimeout(async () => {
      if (!session) {
        clearSession();
        authMode = "login";
        authError = "";
        authReady = true;
        publicProfile = null;
        if (route() !== "/" && route() !== "/home" && route() !== "/login" && !route().startsWith("/u/")) setRoute("/");
        render();
        return;
      }
      if (session.user.id === authUser?.id && account?.initialized) return;
      authReady = false;
      authError = "";
      render();
      try {
        await loadUserProfile(session.user);
        const path = route();
        if (!account.initialized && path !== "/onboarding" && !path.startsWith("/u/") && path !== "/" && path !== "/home") setRoute("/onboarding");
        else if (account.initialized && path === "/login") setRoute("/profile");
        if (path.startsWith("/u/")) await loadPublicProfile(decodeURIComponent(path.split("/")[2]));
      } catch (error) {
        authError = `無法載入個人檔案：${authErrorMessage(error)}`;
      }
      authReady = true;
      render();
    }, 0);
  });

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (data.session?.user) {
      await loadUserProfile(data.session.user);
      const path = route();
      if (!account.initialized && path !== "/onboarding" && !path.startsWith("/u/") && path !== "/" && path !== "/home") setRoute("/onboarding");
    }
  } catch (error) {
    authError = `無法確認登入狀態：${authErrorMessage(error)}`;
  }
  authReady = true;
  if (route().startsWith("/u/")) {
    let slug;
    try { slug = decodeURIComponent(route().split("/")[2]); } catch { slug = ""; }
    if (slug) await loadPublicProfile(slug);
    else render();
  } else {
    render();
  }
}

function profilePage() {
  navMarkup("profile");
  const level = levelInfo();
  const recentlyActive = [...categories].sort((a, b) => {
    const aTime = categoryStats(a).latest?.unlockedAt || "";
    const bTime = categoryStats(b).latest?.unlockedAt || "";
    return new Date(bTime || 0) - new Date(aTime || 0);
  }).slice(0, RECENT_CATEGORY_LIMIT);
  const previewBadges = earnedBadges();
  return `
    <section class="hero">
      <div class="profile-content">
        <div class="profile-main">
          <div class="avatar" role="img" aria-label="${escapeHtml(profile.name)}的頭像"><span aria-hidden="true">${escapeHtml(profile.name.slice(0, 1))}</span></div>
          <div class="profile-copy">
            <div class="status-line"><span class="status-dot"></span>本週正在收集生活碎片</div>
            <div class="name-line"><h1>${escapeHtml(profile.name)}</h1>${profile.pronoun ? `<span class="pronoun">${escapeHtml(profile.pronoun)}</span>` : ""}</div>
            <p class="intro">${escapeHtml(profile.intro)}</p>
          </div>
        </div>
        <div class="profile-footer">
          <div class="tags">${profile.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
          <div class="profile-page-actions">${canEditCurrentProfile
            ? `<a class="profile-public-url" href="#${publicRoute(profile.usernameSlug)}" target="_blank" rel="noopener">公開網址：${escapeHtml(window.location.host)}${escapeHtml(window.location.pathname)}#/u/${escapeHtml(profile.usernameSlug)}</a><button class="quiet-button" type="button" data-action="edit-profile">編輯展櫃</button><button class="quiet-button" type="button" data-action="copy-profile-link">複製公開連結</button>`
            : `<span class="public-profile-label">公開玩家展櫃</span>`}</div>
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
        <div class="section-title"><div><h2>最新動態</h2><p>依最近解鎖時間排列 · 顯示最近 ${RECENT_CATEGORY_LIMIT} 個系列</p></div><a class="text-link" href="${routeHref("/collection")}">查看全部 →</a></div>
        <div class="activity-list">
          ${recentlyActive.map(category => {
            const stats = categoryStats(category);
            const preview = category.achievements.slice(0, 4);
            return `<a href="${routeHref(`/category/${encodeURIComponent(category.id)}`)}" class="activity-card" aria-label="開啟 ${escapeHtml(category.title)} 成就">
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
        <section class="section-card"><div class="section-title"><div><h2>靈魂徽章</h2><p>${previewBadges.length} / ${badgeDefinitions.length} 已獲得</p></div><a class="text-link" href="${routeHref("/badges")}">全部 →</a></div>
          <div class="badges-preview"><div class="badge-preview-grid">${previewBadges.length ? previewBadges.map(badge => `<div class="badge-mini" title="${escapeHtml(badge.title)}">${badge.icon}</div>`).join("") : `<p class="badge-empty">尚未獲得徽章</p>`}</div></div>
        </section>
        <section class="section-card side-stat"><dl><dt>探索系列</dt><dd>${categories.length}</dd><dt>完成成就</dt><dd>${totalUnlocked()} / ${totalAchievements()}</dd><dt>總經驗值</dt><dd>${level.xp.toLocaleString()} XP</dd></dl></section>
        <aside class="side-quote"><strong>今日遊戲提示</strong>不用把每件事變成任務；願意記住小事，就已經很厲害了。</aside>
      </aside>
    </div>`;
}

function landingPage() {
  navMarkup("");
  return `<section class="landing-hero">
    <div class="landing-copy"><p class="eyebrow">YOUR LIFE, IN SIDE QUESTS</p><h1>人生不是履歷，<br><span>是正在解鎖的遊戲。</span></h1><p>打造一座像 Steam 個人檔案一樣的生活成就展櫃，分享你的興趣、故事與最近解鎖的小成就。</p>
      <div class="landing-actions">${authUser && account?.initialized
        ? `<a class="primary-button" href="#/profile">回到我的展櫃 →</a><button class="quiet-button" type="button" data-action="copy-profile-link">複製我的公開連結</button>`
        : `<button class="primary-button" type="button" data-action="open-register">建立我的展櫃 →</button><button class="quiet-button" type="button" data-action="open-login">已有帳號？登入</button>`}
      </div>
      <div class="landing-stats"><span><strong>YOUR STORY</strong>由你定義</span><span><strong>SHAREABLE</strong>一條連結認識你</span><span><strong>LEVEL UP</strong>收藏每個小成就</span></div>
    </div>
    <div class="landing-showcase" aria-label="生活成就展櫃示意">
      <div class="showcase-topline"><span><i></i> PLAYER PROFILE</span><span>LV. 08</span></div>
      <div class="showcase-player"><div class="showcase-avatar">✦</div><div><strong>你的名字</strong><span>正在收集生活碎片</span></div></div>
      <div class="showcase-xp"><div><span>本週經驗值</span><strong>2,480 XP</strong></div><div class="progress-track"><div class="progress-fill" style="width:68%"></div></div></div>
      <div class="showcase-achievements"><div class="showcase-section-title"><strong>最近解鎖</strong><span>探索更多 →</span></div>
        <div><i>🎒</i><span><strong>校園支線任務</strong><small>最後一排觀察家</small></span><b>+40 XP</b></div>
        <div><i>🫧</i><span><strong>社交小實驗室</strong><small>第一句不是你好</small></span><b>+70 XP</b></div>
        <div><i>⛰️</i><span><strong>戶外與生活冒險</strong><small>說走就走的旅行</small></span><b>+120 XP</b></div>
      </div>
      <div class="showcase-foot"><span>✦ 生活徽章</span><span>🎖️ 🎨 🌱 🧭</span></div>
    </div>
    <div class="landing-orbit landing-orbit-one"></div><div class="landing-orbit landing-orbit-two"></div>
  </section>
  <section class="landing-bottom"><div><span class="landing-bottom-icon">01</span><h2>整理你的世界</h2><p>用系列收藏興趣、日常與人生支線。</p></div><div><span class="landing-bottom-icon">02</span><h2>點亮每個成就</h2><p>記下那些值得替自己鼓掌的時刻。</p></div><div><span class="landing-bottom-icon">03</span><h2>分享你的專屬網址</h2><p>放進社群 Bio，讓每次相遇都有話題。</p></div></section>`;
}

function loginPage() {
  const registering = authMode === "register";
  const submitLabel = registering ? "建立帳號並開始冒險 →" : "登入並前往展櫃 →";
  return `<section class="auth-layout">
    <aside class="auth-story"><div class="auth-brand"><span class="brand-mark">L</span><span>life<span style="color:var(--blue)">up</span></span></div>
      <div class="auth-copy"><p class="eyebrow">YOUR LIFE, IN SIDE QUESTS</p><h1>把日常，變成值得聊起來的成就。</h1><p>建立一個可以放進 Bio 的生活展櫃。讓來訪的人看見你的興趣，也看見適合開口的話題。</p><div class="auth-steps"><span><b>1</b> 登入你的展櫃</span><span><b>2</b> 設定第一張個人檔案</span><span><b>3</b> 開始點亮生活成就</span></div></div>
    </aside>
    <section class="auth-form-panel">
      <div class="auth-tabs" role="tablist" aria-label="帳號操作">
        <button type="button" class="auth-tab ${registering ? "" : "active"}" data-auth-mode="login" role="tab" aria-selected="${!registering}">登入</button>
        <button type="button" class="auth-tab ${registering ? "active" : ""}" data-auth-mode="register" role="tab" aria-selected="${registering}">建立帳號</button>
      </div>
      <h2>${registering ? "開啟你的新展櫃" : "歡迎回來"}</h2><p>${registering ? "建立帳號後，你的成就與個人檔案會安全地保存在雲端。" : "登入後繼續收集你的生活碎片。"}</p>
      ${supabaseConfigurationError ? `<p class="auth-alert" role="alert">${escapeHtml(supabaseConfigurationError)}</p>` : ""}
      <form class="auth-form" id="authForm">
        ${registering ? `<div class="form-field"><label for="authName">玩家暱稱</label><input id="authName" name="name" type="text" autocomplete="nickname" maxlength="20" required placeholder="想被怎樣稱呼？"></div>` : ""}
        <div class="form-field"><label for="authEmail">電子郵件</label><input id="authEmail" name="email" type="email" autocomplete="email" required placeholder="you@example.com"></div>
        <div class="form-field"><label for="authPassword">密碼</label><input id="authPassword" name="password" type="password" autocomplete="${registering ? "new-password" : "current-password"}" minlength="8" required placeholder="${registering ? "至少 8 個字元" : "輸入你的密碼"}"></div>
        ${registering ? `<div class="form-field"><label for="authPasswordConfirm">確認密碼</label><input id="authPasswordConfirm" name="passwordConfirm" type="password" autocomplete="new-password" minlength="8" required placeholder="再輸入一次密碼"></div>` : ""}
        <button class="primary-button" type="submit" ${supabaseClient ? "" : "disabled"}>${submitLabel}</button>
      </form>
      <p class="auth-note">${registering ? "若已啟用電子郵件驗證，請先點擊收到的驗證信，再登入。" : "使用註冊時設定的電子郵件與密碼登入。你的資料會與帳號同步。"}</p>
    </section>
  </section>`;
}

function onboardingPage() {
  const name = account?.name || "玩家";
  const usernameSlug = profile.usernameSlug || suggestedUsernameSlug(name, authUser?.id || "");
  return `<section class="auth-layout">
    <aside class="auth-story"><div class="auth-brand"><span class="brand-mark">L</span><span>life<span style="color:var(--blue)">up</span></span></div>
      <div class="auth-copy"><p class="eyebrow">FIRST LOGIN SETUP</p><h1>先替你的展櫃留下一點個性。</h1><p>不用一次說完自己。從名字、簡介與幾個關鍵字開始，之後隨時可以補完。</p><div class="auth-steps"><span><b>✓</b> 已登入</span><span><b>2</b> 初始化個人檔案</span><span><b>3</b> 解鎖第一個成就</span></div></div>
    </aside>
    <section class="auth-form-panel"><div class="onboarding-avatar">${escapeHtml(name.slice(0, 1))}</div><h2>嗨，${escapeHtml(name)}</h2><p>建立第一張玩家名片吧。</p>
      <form class="auth-form" id="onboardingForm"><div class="form-field"><label for="setupName">展示名稱</label><input id="setupName" name="name" maxlength="20" required value="${escapeHtml(name)}"></div><div class="form-field"><label for="setupSlug">專屬網址名稱</label><input id="setupSlug" name="usernameSlug" maxlength="30" pattern="[a-z0-9]+(-[a-z0-9]+)*" autocomplete="off" required value="${escapeHtml(usernameSlug)}"><p class="tag-input-hint">公開網址：${escapeHtml(window.location.origin)}${escapeHtml(window.location.pathname)}#/u/<span id="onboardingSlugPreview">${escapeHtml(usernameSlug)}</span></p></div><div class="form-field"><label for="setupIntro">一句自我介紹</label><textarea id="setupIntro" name="intro" maxlength="180" required placeholder="例如：慢熟型人類，正在把日常收集成有趣的支線任務。"></textarea></div><div class="form-field"><label for="setupTags">你的關鍵字</label><input id="setupTags" name="tags" maxlength="100" required value="#慢熟玩家, #社交練習中, #夜行性" placeholder="#校園玩家, #咖啡控, #散步中"></div><p class="tag-input-hint">用逗號分隔，最多 5 個標籤。</p><button class="primary-button" type="submit">完成設定，進入展櫃 →</button></form>
      <button class="quiet-button auth-signout" type="button" data-action="sign-out">登出帳號</button>
    </section>
  </section>`;
}

function authLoadingPage() {
  const publicMatch = route().match(/^\/u\/([^/]+)/);
  let publicUsername = "";
  if (publicMatch) {
    try { publicUsername = decodeURIComponent(publicMatch[1]); } catch { publicUsername = publicMatch[1]; }
  }
  const title = publicUsername
    ? `正在載入 ${publicUsername} 的展櫃…`
    : "正在載入你的展櫃…";
  return `<section class="auth-loading section-card" role="status"><span class="loading-orb">L</span><h1>${escapeHtml(title)}</h1><p>同步帳號與成就資料，請稍候。</p></section>`;
}

function authErrorPage() {
  return `<section class="auth-layout">
    <aside class="auth-story"><div class="auth-brand"><span class="brand-mark">L</span><span>life<span style="color:var(--blue)">up</span></span></div><div class="auth-copy"><p class="eyebrow">PROFILE SYNC</p><h1>展櫃暫時無法載入。</h1><p>你的登入狀態仍然有效，請稍後重試，或登出後重新登入。</p></div></aside>
    <section class="auth-form-panel"><h2>同步遇到問題</h2><p class="auth-alert" role="alert">${escapeHtml(authError)}</p><button class="primary-button" type="button" data-action="retry-profile">重新載入</button><button class="quiet-button auth-signout" type="button" data-action="sign-out">登出帳號</button></section>
  </section>`;
}

function collectionPage() {
  navMarkup("collection");
  const completed = totalUnlocked();
  return `
    <section class="page-banner">
      <div><div class="breadcrumb"><a href="${routeHref("/profile")}">我的展櫃</a><span>/</span><span>成就圖鑑</span></div><h1>成就圖鑑</h1><p>12 個官方系列從校園、音樂、遊戲到口袋名單，替你的興趣留下線索，讓朋友更容易找到共同話題；也可以建立只屬於你的關卡。</p></div>
      <div class="banner-total"><strong>${completed} / ${totalAchievements()}</strong><span>已解鎖成就</span></div>
    </section>
    <div class="collection-toolbar"><span class="category-count">${categories.length} 個系列 · 依最近解鎖時間整理</span>${canEditCurrentProfile ? iconButton("建立我的系列", "add-category") : ""}</div>
    <section class="category-grid">
      ${[...categories].sort((a, b) => new Date(categoryStats(b).latest?.unlockedAt || 0) - new Date(categoryStats(a).latest?.unlockedAt || 0)).map(category => {
        const stats = categoryStats(category);
        return `<a href="${routeHref(`/category/${encodeURIComponent(category.id)}`)}" class="collection-card" data-symbol="${escapeHtml(category.symbol)}">
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
      <div><div class="breadcrumb"><a href="${routeHref("/profile")}">我的展櫃</a><span>/</span><a href="${routeHref("/collection")}">成就圖鑑</a><span>/</span><span>${escapeHtml(category.title)}</span></div><h1>${escapeHtml(category.symbol)} ${escapeHtml(category.title)}</h1><p>${escapeHtml(category.description)}</p></div>
      <div class="page-banner-actions">
        ${canEditCurrentProfile && category.source === "custom" ? `<button class="quiet-button danger-button" type="button" data-action="delete-category" data-category-id="${escapeHtml(category.id)}">刪除系列</button>` : ""}
        <div class="banner-total"><strong>${stats.count} / ${stats.total}</strong><span>解鎖進度</span></div>
      </div>
    </section>
    <div class="category-detail">
      <div>
        <section class="section-card detail-progress"><div class="detail-progress-row"><span>系列完成度</span><span>${Math.round(stats.progress)}%</span></div>${progressMarkup(stats.progress)}</section>
        <section class="section-card">
          <div class="section-title"><div><h2>成就清單</h2><p>${canEditCurrentProfile ? "點選卡片即可切換解鎖狀態" : "這是玩家收藏的成就紀錄"}</p></div>${canEditCurrentProfile ? iconButton("新增成就", "add-achievement", "+") : ""}</div>
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
  const content = `
    <span class="achievement-icon">${achievement.unlockedAt ? escapeHtml(achievement.icon) : "🔒"}</span>
    <span class="achievement-info"><h3>${escapeHtml(achievement.title)}</h3><p>${escapeHtml(achievement.description)}</p>${achievement.unlockedAt ? `<span class="unlock-meta">${dateLabel(achievement.unlockedAt)} 解鎖</span>` : ""}</span>
    <span class="achievement-xp">+${achievement.xp} XP</span>`;
  return canEditCurrentProfile
    ? `<div class="achievement-item"><button class="achievement-row ${achievement.unlockedAt ? "" : "locked"}" type="button" data-action="toggle-achievement" data-category-id="${escapeHtml(category.id)}" data-achievement-id="${escapeHtml(achievement.id)}" aria-pressed="${Boolean(achievement.unlockedAt)}">${content}</button>${category.source === "custom" ? `<button class="delete-entry-button" type="button" data-action="delete-achievement" data-category-id="${escapeHtml(category.id)}" data-achievement-id="${escapeHtml(achievement.id)}" aria-label="刪除成就：${escapeHtml(achievement.title)}" title="刪除成就">×</button>` : ""}</div>`
    : `<div class="achievement-row ${achievement.unlockedAt ? "" : "locked"}">${content}</div>`;
}

function badgesPage() {
  navMarkup("badges");
  const level = levelInfo();
  const unlocked = earnedBadges();
  return `
    <section class="page-banner">
      <div><div class="breadcrumb"><a href="${routeHref("/profile")}">我的展櫃</a><span>/</span><span>靈魂徽章</span></div><h1>靈魂徽章</h1><p>徽章不是分數，而是那些你曾經跨出去、也曾好好照顧自己的證明。</p></div>
      <div class="badge-level"><div class="level-orb">${level.level}</div><div><h2>等級 ${level.level}</h2><p>${level.xp.toLocaleString()} XP · ${unlocked.length} 枚徽章</p></div></div>
    </section>
    <section class="badges-grid">
      ${unlocked.length ? unlocked.map(badge => `<article class="badge-card"><span class="badge-lock">已獲得</span><div class="badge-icon">${badge.icon}</div><h2>${escapeHtml(badge.title)}</h2><p>${escapeHtml(badge.description)}</p><footer><span>收藏成功</span><span>+${badge.xp} XP</span></footer></article>`).join("") : `<div class="badge-empty-state">${emptyState("尚未獲得徽章", "完成一項成就，開始收集你的第一枚徽章吧。")}</div>`}
    </section>`;
}

function notFoundPage() {
  navMarkup("");
  return `<section class="section-card"><div class="empty-state"><span class="empty-icon">?</span><h2>這個頁面還沒被解鎖</h2><p>也許它藏在別的系列裡。</p><a class="primary-button" href="${routeHref("/profile")}">回到我的展櫃</a></div></section>`;
}
function emptyState(title, description) { return `<div class="empty-state"><span class="empty-icon">✦</span><h2>${title}</h2><p>${description}</p></div>`; }

function publicRoutePage(path) {
  if (publicProfileLoading) return authLoadingPage();
  if (publicProfileError) return `<section class="section-card"><div class="empty-state"><span class="empty-icon">!</span><h2>展櫃載入失敗</h2><p>${escapeHtml(publicProfileError)}</p><button class="primary-button" type="button" data-action="retry-public-profile">重新載入</button></div></section>`;
  if (!publicProfile) return `<section class="section-card"><div class="empty-state"><span class="empty-icon">?</span><h2>找不到這座展櫃</h2><p>網址可能輸入錯誤，或這個玩家尚未建立公開檔案。</p><a class="primary-button" href="#/">回到 LifeUp 首頁</a></div></section>`;

  const previousProfile = profile;
  const previousCategories = categories;
  const previousCanEdit = canEditCurrentProfile;
  profile = publicProfile.profile;
  categories = publicProfile.categories;
  canEditCurrentProfile = Boolean(authUser && authUser.id === publicProfile.id && account?.initialized);
  try {
    const segments = path.split("/").filter(Boolean);
    const page = segments[2] || "";
    if (page === "collection") return collectionPage();
    if (page === "badges") return badgesPage();
    if (page === "category") {
      let categoryId;
      try { categoryId = decodeURIComponent(segments.slice(3).join("/")); } catch { categoryId = ""; }
      return categoryPage(categoryId);
    }
    if (!page) return profilePage();
    return notFoundPage();
  } finally {
    profile = previousProfile;
    categories = previousCategories;
    canEditCurrentProfile = previousCanEdit;
  }
}

function render() {
  const path = route();
  const app = document.getElementById("app");
  const publicMatch = path.match(/^\/u\/([^/]+)/);
  const activeSettings = publicMatch
    ? publicProfile?.profileSettings || DEFAULT_PROFILE_SETTINGS
    : authUser
      ? profileSettings
      : DEFAULT_PROFILE_SETTINGS;
  applyProfileBackground(activeSettings);
  const needsLogin = path === "/login";
  const needsOnboarding = Boolean(authUser && !account?.initialized && !["/", "/home", "/login"].includes(path) && !publicMatch);
  const privateRoute = ["/profile", "/collection", "/badges", "/onboarding"].includes(path) || path.startsWith("/category/");
  canEditCurrentProfile = Boolean(authUser && account?.initialized && (privateRoute || (publicMatch && publicProfile?.id === authUser.id)));
  document.body.classList.toggle("auth-view", !authReady || Boolean(authError) || needsLogin || needsOnboarding);
  updateHeader();
  if (!authReady) app.innerHTML = authLoadingPage();
  else if (authError) app.innerHTML = authErrorPage();
  else if (publicMatch) app.innerHTML = publicRoutePage(path);
  else if (needsOnboarding) app.innerHTML = onboardingPage();
  else if (needsLogin && !authUser) app.innerHTML = loginPage();
  else if (needsLogin && authUser) app.innerHTML = account?.initialized ? profilePage() : onboardingPage();
  else if (path === "/" || path === "/home") app.innerHTML = landingPage();
  else if (!authUser && privateRoute) app.innerHTML = loginPage();
  else if (path === "/profile") app.innerHTML = profilePage();
  else if (path === "/collection") app.innerHTML = collectionPage();
  else if (path === "/badges") app.innerHTML = badgesPage();
  else if (path.startsWith("/category/")) app.innerHTML = categoryPage(decodeURIComponent(path.split("/").slice(2).join("/")));
  else app.innerHTML = notFoundPage();
  app.focus({ preventScroll: true });
}

async function handleRouteChange() {
  currentFilter = "all";
  const path = route();
  publicProfileRequest++;
  publicProfile = null;
  publicProfileError = "";
  publicProfileLoading = false;
  const publicMatch = path.match(/^\/u\/([^/]+)/);
  if (publicMatch) {
    let slug;
    try { slug = decodeURIComponent(publicMatch[1]); } catch { slug = ""; }
    if (!slug) {
      render();
      return;
    }
    if (!supabaseClient) {
      publicProfileError = supabaseConfigurationError || "無法連線至 Supabase。";
      render();
      return;
    }
    await loadPublicProfile(slug);
    return;
  }
  if (!authUser && (path === "/profile" || path === "/collection" || path === "/badges" || path === "/onboarding" || path.startsWith("/category/"))) {
    setRoute("/login");
    return;
  }
  if (authUser && !account?.initialized && !["/", "/home", "/login", "/onboarding"].includes(path)) {
    setRoute("/onboarding");
    return;
  }
  render();
}

function showToast(message) {
  const region = document.getElementById("toastRegion");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  region.append(toast);
  setTimeout(() => toast.remove(), 3100);
}

function showNewBadges(previousBadgeIds) {
  const newlyEarned = earnedBadges().filter(badge => !previousBadgeIds.has(badge.id));
  if (!newlyEarned.length) return;
  document.getElementById("badgeRewardList").innerHTML = newlyEarned.map(badge => `
    <article class="badge-reward-card">
      <div class="badge-reward-icon" aria-hidden="true">${badge.icon}</div>
      <div><h3>${escapeHtml(badge.title)}</h3><p>${escapeHtml(badge.description)}</p><span>+${badge.xp} XP</span></div>
    </article>`).join("");
  document.getElementById("badgeRewardDialog").showModal();
}

function closeBadgeReward() {
  const dialog = document.getElementById("badgeRewardDialog");
  if (dialog.open) dialog.close();
}

function openDialog(type, categoryId = null) {
  const dialog = document.getElementById("entryDialog");
  const fields = document.getElementById("formFields");
  const title = document.getElementById("dialogTitle");
  const eyebrow = document.getElementById("dialogEyebrow");
  document.getElementById("dialogSubmit").disabled = false;
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

function decodeRouteSegment(segment) {
  try { return decodeURIComponent(segment); } catch { return segment; }
}

function openProfileDialog() {
  if (!authUser || !account?.initialized) return;
  document.getElementById("editDisplayName").value = profile.name;
  document.getElementById("editUsernameSlug").value = profile.usernameSlug;
  document.getElementById("editIntro").value = profile.intro;
  document.getElementById("editTags").value = profile.tags.join(", ");
  const backgroundSelect = document.getElementById("editBackground");
  const ownedBackgrounds = ["none", ...profileSettings.unlockedBackgrounds];
  backgroundSelect.innerHTML = ownedBackgrounds.map(id => `<option value="${id}">${PROFILE_BACKGROUNDS[id].label}${id !== "none" && DEFAULT_BACKGROUND_UNLOCKS.includes(id) ? " · 開號獎勵" : ""}</option>`).join("");
  backgroundSelect.value = profileSettings.background;
  document.getElementById("editBackgroundColor").value = profileSettings.backgroundColor;
  document.getElementById("profileDialog").showModal();
}

async function redeemBackground() {
  if (!authUser || !account?.initialized) return;
  const input = document.getElementById("backgroundRedeemCode");
  if (input.value.trim() !== "黑神話") {
    showToast("兌換名稱不正確。");
    return;
  }
  if (profileSettings.unlockedBackgrounds.includes("wukong")) {
    showToast("孫悟空 GIF 背景已在你的收藏中。");
    return;
  }
  const previousSettings = profileSettings;
  profileSettings = {
    ...profileSettings,
    unlockedBackgrounds: [...profileSettings.unlockedBackgrounds, "wukong"]
  };
  try {
    await saveProfile();
    if (publicProfile?.id === authUser.id) publicProfile.profileSettings = { ...profileSettings };
    input.value = "";
    render();
    showToast("兌換成功！已解鎖孫悟空 GIF 背景。");
  } catch (error) {
    profileSettings = previousSettings;
    showToast(`背景兌換儲存失敗：${authErrorMessage(error)}`);
  }
}

function closeProfileDialog() {
  document.getElementById("profileDialog").close();
}

async function submitDialog(event) {
  event.preventDefault();
  if (!pendingDialog) return;
  const form = new FormData(event.currentTarget);
  const title = String(form.get("title") || "").trim();
  const description = String(form.get("description") || "").trim();
  if (!title || !description) return;
  const previousCategories = JSON.parse(JSON.stringify(categories));
  const previousBadgeIds = earnedBadgeIds();
  if (pendingDialog.type === "category") {
    const category = { id: slugify(title), title, description, symbol: String(form.get("symbol") || "✨").trim() || "✨", tone: String(form.get("tone")), source: "custom", achievements: [] };
    categories.unshift(category);
  } else {
    const category = getCategory(decodeRouteSegment(pendingDialog.categoryId));
    if (!category) return;
    category.achievements.push({ id: slugify(title), title, description, icon: String(form.get("icon") || "✦").trim() || "✦", xp: Number(form.get("xp")), unlockedAt: null });
  }
  const submitButton = document.getElementById("dialogSubmit");
  submitButton.disabled = true;
  try {
    await saveState();
    const savedCategory = pendingDialog.type === "category" ? categories[0] : null;
    closeDialog();
    if (savedCategory) {
      setRoute(`/category/${encodeURIComponent(savedCategory.id)}`);
      showToast("新系列已加入你的展櫃 ✨");
    } else {
      closeDialog();
      render();
      showToast("新的小成就已加入，等你點亮。");
    }
    showNewBadges(previousBadgeIds);
  } catch (error) {
    categories = previousCategories;
    submitButton.disabled = false;
    showToast(`儲存失敗：${authErrorMessage(error)}`);
  }
}

async function submitAuth(event) {
  event.preventDefault();
  const formElement = event.target;
  const form = new FormData(formElement);
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const name = String(form.get("name") || "").trim();
  const passwordConfirm = String(form.get("passwordConfirm") || "");
  const submitButton = formElement.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "正在連線…";
  try {
    if (password.length < 8) throw new Error("密碼至少需要 8 個字元。");
    if (authMode === "register") {
      if (!name) throw new Error("請輸入玩家暱稱。");
      if (password !== passwordConfirm) throw new Error("兩次輸入的密碼不一致。");
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: window.location.href.split("#")[0]
        }
      });
      if (error) throw error;
      if (!data.session || !data.user) {
        authMode = "login";
        render();
        showToast("帳號已建立！請先點擊驗證信中的連結，再登入。");
        return;
      }
      await loadUserProfile(data.user);
      if (!account.initialized) setRoute("/onboarding");
      authReady = true;
      render();
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error("登入成功，但未取得帳號資料，請重新嘗試。");
    authError = "";
    await loadUserProfile(data.user);
    if (!account.initialized) setRoute("/onboarding");
    else if (route() === "/login") setRoute("/profile");
    authReady = true;
    render();
  } catch (error) {
    if (authUser) {
      authError = `無法載入個人檔案：${authErrorMessage(error)}`;
      authReady = true;
      render();
    } else {
      showToast(authErrorMessage(error));
    }
  } finally {
    if (submitButton.isConnected) {
      submitButton.disabled = false;
      submitButton.textContent = authMode === "register" ? "建立帳號並開始冒險 →" : "登入並前往展櫃 →";
    }
  }
}

async function submitOnboarding(event) {
  event.preventDefault();
  const formElement = event.target;
  const form = new FormData(formElement);
  const name = String(form.get("name") || "").trim();
  const usernameSlug = String(form.get("usernameSlug") || "").trim();
  const intro = String(form.get("intro") || "").trim();
  const tags = String(form.get("tags") || "").split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 5).map(tag => tag.startsWith("#") ? tag : `#${tag}`);
  if (!name || !usernameSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(usernameSlug) || !intro || !tags.length) return;
  const previousProfile = profile;
  const previousAccount = account;
  profile = { ...profile, name, usernameSlug, intro, tags };
  account = { ...account, name };
  const submitButton = formElement.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await saveProfile();
    account = { ...account, initialized: true };
    setRoute("/profile");
    render();
    showToast("個人展櫃已初始化，第一個成就等你點亮！");
  } catch (error) {
    profile = previousProfile;
    account = previousAccount;
    submitButton.disabled = false;
    const message = error.code === "23505" || error.message?.toLowerCase().includes("duplicate key")
      ? "這個專屬網址名稱已被使用，請換一個。"
      : authErrorMessage(error);
    showToast(`個人檔案儲存失敗：${message}`);
  }
}

async function submitProfileEdit(event) {
  event.preventDefault();
  if (!authUser || !account?.initialized) return;
  const formElement = event.target;
  const form = new FormData(formElement);
  const name = String(form.get("displayName") || "").trim();
  const usernameSlug = String(form.get("usernameSlug") || "").trim();
  const intro = String(form.get("intro") || "").trim();
  const tags = String(form.get("tags") || "").split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 5).map(tag => tag.startsWith("#") ? tag : `#${tag}`);
  if (!name || !intro || !tags.length || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(usernameSlug)) return;
  const previousProfile = profile;
  const previousSettings = profileSettings;
  profile = { ...profile, name, usernameSlug, intro, tags };
  profileSettings = normalizeProfileSettings({
    ...profileSettings,
    background: String(form.get("background") || "none"),
    backgroundColor: String(form.get("backgroundColor") || DEFAULT_PROFILE_SETTINGS.backgroundColor)
  });
  const submitButton = document.getElementById("saveProfileButton");
  submitButton.disabled = true;
  try {
    await saveProfile();
    submitButton.disabled = false;
    account = { ...account, name };
    if (publicProfile?.id === authUser.id) {
      publicProfile.profile = { ...profile };
      publicProfile.profileSettings = { ...profileSettings };
      if (route().startsWith("/u/")) setRoute(publicRoute(usernameSlug));
    }
    closeProfileDialog();
    render();
    showToast("個人展櫃已更新！");
  } catch (error) {
    profile = previousProfile;
    profileSettings = previousSettings;
    submitButton.disabled = false;
    const message = error.code === "23505" || error.message?.toLowerCase().includes("duplicate key")
      ? "這個專屬網址名稱已被使用，請換一個。"
      : authErrorMessage(error);
    showToast(`儲存失敗：${message}`);
  }
}

async function toggleAchievement(categoryId, achievementId, button) {
  const category = getCategory(categoryId);
  const achievement = category?.achievements.find(item => item.id === achievementId);
  if (!achievement) return;
  const previousBadgeIds = earnedBadgeIds();
  const previousUnlockedAt = achievement.unlockedAt;
  achievement.unlockedAt = achievement.unlockedAt ? null : new Date().toISOString();
  button.disabled = true;
  try {
    await saveState();
    render();
    showToast(achievement.unlockedAt ? `解鎖「${achievement.title}」！ +${achievement.xp} XP` : `已取消解鎖「${achievement.title}」`);
    if (achievement.unlockedAt) showNewBadges(previousBadgeIds);
  } catch (error) {
    achievement.unlockedAt = previousUnlockedAt;
    render();
    showToast(`成就儲存失敗：${authErrorMessage(error)}`);
  }
}

async function deleteCustomCategory(categoryId) {
  const category = getCategory(categoryId);
  if (!canEditCurrentProfile || !category || category.source !== "custom") return;
  if (!window.confirm(`確定要刪除「${category.title}」系列及其中所有成就嗎？此操作無法復原。`)) return;
  const index = categories.indexOf(category);
  const previousCategories = JSON.parse(JSON.stringify(categories));
  categories.splice(index, 1);
  try {
    await saveState();
    currentFilter = "all";
    setRoute(route().startsWith("/u/") ? publicRoute(profile.usernameSlug, "/collection") : "/collection");
    render();
    showToast(`已刪除「${category.title}」系列。`);
  } catch (error) {
    categories.splice(0, categories.length, ...previousCategories);
    render();
    showToast(`系列刪除失敗：${authErrorMessage(error)}`);
  }
}

async function deleteCustomAchievement(categoryId, achievementId) {
  const category = getCategory(categoryId);
  if (!canEditCurrentProfile || !category || category.source !== "custom") return;
  const achievementIndex = category.achievements.findIndex(item => item.id === achievementId);
  if (achievementIndex < 0) return;
  const achievement = category.achievements[achievementIndex];
  if (!window.confirm(`確定要刪除成就「${achievement.title}」嗎？此操作無法復原。`)) return;
  const previousCategories = JSON.parse(JSON.stringify(categories));
  category.achievements.splice(achievementIndex, 1);
  try {
    await saveState();
    render();
    showToast(`已刪除成就「${achievement.title}」。`);
  } catch (error) {
    categories.splice(0, categories.length, ...previousCategories);
    render();
    showToast(`成就刪除失敗：${authErrorMessage(error)}`);
  }
}

async function signOut() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    clearSession();
    authMode = "login";
    authError = "";
    publicProfile = null;
    authReady = true;
    setRoute("/");
    render();
  } catch (error) {
    showToast(`登出失敗：${authErrorMessage(error)}`);
  }
}

async function retryProfileLoad() {
  authError = "";
  authReady = false;
  render();
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) {
      clearSession();
    } else {
      await loadUserProfile(data.session.user);
    }
  } catch (error) {
    authError = `無法載入個人檔案：${authErrorMessage(error)}`;
  }
  authReady = true;
  render();
}

document.addEventListener("click", event => {
  const accountMenu = document.getElementById("accountMenu");
  if (!accountMenu.contains(event.target)) accountMenu.open = false;
  const target = event.target.closest("[data-action], [data-auth-mode], [data-filter]");
  if (!target) return;
  if (target.dataset.authMode) {
    authMode = target.dataset.authMode;
    render();
    return;
  }
  const action = target.dataset.action;
  document.getElementById("accountMenu").open = false;
  if (action === "redeem-background") void redeemBackground();
  if (action === "add-category" && canEditCurrentProfile) openDialog("category");
  if (action === "add-achievement" && canEditCurrentProfile) openDialog("achievement", decodeRouteSegment(route().split("/").pop()));
  if (action === "toggle-achievement") {
    const button = target.closest("[data-achievement-id]");
    const category = getCategory(button.dataset.categoryId);
    const achievement = category?.achievements.find(item => item.id === button.dataset.achievementId);
    if (canEditCurrentProfile && achievement && window.confirm(achievement.unlockedAt
      ? `確定要取消解鎖「${achievement.title}」嗎？系列進度與 XP 也會隨之更新。`
      : `確定要解鎖「${achievement.title}」嗎？這會記錄完成時間並加入 XP。`)) {
      void toggleAchievement(button.dataset.categoryId, button.dataset.achievementId, button);
    }
  }
  if (action === "delete-category") void deleteCustomCategory(target.dataset.categoryId);
  if (action === "delete-achievement") void deleteCustomAchievement(target.dataset.categoryId, target.dataset.achievementId);
  if (action === "toggle-background-view") {
    const enabled = document.body.classList.toggle("background-view-mode");
    const button = document.getElementById("backgroundViewToggle");
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute("aria-label", enabled ? "返回展櫃" : "顯示背景");
    button.innerHTML = enabled ? "↩ <span>返回展櫃</span>" : "◉ <span>背景模式</span>";
    return;
  }
  if (action === "edit-profile") openProfileDialog();
  if (action === "open-register") {
    authMode = "register";
    setRoute("/login");
    render();
  }
  if (action === "open-login") {
    authMode = "login";
    setRoute("/login");
    render();
  }
  if (action === "copy-profile-link") void copyProfileLink();
  if (action === "sign-out") void signOut();
  if (action === "retry-profile") void retryProfileLoad();
  if (action === "retry-public-profile") void handleRouteChange();
  if (target.dataset.filter) { currentFilter = target.dataset.filter; render(); }
});
document.getElementById("entryForm").addEventListener("submit", submitDialog);
document.getElementById("profileEditForm").addEventListener("submit", submitProfileEdit);
document.getElementById("closeBadgeReward").addEventListener("click", closeBadgeReward);
document.getElementById("badgeRewardDone").addEventListener("click", closeBadgeReward);
document.addEventListener("submit", event => {
  if (event.target.id === "authForm") void submitAuth(event);
  if (event.target.id === "onboardingForm") void submitOnboarding(event);
});
document.getElementById("closeDialog").addEventListener("click", closeDialog);
document.getElementById("cancelDialog").addEventListener("click", closeDialog);
document.getElementById("closeProfileDialog").addEventListener("click", closeProfileDialog);
document.getElementById("cancelProfileDialog").addEventListener("click", closeProfileDialog);
document.addEventListener("input", event => {
  if (event.target.id === "setupName") {
    const slugInput = document.getElementById("setupSlug");
    if (slugInput.dataset.edited !== "true") {
      slugInput.value = suggestedUsernameSlug(event.target.value, authUser?.id || "");
      document.getElementById("onboardingSlugPreview").textContent = slugInput.value;
    }
  } else if (event.target.id === "setupSlug") {
    event.target.dataset.edited = "true";
    document.getElementById("onboardingSlugPreview").textContent = event.target.value;
  }
});
window.addEventListener("hashchange", () => {
  document.getElementById("accountMenu").open = false;
  void handleRouteChange();
});
void initializeAuth();
