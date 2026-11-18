const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createTour(locale = "en") {
  const elements = new Map();
  const selectors = new Map();
  const documentEvents = {};
  const timers = [];
  function element(id, dialog = null) {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, {
        id, dialog, style: {}, dataset: {}, isConnected: true, open: false, listeners: {},
        classList: {
          add(name) { classes.add(name); },
          remove(name) { classes.delete(name); },
          toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
          contains(name) { return classes.has(name); }
        },
        addEventListener(type, handler) { this.listeners[type] = handler; },
        getClientRects() { return [{}]; },
        getBoundingClientRect() { return { top: 100 }; },
        scrollIntoView() {}, focus() { this.focused = true; },
        matches() { return true; },
        contains(target) { return target === this || target.dialog === this.id; },
        closest() { return this; },
        append(child) { child.parentElement = this; },
        click() { if (!this.disabled && this.listeners.click) this.listeners.click({ target: this }); }
      });
    }
    return elements.get(id);
  }
  const body = element("body");
  const panel = element("tutorialPanel");
  panel.parentElement = body;
  for (const id of ["profileDialog", "entryDialog", "badgeRewardDialog", "badgeRewardDone"]) element(id);
  const target = (selector, dialog = null) => {
    if (!selectors.has(selector)) selectors.set(selector, element(selector, dialog));
    return selectors.get(selector);
  };
  const document = {
    body, documentElement: { lang: locale }, activeElement: element("launcher"),
    getElementById: element,
    querySelector(selector) {
      const dialog = selector.startsWith("#edit") || selector === "#showcaseType0" || selector === "#saveProfileButton"
        ? "profileDialog"
        : selector.startsWith("#category") || selector.startsWith("#achievement") || selector === "#dialogSubmit"
          ? "entryDialog" : null;
      return target(selector, dialog);
    },
    addEventListener(type, handler) { documentEvents[type] = handler; }
  };
  const window = {
    location: { hash: "#/profile" }, innerHeight: 800,
    OpenCC: { Converter: () => value => `简:${value}` },
    requestAnimationFrame(callback) { callback(); },
    setTimeout(callback) { timers.push(callback); },
    addEventListener() {}
  };
  class MutationObserver { observe() {} }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tutorial.js"), "utf8"), { document, window, MutationObserver });
  return {
    element, target, document, window,
    clickTarget(selector, afterClick = () => {}) {
      documentEvents.click({ target: document.querySelector(selector) });
      afterClick();
      while (timers.length) timers.shift()();
    },
    changeLanguage(value) {
      document.documentElement.lang = value;
      documentEvents.change({ target: { classList: { contains: () => true } } });
      while (timers.length) timers.shift()();
    }
  };
}

test("tour highlights real controls and waits for successful profile and series saves", () => {
  const tour = createTour();
  const { element, window } = tour;
  window.LifeUpTutorial.open();
  assert.equal(element("tutorialTitle").textContent, "Welcome to your profile!");
  element("tutorialNext").click();
  assert.equal(element("tutorialTitle").textContent, "First, open the editor");
  assert.equal(element("tutorialNext").disabled, true);
  tour.clickTarget('#app [data-action="edit-profile"]', () => { element("profileDialog").open = true; });
  assert.equal(element("tutorialTitle").textContent, "Your display name");
  assert.equal(element("tutorialPanel").parentElement.id, "profileDialog");
  assert.equal(element("tutorialBack").disabled, true);
  for (let i = 0; i < 4; i++) element("tutorialNext").click();
  assert.equal(element("tutorialTitle").textContent, "Save your changes");
  window.LifeUpTutorial.notify("error", { message: "Save failed: offline" });
  assert.equal(element("tutorialHint").textContent, "Save failed: offline");
  assert.equal(element("tutorialTitle").textContent, "Save your changes");
  element("profileDialog").open = false;
  window.LifeUpTutorial.notify("profile-saved");
  assert.equal(element("tutorialTitle").textContent, "Visit your achievements");
  tour.clickTarget('[data-nav="collection"]', () => { window.location.hash = "#/collection"; });
  tour.clickTarget(".collection-card .official-chip", () => { window.location.hash = "#/category/official"; });
  assert.equal(element("tutorialTitle").textContent, "Unlock something you've done");
  element("tutorialNext").click();
  tour.clickTarget('.breadcrumb a[href="#/collection"]', () => { window.location.hash = "#/collection"; });
  tour.clickTarget('[data-action="add-category"]', () => { element("entryDialog").open = true; });
  element("tutorialNext").click();
  element("tutorialNext").click();
  assert.equal(element("tutorialTitle").textContent, "Add your series");
  window.LifeUpTutorial.notify("achievement-saved");
  assert.equal(element("tutorialTitle").textContent, "Add your series");
  element("entryDialog").open = false;
  window.location.hash = "#/category/new-series";
  window.LifeUpTutorial.notify("category-saved");
  assert.equal(element("tutorialTitle").textContent, "A series needs a quest!");
});

test("tour follows language changes and exits without closing an unfinished form", () => {
  const tour = createTour("zh-Hant");
  const { element, window } = tour;
  window.LifeUpTutorial.open();
  assert.equal(element("tutorialTitle").textContent, "歡迎來到你的展櫃！");
  tour.changeLanguage("zh-Hans");
  assert.equal(element("tutorialTitle").textContent, "简:歡迎來到你的展櫃！");
  tour.changeLanguage("en");
  element("tutorialNext").click();
  tour.clickTarget('#app [data-action="edit-profile"]', () => { element("profileDialog").open = true; });
  element("tutorialSkip").click();
  assert.equal(element("tutorialPanel").hidden, true);
  assert.equal(element("profileDialog").open, true);
  assert.equal(element("tutorialPanel").parentElement.id, "body");
  assert.equal(tour.target("#editDisplayName").classList.contains("tutorial-target"), false);
});
