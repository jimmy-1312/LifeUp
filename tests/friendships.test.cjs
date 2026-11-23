const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function createApp(savedLanguage = "zh-Hant") {
  const element = () => ({
    style: {}, dataset: {}, classList: { toggle() {}, remove() {} },
    addEventListener() {}, querySelectorAll() { return []; }, focus() {}, setAttribute() {}
  });
  const elements = new Map();
  const document = {
    body: element(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    querySelector() { return element(); },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
  const window = {
    location: { hash: "#/", origin: "http://localhost", pathname: "/", host: "localhost" },
    localStorage: { getItem() { return savedLanguage; }, setItem(key, value) { savedLanguage = value; } },
    addEventListener() {}, setInterval() { return 1; }, clearInterval() {}
  };
  const context = vm.createContext({ document, window, console, URL, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "vendor", "opencc", "t2cn.js"), "utf8"), context);
  window.OpenCC = context.OpenCC;
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "backgrounds", "catalog.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "official-en.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8"), context);
  return expression => vm.runInContext(expression, context);
}

test("English is the default and existing language preferences are retained", () => {
  assert.equal(createApp(null)("language"), "en");
  assert.equal(createApp("unknown")("language"), "en");
  for (const locale of ["en", "zh-Hant", "zh-Hans"]) assert.equal(createApp(locale)("language"), locale);
});

test("Simplified Chinese translates official content without changing custom content", () => {
  const app = createApp("zh-Hans");
  assert.equal(app('localText("成就圖鑑", "Achievements")'), "成就图鉴");
  assert.match(app('categoryText(seedCategories[0], "title")'), />校园 NPC 观察日志<\/span>/);
  assert.match(app('achievementText(seedCategories[0].achievements[0], seedCategories[0], "title")'), />座位风水师<\/span>/);
  assert.match(app('badgeText(badgeDefinitions[0], "title")'), />序章玩家<\/span>/);
  assert.equal(app('categoryText({id:"campus-side-quests",source:"custom",title:"繁體自訂"}, "title")'), "繁體自訂");
  assert.equal(app('localText("刪除繁體自訂", "Delete 繁體自訂", "删除繁體自訂")'), "删除繁體自訂");
});

test("language markers translate only explicitly marked content and preserve form values", () => {
  const app = createApp();
  const result = app(`(() => {
    language = "en";
    const text = { dataset: { i18nZh: "登入", i18nEn: "Sign in" }, textContent: "登入" };
    const input = { dataset: { placeholderZh: "密碼", placeholderEn: "Password" }, placeholder: "密碼", value: "my unsaved text" };
    const label = { dataset: { ariaZh: "關閉", ariaEn: "Close" }, setAttribute(name, value) { this[name] = value; } };
    const userContent = { textContent: "登入" };
    translateMarked({ querySelectorAll(selector) {
      return selector === "[data-i18n-en]" ? [text] : selector === "[data-placeholder-en]" ? [input] : selector === "[data-aria-en]" ? [label] : [];
    } });
    return { text: text.textContent, placeholder: input.placeholder, value: input.value, aria: label["aria-label"], userContent: userContent.textContent };
  })()`);
  assert.equal(result.text, "Sign in");
  assert.equal(result.placeholder, "Password");
  assert.equal(result.value, "my unsaved text");
  assert.equal(result.aria, "Close");
  assert.equal(result.userContent, "登入");
  assert.match(app('bilingual("<script>", "Sign in")'), /&lt;script&gt;/);
});

test("Simplified markers preserve interpolated names and selected values", () => {
  const app = createApp("zh-Hans");
  const result = app(`(() => {
    const text = { dataset: {i18nZh:"開啟繁體名字",i18nEn:"Open 繁體名字",i18nHans:"开启繁體名字"}, textContent:"" };
    const label = { dataset:{ariaZh:"繁體名字的頭像",ariaEn:"繁體名字's avatar",ariaHans:"繁體名字的头像"}, setAttribute(name,value) { this[name]=value; } };
    const option = { dataset:{i18nZh:"校園 NPC 觀察日誌",i18nEn:"Campus NPC Field Notes",i18nHans:"校园 NPC 观察日志"}, textContent:"", value:"campus-side-quests", selected:true };
    translateMarked({querySelectorAll(selector) {
      return selector === "[data-i18n-en]" ? [text,option] : selector === "[data-aria-en]" ? [label] : [];
    }});
    return {text:text.textContent, aria:label["aria-label"], option:option.textContent, value:option.value, selected:option.selected};
  })()`);
  assert.equal(result.text, "开启繁體名字");
  assert.equal(result.aria, "繁體名字的头像");
  assert.equal(result.option, "校园 NPC 观察日志");
  assert.equal(result.value, "campus-side-quests");
  assert.equal(result.selected, true);
});

test("common topics compare only shared official unlocks and normalized tags", () => {
  const app = createApp();
  const result = app(`(() => {
    const mine = starterCategories();
    const theirs = starterCategories();
    mine[0].achievements[0].unlockedAt = "2026-01-01";
    theirs[0].achievements[0].unlockedAt = "2026-02-01";
    mine[0].achievements[1].unlockedAt = "2026-01-01";
    mine.push({ id: "custom", source: "custom", achievements: [{ id: "x", unlockedAt: "2026-01-01" }] });
    theirs.push({ id: "custom", source: "custom", achievements: [{ id: "x", unlockedAt: "2026-01-01" }] });
    return sharedInterests({ tags: ["#Music", "#other"] }, mine, { tags: ["music"] }, theirs);
  })()`);
  assert.deepEqual(Array.from(result.commonTags), ["#Music"]);
  assert.equal(result.commonAchievements.length, 1);
  assert.equal(result.commonAchievements[0].id, "seat");
});

test("relationship states expose only appropriate actions", () => {
  const app = createApp();
  assert.match(app('friendshipActions("peer", "incoming")'), /friend-accept/);
  assert.doesNotMatch(app('friendshipActions("peer", "incoming")'), /friend-remove/);
  assert.match(app('friendshipActions("peer", "outgoing")'), /friend-cancel/);
  assert.match(app('friendshipActions("peer", "friends")'), /friend-remove/);
  assert.match(app('friendshipActions("peer", undefined)'), /friend-send/);
});

test("shared topic output escapes profile text", () => {
  const app = createApp();
  const output = app(`sharedInterestsMarkup(
    { tags: ["#<script>"] }, starterCategories(),
    { tags: ["#<script>"] }, starterCategories())`);
  assert.match(output, /&lt;script&gt;/);
  assert.doesNotMatch(output, /<script>/);
});

test("friend badges follow the current accepted count without changing XP", () => {
  const app = createApp();
  for (const [count, expected] of [[0, 0], [1, 1], [4, 1], [5, 2], [9, 2], [10, 3]]) {
    assert.equal(app(`earnedBadges(starterCategories(), ${count}).filter(b => b.id.startsWith("friend-")).length`), expected);
  }
  assert.equal(app('badgeDefinitions.filter(b => b.id.startsWith("friend-")).every(b => b.xp === 0)'), true);
  assert.equal(app('(() => { friendshipsStatus = "loaded"; friendships = [{status:"incoming"},{status:"outgoing"},{status:"friends"}]; return ownFriendCount(); })()'), 1);
});

test("friend preview is capped, escapes names, and never includes pending requests", () => {
  const app = createApp();
  const output = app(`(() => {
    const friends = Array.from({length: 7}, (_, i) => ({display_name: i === 0 ? "<script>" : "Friend " + i, username_slug: "friend-" + i}));
    return friendPreviewMarkup(friends, 7);
  })()`);
  assert.equal((output.match(/class="friend-identity friend-preview-item"/g) || []).length, 5);
  assert.match(output, /7 位隊友/);
  assert.match(output, /&lt;script&gt;/);
  assert.doesNotMatch(output, /<script>/);
  assert.doesNotMatch(output, /friend-5/);
  assert.match(app('friendPreviewMarkup([], null, "failed")'), /無法載入隊友/);
});

test("friend activity previews show the latest unlocked achievement and localize official titles", () => {
  const app = createApp("en");
  const output = app(`(() => {
    const entries = starterCategories();
    entries[0].achievements[0].unlockedAt = "2024-01-01T00:00:00Z";
    entries[0].achievements[1].unlockedAt = "2025-01-01T00:00:00Z";
    entries[0].achievements[2].unlockedAt = "invalid";
    return friendPreviewMarkup([{display_name:"Friend",username_slug:"friend",categories:entries}], 1);
  })()`);
  assert.match(output, /friend-activity-tag/);
  assert.match(output, /Professor Dialogue Unlocked/);
  assert.doesNotMatch(output, /invalid/);
  const custom = app(`friendActivityMarkup([{id:"custom",source:"custom",achievements:[{id:"x",title:"<script>",unlockedAt:"2025-01-01T00:00:00Z"}]}])`);
  assert.match(custom, /&lt;script&gt;/);
  assert.doesNotMatch(custom, /<script>/);
  assert.match(app("friendActivityMarkup([])"), /No recent activity/);
});

test("unread profile dots are private to the viewer and names precede IDs and activity", () => {
  const app = createApp("en");
  app(`friendshipsStatus="loaded"; friendships=[{peer_id:"friend",status:"friends",unread_profile:true}];`);
  const own = app(`friendPreviewMarkup([{peer_id:"friend",display_name:"Alice",username_slug:"alice",categories:[]}],1,"",true)`);
  assert.match(own, /friend-unread/);
  assert.match(own, /Unread profile update/);
  assert.ok(own.indexOf("Alice") < own.indexOf("@alice") && own.indexOf("@alice") < own.indexOf("friend-activity-tag"));
  assert.doesNotMatch(app(`friendPreviewMarkup([{peer_id:"friend",display_name:"Alice",username_slug:"alice"}],1,"",false)`), /friend-unread/);
  app("friendships[0].unread_profile=false");
  assert.doesNotMatch(app(`friendPreviewMarkup([{peer_id:"friend",display_name:"Alice",username_slug:"alice"}],1,"",true)`), /friend-unread/);
});

test("unread friends are prioritized before the preview limit and in the roster", () => {
  const app = createApp("en");
  app(`friendshipsStatus = "loaded";
    friendships = Array.from({length: 7}, (_, i) => ({
      peer_id: "id-" + i, status: "friends", display_name: "Friend " + i,
      username_slug: "friend-" + i, unread_profile: i === 3 || i === 6
    }));
    friendships.splice(1, 0,
      {peer_id:"request-1",status:"incoming",display_name:"Request 1",username_slug:"request-1"},
      {peer_id:"request-2",status:"incoming",display_name:"Request 2",username_slug:"request-2",unread_profile:true});
  `);
  const links = html => Array.from(html.matchAll(/class="friend-identity friend-(?:preview|roster)-item" href="#\/u\/([^"]+)"/g), match => match[1]);
  const preview = app(`friendPreviewMarkup(friendships.filter(f => f.status === "friends"), 7, "", true)`);
  assert.deepEqual(links(preview), ["friend-3", "friend-6", "friend-0", "friend-1", "friend-2"]);
  assert.equal((preview.match(/class="friend-unread"/g) || []).length, 2);
  assert.deepEqual(links(app("friendsPage()")), ["request-1", "request-2", "friend-3", "friend-6", "friend-0", "friend-1", "friend-2", "friend-4", "friend-5"]);
  assert.deepEqual(Array.from(app(`friendships.filter(f => f.status === "friends").map(f => f.username_slug)`)), ["friend-0", "friend-1", "friend-2", "friend-3", "friend-4", "friend-5", "friend-6"]);
  const publicPreview = app(`friendPreviewMarkup(friendships.filter(f => f.status === "friends"), 7, "", false)`);
  assert.deepEqual(links(publicPreview), ["friend-0", "friend-1", "friend-2", "friend-3", "friend-4"]);
  assert.doesNotMatch(publicPreview, /friend-unread/);
});

test("the owner's public profile uses the complete private roster for its preview", () => {
  const app = createApp("en");
  const result = app(`(() => {
    friendshipsStatus = "loaded";
    friendships = Array.from({length: 6}, (_, i) => ({
      peer_id:"id-" + i, status:"friends", display_name:"Friend " + i,
      username_slug:"friend-" + i, unread_profile:i === 5
    }));
    const publicData = {entries:friendships.slice(0, 5), count:6, error:""};
    canEditCurrentProfile = true;
    const own = profilePage(profileSettings, "", publicData);
    canEditCurrentProfile = false;
    const visitor = profilePage(profileSettings, "", publicData);
    return {own, visitor};
  })()`);
  assert.match(result.own, /href="#\/u\/friend-5"/);
  assert.doesNotMatch(result.own, /href="#\/u\/friend-4"/);
  assert.doesNotMatch(result.visitor, /href="#\/u\/friend-5"/);
  assert.doesNotMatch(result.visitor, /friend-unread/);
});

test("profile views mark the observed revision and discard responses from previous sessions", async () => {
  const app = createApp("en");
  const result = await app(`(async () => {
    authUser={id:"me"};account={initialized:true};publicProfileRequest=7;
    let args, refreshes=0, message="", resolve;
    loadFriendships=async()=>{refreshes++};showToast=text=>{message=text};
    supabaseClient={rpc:async (name, value)=>{args={name,value};return {data:true,error:null}}};
    await markFriendProfileViewed({id:"friend",publicRevision:3},7);
    const success=refreshes;
    supabaseClient.rpc=()=>new Promise(done=>{resolve=done});
    const pending=markFriendProfileViewed({id:"friend",publicRevision:4},7);
    clearSession();authUser={id:"another"};account={initialized:true};
    resolve({data:true,error:null});await pending;
    return {args,success,refreshes,message};
  })()`);
  assert.equal(result.args.name, "mark_friend_profile_viewed");
  assert.equal(result.args.value.observed_revision, 3);
  assert.equal(result.success, 1);
  assert.equal(result.refreshes, 1);
  assert.equal(result.message, "");
});

test("profile is marked viewed only after its main page is shown", () => {
  const app = createApp("en");
  const result = app(`(() => {
    let marked=0;
    markFriendProfileViewed=()=>{marked++};
    authUser={id:"me"};account={initialized:true};authReady=false;authError="";
    publicProfile={id:"friend",profile:{usernameSlug:"friend"}};
    window.location.hash="#/u/friend";markCurrentFriendProfileViewed();
    authReady=true;window.location.hash="#/u/friend/category/test";markCurrentFriendProfileViewed();
    const before=marked;
    window.location.hash="#/u/friend";markCurrentFriendProfileViewed();
    authUser={id:"friend"};markCurrentFriendProfileViewed();
    return {before,marked};
  })()`);
  assert.equal(result.before, 0);
  assert.equal(result.marked, 1);
});

test("friend like notifications show translated achievements and escape custom titles", () => {
  const app = createApp("en");
  app(`notificationsStatus="loaded"; socialNotifications=[{kind:"achievement_like",display_name:"<Friend>",username_slug:"friend",created_at:"2026-01-01T00:00:00Z",detail:JSON.stringify({categoryId:"campus-side-quests",achievementId:"seat"})}]`);
  const official = app("notificationsPage()");
  assert.match(official, /&lt;Friend&gt;/);
  assert.match(official, /Seat Feng Shui Master/);
  app(`socialNotifications[0].detail=JSON.stringify({categoryId:"custom",achievementId:"x",source:"custom",title:"<script>"})`);
  assert.match(app("notificationsPage()"), /&lt;script&gt;/);
  assert.doesNotMatch(app("notificationsPage()"), /<script>/);
  app('socialNotifications[0].detail="invalid json"');
  assert.match(app("notificationsPage()"), /your achievement/);
});

test("custom series and achievements save without descriptions", async () => {
  const app = createApp("en");
  const result = await app(`(async () => {
    authUser={id:"me"}; account={initialized:true}; categories=starterCategories();
    let values={title:"My series",description:"   ",symbol:"✨",tone:"blue"}, saved=0, notices=[];
    globalThis.FormData=class { get(name) {return values[name]} };
    saveState=async()=>{saved++}; showToast=message=>notices.push(message);
    showNewBadges=()=>{}; closeDialog=()=>{pendingDialog=null}; render=()=>{}; setRoute=()=>{};
    pendingDialog={type:"category"}; await submitDialog({preventDefault(){},currentTarget:{}});
    const series=categories[0];
    values={title:"My quest",description:"",icon:"✦",xp:"45"};
    pendingDialog={type:"achievement",categoryId:series.id}; await submitDialog({preventDefault(){},currentTarget:{}});
    values={title:" ",description:""}; pendingDialog={type:"category"};
    await submitDialog({preventDefault(){},currentTarget:{}});
    return {saved,series,notices};
  })()`);
  assert.equal(result.saved, 2);
  assert.equal(result.series.description, "");
  assert.equal(result.series.achievements[0].description, "");
  assert.match(result.notices.at(-1), /enter a name/i);
});

test("encouragement appears only on accepted friends' profiles", () => {
  const app = createApp();
  app('authUser = { id: "me" }; account = { initialized: true }; publicProfile = { id: "peer" }; friendshipsStatus = "loaded"; friendships = [{peer_id:"peer", status:"incoming"}]');
  assert.doesNotMatch(app("friendProfileActions()"), /send-encouragement/);
  app('friendships[0].status = "friends"');
  assert.match(app("friendProfileActions()"), /send-encouragement/);
  assert.match(app("friendProfileActions()"), /已是隊友/);
  assert.doesNotMatch(app("friendProfileActions()"), /friend-remove/);
  assert.match(app("friendsPage()"), /friend-remove/);
  app('authUser = null');
  assert.doesNotMatch(app("friendProfileActions()"), /send-encouragement/);
});

test("accepted friends no longer have a conversation prompt form", () => {
  const app = createApp();
  app('authUser = {id:"me"}; account = {initialized:true}; publicProfile = {id:"peer"}; friendshipsStatus = "loaded"; friendships = [{peer_id:"peer", status:"incoming"}]');
  assert.doesNotMatch(app("friendProfileActions()"), /data-conversation-peer/);
  assert.doesNotMatch(app("friendsPage()"), /data-conversation-peer/);
  app('friendships[0].status = "friends"');
  assert.doesNotMatch(app("friendProfileActions()"), /data-conversation-peer/);
  assert.doesNotMatch(app("friendsPage()"), /data-conversation-peer/);
  app("authUser = null");
  assert.doesNotMatch(app("friendProfileActions()"), /data-conversation-peer/);
});

test("prompt notifications translate predefined questions and safely handle unknown details", () => {
  const expected = {
    en: "What's a small win that made you happy recently?",
    "zh-Hant": "最近有什麼讓你開心的小事？",
    "zh-Hans": "最近有什么让你开心的小事？"
  };
  for (const [locale, text] of Object.entries(expected)) {
    const app = createApp(locale);
    app(`notificationsStatus = "loaded"; socialNotifications = [{kind:"conversation_prompt", detail:"small_win", display_name:"<script>", created_at:"2026-01-01T00:00:00Z"}]`);
    assert.equal(app('localText(...conversationPrompts.small_win)'), text);
    assert.match(app("notificationsPage()"), /&lt;script&gt;/);
    app('socialNotifications[0].detail = "__proto__"');
    assert.match(app("notificationsPage()"), /unavailable|無法顯示|无法显示/);
    app('socialNotifications[0].detail = "<script>"');
    assert.doesNotMatch(app("notificationsPage()"), /<script>/);
  }
});

test("achievement likes show totals only to the owner and a private toggle to visitors", () => {
  const app = createApp("en");
  app(`authReady=true; authUser={id:"me"}; account={initialized:true}; categories=starterCategories();
    window.location.hash="#/category/campus-side-quests"; canEditCurrentProfile=true;
    achievementLikes={key:achievementLikesKey(currentLikeContext()),status:"loaded",rows:[{achievement_id:"seat",like_count:7}],pending:new Set()}`);
  assert.match(app("achievementMarkup(categories[0].achievements[0],categories[0])"), /♥ 7/);
  assert.doesNotMatch(app("achievementMarkup(categories[0].achievements[0],categories[0])"), /toggle-achievement-like/);
  app(`publicProfile={id:"peer",categories:starterCategories()}; window.location.hash="#/u/peer/category/campus-side-quests";
    canEditCurrentProfile=false; achievementLikes={key:achievementLikesKey(currentLikeContext()),status:"loaded",
      rows:[{achievement_id:"seat",liked:true,like_count:99}],pending:new Set()}`);
  const visitor = app("achievementMarkup(publicProfile.categories[0].achievements[0],publicProfile.categories[0])");
  assert.match(visitor, /aria-pressed="true"/);
  assert.doesNotMatch(visitor, /99/);
  app("authUser=null");
  assert.match(app("achievementMarkup(publicProfile.categories[0].achievements[0],publicProfile.categories[0])"), /sign-in-to-like/);
});

test("likes can be added and removed, surface failures, and discard stale session results", async () => {
  const app = createApp("en");
  const result = await app(`(async () => {
    authReady=true; authUser={id:"me"}; account={initialized:true};
    publicProfile={id:"peer",categories:starterCategories()};
    window.location.hash="#/u/peer/category/campus-side-quests"; render=()=>{};
    let calls=[], message="", fail=false, resolve;
    showToast=text=>{message=text};
    supabaseClient={rpc:async (name,args)=>{calls.push({name,args}); return fail ? {error:{message:"offline"}} : {data:[],error:null}}};
    await loadAchievementLikes(currentLikeContext());
    await setAchievementLike("seat");
    const liked=achievementLikes.rows[0].liked;
    await setAchievementLike("seat");
    const removed=achievementLikes.rows.length===0;
    fail=true; await setAchievementLike("seat");
    const failure=message, unchanged=achievementLikes.rows.length===0, pending=achievementLikes.pending.size;
    supabaseClient.rpc=()=>new Promise(done=>{resolve=done});
    const request=loadAchievementLikes(currentLikeContext());
    clearSession(); authUser={id:"other"}; account={initialized:true};
    resolve({data:[{achievement_id:"seat",liked:true}],error:null}); await request;
    return {calls,liked,removed,failure,unchanged,pending,stale:achievementLikes.rows.length};
  })()`);
  assert.equal(result.calls[0].name, "get_achievement_likes");
  assert.equal(result.calls[1].args.liked, true);
  assert.equal(result.calls[2].args.liked, false);
  assert.equal(result.liked, true);
  assert.equal(result.removed, true);
  assert.match(result.failure, /offline/);
  assert.equal(result.unchanged, true);
  assert.equal(result.pending, 0);
  assert.equal(result.stale, 0);
});

test("like-loading failures do not masquerade as zero likes and can be retried", async () => {
  const app = createApp("en");
  const result = await app(`(async () => {
    authReady=true; authUser={id:"me"}; account={initialized:true}; categories=starterCategories();
    window.location.hash="#/category/campus-side-quests"; canEditCurrentProfile=true; render=()=>{};
    supabaseClient={rpc:async()=>({data:null,error:null})};
    await loadAchievementLikes(currentLikeContext());
    const failed=categoryPage("campus-side-quests");
    supabaseClient.rpc=async()=>({data:[],error:null});
    await loadAchievementLikes(currentLikeContext());
    return {failed,loaded:achievementMarkup(categories[0].achievements[0],categories[0])};
  })()`);
  assert.match(result.failed, /Failed to load likes/);
  assert.match(result.failed, /retry-achievement-likes/);
  assert.doesNotMatch(result.failed, /achievement-like-count/);
  assert.match(result.loaded, /♥ 0/);
});

test("official like validation catalog matches the app's achievements", () => {
  const app = createApp();
  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "schema.sql"), "utf8");
  const match = sql.match(/select '(\{\s*"campus-side-quests"[\s\S]*?\})'::jsonb as catalog/);
  assert.ok(match, "official like catalog not found");
  const catalog = JSON.parse(match[1]);
  const expected = JSON.parse(app("JSON.stringify(Object.fromEntries(seedCategories.map(c => [c.id, c.achievements.map(a => a.id)])))"));
  assert.deepEqual(catalog, expected);
});

