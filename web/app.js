"use strict";
const GROUPS = {
  Technical: ["corners","crossing","dribbling","finishing","first_touch","free_kick_taking","heading","long_shots","long_throws","marking","passing","penalty_taking","tackling","technique"],
  Mental: ["aggression","anticipation","bravery","composure","concentration","decisions","determination","flair","leadership","off_the_ball","positioning","teamwork","vision","work_rate"],
  Physical: ["acceleration","agility","balance","jumping_reach","natural_fitness","pace","stamina","strength"],
  Goalkeeping: ["aerial_reach","command_of_area","communication","eccentricity","handling","kicking","one_on_ones","punching","reflexes","rushing_out","throwing"],
  Hidden: ["consistency","dirtiness","important_matches","injury_proneness","versatility"],
};
const COMPOSITES = {
  Attacking: ["finishing","long_shots","off_the_ball","composure","dribbling"],
  Control: ["first_touch","technique","dribbling","balance","composure"],
  Playmaking: ["passing","vision","decisions","technique","teamwork"],
  Physicality: ["pace","acceleration","strength","stamina","jumping_reach","agility"],
  Mental: ["anticipation","decisions","determination","concentration","work_rate","bravery"],
  Defending: ["tackling","marking","positioning","heading","anticipation"],
};
const KEY_SETS = {
  General: ["pace", "acceleration", "passing", "technique", "decisions", "work_rate"],
  Goalkeeper: ["handling", "reflexes", "one_on_ones", "aerial_reach", "command_of_area", "positioning"],
  "Centre-back": ["tackling", "marking", "heading", "positioning", "jumping_reach", "strength"],
  "Full-back": ["crossing", "tackling", "pace", "acceleration", "stamina", "positioning"],
  "Defensive midfielder": ["tackling", "positioning", "passing", "anticipation", "work_rate", "stamina"],
  "Central midfielder": ["passing", "vision", "first_touch", "decisions", "work_rate", "technique"],
  Winger: ["dribbling", "crossing", "pace", "acceleration", "technique", "off_the_ball"],
  "Attacking midfielder": ["passing", "vision", "technique", "first_touch", "dribbling", "off_the_ball"],
  Striker: ["finishing", "off_the_ball", "composure", "first_touch", "pace", "heading"],
};
const KEY_BY_POSITION = { GK: "Goalkeeper", DC: "Centre-back", DL: "Full-back", DR: "Full-back", WBL: "Full-back",
  WBR: "Full-back", DM: "Defensive midfielder", MC: "Central midfielder", ML: "Winger", MR: "Winger", AML: "Winger",
  AMR: "Winger", AMC: "Attacking midfielder", STC: "Striker" };
const ABBR = { pace: "Pac", acceleration: "Acc", passing: "Pas", technique: "Tec", decisions: "Dec", work_rate: "Wor",
  handling: "Han", reflexes: "Ref", one_on_ones: "1v1", aerial_reach: "Aer", command_of_area: "Cmd", positioning: "Pos",
  tackling: "Tck", marking: "Mar", heading: "Hea", jumping_reach: "Jum", strength: "Str", crossing: "Cro", stamina: "Sta",
  anticipation: "Ant", vision: "Vis", first_touch: "Fir", dribbling: "Dri", off_the_ball: "OtB", finishing: "Fin",
  composure: "Cmp" };
const POS = { fullbacks: ["DL", "DR", "WBL", "WBR"], wingers: ["ML", "MR", "AML", "AMR"] };
// Thresholds below are this tool's own defaults, not the game's or FMScout's.
const QUICK = [
  { group: "Best players", items: [
    { label: "Overall", set: {} },
    { label: "GK", set: { positions: ["GK"] } },
    { label: "Centre-backs", set: { positions: ["DC"] } },
    { label: "Full-backs", set: { positions: POS.fullbacks } },
    { label: "Def. mids", set: { positions: ["DM"] } },
    { label: "Midfielders", set: { positions: ["MC"] } },
    { label: "Wingers", set: { positions: POS.wingers } },
    { label: "Att. mids", set: { positions: ["AMC"] } },
    { label: "Strikers", set: { positions: ["STC"] } },
  ] },
  { group: "Talents", items: [
    { label: "Wonderkids", title: "Age 21 or under, potential 150+", set: { fAgeMax: 21, fPaMin: 150 }, sort: "pa" },
    { label: "Bargain wonderkids", title: "Age 21 or under, potential 140+, value up to £5m", set: { fAgeMax: 21, fPaMin: 140, fValueMax: 5 }, sort: "pa" },
    { label: "Hidden gems", title: "Age 23 or under, potential 140+, value up to £1m", set: { fAgeMax: 23, fPaMin: 140, fValueMax: 1 }, sort: "pa" },
  ] },
  { group: "Deals", items: [
    { label: "Free agents", title: "Players without a club, best first", set: { fFree: true } },
    { label: "Top bargains", title: "Ability 130+, value up to £10m", set: { fCaMin: 130, fValueMax: 10 } },
    { label: "Expiring contracts", title: "Contract ends within 6 months", set: { contractMonths: 6 } },
  ] },
];
const BASE_COLUMNS = [
  { key: "name", label: "Name", get: p => p.name },
  { key: "age", label: "Age", num: true, get: p => p.age },
  { key: "gender", label: "Gender", get: p => genderLabel(p) },
  { key: "nation", label: "Nat", get: p => p.nation_code || p.nation },
  { key: "club", label: "Club", get: p => p.club_short || p.club },
  { key: "pos", label: "Position", get: p => posLabel(p) },
  { key: "ca", label: "CA", num: true, get: p => p.ca },
  { key: "pa", label: "PA", num: true, get: p => p.pa },
  { key: "value", label: "Value", num: true, get: p => p.value, fmt: money },
  { key: "wage", label: "Wage p/w", num: true, get: p => p.wage, fmt: money },
  { key: "contract_end", label: "Contract", get: p => p.contract_end },
];

const $ = id => document.getElementById(id);
const state = { players: [], data: null, attrIndex: {}, posIndex: {}, positions: new Set(),
  refCache: {}, similarTo: null, matchOf: new Map(), shortlist: new Set(), attrFilters: [], sort: { key: "ca", dir: -1 }, shown: 200, filtered: [], managedClub: null };

function el(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined) node.append(c);
  return node;
}
const title = s => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
function money(v) {
  if (v === null || v === undefined) return "–";
  if (v >= 1e6) return "£" + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + "m";
  if (v >= 1e3) return "£" + Math.round(v / 1e3) + "k";
  return "£" + v;
}
const band = v => v >= 16 ? "b-top" : v >= 11 ? "b-good" : v >= 6 ? "b-mid" : "b-low";
const badge = v => el("span", { class: "badge " + band(v ?? 0) }, v ?? "–");
const genderLabel = p => p.gender ? (p.gender === "men" ? "Male" : "Female") + (p.gender_estimated ? " (est.)" : "") : "Unknown";
const posLabel = p => p.natural_positions.concat(p.accomplished_positions).join(", ");
const attr = (p, name) => p.attributes[state.attrIndex[name]];

// ---------- Save source: a connected folder, or a single chosen file ----------
// The page cannot read the disk on its own. Either the user grants read access to the
// game's save folder once (remembered by the browser), or picks one save file per visit.
const SAVE_PATH = "~/Library/Containers/com.sega.soccer.manager.23/Data/Library/Application Support/local_backups";
const SAVE_PATTERN = /\.fmv?$/i;
const canPickFolder = typeof window.showDirectoryPicker === "function";
const source = { dir: null, files: [] };   // files: File objects, newest first

