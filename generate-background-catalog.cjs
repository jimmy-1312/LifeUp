const fs = require("node:fs");
const path = require("node:path");

const folder = path.join(__dirname, "backgrounds");
const legacyIds = {
  "夜城(靜態).jpg": "cyberpunk",
  "雪山(靜態).jpg": "snow-mountain",
  "孫悟空(動態).gif": "wukong"
};
const entries = fs.readdirSync(folder, { withFileTypes: true })
  .filter(entry => entry.isFile() && /\.(jpe?g|png|webp|gif)$/i.test(entry.name))
  .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"))
  .map(entry => ({
    id: legacyIds[entry.name] || entry.name,
    label: path.parse(entry.name).name,
    src: entry.name,
    type: /\.gif$/i.test(entry.name) ? "gif" : "image"
  }));
if (new Set(entries.map(entry => entry.id)).size !== entries.length) {
  throw new Error("Background IDs must be unique.");
}
fs.writeFileSync(path.join(folder, "catalog.js"), `window.BACKGROUND_CATALOG = ${JSON.stringify(entries, null, 2)};\n`);
const sqlValues = entries.map(({ id, type }) => `('${id.replace(/'/g, "''")}', '${type}')`).join(",\n  ");
fs.writeFileSync(path.join(folder, "catalog.sql"), sqlValues
  ? `-- Run as the database owner after adding backgrounds.\ninsert into public.background_catalog (id, reward_type) values\n  ${sqlValues}\non conflict (id) do update set reward_type = excluded.reward_type;\n`
  : "-- No background assets found.\n");