test("onboarding opens the tutorial only after a successful save", async () => {
  const app = createApp();
  const result = await app(`(async () => {
    let opened = 0, fail = false, notices = 0;
    window.LifeUpTutorial = {open(){opened++;}};
    globalThis.FormData = class { get(key) { return {name:"Player", usernameSlug:"player", intro:"Hello", tags:"games"}[key]; } };
    saveProfile = async () => {if (fail) throw new Error("offline");};
    render = () => {}; showToast = () => {notices++;};
    const button = {disabled:false};
    const event = {preventDefault(){}, target:{querySelector(){return button;}}};
    await submitOnboarding(event);
    const success = opened;
    fail = true; await submitOnboarding(event);
    return {success, opened, notices, disabled:button.disabled};
  })()`);
  assert.equal(result.success, 1);
  assert.equal(result.opened, 1);
  assert.equal(result.notices, 2);
  assert.equal(result.disabled, false);
});

test("notification list escapes actors and marks unread items", () => {
  const app = createApp();
  const output = app(`(() => {
    notificationsStatus = "loaded";
    notificationsUnreadCount = 1;
    socialNotifications = [{kind: "friend_request", display_name: "<script>", username_slug: "player", created_at: "2026-01-01T00:00:00Z", read_at: null}];
    return notificationsPage();
  })()`);
  assert.match(output, /&lt;script&gt;/);
  assert.doesNotMatch(output, /<script>/);
  assert.match(output, /未讀/);
  assert.doesNotMatch(output, /read-notifications/);
});