// A folder handle cannot be stored in localStorage; IndexedDB can hold it.
function idb(mode, run) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("fmscout", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("kv");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction("kv", mode);
      const request = run(tx.objectStore("kv"));
      tx.oncomplete = () => { open.result.close(); resolve(request.result); };
      tx.onerror = () => { open.result.close(); reject(tx.error); };
    };
  });
}
// Remembering is a convenience: if storage is unavailable the folder is simply asked for again.
const rememberDir = dir => idb("readwrite", store => store.put(dir, "dir")).catch(() => {});
const recallDir = () => idb("readonly", store => store.get("dir")).catch(() => null);

// ---------- The reader worker ----------
let worker = null;
let pending = null;   // the one parse in flight: { id, resolve, reject }
let parseId = 0;
class Superseded extends Error {}

function startWorker() {
  worker = new Worker("worker.js", { type: "module" });
  worker.onmessage = ({ data }) => {
    if (data.type === "progress") { if (pending) setStatus(data.text); return; }
    if (data.type === "boot-error") { failPending(new Error("The save reader could not start: " + data.error)); return; }
    if (!pending || data.id !== pending.id) return;
    const { resolve, reject } = pending;
    pending = null;
    if (data.type === "result") {
      try { resolve(JSON.parse(data.json)); } catch (err) { reject(err); }
    } else if (data.type === "error") reject(new Error(data.error));
  };
  worker.onerror = event => failPending(new Error("The save reader stopped: " + (event.message || "unknown error")));
}
function failPending(error) {
  if (!pending) return;
  const { reject } = pending;
  pending = null;
  reject(error);
}
function parseSave(file) {
  // A newer request replaces one still running: stop the worker and start a fresh one.
  if (pending) { worker.terminate(); failPending(new Superseded()); startWorker(); }
  return new Promise((resolve, reject) => {
    pending = { id: ++parseId, resolve, reject };
    worker.postMessage({ type: "parse", id: pending.id, file });
  });
}

async function readFolder(dir) {
  const files = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "file" && SAVE_PATTERN.test(name)) files.push(await handle.getFile());
  }
  return files.sort((a, b) => b.lastModified - a.lastModified);
}

function setFiles(files, keepName) {
  source.files = files;
  $("saveSelect").replaceChildren(...files.map((file, i) =>
    el("option", { value: i }, `${file.name.replace(SAVE_PATTERN, "")} · ${new Date(file.lastModified).toLocaleString()}`)));
  const kept = keepName ? files.findIndex(f => f.name === keepName) : -1;
  $("saveSelect").value = String(Math.max(0, kept));
  $("reload").textContent = source.dir ? "Reload" : "Choose another file";
}

async function loadSelected() {
  const file = source.files[Number($("saveSelect").value)];
  if (!file) return;
  setStatus("Loading the save reader…");
  $("saveMeta").textContent = "Loading…";
  try {
    applyData(await parseSave(file));
  } catch (err) {
    if (err instanceof Superseded) return;
    state.data = null;
    state.players = [];
    $("saveMeta").textContent = "Could not load save";
    showWelcome(`Could not read ${file.name}: ${err.message}`);
  }
}

// Re-reads the connected folder. latest: jump to the newest save; otherwise keep the selection.
async function refreshFolder({ latest }) {
  const keep = latest ? null : source.files[Number($("saveSelect").value)]?.name;
  let files;
  try {
    files = await readFolder(source.dir);
  } catch (err) {
    showWelcome(`Could not read the folder "${source.dir.name}": ${err.message}`);
    return;
  }
  if (!files.length) {
    showWelcome(`No .fmv save files were found in "${source.dir.name}". Check that you chose the local_backups folder.`);
    return;
  }
  setFiles(files, keep);
  await loadSelected();
}

async function connectFolder() {
  let dir;
  try {
    dir = await window.showDirectoryPicker({ id: "fm-saves", mode: "read" });
  } catch (err) {
    if (err.name === "AbortError") return;   // dialog cancelled
    showWelcome(`The browser would not open that folder (${err.message}). Choose a save file instead.`);
    return;
  }
  source.dir = dir;
  await rememberDir(dir);
  await refreshFolder({ latest: true });
}

async function reconnectFolder(dir) {
  let permission;
  try {
    permission = await dir.requestPermission({ mode: "read" });
  } catch (err) {
    showWelcome(`Could not reconnect "${dir.name}": ${err.message}`);
    return;
  }
  if (permission !== "granted") { showWelcome(`Access to "${dir.name}" was not granted.`, dir); return; }
  source.dir = dir;
  await refreshFolder({ latest: true });
}

async function useFile(file) {
  if (!file) return;
  if (!SAVE_PATTERN.test(file.name)) { showWelcome(`"${file.name}" is not a Football Manager save (.fmv or .fm).`); return; }
  source.dir = null;
  setFiles([file]);
  await loadSelected();
}

// The start screen. notice: a problem to explain; rememberedDir: offer a one-click reconnect.
function showWelcome(notice, rememberedDir) {
  $("count").textContent = "";
  $("keyNote").textContent = "";
  $("similarNote").replaceChildren();
  const pathBox = el("code", { class: "path" }, SAVE_PATH);
  const copy = el("button", { class: "btn small", type: "button", onclick: async () => {
    try { await navigator.clipboard.writeText(SAVE_PATH); copy.textContent = "Copied"; }
    catch { copy.textContent = "Select the path and copy it"; }
  } }, "Copy path");
  const fileButton = el("button", { class: "btn" + (canPickFolder ? "" : " primary"), type: "button",
    onclick: () => $("fileInput").click() }, canPickFolder ? "Choose a save file instead" : "Choose a save file");
  $("tablewrap").replaceChildren(el("div", { class: "welcome" },
    notice ? el("div", { class: "notice", role: "alert" }, notice) : null,
    el("h2", {}, "Load your game save"),
    el("p", {}, "FM Scout reads the save inside your browser. Nothing is uploaded."),
    rememberedDir ? el("p", {}, el("button", { class: "btn primary", type: "button",
      onclick: () => reconnectFolder(rememberedDir) }, `Reconnect "${rememberedDir.name}"`)) : null,
    canPickFolder ? el("div", {},
      el("p", {}, "Connect the game's save folder once and your newest save loads on every visit. Football Manager Touch on a Mac keeps its saves here:"),
      el("p", { class: "pathrow" }, pathBox, copy),
      el("p", { class: "sub" }, "In the folder dialog press Cmd+Shift+G, paste the path, press Return, then choose Open."),
      el("p", {}, el("button", { class: "btn" + (rememberedDir ? "" : " primary"), type: "button", onclick: connectFolder },
        rememberedDir ? "Connect a different folder" : "Connect save folder"), " ", fileButton))
      : el("div", {},
        el("p", {}, "This browser cannot remember a folder, so choose the save file each visit. Football Manager Touch on a Mac keeps its saves here:"),
        el("p", { class: "pathrow" }, pathBox, copy),
        el("p", {}, fileButton)),
    el("p", { class: "sub" }, "You can also drag a .fmv file onto this page.")));
}

