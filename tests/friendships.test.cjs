const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function createApp() {
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
    addEventListener() {}, setInterval() { return 1; }, clearInterval() {}
  };
  const context = vm.createContext({ document, window, console, URL, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "backgrounds", "catalog.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "official-en.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8"), context);
  return expression => vm.runInContext(expression, context);
}

test("language markers translate only explicitly marked content and preserve form values", () => {
  const app = createApp();
  const result = app(`(() => {
    language = "en";
    const text = { dataset: { i18nZh: "登入", i18nEn: "Sign in" }, textContent: "登入" };
    const input = { dataset: { placeholderZh: "密碼", placeholderEn: "Password" }, placeholder: "密碼", value: "my unsaved text" };
    const label = { dataset: { ariaZh: "關閉", ariaEn: "Close" }, setAttribute(name, value) { this[name] = value; } };
    const userContent = { textContent: "登入" };
    translateMarked({ querySelectorAll(selector) {
      return selector === "[data-i18n-en]" ? [text] : selector === "[data-placeholder-en]" ? [input] : [label];
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
  assert.equal((output.match(/class="friend-identity"/g) || []).length, 5);
  assert.match(output, /7 位隊友/);
  assert.match(output, /&lt;script&gt;/);
  assert.doesNotMatch(output, /<script>/);
  assert.doesNotMatch(output, /friend-5/);
  assert.match(app('friendPreviewMarkup([], null, "failed")'), /無法載入隊友/);
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
  assert.match(output, /read-notifications/);
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
  assert.match(result.markup, /read-notifications/);
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