test("entering notifications refreshes once per visit even when data is already loaded", () => {
  const app = createApp("en");
  const result = app(`(() => {
    let loads = 0;
    authReady = true; authUser = {id:"me"}; account = {initialized:true};
    friendshipsStatus = "loaded"; notificationsStatus = "loaded";
    applyProfileBackground = () => {}; updateHeader = () => {}; updateLanguage = () => {};
    currentLikeContext = () => null; profilePage = () => ""; notificationsPage = () => "";
    loadNotifications = () => { loads++; };
    window.location.hash = "#/profile"; render();
    window.location.hash = "#/notifications"; render(); render();
    const firstVisit = loads;
    window.location.hash = "#/profile"; render();
    window.location.hash = "#/notifications"; render();
    return {firstVisit, secondVisit:loads};
  })()`);
  assert.equal(result.firstVisit, 1);
  assert.equal(result.secondVisit, 2);
});

test("opening and refreshing notifications automatically marks all unread records", async () => {
  const app = createApp("en");
  const result = await app(`(async () => {
    let unread = 70, marks = 0;
    authUser = {id:"me"}; account = {initialized:true};
    render = () => {};
    supabaseClient = {rpc: async name => {
      if (name === "get_social_notifications") return {data:[], error:null};
      if (name === "get_social_notifications_unread_count") return {data:unread, error:null};
      if (name === "mark_social_notifications_read") { marks++; unread = 0; return {error:null}; }
      throw new Error("Unexpected RPC: " + name);
    }};
    window.location.hash = "#/profile"; await loadNotifications();
    const before = {count:notificationsUnreadCount, marks};
    window.location.hash = "#/notifications"; await loadNotifications();
    const opened = {count:notificationsUnreadCount, marks};
    unread = 1; await loadNotifications();
    return {before, opened, refreshed:{count:notificationsUnreadCount, marks}};
  })()`);
  assert.equal(result.before.count, 70);
  assert.equal(result.before.marks, 0);
  assert.equal(result.opened.count, 0);
  assert.equal(result.opened.marks, 1);
  assert.equal(result.refreshed.count, 0);
  assert.equal(result.refreshed.marks, 2);
});