function applyData(data) {
  state.data = data;
  state.managedClub = data.managed_club;
  state.refCache = {};
  state.attrIndex = Object.fromEntries(data.attributes.map((a, i) => [a, i]));
  state.posIndex = Object.fromEntries(data.positions.map((a, i) => [a.toUpperCase(), i]));
  state.players = data.rows.map(r => Object.fromEntries(data.columns.map((c, i) => [c, r[i]])));
  if (state.similarTo) state.similarTo = state.players.find(p => p.uid === state.similarTo.uid) || null;
  $("saveMeta").textContent = `${data.game} · in-game date ${data.game_date} · ${state.players.length.toLocaleString()} players`
    + (data.known_build ? "" : " · unverified game build");
  const nations = [...new Set(state.players.map(p => p.nation).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const current = $("fNation").value;
  $("fNation").replaceChildren(el("option", { value: "" }, "Any"), ...nations.map(n => el("option", { value: n }, n)));
  $("fNation").value = nations.includes(current) ? current : "";
  apply();
}

function setStatus(text, isError) {
  $("tablewrap").replaceChildren(el("div", { class: "status" + (isError ? " error" : ""), role: isError ? "alert" : null }, text));
  $("count").textContent = "";
}

function readFilters() {
  const num = id => $(id).value === "" ? null : Number($(id).value);
  return {
    name: $("fName").value.trim().toLowerCase(), club: $("fClub").value.trim().toLowerCase(),
    nation: $("fNation").value, gender: $("fGender").value, naturalOnly: $("fNaturalOnly").checked,
    ageMin: num("fAgeMin"), ageMax: num("fAgeMax"), caMin: num("fCaMin"), paMin: num("fPaMin"),
    valueMax: num("fValueMax"), wageMax: num("fWageMax"), contract: $("fContract").value,
    free: $("fFree").checked, shortOnly: $("fShort").checked, hideMine: $("fHideMine").checked, keyAttrs: $("fKeyAttrs").checked,
  };
}
const fold = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function apply() {
  if (!state.data) return;
  const f = readFilters();
  const name = fold(f.name), club = fold(f.club);
  const positions = [...state.positions];
  const attrs = state.attrFilters.filter(a => a.name && a.min > 0);
  state.matchOf = new Map(state.similarTo
    ? similarPlayers(state.similarTo, Infinity, true).map(m => [m.player, m.similarity]) : []);
  state.filtered = state.players.filter(p => {
    if (state.similarTo && !state.matchOf.has(p)) return false;
    if (f.shortOnly && !state.shortlist.has(p.uid)) return false;
    if (name && !fold(p.name).includes(name)) return false;
    if (club && !fold(p.club).includes(club) && !fold(p.club_short).includes(club)) return false;
    if (f.nation && p.nation !== f.nation && !p.second_nations.includes(f.nation)) return false;
    if (f.gender && p.gender && p.gender !== f.gender) return false;
    if (positions.length) {
      const pool = f.naturalOnly ? p.natural_positions : p.natural_positions.concat(p.accomplished_positions);
      if (!positions.some(x => pool.includes(x))) return false;
    }
    if (f.ageMin !== null && p.age < f.ageMin) return false;
    if (f.ageMax !== null && p.age > f.ageMax) return false;
    if (f.caMin !== null && (p.ca ?? 0) < f.caMin) return false;
    if (f.paMin !== null && (p.pa ?? 0) < f.paMin) return false;
    if (f.valueMax !== null && (p.value === null ? Boolean(p.club) : p.value > f.valueMax * 1e6)) return false;
    if (f.wageMax !== null && (p.wage ?? 0) > f.wageMax * 1e3) return false;
    if (f.contract && !(p.contract_end && p.contract_end <= f.contract)) return false;
    if (f.free && p.club) return false;
    if (f.hideMine && state.managedClub && p.club === state.managedClub) return false;
    for (const a of attrs) if ((attr(p, a.name) ?? 0) < a.min) return false;
    return true;
  });
  if (state.similarTo) {
    state.filtered.sort((a, b) => state.matchOf.get(b) - state.matchOf.get(a));
    state.filtered.length = Math.min(state.filtered.length, SIMILAR_LIMIT);
  }
  state.shown = 200;
  sortRows();
  render();
}

function keySetName() {
  const names = new Set([...state.positions].map(x => KEY_BY_POSITION[x]));
  return names.size === 1 ? [...names][0] : "General";
}
function columns() {
  const key = $("fKeyAttrs").checked ? KEY_SETS[keySetName()] : [];
  const filtered = state.attrFilters.map(a => a.name).filter(Boolean);
  const extra = [...new Set(key.concat(filtered))].map(name => ({
    key: "attr:" + name, label: ABBR[name] && !filtered.includes(name) ? ABBR[name] : title(name),
    title: title(name), num: true, attr: true, get: p => attr(p, name) }));
  const star = { key: "star", label: "★", title: "Shortlist", star: true, get: p => state.shortlist.has(p.uid) ? 1 : 0, num: true };
  const match = state.similarTo ? [{ key: "match", label: "Match", num: true, get: p => state.matchOf.get(p), fmt: v => v + "%" }] : [];
  return [star, BASE_COLUMNS[0]].concat(match, BASE_COLUMNS.slice(1), extra);
}

function sortRows() {
  const col = columns().find(c => c.key === state.sort.key) || BASE_COLUMNS.find(c => c.key === "ca");
  const dir = state.sort.dir;
  state.filtered.sort((a, b) => {
    const x = col.get(a), y = col.get(b);
    if (x === y) return 0;
    if (x === null || x === undefined || x === "") return 1;   // blanks last either way
    if (y === null || y === undefined || y === "") return -1;
    return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
  });
}

function render() {
  const cols = columns();
  const total = state.filtered.length;
  $("count").textContent = `${total.toLocaleString()} of ${state.players.length.toLocaleString()} players`;
  $("keyNote").textContent = $("fKeyAttrs").checked ? `Key attributes: ${keySetName()}` : "";
  $("similarNote").replaceChildren(...(state.similarTo ? [
    el("strong", {}, `Similar to ${state.similarTo.name}`), ` · closest ${SIMILAR_LIMIT} within your filters `,
    el("button", { class: "btn small", type: "button", onclick: clearSimilar }, "Clear")] : []));
  if (!total) { setStatus("No players match these filters."); $("count").textContent = "0 players match"; return; }
  const head = el("tr", {}, cols.map(c => el("th", {
    class: c.num ? "num" : "", scope: "col", tabindex: "0", title: c.title || null,
    "aria-sort": state.sort.key === c.key ? (state.sort.dir === 1 ? "ascending" : "descending") : null,
    onclick: () => setSort(c), onkeydown: e => { if (e.key === "Enter") setSort(c); },
  }, c.label + (state.sort.key === c.key ? (state.sort.dir === 1 ? " ▲" : " ▼") : ""))));
  const body = el("tbody", {}, state.filtered.slice(0, state.shown).map(p => el("tr", {
    tabindex: "0", onclick: () => openProfile(p), onkeydown: e => { if (e.key === "Enter") openProfile(p); },
  }, cols.map(c => {
    const v = c.get(p);
    if (c.star) return el("td", { class: "starcell" }, el("button", { class: "starbtn" + (v ? " on" : ""), type: "button",
      "aria-label": (v ? "Remove from shortlist: " : "Add to shortlist: ") + p.name, "aria-pressed": String(Boolean(v)),
      onclick: e => { e.stopPropagation(); toggleShortlist(p); }, onkeydown: e => e.stopPropagation() }, v ? "★" : "☆"));
    const content = c.attr ? badge(v) : c.fmt ? c.fmt(v) : (v === null || v === undefined || v === "" ? "–" : v);
    return el("td", { class: (c.num ? "num " : "") + (c.key === "name" ? "name" : "") }, content);
  }))));
  const nodes = [el("table", {}, el("thead", {}, head), body)];
  if (total > state.shown) nodes.push(el("div", { class: "more" },
    el("button", { class: "btn", type: "button", onclick: () => { state.shown += 300; render(); } },
      `Show more (${(total - state.shown).toLocaleString()} remaining)`)));
  $("tablewrap").replaceChildren(...nodes);
}

function setSort(col) {
  state.sort = state.sort.key === col.key ? { key: col.key, dir: -state.sort.dir }
    : { key: col.key, dir: col.num ? -1 : 1 };
  sortRows(); render();
}

function stars(value) {
  const halves = Math.max(0, Math.min(10, Math.round((value || 0) / 20)));
  return el("span", { class: "stars", role: "img", "aria-label": `${halves / 2} of 5 stars` },
    "★★★★★", el("span", { class: "on", style: `width:${halves * 10}%` }, "★★★★★"));
}
const kpi = (k, ...v) => el("div", { class: "kpi" }, el("div", { class: "k" }, k), el("div", { class: "v" }, ...v));
const footWord = v => v >= 18 ? "Very strong" : v >= 15 ? "Strong" : v >= 12 ? "Fairly strong" : v >= 8 ? "Reasonable" : "Weak";

// Role and strength definitions are this tool's own: plain averages of the listed
// attributes, not the game's or FMScout's weightings.
const ALL_FB = ["DL", "DR", "WBL", "WBR"], ALL_W = ["ML", "MR", "AML", "AMR"];
const ROLES = {
  ip: [
    { name: "Goalkeeper", pos: ["GK"], attrs: ["handling", "reflexes", "one_on_ones", "aerial_reach", "command_of_area", "positioning", "concentration"] },
    { name: "Ball-Playing Goalkeeper", pos: ["GK"], attrs: ["kicking", "passing", "first_touch", "composure", "vision", "throwing", "decisions"] },
    { name: "Centre-Back", pos: ["DC"], attrs: ["heading", "marking", "tackling", "positioning", "jumping_reach", "strength", "concentration"] },
    { name: "Ball-Playing Centre-Back", pos: ["DC"], attrs: ["passing", "first_touch", "composure", "vision", "technique", "positioning", "tackling", "decisions"] },
    { name: "Wide Centre-Back", pos: ["DC"], attrs: ["pace", "stamina", "crossing", "dribbling", "tackling", "positioning", "work_rate"] },
    { name: "Full-Back", pos: ALL_FB, attrs: ["tackling", "marking", "positioning", "stamina", "pace", "crossing", "teamwork"] },
    { name: "Wing-Back", pos: ALL_FB, attrs: ["crossing", "dribbling", "stamina", "pace", "acceleration", "work_rate", "off_the_ball"] },
    { name: "Inverted Full-Back", pos: ALL_FB, attrs: ["passing", "first_touch", "decisions", "composure", "positioning", "tackling", "technique"] },
    { name: "Playmaking Wing-Back", pos: ALL_FB, attrs: ["passing", "vision", "technique", "crossing", "decisions", "first_touch", "stamina"] },
    { name: "Defensive Midfielder", pos: ["DM"], attrs: ["tackling", "positioning", "anticipation", "concentration", "work_rate", "stamina", "passing"] },
    { name: "Deep-Lying Playmaker", pos: ["DM", "MC"], attrs: ["passing", "vision", "first_touch", "composure", "decisions", "technique", "teamwork"] },
    { name: "Half-Back", pos: ["DM"], attrs: ["positioning", "marking", "tackling", "heading", "concentration", "composure", "passing"] },
    { name: "Central Midfielder", pos: ["MC"], attrs: ["passing", "first_touch", "decisions", "teamwork", "work_rate", "stamina", "tackling"] },
    { name: "Midfield Playmaker", pos: ["MC"], attrs: ["passing", "decisions", "vision", "stamina", "work_rate", "composure", "anticipation", "technique"] },
    { name: "Advanced Playmaker", pos: ["MC", "AMC"], attrs: ["passing", "vision", "technique", "first_touch", "flair", "off_the_ball", "composure"] },
    { name: "Channel Midfielder", pos: ["MC"], attrs: ["off_the_ball", "stamina", "work_rate", "passing", "dribbling", "acceleration", "first_touch"] },
    { name: "Box-to-Box Midfielder", pos: ["MC"], attrs: ["stamina", "work_rate", "tackling", "passing", "off_the_ball", "long_shots", "strength"] },
    { name: "Winger", pos: ALL_W, attrs: ["crossing", "dribbling", "pace", "acceleration", "technique", "off_the_ball", "agility"] },
    { name: "Inside Forward", pos: ALL_W, attrs: ["dribbling", "finishing", "off_the_ball", "acceleration", "technique", "composure", "first_touch"] },
    { name: "Wide Playmaker", pos: ALL_W, attrs: ["passing", "vision", "technique", "first_touch", "decisions", "composure", "dribbling"] },
    { name: "Attacking Midfielder", pos: ["AMC"], attrs: ["off_the_ball", "passing", "technique", "first_touch", "long_shots", "anticipation", "decisions"] },
    { name: "Second Striker", pos: ["AMC"], attrs: ["finishing", "off_the_ball", "anticipation", "composure", "acceleration", "dribbling", "first_touch"] },
    { name: "Centre Forward", pos: ["STC"], attrs: ["finishing", "off_the_ball", "composure", "first_touch", "heading", "strength", "pace"] },
    { name: "Poacher", pos: ["STC"], attrs: ["finishing", "off_the_ball", "anticipation", "composure", "acceleration"] },
    { name: "Target Forward", pos: ["STC"], attrs: ["heading", "jumping_reach", "strength", "bravery", "finishing", "first_touch", "balance"] },
    { name: "Deep-Lying Forward", pos: ["STC"], attrs: ["first_touch", "passing", "technique", "composure", "vision", "off_the_ball", "finishing"] },
    { name: "Channel Forward", pos: ["STC"], attrs: ["pace", "acceleration", "off_the_ball", "work_rate", "dribbling", "finishing", "stamina"] },
  ],
  oop: [
    { name: "Line-Holding Keeper", pos: ["GK"], attrs: ["positioning", "reflexes", "handling", "concentration", "aerial_reach", "command_of_area"] },
    { name: "Sweeper Keeper", pos: ["GK"], attrs: ["rushing_out", "anticipation", "acceleration", "one_on_ones", "decisions", "composure"] },
    { name: "Centre-Back", pos: ["DC"], attrs: ["marking", "tackling", "heading", "positioning", "strength", "jumping_reach"] },
    { name: "Stopping Centre-Back", pos: ["DC"], attrs: ["aggression", "bravery", "tackling", "anticipation", "decisions", "pace"] },
    { name: "Covering Centre-Back", pos: ["DC"], attrs: ["pace", "acceleration", "anticipation", "positioning", "concentration", "decisions"] },
    { name: "Full-Back", pos: ALL_FB, attrs: ["marking", "tackling", "positioning", "concentration", "pace", "anticipation"] },
    { name: "Pressing Full-Back", pos: ALL_FB, attrs: ["aggression", "work_rate", "stamina", "tackling", "acceleration", "anticipation"] },
    { name: "Holding Full-Back", pos: ALL_FB, attrs: ["positioning", "concentration", "marking", "decisions", "strength", "heading"] },
    { name: "Screening Defensive Midfielder", pos: ["DM"], attrs: ["positioning", "anticipation", "concentration", "tackling", "marking", "decisions"] },
    { name: "Pressing Defensive Midfielder", pos: ["DM"], attrs: ["work_rate", "stamina", "aggression", "tackling", "acceleration", "anticipation"] },
    { name: "Dropping Defensive Midfielder", pos: ["DM"], attrs: ["positioning", "heading", "strength", "marking", "concentration", "bravery"] },
    { name: "Central Midfielder", pos: ["MC"], attrs: ["tackling", "positioning", "work_rate", "stamina", "teamwork", "anticipation"] },
    { name: "Pressing Central Midfielder", pos: ["MC"], attrs: ["work_rate", "stamina", "aggression", "acceleration", "tackling", "anticipation"] },
    { name: "Screening Central Midfielder", pos: ["MC"], attrs: ["positioning", "concentration", "anticipation", "decisions", "tackling", "marking"] },
    { name: "Tracking Winger", pos: ALL_W, attrs: ["work_rate", "stamina", "teamwork", "tackling", "positioning", "acceleration"] },
    { name: "Wide Outlet", pos: ALL_W, attrs: ["pace", "acceleration", "off_the_ball", "anticipation", "balance", "dribbling"] },
    { name: "Pressing Winger", pos: ALL_W, attrs: ["work_rate", "aggression", "acceleration", "stamina", "anticipation", "bravery"] },
    { name: "Attacking Midfielder", pos: ["AMC"], attrs: ["work_rate", "positioning", "anticipation", "teamwork", "stamina", "decisions"] },
    { name: "Tracking Attacking Midfielder", pos: ["AMC"], attrs: ["work_rate", "stamina", "tackling", "teamwork", "positioning", "anticipation"] },
    { name: "Central Outlet Attacking Midfielder", pos: ["AMC"], attrs: ["off_the_ball", "anticipation", "acceleration", "composure", "first_touch", "pace"] },
    { name: "Centre Forward", pos: ["STC"], attrs: ["work_rate", "anticipation", "teamwork", "positioning", "stamina", "decisions"] },
    { name: "Pressing Centre Forward", pos: ["STC"], attrs: ["work_rate", "stamina", "aggression", "teamwork", "acceleration", "bravery"] },
    { name: "Central Outlet Centre Forward", pos: ["STC"], attrs: ["pace", "acceleration", "off_the_ball", "anticipation", "strength", "balance"] },
  ],
};
// "p:" reads a personality value; "weak_foot" is the weaker of the two feet.
const STRENGTHS = [
  ["Clinical", ["finishing", "composure"], "out"], ["Penalty Taker", ["penalty_taking"], "out"],
  ["Set-Piece Specialist", ["free_kick_taking", "corners"], "out"], ["Long Shot Threat", ["long_shots", "technique"], "out"],
  ["Range Passer", ["passing", "vision", "technique"], "out"], ["Through Ball Threat", ["vision", "passing", "decisions"], "out"],
  ["Creative", ["flair", "vision"], "out"], ["Dribbler", ["dribbling", "agility", "balance"], "out"],
  ["Carries Well", ["dribbling", "acceleration", "technique"], "out"], ["Hard to Dispossess", ["balance", "strength", "first_touch"], "out"],
  ["Press Resistant", ["composure", "first_touch", "balance"], "out"], ["Technically Refined", ["technique", "first_touch"], "out"],
  ["Two-Footed", ["weak_foot"], "out"], ["Rapid", ["pace", "acceleration"], "out"], ["Powerful", ["strength", "jumping_reach"], "out"],
  ["Aerial Threat", ["heading", "jumping_reach"], "out"], ["Tireless", ["stamina", "work_rate", "natural_fitness"], "all"],
  ["Ball Winner", ["tackling", "anticipation", "aggression"], "out"], ["High Press", ["work_rate", "aggression", "acceleration", "stamina"], "out"],
  ["Reads the Game", ["anticipation", "positioning", "decisions"], "all"], ["Team Player", ["teamwork", "work_rate"], "all"],
  ["Shot Stopper", ["reflexes", "handling", "one_on_ones"], "gk"], ["Commands Area", ["command_of_area", "aerial_reach", "communication"], "gk"],
  ["Good Distribution", ["kicking", "throwing", "passing"], "gk"], ["Sweeper", ["rushing_out", "acceleration", "anticipation"], "gk"],
  ["Pressure Proof", ["composure", "p:pressure", "important_matches"], "all"], ["Leader", ["leadership", "determination"], "all"],
  ["Mentality", ["determination", "bravery", "concentration"], "all"], ["Big Game Player", ["important_matches"], "all"],
  ["Consistent", ["consistency"], "all"], ["Model Professional", ["p:professionalism"], "all"], ["Ambitious", ["p:ambition"], "all"],
  ["Versatile", ["versatility"], "all"],
];
const WEAKNESSES = [
  ["Slow", p => (val(p, "pace") + val(p, "acceleration")) / 2 <= 8, "out"],
  ["Weak in the Air", p => (val(p, "heading") + val(p, "jumping_reach")) / 2 <= 7, "out"],
  ["Poor Stamina", p => val(p, "stamina") <= 8, "all"],
  ["Lightweight", p => val(p, "strength") <= 7, "out"],
  ["One-Footed", p => val(p, "weak_foot") <= 6, "out"],
  ["Inconsistent", p => val(p, "consistency") <= 7, "all"],
  ["Injury Prone", p => val(p, "injury_proneness") >= 15, "all"],
  ["Ill-Disciplined", p => val(p, "dirtiness") >= 16, "all"],
  ["Struggles in Big Games", p => val(p, "important_matches") <= 6, "all"],
  ["Poor Decision Maker", p => val(p, "decisions") <= 7, "all"],
  ["Unprofessional", p => val(p, "p:professionalism") <= 6, "all"],
];
const RADAR_ORDER = [["Attacking", "ATK"], ["Control", "CTR"], ["Physicality", "PHY"], ["Defending", "DEF"], ["Mental", "MEN"], ["Playmaking", "PLY"]];
const SVGNS = "http://www.w3.org/2000/svg";

function svg(tag, attrs, ...children) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
  for (const c of children.flat()) if (c !== null && c !== undefined) node.append(c);
  return node;
}
function val(p, key) {
  if (key === "weak_foot") return Math.min(p.left_foot ?? 0, p.right_foot ?? 0);
  if (key.startsWith("p:")) return p.personality[state.data.personality.indexOf(key.slice(2))] ?? 0;
  return attr(p, key) ?? 0;
}
const mean = (p, keys) => keys.reduce((sum, k) => sum + val(p, k), 0) / keys.length;
const composites = p => Object.fromEntries(Object.entries(COMPOSITES).map(([name, keys]) => [name, mean(p, keys)]));
const isKeeper = p => p.natural_positions.includes("GK");
const scope = p => kind => kind === "all" || kind === (isKeeper(p) ? "gk" : "out");
const ratingWord = v => v >= 16 ? ["Excellent", "r-top"] : v >= 13 ? ["Good", "r-good"] : v >= 10 ? ["Decent", "r-mid"] : ["Poor", "r-low"];

// Comparison lines for the radar: players of the same gender and natural position who have a club.
function references(p) {
  const pos = p.natural_positions[0];
  const key = p.gender + "|" + pos;
  if (!state.refCache[key]) {
    const pool = state.players.filter(q => q.club && q.gender === p.gender && q.natural_positions.includes(pos));
    const elite = [...pool].sort((a, b) => (b.ca || 0) - (a.ca || 0)).slice(0, 30);
    const average = list => Object.fromEntries(Object.keys(COMPOSITES).map(name =>
      [name, list.length ? list.reduce((sum, q) => sum + mean(q, COMPOSITES[name]), 0) / list.length : 0]));
    state.refCache[key] = { average: average(pool), elite: average(elite), count: pool.length, pos };
  }
  return state.refCache[key];
}

function radar(player, ref) {
  const size = 320, c = size / 2, radius = 108;
  const point = (i, v) => {
    const angle = (-90 + 60 * i) * Math.PI / 180, r = radius * Math.max(0, Math.min(20, v)) / 20;
    return [c + r * Math.cos(angle), c + r * Math.sin(angle)];
  };
  const shape = scores => RADAR_ORDER.map(([name], i) => point(i, scores[name]).map(n => n.toFixed(1)).join(",")).join(" ");
  const ring = v => svg("polygon", { points: shape(Object.fromEntries(RADAR_ORDER.map(([n]) => [n, v]))), class: "rg" });
  const top = Object.entries(player).sort((a, b) => b[1] - a[1])[0][0];
  return svg("svg", { viewBox: `0 0 ${size} ${size}`, class: "radar", role: "img",
      "aria-label": "Radar chart of the six composite scores against the position average and the top players" },
    [5, 10, 15, 20].map(ring),
    RADAR_ORDER.map((_, i) => { const [x, y] = point(i, 20); return svg("line", { x1: c, y1: c, x2: x, y2: y, class: "rg" }); }),
    svg("polygon", { points: shape(ref.elite), class: "r-elite" }),
    svg("polygon", { points: shape(ref.average), class: "r-avg" }),
    svg("polygon", { points: shape(player), class: "r-player" }),
    RADAR_ORDER.map(([name], i) => { const [x, y] = point(i, player[name]); return svg("circle", { cx: x, cy: y, r: 4, class: "r-dot" }); }),
    RADAR_ORDER.map(([name, short], i) => {
      const [x, y] = point(i, 24.5);
      return svg("text", { x, y: y + 4, "text-anchor": "middle", class: "r-label" + (name === top ? " top" : "") }, short);
    }));
}

function roleScores(p, phase) {
  const playable = p.natural_positions.concat(p.accomplished_positions);
  return ROLES[phase].filter(role => role.pos.some(x => playable.includes(x)))
    .map(role => ({ ...role, score: Math.round(mean(p, role.attrs) * 5) }))
    .sort((a, b) => b.score - a.score).slice(0, 5);
}

function strengthTags(p) {
  const applies = scope(p);
  const tiers = { Gold: [], Silver: [], Bronze: [] };
  for (const [name, keys, kind] of STRENGTHS) {
    if (!applies(kind)) continue;
    const score = mean(p, keys);
    const tier = score >= 17.5 ? "Gold" : score >= 15.5 ? "Silver" : score >= 13.5 ? "Bronze" : null;
    if (tier) tiers[tier].push(name);
  }
  return { tiers, weaknesses: WEAKNESSES.filter(([, test, kind]) => applies(kind) && test(p)).map(([name]) => name) };
}

// Closest players of the same gender sharing a natural position, by root-mean-square
// difference across the technical (or goalkeeping), mental and physical attributes.
function similarPlayers(p, count, anyGender) {
  const keys = (isKeeper(p) ? GROUPS.Goalkeeping : GROUPS.Technical).concat(GROUPS.Mental, GROUPS.Physical).map(k => state.attrIndex[k]);
  const scored = [];
  for (const q of state.players) {
    if (q === p || (!anyGender && p.gender && q.gender !== p.gender)) continue;
    if (!q.natural_positions.some(x => p.natural_positions.includes(x))) continue;
    let sum = 0;
    for (const i of keys) { const d = (p.attributes[i] || 0) - (q.attributes[i] || 0); sum += d * d; }
    scored.push([Math.sqrt(sum / keys.length), q]);
  }
  scored.sort((a, b) => a[0] - b[0]);
  return scored.slice(0, count).map(([distance, player]) => ({ player, similarity: Math.max(0, Math.round(100 - distance * 12)) }));
}

const SIMILAR_LIMIT = 100;
function showSimilar(p) {
  state.similarTo = p;
  if (p.gender) $("fGender").value = p.gender;
  state.sort = { key: "match", dir: -1 };
  clearQuick();
  apply();
  $("tablewrap").scrollTop = 0;
}
function clearSimilar() {
  state.similarTo = null;
  if (state.sort.key === "match") state.sort = { key: "ca", dir: -1 };
  apply();
}

function shortlistButton(p) {
  const button = el("button", { class: "btn", type: "button" });
  const paint = () => {
    const on = state.shortlist.has(p.uid);
    button.textContent = on ? "★ Shortlisted" : "☆ Add to shortlist";
    button.classList.toggle("primary", on);
    button.setAttribute("aria-pressed", String(on));
  };
  button.addEventListener("click", async () => { await toggleShortlist(p); paint(); });
  paint();
  return button;
}
// The shortlist lives in this browser's storage; export and import move it between browsers.
const SHORTLIST_KEY = "fmscout.shortlist";
const validUids = list => Array.isArray(list) && list.every(u => Number.isInteger(u) && u >= 0);
function loadShortlist() {
  try {
    const uids = JSON.parse(localStorage.getItem(SHORTLIST_KEY) || "[]");
    return new Set(validUids(uids) ? uids : []);
  } catch {
    return new Set();   // storage blocked or corrupt: start empty rather than fail to load the page
  }
}
function saveShortlist() {
  localStorage.setItem(SHORTLIST_KEY, JSON.stringify([...state.shortlist]));
}
async function toggleShortlist(p) {
  const before = new Set(state.shortlist);
  state.shortlist.has(p.uid) ? state.shortlist.delete(p.uid) : state.shortlist.add(p.uid);
  try {
    saveShortlist();
  } catch (err) {
    state.shortlist = before;
    alert("Could not save the shortlist in this browser: " + err.message);
  }
  paintShortlistCount();
  $("fShort").checked ? apply() : render();
}
function exportShortlist() {
  const blob = new Blob([JSON.stringify({ uids: [...state.shortlist] })], { type: "application/json" });
  const link = el("a", { href: URL.createObjectURL(blob), download: "fm-scout-shortlist.json" });
  link.click();
  URL.revokeObjectURL(link.href);
}
async function importShortlist(file) {
  if (!file) return;
  try {
    const uids = JSON.parse(await file.text()).uids;
    if (!validUids(uids)) throw new Error("it is not a shortlist exported from FM Scout");
    const before = new Set(state.shortlist);
    for (const uid of uids) state.shortlist.add(uid);
    try { saveShortlist(); } catch (err) { state.shortlist = before; throw err; }
  } catch (err) {
    alert(`Could not import ${file.name}: ${err.message}`);
  }
  paintShortlistCount();
  if (state.data) apply();
}
function paintShortlistCount() {
  $("shortCount").textContent = `Shortlist (${state.shortlist.size})`;
}

const panel = (heading, ...content) => el("div", { class: "section" }, el("h3", {}, heading), ...content);
const meter = (value, max, cls) => el("div", { class: "bar " + (cls || "") }, el("i", { style: `width:${Math.max(0, Math.min(100, value / max * 100))}%` }));

function openProfile(p) {
  const keeper = isKeeper(p);
  const foot = p.right_foot >= 18 && p.left_foot >= 18 ? "Either foot" : p.right_foot >= p.left_foot ? "Right foot" : "Left foot";
  const facts = [genderLabel(p), foot, p.height_cm ? p.height_cm + " cm" : null, `${p.age} years (${p.birth_date})`,
    p.club || "Free agent", [p.nation].concat(p.second_nations).filter(Boolean).join(" / ")].filter(Boolean).join(" · ");
  const hero = el("div", { class: "hero" },
    el("div", {},
      el("h2", {}, p.name),
      el("div", { class: "facts" }, facts),
      p.on_loan && p.loan_from ? el("div", { class: "sub" }, "On loan from " + p.loan_from) : null,
      el("div", { class: "pos" },
        p.natural_positions.map(x => el("span", { class: "tag natural", title: "Natural" }, x)),
        p.accomplished_positions.map(x => el("span", { class: "tag accomplished", title: "Accomplished" }, x))),
      el("div", { class: "heroactions" }, shortlistButton(p),
        el("button", { class: "btn", type: "button", onclick: () => { $("profile").close(); showSimilar(p); } }, "Find similar players"))),
    el("div", { class: "kpis" },
      kpi("Current ability", stars(p.ca), " ", p.ca ?? "–"),
      kpi("Potential", stars(p.pa), " ", p.pa ?? "–"),
      kpi("Value", money(p.value)),
      kpi("Wage p/w", money(p.wage)),
      kpi("Contract ends", p.contract_end || "–"),
      kpi("Squad status", p.squad_status && p.squad_status !== "unknown" ? title(p.squad_status) : "–")));

  // Skill profile: composite scores, radar, and the key attributes of the best in-possession role.
  const scores = composites(p), ref = references(p);
  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const best = ordered[0][0], worst = ordered[ordered.length - 1][0];
  const scoreList = el("div", { class: "scores" }, Object.entries(scores).map(([name, v]) =>
    el("div", { class: "score" + (name === best ? " top" : name === worst ? " low" : "") },
      el("span", { class: "k" }, name), name === best ? el("span", { class: "topmark" }, "TOP") : null,
      el("span", { class: "v" }, Math.round(v)))));
  const legend = el("div", { class: "legend" },
    el("span", { class: "lg player" }, p.name),
    el("span", { class: "lg avg" }, `${ref.pos} average (${ref.count.toLocaleString()} players)`),
    el("span", { class: "lg elite" }, `Top 30 ${ref.pos}`));
  const ip = roleScores(p, "ip"), oop = roleScores(p, "oop");
  const keyRole = ip[0];
  const keyPanel = keyRole ? el("div", {},
    el("h4", { class: "bestrole" }, "Best in-possession role: ", el("strong", {}, keyRole.name)),
    keyRole.attrs.map(k => {
      const v = val(p, k), [word, cls] = ratingWord(v);
      return el("div", { class: "keyrow" }, el("span", {}, title(k)), meter(v, 20, cls), el("span", { class: "word " + cls }, `${word} · ${v}`));
    })) : el("div", { class: "sub" }, "No role data for this position.");
  const skill = panel("Skill profile",
    el("div", { class: "skill" },
      el("div", {}, el("h4", {}, "Composite scores (1–20)"), el("div", { class: "skillchart" }, scoreList, el("div", {}, radar(scores, ref), legend))),
      el("div", {}, el("h4", {}, "Key attributes for role"), keyPanel)));

  const roleList = (heading, roles) => el("div", {}, el("h4", {}, heading),
    roles.length ? roles.map((role, i) => el("div", { class: "rolerow" + (i === 0 ? " best" : "") },
      el("span", {}, role.name), meter(role.score, 100, i === 0 ? "r-top" : "r-soft"), el("span", { class: "n" }, role.score)))
      : el("div", { class: "sub" }, "None for this position."));
  const roles = panel("Role suitability",
    el("div", { class: "two" }, roleList("In possession", ip), roleList("Out of possession", oop)),
    el("div", { class: "foot" }, "Top 5 roles per phase among positions the player can play. Score is the average of the role's key attributes, scaled to 100."));

  const tags = strengthTags(p);
  const tier = name => tags.tiers[name].length ? el("div", { class: "tier" }, el("h4", {}, name),
    el("div", { class: "chips" }, tags.tiers[name].map(t => el("span", { class: "medal " + name.toLowerCase() }, t)))) : null;
  const strengths = panel("Strengths and weaknesses",
    tier("Gold"), tier("Silver"), tier("Bronze"),
    Object.values(tags.tiers).every(list => !list.length) ? el("div", { class: "sub" }, "No standout strengths identified.") : null,
    el("div", { class: "weak" }, el("strong", {}, "Weaknesses"),
      tags.weaknesses.length ? el("span", { class: "chips" }, tags.weaknesses.map(t => el("span", { class: "medal weakness" }, t)))
        : el("span", { class: "sub" }, "No notable weaknesses identified.")));

  const group = name => el("div", {}, el("h4", {}, name),
    GROUPS[name].map(k => el("div", { class: "attr" }, el("span", {}, title(k)), badge(attr(p, k)))));
  const shownGroups = keeper ? ["Goalkeeping", "Mental", "Physical"] : ["Technical", "Mental", "Physical"];
  const ratings = state.data.positions.map((k, i) => [k.toUpperCase(), p.position_ratings[i]])
    .filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]);
  const list = rows => rows.map(([k, v]) => el("div", { class: "attr" }, el("span", {}, k), badge(v)));

  const profile = el("div", { class: "profile" },
    hero, skill, roles, strengths,
    panel("Attributes", el("div", { class: "attrgrid" }, shownGroups.map(group))),
    el("div", { class: "two" },
      panel("Position ratings", list(ratings)),
      panel("Feet and condition",
        list([["Right foot — " + footWord(p.right_foot), p.right_foot], ["Left foot — " + footWord(p.left_foot), p.left_foot]]),
        el("div", { class: "attr" }, el("span", {}, "Condition"), el("span", {}, p.condition != null ? Math.round(p.condition / 100) + "%" : "–")),
        el("div", { class: "attr" }, el("span", {}, "Match sharpness"), el("span", {}, p.sharpness != null ? Math.round(p.sharpness / 100) + "%" : "–")))),
    el("div", { class: "two" },
      panel("Personality", list(state.data.personality.map((k, i) => [title(k), p.personality[i]]))),
      panel("Hidden attributes", list(GROUPS.Hidden.map(k => [title(k), attr(p, k)])))));

  const dialog = $("profile");
  dialog.replaceChildren(el("div", { class: "dialogbar" },
    el("button", { class: "btn", type: "button", onclick: () => dialog.close() }, "Close")), profile);
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

