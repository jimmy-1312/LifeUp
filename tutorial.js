(function () {
  const steps = [
    { key: "welcome", route: "/profile", target: ".profile-main", mode: "next",
      title: ["歡迎來到你的展櫃！", "Welcome to your profile!"],
      description: ["這次不是看說明書：跟著藍框，親手探索你的展櫃。教學中的儲存會真的更新你的公開檔案，隨時可以退出。", "No instruction manual this time: follow the blue outline and try the real controls. Saving during the tour updates your public profile. You can exit whenever you like."] },
    { key: "edit", route: "/profile", target: '#app [data-action="edit-profile"]', mode: "click",
      title: ["先打開編輯器", "First, open the editor"],
      description: ["點一下框起來的「編輯展櫃」。你的角色設定就在這裡。", "Click the highlighted Edit profile button. This is your character customization screen."] },
    { key: "name", dialog: "profileDialog", target: "#editDisplayName", mode: "next",
      title: ["這是你的名字", "Your display name"],
      description: ["這個名字會顯示在公開展櫃。試著修改，或保留原本的名字，再按下一步。", "This name appears on your public profile. Change it or keep it, then choose Next."] },
    { key: "tags", dialog: "profileDialog", target: "#editTags", mode: "next",
      title: ["替自己貼上聊天標籤", "Tag your interests"],
      description: ["輸入最多五個標籤，用逗號分隔，例如：咖啡、音樂、遊戲。這些標籤是公開的，也能幫朋友找到共同點。", "Add up to five comma-separated tags, such as coffee, music, and gaming. They are public and help friends discover common ground."] },
    { key: "background", dialog: "profileDialog", target: "#editBackground", mode: "next",
      title: ["換個風景吧", "Change the scenery"],
      description: ["試著從下拉選單選擇已擁有的背景。你也可以在下方調整背景顏色；稍後會教你如何獲得更多背景。", "Try choosing an owned background from this menu. You can also adjust its color below; we'll visit background rewards later."] },
    { key: "showcase", dialog: "profileDialog", target: "#showcaseType0", mode: "next",
      title: ["把喜歡的放在 C 位", "Give your favorites the spotlight"],
      description: ["選擇「精選系列」或「近期熱愛」，再填寫出現的欄位。最多可以使用兩張卡片；也可以先保留「不使用」。", "Choose Featured series or Current interests and fill in the fields that appear. You can use up to two cards, or leave them unused for now."] },
    { key: "save-profile", dialog: "profileDialog", target: "#saveProfileButton", mode: "profile-saved",
      title: ["儲存你的設定", "Save your changes"],
      description: ["點選「儲存變更」，把你的名字、標籤、背景和精選展櫃更新到公開檔案。", "Click Save changes to update your public name, tags, background, and showcase."] },
    { key: "collection", route: "/profile", target: '[data-nav="collection"]', mode: "click",
      title: ["來逛成就圖鑑", "Visit your achievements"],
      description: ["點選頂部的「成就圖鑑」，看看人生有哪些支線可以點亮。", "Click Achievements in the top navigation to explore your life side quests."] },
    { key: "official", route: "/collection", target: () => document.querySelector(".collection-card .official-chip")?.closest(".collection-card"), mode: "click",
      title: ["選一個官方系列", "Open an official series"],
      description: ["點開這個官方系列；裡面有預先設計好的成就，不用先想任務名稱。", "Open this official series to see ready-made achievements—no quest-writing required."] },
    { key: "official-card", routePrefix: "/category/", target: '[data-action="toggle-achievement"]', mode: "next",
      title: ["點亮你做過的事", "Unlock something you've done"],
      description: ["如果這項成就符合你的經歷，可以點卡片並確認解鎖；再點一次可以取消。這會真正修改你的成就與 XP。也可以不點，直接按下一步。", "If this achievement describes you, click its card and confirm to unlock it; click again to undo. This really changes your achievements and XP. You may also continue without changing it."] },
    { key: "back-collection", routePrefix: "/category/", target: '.breadcrumb a[href="#/collection"]', mode: "click",
      title: ["現在輪到你設計", "Now make your own"],
      description: ["點選「成就圖鑑」回到系列列表，接著建立屬於你的系列。", "Click Achievements in the breadcrumb to return to the series list."] },
    { key: "create-series", route: "/collection", target: '[data-action="add-category"]', mode: "click",
      title: ["建立你的系列", "Create your own series"],
      description: ["點選「建立我的系列」。例如，你可以收藏旅行故事、喜歡的遊戲，或煎蛋進化史。", "Click Create a series. Try travel stories, favorite games, or your epic egg-cooking journey."] },
    { key: "series-name", dialog: "entryDialog", target: "#categoryTitle", mode: "next",
      title: ["替系列命名", "Name your series"],
      description: ["在這裡輸入一個你想分享的系列名稱。這會建立真正的公開系列，而不是範例資料。", "Enter a series name you'd like to share. This creates a real public series, not sample data."] },
    { key: "series-description", dialog: "entryDialog", target: "#categoryDescription", mode: "next",
      title: ["說說這個系列", "Describe your series"],
      description: ["填寫簡短描述。下面還可以選擇代表符號和色調，讓它更像你。", "Add a short description. You can also choose a symbol and color theme below."] },
    { key: "save-series", dialog: "entryDialog", target: "#dialogSubmit", mode: "category-saved",
      title: ["把系列加入展櫃", "Add your series"],
      description: ["填好必填欄位後，按「儲存」。我們會帶你到新系列；儲存失敗時可以重試。", "Once the required fields are filled in, click Save. We'll open your new series; if saving fails, you can retry."] },
    { key: "add-achievement", routePrefix: "/category/", target: '[data-action="add-achievement"]', mode: "click",
      title: ["系列有了，成就呢？", "A series needs a quest!"],
      description: ["點選「新增成就」，替你的系列加入第一個自訂成就。", "Click Add achievement to create your first custom quest in this series."] },
    { key: "achievement-name", dialog: "entryDialog", target: "#achievementTitle", mode: "next",
      title: ["這次的任務是……", "What is your quest?"],
      description: ["輸入成就名稱，例如「第一次獨自旅行」。", "Enter an achievement name, such as “My first solo trip”."] },
    { key: "achievement-description", dialog: "entryDialog", target: "#achievementDescription", mode: "next",
      title: ["怎樣才算完成？", "What counts as complete?"],
      description: ["輸入解鎖條件，並在下方選擇符號和 XP。沒有裁判，你自己說了算。", "Describe the unlock condition and choose a symbol and XP below. You're the referee here."] },
    { key: "save-achievement", dialog: "entryDialog", target: "#dialogSubmit", mode: "achievement-saved",
      title: ["儲存你的第一個成就", "Save your first achievement"],
      description: ["填好必填欄位後，按「儲存」。它會加入你的真實系列。", "Fill in the required fields and click Save to add it to your real series."] },
    { key: "custom-card", routePrefix: "/category/", target: '[data-action="toggle-achievement"]', mode: "next",
      title: ["這就是你的自訂成就！", "There's your custom achievement!"],
      description: ["完成後可以點卡片解鎖，或再次點擊取消。這會修改真實資料；如果還沒完成，先按下一步就好。", "When you've completed it, click the card to unlock it, or click again to undo. This changes real data, so feel free to continue without unlocking."] },
    { key: "badges", target: '[data-nav="badges"]', mode: "click",
      title: ["看看你的徽章", "Check your badges"],
      description: ["點選頂部「靈魂徽章」。完成成就和徽章條件可累積 XP；好友徽章不提供 XP。", "Click Badges in the top navigation. Achievements and earned badges contribute XP; friend badges do not."] },
    { key: "badge-view", route: "/badges", target: ".badge-level", mode: "next",
      title: ["你的等級與收藏", "Your level and collection"],
      description: ["這裡顯示等級和 XP，下方是已獲得的徽章。慢慢玩，人生沒有補考。", "Your level and XP are here; earned badges appear below. Take your time—life has no retake exam."] },
    { key: "rewards-menu", target: "#profileMenu", mode: "click",
      title: ["打開帳號選單", "Open the account menu"],
      description: ["點一下右上角的玩家名稱，我們去看看背景獎勵。", "Click your player name in the top bar to find background rewards."] },
    { key: "rewards-link", target: '#accountMenuItems a[href="#/rewards"]', mode: "click",
      title: ["看看升級獎勵", "Visit background rewards"],
      description: ["點選「升級背景獎勵」。", "Click Background rewards."] },
    { key: "rewards-view", route: "/rewards", target: ".reward-choice", mode: "next",
      title: ["升級，然後換風景", "Level up, change the view"],
      description: ["每次升級可選一張尚未擁有的靜態背景；每達到 10 的倍數等級可額外選一個動態背景。未用的機會會保留。帳號選單也能用背景名稱兌換。", "Each level grants a choice of an unowned static background; every 10 levels also grants an animated choice. Unused choices are saved. The account menu also accepts background names for redemption."] },
    { key: "friends-menu", target: "#profileMenu", mode: "click",
      title: ["冒險不一定要單人", "Adventures can be co-op"],
      description: ["再打開一次帳號選單，這次去找隊友。", "Open the account menu again to find your friends."] },
    { key: "friends-link", target: '#accountMenuItems a[href="#/friends"]', mode: "click",
      title: ["打開隊友名冊", "Open your friends list"],
      description: ["點選「隊友名冊」。", "Click Friends."] },
    { key: "friends-search", route: "/friends", target: "#friendSlug", mode: "next",
      title: ["尋找另一位玩家", "Find another player"],
      description: ["輸入朋友公開網址最後的名稱，或直接造訪他們的連結。在對方展櫃送出邀請，對方接受後就能比較共同話題和送鼓勵。也可以為他們的成就按讚，讚數只有擁有者看得到。現在不用真的送出邀請。", "Enter a friend's profile URL name, or visit their shared link. Once they accept your request, you can compare common ground and send encouragement. You can also like achievements; only their owner sees the counts. No request is required for this tour."] },
    { key: "notifications", target: "#notificationLink", mode: "click",
      title: ["別錯過隊友的訊號", "Don't miss a party invite"],
      description: ["點選頂部的通知鈴鐺。紅點代表有未讀通知。", "Click the notification bell at the top. A red dot means something is unread."] },
    { key: "notifications-view", route: "/notifications", target: ".notification-section", mode: "next",
      title: ["通知收件匣", "Your notification inbox"],
      description: ["好友邀請、鼓勵與獎勵都會出現在這裡。", "Friend requests, encouragement, and rewards appear here."] },
    { key: "return-profile", target: '[data-nav="profile"]', mode: "click",
      title: ["最後回到你的展櫃", "One last stop: your profile"],
      description: ["點選頂部「我的展櫃」。", "Click My profile in the top navigation."] },
    { key: "share", route: "/profile", target: '#app [data-action="copy-profile-link"]', mode: "next",
      title: ["把你的故事分享出去", "Share your story"],
      description: ["這個按鈕可以複製公開連結，放進社群 Bio 或傳給朋友。分享前記得檢查你願意公開的內容。恭喜，新手村畢業！", "This button copies your public link for your social bio or friends. Check what you're comfortable sharing first. Congratulations, you've finished the tutorial!"] }
  ];

  const panel = document.getElementById("tutorialPanel");
  const byId = id => document.getElementById(id);
  const simplify = window.OpenCC.Converter({ from: "tw", to: "cn" });
  const text = pair => document.documentElement.lang === "en" ? pair[1] : document.documentElement.lang === "zh-Hans" ? simplify(pair[0]) : pair[0];
  let index = 0;
  let active = false;
  let highlighted = null;
  let previousFocus = null;
  let scheduled = false;
  let errorMessage = "";
  let lastStep = -1;

  function currentRoute() {
    return window.location.hash.slice(1).split("?")[0] || "/";
  }
  function targetFor(step) {
    if (step.route && currentRoute() !== step.route) return null;
    if (step.routePrefix && !currentRoute().startsWith(step.routePrefix)) return null;
    if (step.dialog && !byId(step.dialog).open) return null;
    const target = typeof step.target === "function" ? step.target() : document.querySelector(step.target);
    const modal = byId("badgeRewardDialog").open ? byId("badgeRewardDialog") : byId("entryDialog").open ? byId("entryDialog") : byId("profileDialog").open ? byId("profileDialog") : null;
    if (modal && target && !modal.contains(target)) return null;
    return target && target.getClientRects().length ? target : null;
  }
  function clearHighlight() {
    if (highlighted) highlighted.classList.remove("tutorial-target");
    highlighted = null;
  }
  function schedule() {
    if (!active || scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => { scheduled = false; if (active) refresh(); });
  }
  function moveTo(stepIndex) {
    index = stepIndex;
    errorMessage = "";
    refresh();
  }
  function refresh() {
    const badge = byId("badgeRewardDialog");
    const modal = badge.open ? badge : byId("entryDialog").open ? byId("entryDialog") : byId("profileDialog").open ? byId("profileDialog") : null;
    const parent = modal || document.body;
    if (panel.parentElement !== parent) parent.append(panel);
    const step = steps[index];
    if (step.dialog && !byId(step.dialog).open && !badge.open) {
      const recovery = step.dialog === "profileDialog" ? "edit" : step.key.startsWith("series-") || step.key === "save-series" ? "create-series" : "add-achievement";
      index = steps.findIndex(item => item.key === recovery);
      errorMessage = "";
      return refresh();
    }
    const actual = steps[index];
    const target = badge.open ? byId("badgeRewardDone") : targetFor(actual);
    const changedTarget = highlighted !== target;
    if (changedTarget) {
      clearHighlight();
      highlighted = target;
      if (target) target.classList.add("tutorial-target");
    }
    if (target && (lastStep !== index || !target.dataset.tutorialSeen)) {
      target.scrollIntoView({ block: modal ? "center" : "start", inline: "nearest", behavior: "auto" });
      target.dataset.tutorialSeen = "true";
    }
    if (target && (lastStep !== index || changedTarget) && target.matches("button, a, input, textarea, select, summary")) {
      target.focus({ preventScroll: true });
    }
    lastStep = index;
    panel.classList.toggle("tutorial-panel-top", Boolean(target && target.getBoundingClientRect().top > window.innerHeight * .55));
    byId("tutorialProgressCount").textContent = `${index + 1} / ${steps.length}`;
    byId("tutorialProgressFill").style.width = `${(index + 1) / steps.length * 100}%`;
    byId("tutorialTitle").textContent = badge.open ? text(["新徽章入手！", "New badge unlocked!"]) : text(actual.title);
    byId("tutorialDescription").textContent = badge.open
      ? text(["先點選徽章視窗中的按鈕，然後繼續教學。", "Close the badge celebration to continue your tour."])
      : text(actual.description);
    byId("tutorialHint").textContent = errorMessage || (!target && !badge.open
      ? text(["等待頁面載入。若頁面沒有出現，可退出後重新開始教學。", "Waiting for the page. If it doesn't appear, exit and restart the tour."])
      : !badge.open && actual.mode !== "next"
        ? text(["請操作藍框內的項目。", "Use the highlighted control to continue."])
        : "");
    byId("tutorialSkip").textContent = text(["退出教學", "Exit tour"]);
    byId("tutorialBack").textContent = text(["上一步", "Back"]);
    byId("tutorialBack").disabled = badge.open || index === 0 || !targetFor(steps[index - 1]);
    byId("tutorialNext").textContent = index === steps.length - 1 ? text(["完成", "Finish"]) : text(["下一步", "Next"]);
    byId("tutorialNext").disabled = badge.open || !target || actual.mode !== "next";
  }
  function open() {
    if (active) return;
    active = true;
    index = 0;
    lastStep = -1;
    errorMessage = "";
    previousFocus = document.activeElement;
    panel.hidden = false;
    if (currentRoute() !== "/profile") window.location.hash = "#/profile";
    refresh();
  }
  function close() {
    active = false;
    clearHighlight();
    panel.hidden = true;
    document.body.append(panel);
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }
  function notify(event, data = {}) {
    if (!active) return;
    if (event === "error") {
      errorMessage = data.message;
      refresh();
    } else if (steps[index].mode === event) {
      moveTo(index + 1);
    }
  }

  byId("tutorialSkip").addEventListener("click", close);
  byId("tutorialBack").addEventListener("click", () => { if (index > 0 && targetFor(steps[index - 1])) moveTo(index - 1); });
  byId("tutorialNext").addEventListener("click", () => {
    if (steps[index].mode !== "next" || !targetFor(steps[index])) return;
    if (index === steps.length - 1) close();
    else moveTo(index + 1);
  });
  document.addEventListener("click", event => {
    if (!active || byId("badgeRewardDialog").open || steps[index].mode !== "click") return;
    const target = targetFor(steps[index]);
    if (!target || !target.contains(event.target)) return;
    const clickedStep = index;
    window.setTimeout(() => { if (active && index === clickedStep) moveTo(index + 1); }, 0);
  });
  document.addEventListener("change", event => {
    if (active && event.target.classList.contains("language-toggle")) window.setTimeout(schedule, 0);
  });
  window.addEventListener("hashchange", schedule);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  new MutationObserver(records => {
    if (records.some(record => !panel.contains(record.target))) schedule();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });

  window.LifeUpTutorial = Object.freeze({ open, close, notify });
})();