test("automatic marking errors remain visible and retryable", async () => {
  const app = createApp("en");
  const result = await app(`(async () => {
    let unread = 1, fail = true;
    authUser = {id:"me"}; account = {initialized:true}; window.location.hash = "#/notifications";
    render = () => {};
    supabaseClient = {rpc: async name => {
      if (name === "get_social_notifications") return {data:[], error:null};
      if (name === "get_social_notifications_unread_count") return {data:unread, error:null};
      if (name === "mark_social_notifications_read") {
        if (fail) return {error:{message:"database unavailable"}};
        unread = 0; return {error:null};
      }
      throw new Error("Unexpected RPC: " + name);
    }};
    await loadNotifications();
    const failed = {status:notificationsStatus, count:notificationsUnreadCount, markup:notificationsPage()};
    fail = false; await loadNotifications();
    return {failed, status:notificationsStatus, count:notificationsUnreadCount};
  })()`);
  assert.equal(result.failed.status, "error");
  assert.equal(result.failed.count, 1);
  assert.match(result.failed.markup, /Could not mark notifications as read: database unavailable/);
  assert.match(result.failed.markup, /retry-notifications/);
  assert.equal(result.status, "loaded");
  assert.equal(result.count, 0);
});

test("an automatic mark response cannot overwrite a new session", async () => {
  const app = createApp("en");
  const result = await app(`(async () => {
    let resolveMark;
    authUser = {id:"me"}; account = {initialized:true}; window.location.hash = "#/notifications";
    supabaseClient = {rpc: async name => {
      if (name === "get_social_notifications") return {data:[], error:null};
      if (name === "get_social_notifications_unread_count") return {data:1, error:null};
      if (name === "mark_social_notifications_read") return new Promise(resolve => {resolveMark = resolve});
      throw new Error("Unexpected RPC: " + name);
    }};
    const loading = loadNotifications();
    await new Promise(resolve => setTimeout(resolve, 0));
    clearSession();
    authUser = {id:"me"}; account = {initialized:true};
    notificationsStatus = "loaded"; notificationsUnreadCount = 7;
    resolveMark({error:null});
    await loading;
    return {status:notificationsStatus, count:notificationsUnreadCount};
  })()`);
  assert.equal(result.status, "loaded");
  assert.equal(result.count, 7);
});