function renderAttrChips() {
  $("attrFilters").replaceChildren(...state.attrFilters.map(item => el("span", { class: "chip active" },
    `${title(item.name)} ≥ ${item.min} `,
    el("button", { class: "chipx", type: "button", "aria-label": `Remove ${title(item.name)} filter`,
      onclick: () => { state.attrFilters = state.attrFilters.filter(a => a !== item); renderAttrChips(); clearQuick(); apply(); } }, "×"))));
  $("addAttr").textContent = state.attrFilters.length ? "Edit attribute filters…" : "Choose attributes…";
}

function openAttrPicker() {
  const dialog = $("attrPicker");
  const current = Object.fromEntries(state.attrFilters.map(a => [a.name, a.min]));
  const inputs = {};
  const summary = el("span", { class: "sub", "aria-live": "polite" });
  const commit = () => {
    state.attrFilters = Object.entries(inputs).map(([name, input]) => ({ name, min: Math.min(20, Math.floor(Number(input.value))) }))
      .filter(a => a.min >= 1);
    for (const [name, input] of Object.entries(inputs)) input.closest(".pick").classList.toggle("on", Number(input.value) >= 1);
    summary.textContent = state.attrFilters.length
      ? `${state.attrFilters.length} attribute filter${state.attrFilters.length > 1 ? "s" : ""} · ${countMatches().toLocaleString()} players match`
      : "No attribute filters set";
  };
  const row = name => {
    // Quick picks of 10 and 15; any other value reached with − / + is added as its own option.
    const input = el("select", { id: "pick-" + name, onchange: commit },
      el("option", { value: "" }, "–"), el("option", { value: "10" }, "10"), el("option", { value: "15" }, "15"));
    const setValue = value => {
      const text = value ? String(value) : "";
      if (text && ![...input.options].some(o => o.value === text)) {
        const before = [...input.options].find(o => o.value && Number(o.value) > value) || null;
        input.insertBefore(el("option", { value: text }, text), before);
      }
      input.value = text;
    };
    setValue(current[name]);
    inputs[name] = input;
    const step = (label, delta) => el("button", { class: "btn step", type: "button", tabindex: "-1",
      "aria-label": `${delta > 0 ? "Raise" : "Lower"} ${title(name)} minimum`,
      onclick: () => {
        const next = input.value === "" ? (delta > 0 ? 15 : 0) : Number(input.value) + delta;
        setValue(next < 1 ? 0 : Math.min(20, next));
        commit();
      } }, label);
    return el("div", { class: "pick" + (current[name] ? " on" : "") },
      el("label", { for: "pick-" + name }, title(name)), step("−", -1), input, step("+", 1));
  };
  const groups = el("div", { class: "pickgrid" }, Object.entries(GROUPS).map(([group, names]) =>
    el("section", {}, el("h4", {}, group), names.map(row))));
  const close = () => { dialog.close(); };
  dialog.replaceChildren(
    el("div", { class: "pickhead" },
      el("div", {}, el("h2", {}, "Attribute filters"),
        el("div", { class: "sub" }, "Set the minimum value (1–20) for any attribute. Pick 10 or 15, then fine-tune with − and +. Leave on – for no filter.")),
      el("div", { class: "pickactions" }, summary,
        el("button", { class: "btn", type: "button", onclick: () => { for (const i of Object.values(inputs)) i.value = ""; commit(); } }, "Clear all"),
        el("button", { class: "btn primary", type: "button", onclick: close }, "Done"))),
    groups);
  commit();
  dialog.showModal();
}
// Matches under the filters as they stand, with the picker's pending attribute minimums.
function countMatches() {
  apply();
  return state.filtered.length;
}

