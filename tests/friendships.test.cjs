const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function createApp() {
  const element = () => ({
    style: {}, dataset: {}, classList: { toggle() {}, remove() {} },
    addEventListener() {}, querySelectorAll() { return []; }, focus() {}
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
    addEventListener() {}
  };
  const context = vm.createContext({ document, window, console, URL, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8"), context);
  return expression => vm.runInContext(expression, context);
}

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