test("notification responses from a previous account are discarded", async () => {
  const app = createApp();
  const result = await app(`(async () => {
    authUser = {id: "first"}; account = {initialized: true};
    let resolve;
    supabaseClient = {rpc: name => name === "get_social_notifications" ? new Promise(done => { resolve = done; }) : Promise.resolve({data: 1, error: null})};
    const loading = loadNotifications();
    clearSession();
    authUser = {id: "second"}; account = {initialized: true};
    resolve({data: [{kind: "friend_request"}], error: null});
    await loading;
    return socialNotifications.length;
  })()`);
  assert.equal(result, 0);
});

test("notification unread count includes older notifications outside the list", async () => {
  const app = createApp();
  const result = await app(`(async () => {
    authUser = {id:"me"}; account = {initialized:true};
    supabaseClient = {rpc: async name => name === "get_social_notifications"
      ? {data: [], error: null}
      : {data: 70, error: null}};
    await loadNotifications();
    return {count: notificationsUnreadCount, markup: notificationsPage()};
  })()`);
  assert.equal(result.count, 70);
  assert.doesNotMatch(result.markup, /read-notifications/);
});

test("public friend data is isolated by route and surfaces failures", async () => {
  const app = createApp();
  const result = await app(`(async () => {
    render = () => {};
    publicProfileRequest = 1;
    publicProfile = { friends: [], friendCount: null };
    let resolve;
    supabaseClient = {rpc: name => name === "get_public_friends"
      ? new Promise(done => { resolve = done; })
      : Promise.resolve({data: 10, error: null})};
    const loading = loadPublicFriends("first", 1);
    publicProfileRequest = 2;
    publicProfile = { friends: [], friendCount: null };
    resolve({data: [{display_name:"wrong user"}], error: null});
    await loading;
    const ignored = publicProfile.friendCount === null && publicProfile.friends.length === 0;
    supabaseClient = {rpc: async () => ({error: {message: "offline"}})};
    await loadPublicFriends("second", 2);
    return {ignored, error: publicProfile.friendsError, count: publicProfile.friendCount};
  })()`);
  assert.equal(result.ignored, true);
  assert.equal(result.error, "offline");
  assert.equal(result.count, null);
});