function buildPositionChips() {
  const order = ["GK", "DL", "DC", "DR", "WBL", "WBR", "DM", "ML", "MC", "MR", "AML", "AMC", "AMR", "STC"];
  $("posChips").replaceChildren(...order.map(pos => el("button", {
    class: "chip", type: "button", "aria-pressed": String(state.positions.has(pos)),
    onclick: e => {
      const on = !state.positions.has(pos);
      on ? state.positions.add(pos) : state.positions.delete(pos);
      e.currentTarget.setAttribute("aria-pressed", String(on));
      clearQuick();
      apply();
    },
  }, pos)));
}

function addMonths(isoDate, months) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
function buildPresets() {
  const chip = (label, title, run) => el("button", { class: "chip", type: "button", title, onclick: () => { run(); clearQuick(); apply(); } }, label);
  const age = (min, max) => () => { $("fAgeMin").value = min; $("fAgeMax").value = max; };
  $("agePresets").replaceChildren(
    chip("Youngster", "Age 18 or under", age("", 18)), chip("Under 21", "Age 20 or under", age("", 20)),
    chip("18–24", "Age 18 to 24", age(18, 24)), chip("Any age", "Clear the age range", age("", "")));
  const contract = months => () => { if (state.data) $("fContract").value = months ? addMonths(state.data.game_date, months) : ""; };
  $("contractPresets").replaceChildren(
    chip("6 months", "Contract ends within 6 months of the in-game date", contract(6)),
    chip("1 year", "Contract ends within 1 year of the in-game date", contract(12)),
    chip("Any", "Clear the contract date", contract(0)));
}
function clearQuick() {
  for (const b of document.querySelectorAll("#quick .chip")) b.setAttribute("aria-pressed", "false");
}
function runQuick(item, button) {
  const gender = $("fGender").value, keyAttrs = $("fKeyAttrs").checked;
  $("filters").reset();
  $("fGender").value = gender; $("fKeyAttrs").checked = keyAttrs;
  state.attrFilters = []; renderAttrChips();
  state.positions = new Set(item.set.positions || []);
  buildPositionChips();
  for (const [id, value] of Object.entries(item.set)) {
    if (id === "positions") continue;
    if (id === "contractMonths") $("fContract").value = addMonths(state.data.game_date, value);
    else if (typeof value === "boolean") $(id).checked = value;
    else $(id).value = value;
  }
  state.similarTo = null;
  state.sort = { key: item.sort || "ca", dir: -1 };
  clearQuick();
  button.setAttribute("aria-pressed", "true");
  apply();
}
function buildQuick() {
  const mine = el("div", { class: "grp" }, el("span", {}, "Mine"),
    el("button", { class: "chip", type: "button", "aria-pressed": "false", id: "shortCount", title: "Players you have shortlisted",
      onclick: e => { if (state.data) runQuick({ set: { fShort: true } }, e.currentTarget); } }, "Shortlist (0)"));
  $("quick").replaceChildren(mine, ...QUICK.map(g => el("div", { class: "grp" }, el("span", {}, g.group),
    g.items.map(item => el("button", { class: "chip", type: "button", "aria-pressed": "false", title: item.title || null,
      onclick: e => { if (state.data) runQuick(item, e.currentTarget); } }, item.label)))));
}