test("encouragement reports rate limits and reenables the button", async () => {
  const app = createApp();
  const result = await app(`(async () => {
    authUser = {id:"me"}; account = {initialized:true};
    let message = "";
    showToast = text => { message = text; };
    supabaseClient = {rpc: async () => ({error:{message:"24 hour limit"}})};
    const button = {disabled:false};
    await sendEncouragement("friend", button);
    return {message, disabled: button.disabled};
  })()`);
  assert.match(result.message, /24 hour limit/);
  assert.equal(result.disabled, false);
});

test("background catalog preserves existing IDs and references moved files", () => {
  const app = createApp();
  for (const [id, name] of [["cyberpunk", "cyberpunk.jpg"], ["snow-mountain", "Snowmountain.jpg"], ["wukong", "wukong.gif"]]) {
    assert.equal(app(`PROFILE_BACKGROUNDS[${JSON.stringify(id)}].src`), name);
    assert.equal(fs.existsSync(path.join(__dirname, "..", "backgrounds", name)), true);
    assert.equal(app(`PROFILE_BACKGROUNDS[${JSON.stringify(id)}].label`), path.parse(name).name);
  }
  const url = app(`(() => { applyProfileBackground({background:"snow-mountain"}); return document.body.style.backgroundImage; })()`);
  assert.match(url, /backgrounds\/Snowmountain\.jpg/);
});

test("renamed and missing backgrounds preserve ownership and selected settings", () => {
  const app = createApp();
  const settings = app(`normalizeProfileSettings({
    background: "wukong.gif", unlockedBackgrounds: ["wukong.gif", "cyberpunk.jpg", "Snowmountain.jpg", "removed.jpg"],
    backgroundColor: "#07111f"
  })`);
  assert.equal(settings.background, "wukong");
  assert.deepEqual(Array.from(settings.unlockedBackgrounds), ["cyberpunk", "snow-mountain", "wukong", "removed.jpg"]);
  assert.equal(settings.backgroundColor, "#172d45");
  assert.equal(app('normalizeProfileSettings({backgroundColor:"#123456"}).backgroundColor'), "#123456");
  assert.equal(app('normalizeProfileSettings({background:"removed.jpg",unlockedBackgrounds:["removed.jpg"]}).background'), "removed.jpg");
  assert.doesNotThrow(() => app('applyProfileBackground({background:"removed.jpg",unlockedBackgrounds:["removed.jpg"]})'));
});

test("all background names and full filenames resolve to their own redeem code", () => {
  const app = createApp();
  const entries = app('Object.entries(PROFILE_BACKGROUNDS).filter(([id]) => id !== "none")');
  for (const [id, item] of entries) {
    assert.equal(app(`backgroundIdForCode(${JSON.stringify(item.src.toUpperCase())})`), id);
    assert.equal(app(`backgroundIdForCode(${JSON.stringify(item.label)})`), id);
  }
  assert.equal(app('backgroundIdForCode("黑神話")'), "wukong");
  assert.equal(app('backgroundIdForCode("not-a-background")'), null);
});

test("redeem saves every background, rejects duplicates, and restores state on failure", async () => {
  const app = createApp();
  const result = await app(`(async () => {
    authUser = {id:"me",email:"x"}; account = {initialized:true}; friendshipsStatus = "idle";
    profileSettings = normalizeProfileSettings();
    const input = document.getElementById("backgroundRedeemCode");
    const button = {disabled:false};
    let message = "", saves = 0, fail = false;
    showToast = value => { message = value; };
    render = () => {}; loadNotifications = async () => {};
    supabaseClient = {from: () => ({upsert: async () => { saves++; return {error: fail ? {message:"offline"} : null}; }})};
    input.value = "eyes"; await redeemBackground(button);
    const first = profileSettings.unlockedBackgrounds.includes("eyes.gif");
    input.value = "eyes.gif"; await redeemBackground(button);
    const duplicate = message;
    fail = true; input.value = "stars"; await redeemBackground(button);
    return {first, duplicate, saves, failedOwned:profileSettings.unlockedBackgrounds.includes("stars.jpg"), message, disabled:button.disabled};
  })()`);
  assert.equal(result.first, true);
  assert.match(result.duplicate, /已在你的收藏/);
  assert.equal(result.saves, 2);
  assert.equal(result.failedOwned, false);
  assert.match(result.message, /offline/);
  assert.equal(result.disabled, false);
});

test("notification indicator follows the unread count", () => {
  const app = createApp();
  const toggles = [];
  app('authUser = {id:"me"}; account = {initialized:true}; notificationsStatus = "loaded"');
  app('document.getElementById("notificationLink").classList.toggle = (name, value) => { globalThis.lastToggle = [name, value]; }');
  app("notificationsUnreadCount = 2; updateHeader()");
  toggles.push(Array.from(app("lastToggle")));
  app("notificationsUnreadCount = 0; updateHeader()");
  toggles.push(Array.from(app("lastToggle")));
  assert.deepEqual(toggles, [["has-unread", true], ["has-unread", false]]);
});

test("reward choices omit owned assets and retain credits when the catalog is empty", () => {
  const app = createApp();
  const output = app(`(() => {
    profileSettings = normalizeProfileSettings();
    rewardProgress = {highestLevel: 10, imageCredits: 9, gifCredits: 1};
    return rewardsPage();
  })()`);
  assert.match(output, /wukong/);
  assert.match(output, /cat_in_eldenring/);
  assert.doesNotMatch(output, /<option value="cyberpunk"/);
  assert.doesNotMatch(output, /<option value="snow-mountain"/);
  const owned = app('profileSettings.unlockedBackgrounds.push("wukong"); rewardsPage()');
  assert.doesNotMatch(owned, /<option value="wukong"/);
});