function resetFilters() {
  $("filters").reset();
  state.positions.clear();
  state.attrFilters = [];
  state.similarTo = null;
  if (state.sort.key === "match") state.sort = { key: "ca", dir: -1 };
  renderAttrChips();
  buildPositionChips();
  clearQuick();
  apply();
}

async function start() {
  buildPositionChips();
  buildPresets();
  buildQuick();
  let timer;
  $("filters").addEventListener("input", () => { clearQuick(); clearTimeout(timer); timer = setTimeout(apply, 120); });
  $("filters").addEventListener("submit", e => e.preventDefault());
  $("addAttr").addEventListener("click", () => { if (state.data) openAttrPicker(); });
  $("attrPicker").addEventListener("close", () => { renderAttrChips(); clearQuick(); apply(); });
  $("attrPicker").addEventListener("click", e => { if (e.target === $("attrPicker")) $("attrPicker").close(); });
  $("resetBtn").addEventListener("click", resetFilters);
  $("profile").addEventListener("click", e => { if (e.target === $("profile")) $("profile").close(); });

  $("saveSelect").addEventListener("change", loadSelected);
  $("reload").addEventListener("click", () => {
    if (source.dir) refreshFolder({ latest: true });
    else $("fileInput").click();
  });
  $("changeSource").addEventListener("click", () => showWelcome());
  $("fileInput").addEventListener("change", e => { const file = e.target.files[0]; e.target.value = ""; useFile(file); });
  $("exportShort").addEventListener("click", exportShortlist);
  $("importShort").addEventListener("click", () => $("shortInput").click());
  $("shortInput").addEventListener("change", e => { const file = e.target.files[0]; e.target.value = ""; importShortlist(file); });
  // Dropping a save anywhere on the page loads it; without this the browser would navigate to the file.
  document.addEventListener("dragover", e => e.preventDefault());
  document.addEventListener("drop", e => { e.preventDefault(); useFile(e.dataTransfer?.files?.[0]); });

  state.shortlist = loadShortlist();
  paintShortlistCount();
  startWorker();

  const remembered = canPickFolder ? await recallDir() : null;
  if (!remembered) { showWelcome(); return; }
  let permission = "prompt";
  try { permission = await remembered.queryPermission({ mode: "read" }); } catch { /* treat as needing a prompt */ }
  if (permission === "granted") {
    source.dir = remembered;
    await refreshFolder({ latest: true });
  } else {
    // Asking for access again needs a click, so offer a button rather than prompting unasked.
    showWelcome(null, remembered);
  }
}
start();