test("reward notifications escape badge and background text", () => {
  const app = createApp();
  const output = app(`(() => {
    notificationsStatus = "loaded";
    socialNotifications = [
      {kind:"badge", detail:"<script>", created_at:"2026-01-01T00:00:00Z"},
      {kind:"background", detail:"wukong", created_at:"2026-01-01T00:00:00Z"}
    ];
    return notificationsPage();
  })()`);
  assert.match(output, /徽章<\/span>「&lt;script&gt;」/);
  assert.match(output, /背景<\/span>「wukong」/);
  assert.doesNotMatch(output, /<script>/);
});

test("official translation catalog covers every official series, achievement, and badge", () => {
  const app = createApp();
  assert.equal(app(`seedCategories.every(category => {
    const translated = window.OFFICIAL_EN[category.id];
    return translated && translated.title && translated.description
      && category.achievements.every(achievement => translated.achievements[achievement.id]?.length === 2);
  })`), true);
  assert.equal(app('badgeDefinitions.every(badge => window.BADGES_EN[badge.id]?.length === 2)'), true);
  assert.match(app('categoryText({id:"campus-side-quests",source:"custom",title:"校園 NPC 觀察日誌"}, "title")'), /^校園 NPC 觀察日誌$/);
  assert.match(app('categoryText(seedCategories[0], "title")'), /Campus NPC Field Notes/);
  assert.match(app('achievementText(seedCategories[0].achievements[0], seedCategories[0], "title")'), /Seat Feng Shui Master/);
});

test("English displays official content without changing persisted or custom content", () => {
  const app = createApp();
  const result = app(`(() => {
    language = "en";
    categories = starterCategories();
    categories[0].achievements[0].unlockedAt = "2026-01-01T00:00:00Z";
    categories.push({id:"custom",source:"custom",title:"校園 NPC 觀察日誌",description:"我的文字",symbol:"✦",tone:"blue",achievements:[]});
    const before = JSON.stringify(categories);
    const collection = collectionPage();
    const detail = categoryPage("campus-side-quests");
    const badges = badgesPage(0);
    notificationsStatus = "loaded";
    socialNotifications = [{kind:"badge", detail:"序章玩家", created_at:"2026-01-01T00:00:00Z"}];
    const notifications = notificationsPage();
    return { before, after: JSON.stringify(categories), collection, detail, badges, notifications };
  })()`);
  assert.equal(result.before, result.after);
  assert.match(result.collection, /Campus NPC Field Notes/);
  assert.match(result.collection, /我的文字/);
  assert.match(result.detail, /Seat Feng Shui Master/);
  assert.match(result.badges, /Prologue Player/);
  assert.match(result.notifications, /Prologue Player/);
});

test("reward progress sync sends current level and accepted-friend badges", async () => {
  const app = createApp();
  const result = await app(`(async () => {
    authUser = {id:"me"}; account = {initialized:true}; friendshipsStatus = "loaded";
    friendships = Array.from({length: 5}, () => ({status:"friends"}));
    notificationsStatus = "loaded";
    let payload;
    supabaseClient = {rpc: async (name, args) => {
      if (name === "sync_reward_progress") {
        payload = args;
        return {data:{highestLevel: 10, imageCredits:9, gifCredits:1}, error:null};
      }
      return name === "get_social_notifications" ? {data:[], error:null} : {data:0, error:null};
    }};
    await syncRewardProgress();
    return {payload, rewardProgress};
  })()`);
  assert.equal(result.rewardProgress.gifCredits, 1);
  assert.equal(result.payload.current_badges.some(b => b.id === "friend-five"), true);
  assert.equal(result.payload.current_badges.some(b => b.id === "friend-ten"), false);
});

test("reward sync cannot leak results across sessions for the same account", async () => {
  const app = createApp();
  const result = await app(`(async () => {
    authUser = {id:"me"}; account = {initialized:true}; friendshipsStatus = "loaded";
    let resolve;
    supabaseClient = {rpc: () => new Promise(done => { resolve = done; })};
    const loading = syncRewardProgress();
    await Promise.resolve();
    clearSession();
    authUser = {id:"me"}; account = {initialized:true};
    resolve({data:{highestLevel:10, imageCredits:9, gifCredits:1}, error:null});
    await loading;
    return rewardProgress;
  })()`);
  assert.equal(result, null);
});

test("a new acceptance notification refreshes friendships and friend badges", async () => {
  const app = createApp();
  const result = await app(`(async () => {
    authUser = {id:"me"}; account = {initialized:true}; friendshipsStatus = "loaded";
    notificationsStatus = "loaded"; socialNotifications = [];
    let syncBadges = [];
    supabaseClient = {rpc: async (name, args) => {
      if (name === "get_social_notifications") return {data:[{id:"new",kind:"friend_accepted"}], error:null};
      if (name === "get_social_notifications_unread_count") return {data:1, error:null};
      if (name === "get_friendships") return {data:[{status:"friends",peer_id:"friend"}], error:null};
      syncBadges = args.current_badges;
      return {data:{highestLevel:1,imageCredits:0,gifCredits:0},error:null};
    }};
    await loadNotifications();
    await new Promise(resolve => setTimeout(resolve, 0));
    await rewardSyncQueue;
    return syncBadges.some(b => b.id === "friend-first");
  })()`);
  assert.equal(result, true);
});
