import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const GEN_FALLBACK = ["Image", "Audio", "Video", "3D", "Other"];

const CSS = `
.ckd-overlay {
  position: fixed; inset: 0; z-index: 2000;
  display: flex; flex-direction: column;
  background-color: #141414;
  background-image: radial-gradient(circle, #2b2b2b 1px, transparent 1px);
  background-size: 25px 25px;
  color: #e6e6e6;
  font-family: inherit;
  animation: ckd-fade .12s ease-out;
}
@keyframes ckd-fade { from { opacity: 0 } to { opacity: 1 } }

.ckd-topbar {
  display: flex; align-items: center; gap: 16px;
  padding: 18px 28px 10px 28px;
}
.ckd-title { display: flex; align-items: baseline; gap: 10px; }
.ckd-title h2 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: .02em; }
.ckd-title span { font-size: 12px; color: #8a8a8a; }
.ckd-spacer { flex: 1; }

.ckd-btn {
  background: #1e1e1e; border: 1px solid #3a3a3a; border-radius: 10px;
  color: #d8d8d8; padding: 8px 14px; font-size: 12px; cursor: pointer;
  transition: border-color .12s, background .12s, color .12s;
  white-space: nowrap;
}
.ckd-btn:hover { border-color: #5a5a5a; background: #262626; }
.ckd-btn.ckd-on { border-color: #f5c451; color: #f5c451; }
.ckd-btn.ckd-close { font-size: 15px; line-height: 1; padding: 8px 12px; }

.ckd-filters {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 4px 28px 14px 28px;
}
.ckd-search {
  background: #1e1e1e; border: 1px solid #3a3a3a; border-radius: 10px;
  color: #e6e6e6; padding: 9px 14px; font-size: 13px; min-width: 260px;
  outline: none;
}
.ckd-search:focus { border-color: #5a5a5a; }
.ckd-search::placeholder { color: #6e6e6e; }

.ckd-drop { position: relative; }
.ckd-menu {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 10;
  background: #1c1c1c; border: 1px solid #3a3a3a; border-radius: 10px;
  padding: 6px; min-width: 190px; max-height: 320px; overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0,0,0,.55);
}
.ckd-menu label {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 10px; border-radius: 7px; font-size: 12.5px; cursor: pointer;
}
.ckd-menu label:hover { background: #272727; }
.ckd-menu input { accent-color: #f5c451; }
.ckd-count { font-size: 12px; color: #8a8a8a; margin-left: 2px; }

.ckd-scroll { flex: 1; overflow: auto; padding: 0 28px 32px 28px; }
.ckd-grid { width: max-content; min-width: 100%; }

.ckd-grid { display: grid; gap: 10px; align-items: stretch; }
.ckd-head {
  position: sticky; top: 0; z-index: 5;
  padding-bottom: 10px;
  background: linear-gradient(#141414 65%, rgba(20,20,20,0));
}
.ckd-head .ckd-cell {
  display: flex; align-items: center; gap: 6px;
  background: #1c1c1c; border: 1px solid #333; border-radius: 10px;
  padding: 14px 16px; font-size: 11.5px; letter-spacing: .09em;
  text-transform: uppercase; color: #cfcfcf; cursor: pointer; user-select: none;
  min-height: 50px;
}
.ckd-head .ckd-cell:hover { border-color: #4d4d4d; }
.ckd-head .ckd-cell.ckd-star-col { justify-content: center; padding: 14px 0; }
.ckd-sort { color: #f5c451; font-size: 10px; }

.ckd-row { display: contents; }
.ckd-row > .ckd-cell {
  background: #1a1a1a; border: 1px solid #2e2e2e; border-radius: 10px;
  padding: 10px 14px; font-size: 13px; display: flex; align-items: center;
  min-height: var(--ckd-row-h, 74px); cursor: pointer;
  transition: border-color .12s, background .12s;
}
.ckd-row:hover > .ckd-cell { border-color: #4a4a4a; background: #1f1f1f; }
.ckd-row.ckd-fav > .ckd-cell { border-color: #3d3625; }
.ckd-row.ckd-fav:hover > .ckd-cell { border-color: #5c4f2c; }

.ckd-cell.ckd-star-col { justify-content: center; padding: 10px 0; }
.ckd-star {
  background: none; border: none; cursor: pointer; font-size: 17px;
  line-height: 1; color: #4a4a4a; padding: 4px;
}
.ckd-star.ckd-on { color: #f5c451; }

.ckd-thumb-cell { padding: 8px !important; position: relative; }
.ckd-thumb {
  width: 100%; height: var(--ckd-thumb-h, 58px); border-radius: 7px; overflow: hidden;
  background: #232323; display: flex; align-items: center; justify-content: center;
  color: #555; font-size: 10.5px; letter-spacing: .06em; position: relative;
}
.ckd-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ckd-thumb-actions {
  position: absolute; top: 3px; right: 3px; display: none; gap: 3px;
}
.ckd-thumb-cell:hover .ckd-thumb-actions { display: flex; }
.ckd-mini {
  background: rgba(15,15,15,.85); border: 1px solid #4a4a4a; border-radius: 5px;
  color: #ddd; font-size: 10px; line-height: 1; padding: 4px 5px; cursor: pointer;
}
.ckd-mini:hover { border-color: #f5c451; color: #f5c451; }
.ckd-thumb-cell.ckd-dragover .ckd-thumb { outline: 1.5px dashed #f5c451; outline-offset: -3px; }

.ckd-name { display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
.ckd-name b { font-weight: 550; font-size: 13.5px; }
.ckd-name small { color: #7d7d7d; font-size: 11px; }

.ckd-edit {
  outline: none; border-radius: 5px; padding: 3px 5px; margin: -3px -5px;
  min-width: 12px; cursor: text; white-space: pre-wrap; word-break: break-word;
}
.ckd-edit:hover { background: #262626; }
.ckd-edit:focus { background: #101010; box-shadow: 0 0 0 1px #f5c451; cursor: text; }
.ckd-edit:empty::before { content: attr(data-placeholder); color: #5c5c5c; }

.ckd-select {
  background: #232323; border: 1px solid #3a3a3a; border-radius: 7px;
  color: #e0e0e0; padding: 5px 8px; font-size: 12.5px; cursor: pointer; outline: none;
  max-width: 100%;
}
.ckd-select:focus { border-color: #f5c451; }
.ckd-muted { color: #7d7d7d; font-size: 12px; }

.ckd-empty { padding: 60px 0; text-align: center; color: #7d7d7d; font-size: 13px; }
.ckd-toast {
  position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%);
  background: #1c1c1c; border: 1px solid #3a3a3a; border-radius: 10px;
  padding: 10px 18px; font-size: 12.5px; color: #e0e0e0; z-index: 2100;
  box-shadow: 0 10px 30px rgba(0,0,0,.5);
}
.ckd-toast.ckd-err { border-color: #7a3b3b; color: #ffb4b4; }

.ckd-comment-cell { position: relative; }
.ckd-actions {
  position: absolute; top: 6px; right: 6px; display: none; gap: 4px;
  background: #1a1a1a; border-radius: 7px; padding: 2px;
}
.ckd-row:hover .ckd-actions, .ckd-comment-cell:hover .ckd-actions { display: flex; }
.ckd-act {
  background: #232323; border: 1px solid #3f3f3f; border-radius: 6px;
  color: #cfcfcf; font-size: 11px; line-height: 1; padding: 5px 7px; cursor: pointer;
}
.ckd-act:hover { border-color: #f5c451; color: #f5c451; }
.ckd-act.ckd-danger:hover { border-color: #b45252; color: #ff9b9b; }

.ckd-confirm-back {
  position: fixed; inset: 0; z-index: 2050; background: rgba(0,0,0,.55);
  display: flex; align-items: center; justify-content: center;
}
.ckd-confirm {
  background: #1c1c1c; border: 1px solid #3a3a3a; border-radius: 12px;
  padding: 22px 24px; max-width: 420px; color: #e6e6e6;
  box-shadow: 0 20px 50px rgba(0,0,0,.6);
}
.ckd-confirm h3 { margin: 0 0 8px; font-size: 15px; font-weight: 550; }
.ckd-confirm p { margin: 0 0 18px; font-size: 12.5px; color: #9a9a9a; line-height: 1.6; }
.ckd-confirm-row { display: flex; gap: 8px; justify-content: flex-end; }

.ckd-head .ckd-cell { position: relative; }
.ckd-resizer {
  position: absolute; top: 6px; right: -6px; bottom: 6px; width: 11px;
  cursor: col-resize; z-index: 6;
}
.ckd-resizer::after {
  content: ""; position: absolute; top: 0; bottom: 0; left: 5px; width: 1px;
  background: transparent; transition: background .12s;
}
.ckd-resizer:hover::after, .ckd-resizing .ckd-resizer::after { background: #f5c451; }
.ckd-resizing, .ckd-resizing * { cursor: col-resize !important; user-select: none; }
.ckd-rowsizing, .ckd-rowsizing * { cursor: row-resize !important; user-select: none; }

.ckd-row-resizer {
  position: absolute; left: 4px; right: 4px; bottom: -6px; height: 11px;
  cursor: row-resize; z-index: 4;
}
.ckd-row-resizer::after {
  content: ""; position: absolute; left: 0; right: 0; top: 5px; height: 1px;
  background: transparent; transition: background .12s;
}
.ckd-row-resizer:hover::after { background: #f5c451; }
.ckd-cell.ckd-star-col { position: relative; }

.ckd-ctx {
  position: fixed; z-index: 2060;
  background: #1c1c1c; border: 1px solid #3a3a3a; border-radius: 10px;
  padding: 6px; min-width: 200px; box-shadow: 0 10px 30px rgba(0,0,0,.55);
}
.ckd-ctx-title {
  font-size: 10px; letter-spacing: .09em; text-transform: uppercase;
  color: #6e6e6e; padding: 6px 10px 4px;
}
.ckd-ctx label {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 10px; border-radius: 7px; font-size: 12.5px; cursor: pointer; color: #ddd;
}
.ckd-ctx label:hover { background: #272727; }
.ckd-ctx label.ckd-locked { opacity: .45; cursor: not-allowed; }
.ckd-ctx input { accent-color: #f5c451; }
.ckd-ctx-foot { border-top: 1px solid #2e2e2e; margin-top: 5px; padding-top: 5px; }

.ckd-picker-back {
  position: fixed; inset: 0; z-index: 2040; background: rgba(0,0,0,.6);
  display: flex; align-items: center; justify-content: center; padding: 40px;
}
.ckd-picker {
  background: #161616; border: 1px solid #333; border-radius: 14px;
  width: min(1100px, 100%); height: 100%; display: flex; flex-direction: column;
  color: #e6e6e6; box-shadow: 0 24px 60px rgba(0,0,0,.6);
}
.ckd-picker-head {
  display: flex; align-items: center; gap: 12px; padding: 18px 22px 12px; flex-wrap: wrap;
}
.ckd-picker-head h3 { margin: 0; font-size: 15px; font-weight: 550; }
.ckd-picker-grid {
  flex: 1; overflow-y: auto; padding: 6px 22px 22px;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px;
  align-content: start;
}
.ckd-card {
  background: #1a1a1a; border: 1px solid #2e2e2e; border-radius: 10px;
  overflow: hidden; cursor: pointer; display: flex; flex-direction: column;
  transition: border-color .12s, transform .12s;
}
.ckd-card:hover { border-color: #f5c451; transform: translateY(-2px); }
.ckd-card-img {
  aspect-ratio: 16 / 10; background: #232323; display: flex;
  align-items: center; justify-content: center; color: #555; font-size: 10.5px;
}
.ckd-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ckd-card-body { padding: 9px 11px 11px; display: flex; flex-direction: column; gap: 3px; }
.ckd-card-body b { font-size: 12.5px; font-weight: 500; line-height: 1.35; }
.ckd-card-body small { font-size: 10.5px; color: #7d7d7d; }
.ckd-card.ckd-busy { opacity: .5; pointer-events: none; }

.ckd-models { display: flex; flex-wrap: wrap; gap: 4px; overflow: hidden; }
.ckd-chip {
  background: #232323; border: 1px solid #3a3a3a; border-radius: 5px;
  color: #bdbdbd; font-size: 10.5px; line-height: 1.4; padding: 2px 6px;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ckd-chip.ckd-chip-missing { border-color: #7a3b3b; color: #ff9b9b; background: #241a1a; }
.ckd-chip.ckd-chip-more { border-style: dashed; color: #8a8a8a; }
.ckd-warn {
  color: #ffb4b4; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;
}

.ckd-pick { accent-color: #f5c451; cursor: pointer; margin: 0; }
.ckd-cell.ckd-star-col { flex-direction: column; gap: 4px; }
.ckd-row > .ckd-cell.ckd-star-col .ckd-pick { opacity: 0; transition: opacity .12s; }
.ckd-row:hover > .ckd-cell.ckd-star-col .ckd-pick,
.ckd-row.ckd-picked > .ckd-cell.ckd-star-col .ckd-pick,
.ckd-selecting .ckd-row > .ckd-cell.ckd-star-col .ckd-pick { opacity: 1; }
.ckd-row.ckd-picked > .ckd-cell { border-color: #f5c451; background: #1f1c14; }

.ckd-bulk {
  position: sticky; bottom: 0; z-index: 8; margin-top: 12px;
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: #1c1c1c; border: 1px solid #f5c451; border-radius: 12px;
  padding: 10px 14px; box-shadow: 0 -6px 24px rgba(0,0,0,.5);
}
.ckd-bulk b { font-size: 12.5px; font-weight: 500; color: #f5c451; }

.ckd-grip {
  background: none; border: none; color: #4a4a4a; cursor: grab;
  font-size: 12px; line-height: 1; padding: 0 2px; opacity: 0;
  transition: opacity .12s, color .12s;
}
.ckd-row:hover > .ckd-cell.ckd-star-col .ckd-grip { opacity: 1; }
.ckd-grip:hover { color: #f5c451; }
.ckd-grip:active { cursor: grabbing; }
.ckd-row.ckd-dragging > .ckd-cell { opacity: .4; }
.ckd-row.ckd-drop-before > .ckd-cell { box-shadow: inset 0 3px 0 -1px #f5c451; }
.ckd-row.ckd-drop-after > .ckd-cell { box-shadow: inset 0 -3px 0 -1px #f5c451; }
.ckd-btn.ckd-btn-danger { border-color: #7a3b3b; color: #ffb4b4; }
.ckd-btn.ckd-btn-danger:hover { border-color: #a85252; background: #2a1c1c; }
`;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const GEN_EMOJI = {
  Image: "🖼️",
  Audio: "🎵",
  Video: "🎬",
  "3D": "🧊",
  Other: "⚪",
  // Values written by earlier Spanish-language versions.
  Imagen: "🖼️",
  "Vídeo": "🎬",
  Otro: "⚪",
};

const genLabel = (type) => (GEN_EMOJI[type] ? `${GEN_EMOJI[type]} ${type}` : type || "—");

const DEFAULT_PREFS = {
  widths: {},
  rowHeight: 74,
  hidden: [],
  order: [],
  sortBy: "lastUsed",
  sortDir: -1,
};

const state = {
  items: [],
  genTypes: GEN_FALLBACK,
  search: "",
  genFilter: new Set(),
  funcFilter: new Set(),
  modelFilter: new Set(),
  onlyFavs: false,
  onlyIssues: false,
  sortBy: "lastUsed",
  sortDir: -1,
  dragKey: null,
  overlay: null,
  prefs: { ...DEFAULT_PREFS },
  selected: new Set(),
};

const COLUMNS = [
  { id: "favorite", label: "★", cls: "ckd-star-col", width: 56, min: 44 },
  { id: "thumb", label: "Image", sortable: false, width: 128, min: 80 },
  { id: "name", label: "Workflow", width: 260, min: 150, locked: true },
  { id: "generationType", label: "Generation type", width: 165, min: 110 },
  { id: "lastUsed", label: "Last used", width: 120, min: 90 },
  { id: "runCount", label: "Runs", width: 90, min: 70 },
  { id: "function", label: "Function", width: 155, min: 100 },
  { id: "models", label: "Models", width: 215, min: 120, sortable: false },
  { id: "comment", label: "Comment", width: 240, min: 120 },
];

const modelName = (path) => String(path).replace(/\\/g, "/").split("/").pop();

const colWidth = (col) => state.prefs.widths[col.id] ?? col.width;
const visibleColumns = () => COLUMNS.filter((c) => c.locked || !state.prefs.hidden.includes(c.id));
const gridTemplate = () => visibleColumns().map((c) => `${colWidth(c)}px`).join(" ");

let prefsTimer = null;
function savePrefs() {
  clearTimeout(prefsTimer);
  prefsTimer = setTimeout(() => {
    apiJson("/drilo/prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.prefs),
    }).catch((err) => toast(`Could not save preferences: ${err.message}`, true));
  }, 400);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function apiJson(path, options) {
  const res = await api.fetchApi(path, options);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).error || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

async function fetchItems() {
  const data = await apiJson("/drilo/items");
  state.items = data.items;
  state.genTypes = data.generationTypes?.length ? data.generationTypes : GEN_FALLBACK;
  state.prefs = { ...DEFAULT_PREFS, ...(data.prefs || {}) };
  state.prefs.widths = state.prefs.widths || {};
  state.prefs.hidden = state.prefs.hidden || [];
  state.prefs.order = state.prefs.order || [];
  state.sortBy = state.prefs.sortBy || "lastUsed";
  state.sortDir = state.prefs.sortDir === 1 ? 1 : -1;
  state.packModules = data.packModules || [];

  // Which node types are available is only fully known in the frontend: LiteGraph's
  // registry includes JS-only nodes (KJNodes' GetNode/SetNode) that never reach Python.
  const registered = window.LiteGraph?.registered_node_types;
  for (const item of state.items) {
    item.missingNodes = registered
      ? (item.nodeTypes || []).filter((type) => !registered[type])
      : [];
  }
}

function patchItem(key, patch) {
  return apiJson("/drilo/item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, patch }),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toast(message, isError) {
  const el = document.createElement("div");
  el.className = "ckd-toast" + (isError ? " ckd-err" : "");
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), isError ? 5000 : 2200);
}

function confirmDialog({ title, body, confirmLabel, danger }) {
  return new Promise((resolve) => {
    const back = el("div", "ckd-confirm-back");
    const box = el("div", "ckd-confirm");
    box.append(el("h3", null, title), el("p", null, body));

    const row = el("div", "ckd-confirm-row");
    const cancel = el("button", "ckd-btn", "Cancel");
    const accept = el("button", "ckd-btn" + (danger ? " ckd-btn-danger" : ""), confirmLabel);
    row.append(cancel, accept);
    box.appendChild(row);
    back.appendChild(box);

    const finish = (value) => {
      document.removeEventListener("keydown", onKey, true);
      back.remove();
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        finish(e.key === "Enter");
      }
    };

    cancel.addEventListener("click", () => finish(false));
    accept.addEventListener("click", () => finish(true));
    back.addEventListener("click", (e) => {
      if (e.target === back) finish(false);
    });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(back);
    accept.focus();
  });
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} d ago`;
  return d.toISOString().slice(0, 10);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function visibleItems() {
  const q = state.search.trim().toLowerCase();
  const rows = state.items.filter((it) => {
    if (state.onlyFavs && !it.favorite) return false;
    if (state.onlyIssues && !it.missingModels?.length && !it.missingNodes?.length) return false;
    if (state.genFilter.size && !state.genFilter.has(it.generationType)) return false;
    if (state.funcFilter.size && !state.funcFilter.has(it.function || "—")) return false;
    if (state.modelFilter.size && !(it.models || []).some((m) => state.modelFilter.has(modelName(m))))
      return false;
    if (!q) return true;
    return [it.name, it.generationType, it.function, it.comment, it.folder, ...(it.models || [])]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  rows.sort(comparator());
  return rows;
}

function comparator() {
  const dir = state.sortDir;
  const by = state.sortBy;

  if (by === "manual") {
    const rank = new Map(state.prefs.order.map((key, index) => [key, index]));
    // Anything not yet in the manual order (new or imported) sinks to the bottom.
    return (a, b) =>
      (rank.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.key) ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name);
  }

  return (a, b) => {
    if (by === "favorite") return (Number(b.favorite) - Number(a.favorite)) * dir;
    if (by === "runCount") return ((a.runCount || 0) - (b.runCount || 0)) * dir;
    const va = (a[by] ?? "").toString().toLowerCase();
    const vb = (b[by] ?? "").toString().toLowerCase();
    if (va === vb) return a.name.localeCompare(b.name);
    return va < vb ? -dir : dir;
  };
}

function persistSort() {
  state.prefs.sortBy = state.sortBy;
  state.prefs.sortDir = state.sortDir;
  savePrefs();
}

// ---------------------------------------------------------------------------
// Manual ordering by drag and drop
// ---------------------------------------------------------------------------

function seedManualOrder() {
  // Start from what is on screen right now, filters ignored, so the first drag
  // does not shuffle everything the user was not looking at.
  const all = [...state.items].sort(comparator());
  state.prefs.order = all.map((item) => item.key);
}

function moveInOrder(dragKey, targetKey, before) {
  if (!state.prefs.order.length) seedManualOrder();
  const order = state.prefs.order.filter((key) => key !== dragKey);
  let index = order.indexOf(targetKey);
  if (index === -1) index = order.length;
  else if (!before) index += 1;
  order.splice(index, 0, dragKey);
  state.prefs.order = order;
  state.sortBy = "manual";
  state.sortDir = 1;
  persistSort();
}

function clearDropMarkers() {
  for (const row of state.overlay?.querySelectorAll(".ckd-drop-before, .ckd-drop-after") || []) {
    row.classList.remove("ckd-drop-before", "ckd-drop-after");
  }
}

function enableRowDragging(body) {
  body.addEventListener("dragover", (e) => {
    if (!state.dragKey) return;
    const row = e.target.closest?.(".ckd-row");
    if (!row || row.dataset.key === state.dragKey) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    // A display:contents row has no box of its own, so measure the cell instead.
    const box = (e.target.closest(".ckd-cell") || row).getBoundingClientRect();
    const before = e.clientY < box.top + box.height / 2;
    clearDropMarkers();
    row.classList.add(before ? "ckd-drop-before" : "ckd-drop-after");
  });

  body.addEventListener("drop", (e) => {
    if (!state.dragKey) return;
    const row = e.target.closest?.(".ckd-row");
    if (!row || row.dataset.key === state.dragKey) return;
    e.preventDefault();
    const before = row.classList.contains("ckd-drop-before");
    const dragKey = state.dragKey;
    state.dragKey = null;
    clearDropMarkers();
    moveInOrder(dragKey, row.dataset.key, before);
    render();
  });

  body.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget || !body.contains(e.relatedTarget)) clearDropMarkers();
  });
}

// ---------------------------------------------------------------------------
// Opening a workflow
// ---------------------------------------------------------------------------

async function openWorkflow(item) {
  const path = `workflows/${item.key}`;
  try {
    const store = app.extensionManager?.workflow;
    const wf = store?.getWorkflowByPath?.(path);
    if (wf && store.openWorkflow) {
      await store.openWorkflow(wf);
    } else {
      const res = await api.getUserData(path);
      if (res.status !== 200) throw new Error(`Could not read ${path}`);
      await app.loadGraphData(await res.json(), true, true, item.name);
    }
    apiJson("/drilo/touch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: item.key }),
    })
      .then((r) => {
        item.lastUsed = r.lastUsed;
      })
      .catch(() => {});
    closeOverlay();
  } catch (err) {
    toast(`Could not open: ${err.message}`, true);
  }
}

// ---------------------------------------------------------------------------
// Editable cells
// ---------------------------------------------------------------------------

function editableCell(item, field, placeholder, onCommit) {
  const cell = el("div", "ckd-cell");
  const span = el("span", "ckd-edit", item[field] || "");
  span.contentEditable = "plaintext-only";
  span.dataset.placeholder = placeholder;
  span.title = "Click to edit · Enter to save";

  let original = item[field] || "";
  const commit = async () => {
    const value = span.textContent.trim();
    if (value === original) return;
    try {
      await onCommit(value);
      original = value;
    } catch (err) {
      span.textContent = original;
      toast(err.message, true);
    }
  };

  span.addEventListener("click", (e) => e.stopPropagation());
  span.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      span.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      span.textContent = original;
      span.blur();
    }
  });
  span.addEventListener("blur", commit);

  cell.appendChild(span);
  cell.addEventListener("click", () => span.focus());
  return cell;
}

// ---------------------------------------------------------------------------
// Column and row resizing
// ---------------------------------------------------------------------------

function applyRowHeight() {
  if (!state.overlay) return;
  state.overlay.style.setProperty("--ckd-row-h", `${state.prefs.rowHeight}px`);
  state.overlay.style.setProperty("--ckd-thumb-h", `${Math.max(34, state.prefs.rowHeight - 16)}px`);
}

function applyGridTemplate() {
  const tpl = gridTemplate();
  for (const grid of state.overlay?.querySelectorAll(".ckd-grid") || []) {
    grid.style.gridTemplateColumns = tpl;
  }
}

function makeColResizer(col) {
  const handle = el("div", "ckd-resizer");
  handle.title = `Drag to resize · double-click to reset (${col.width}px)`;
  handle.addEventListener("click", (e) => e.stopPropagation());
  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidth(col);
    document.body.classList.add("ckd-resizing");

    const onMove = (ev) => {
      const next = Math.max(col.min ?? 60, Math.min(900, startW + ev.clientX - startX));
      state.prefs.widths[col.id] = Math.round(next);
      applyGridTemplate();
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.classList.remove("ckd-resizing");
      savePrefs();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
  handle.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    delete state.prefs.widths[col.id];
    applyGridTemplate();
    savePrefs();
  });
  return handle;
}

function makeRowResizer() {
  const handle = el("div", "ckd-row-resizer");
  handle.title = "Drag to change the height of every row · double-click to reset";
  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = state.prefs.rowHeight;
    document.body.classList.add("ckd-rowsizing");

    const onMove = (ev) => {
      const next = Math.max(44, Math.min(320, startH + ev.clientY - startY));
      state.prefs.rowHeight = Math.round(next);
      // One custom property on the overlay instead of two style writes per row:
      // dragging used to touch every cell in the table on each mousemove.
      applyRowHeight();
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.classList.remove("ckd-rowsizing");
      savePrefs();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
  handle.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    state.prefs.rowHeight = DEFAULT_PREFS.rowHeight;
    savePrefs();
    render();
  });
  return handle;
}

// ---------------------------------------------------------------------------
// Column menu (right-click on the headers)
// ---------------------------------------------------------------------------

function closeColumnMenu() {
  document.querySelector(".ckd-ctx")?.remove();
  document.removeEventListener("mousedown", onMenuOutside, true);
}

function onMenuOutside(e) {
  if (!e.target.closest(".ckd-ctx")) closeColumnMenu();
}

function openColumnMenu(x, y) {
  closeColumnMenu();
  const menu = el("div", "ckd-ctx");
  menu.appendChild(el("div", "ckd-ctx-title", "Visible columns"));

  for (const col of COLUMNS) {
    const row = el("label", col.locked ? "ckd-locked" : null);
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = col.locked || !state.prefs.hidden.includes(col.id);
    cb.disabled = !!col.locked;
    cb.addEventListener("change", () => {
      state.prefs.hidden = cb.checked
        ? state.prefs.hidden.filter((id) => id !== col.id)
        : [...state.prefs.hidden, col.id];
      savePrefs();
      render();
      openColumnMenu(x, y);
    });
    row.append(cb, el("span", null, col.id === "favorite" ? "★ Favorite" : col.label));
    if (col.locked) row.title = "The Workflow column cannot be hidden";
    menu.appendChild(row);
  }

  const foot = el("div", "ckd-ctx-foot");
  const reset = el("label");
  reset.style.cursor = "pointer";
  reset.appendChild(el("span", null, "↺  Reset widths and row height"));
  reset.addEventListener("click", () => {
    state.prefs.widths = {};
    state.prefs.rowHeight = DEFAULT_PREFS.rowHeight;
    savePrefs();
    closeColumnMenu();
    render();
  });
  foot.appendChild(reset);
  menu.appendChild(foot);

  document.body.appendChild(menu);
  const box = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, window.innerWidth - box.width - 12)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - box.height - 12)}px`;
  document.addEventListener("mousedown", onMenuOutside, true);
}

function buildRow(item, refresh) {
  const row = el("div", "ckd-row" + (item.favorite ? " ckd-fav" : ""));
  row.dataset.key = item.key;

  // ⭐
  const starCell = el("div", "ckd-cell ckd-star-col");
  const star = el("button", "ckd-star" + (item.favorite ? " ckd-on" : ""), item.favorite ? "★" : "☆");
  star.title = item.favorite ? "Remove from favorites" : "Mark as favorite";
  star.addEventListener("click", async (e) => {
    e.stopPropagation();
    const next = !item.favorite;
    try {
      await patchItem(item.key, { favorite: next });
      item.favorite = next;
      refresh();
    } catch (err) {
      toast(err.message, true);
    }
  });
  const pickBox = document.createElement("input");
  pickBox.type = "checkbox";
  pickBox.className = "ckd-pick";
  pickBox.checked = state.selected.has(item.key);
  pickBox.title = "Select for bulk actions";
  pickBox.addEventListener("click", (e) => e.stopPropagation());
  pickBox.addEventListener("change", () => {
    if (pickBox.checked) state.selected.add(item.key);
    else state.selected.delete(item.key);
    refresh();
  });

  const grip = el("button", "ckd-grip", "⠿");
  grip.draggable = true;
  grip.title = "Drag to reorder — switches the table to manual order";
  grip.addEventListener("click", (e) => e.stopPropagation());
  grip.addEventListener("dragstart", (e) => {
    e.stopPropagation();
    state.dragKey = item.key;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.key);
    row.classList.add("ckd-dragging");
  });
  grip.addEventListener("dragend", () => {
    state.dragKey = null;
    row.classList.remove("ckd-dragging");
    clearDropMarkers();
  });

  starCell.append(pickBox, star, grip, makeRowResizer());
  if (pickBox.checked) row.classList.add("ckd-picked");

  // Image
  const thumbCell = el("div", "ckd-cell ckd-thumb-cell");
  const thumb = el("div", "ckd-thumb");
  if (item.thumb) {
    const img = document.createElement("img");
    // Versioned by the file's mtime, not Date.now(): a fresh URL on every
    // repaint would refetch every thumbnail on each keystroke in the search box.
    img.src = api.apiURL(`/drilo/thumb/${encodeURIComponent(item.thumb)}?v=${item.thumbVersion || 0}`);
    img.alt = item.name;
    thumb.appendChild(img);
  } else {
    thumb.textContent = "NO IMAGE";
  }

  const actions = el("div", "ckd-thumb-actions");
  const pick = el("button", "ckd-mini", "✎");
  pick.title = "Set thumbnail — from a recent output or a file (or drop an image here)";
  pick.addEventListener("click", (e) => {
    e.stopPropagation();
    openThumbnailPicker(item, refresh);
  });
  actions.appendChild(pick);

  if (item.thumb) {
    const clear = el("button", "ckd-mini", "✕");
    clear.title = "Remove thumbnail";
    clear.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await apiJson("/drilo/thumbnail/clear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: item.key }),
        });
        item.thumb = null;
        refresh();
      } catch (err) {
        toast(err.message, true);
      }
    });
    actions.appendChild(clear);
  }

  thumbCell.append(thumb, actions);
  thumbCell.title = "Click to open the workflow";
  thumbCell.addEventListener("click", () => openWorkflow(item));
  thumbCell.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    thumbCell.classList.add("ckd-dragover");
  });
  thumbCell.addEventListener("dragleave", () => thumbCell.classList.remove("ckd-dragover"));
  thumbCell.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    thumbCell.classList.remove("ckd-dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadThumb(item, file, refresh);
  });

  // Workflow (renames the real file)
  const nameCell = el("div", "ckd-cell ckd-comment-cell");
  const nameWrap = el("div", "ckd-name");
  const nameEdit = el("span", "ckd-edit", item.name);
  nameEdit.contentEditable = "plaintext-only";
  nameEdit.title = "Click to rename the file · Enter to save";
  let originalName = item.name;
  nameEdit.addEventListener("click", (e) => e.stopPropagation());
  nameEdit.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      nameEdit.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      nameEdit.textContent = originalName;
      nameEdit.blur();
    }
  });
  nameEdit.addEventListener("blur", async () => {
    const value = nameEdit.textContent.trim();
    if (!value || value === originalName) {
      nameEdit.textContent = originalName;
      return;
    }
    try {
      const res = await apiJson("/drilo/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: item.key, name: value }),
      });
      item.key = res.key;
      item.name = value;
      originalName = value;
      toast("Workflow renamed");
      refresh();
    } catch (err) {
      nameEdit.textContent = originalName;
      toast(err.message, true);
    }
  });
  const strong = el("b");
  strong.appendChild(nameEdit);
  const meta = el("small", null, [item.folder, `${item.nodeCount} nodes`, `${item.sizeKb} KB`].filter(Boolean).join(" · "));
  nameWrap.append(strong, meta);

  const missingNodes = item.missingNodes || [];
  if (missingNodes.length) {
    const warn = el(
      "small",
      "ckd-warn",
      `⚠ ${missingNodes.length} node type${missingNodes.length > 1 ? "s" : ""} not installed`
    );
    warn.title = missingNodes.join("\n");
    nameWrap.appendChild(warn);
  }
  nameCell.appendChild(nameWrap);
  nameCell.addEventListener("click", () => openWorkflow(item));

  // Generation type
  const genCell = el("div", "ckd-cell");
  const select = el("select", "ckd-select");
  const options = [...new Set([...state.genTypes, item.generationType].filter(Boolean))];
  for (const opt of options) {
    const o = el("option", null, genLabel(opt));
    o.value = opt;
    if (opt === item.generationType) o.setAttribute("selected", "");
    select.appendChild(o);
  }
  select.addEventListener("click", (e) => e.stopPropagation());
  select.addEventListener("change", async () => {
    try {
      await patchItem(item.key, { generationType: select.value });
      item.generationType = select.value;
      refresh();
    } catch (err) {
      toast(err.message, true);
    }
  });
  genCell.appendChild(select);

  // Runs
  const runsCell = el("div", "ckd-cell");
  const runs = item.runCount || 0;
  const runsLabel = el("span", runs ? null : "ckd-muted", runs ? `▶ ${runs}` : "—");
  runsLabel.title = item.lastRun ? `Last run: ${item.lastRun}` : "Never run from this library";
  runsCell.appendChild(runsLabel);
  runsCell.addEventListener("click", () => openWorkflow(item));

  // Last used
  const usedCell = el("div", "ckd-cell");
  const used = el("span", "ckd-muted", formatDate(item.lastUsed));
  used.title = item.lastUsed || "";
  usedCell.appendChild(used);
  usedCell.addEventListener("click", () => openWorkflow(item));

  // Function
  const funcCell = editableCell(item, "function", "—", async (value) => {
    await patchItem(item.key, { function: value });
    item.function = value;
  });

  // Models
  const modelsCell = el("div", "ckd-cell");
  const models = item.models || [];
  const missingModels = new Set(item.missingModels || []);
  if (!models.length) {
    modelsCell.appendChild(el("span", "ckd-muted", "—"));
  } else {
    const chips = el("div", "ckd-models");
    const MAX_CHIPS = 4;
    for (const model of models.slice(0, MAX_CHIPS)) {
      const missing = missingModels.has(model);
      const chip = el("span", "ckd-chip" + (missing ? " ckd-chip-missing" : ""), modelName(model));
      chip.title = missing ? `${model}\nNot found in this installation` : model;
      chips.appendChild(chip);
    }
    if (models.length > MAX_CHIPS) {
      const more = el("span", "ckd-chip ckd-chip-more", `+${models.length - MAX_CHIPS}`);
      more.title = models.slice(MAX_CHIPS).join("\n");
      chips.appendChild(more);
    }
    modelsCell.appendChild(chips);
  }
  modelsCell.addEventListener("click", () => openWorkflow(item));

  // Comment
  const commentCell = editableCell(item, "comment", "Add a note…", async (value) => {
    await patchItem(item.key, { comment: value });
    item.comment = value;
  });

  const rowActions = el("div", "ckd-actions");
  const act = (label, title, handler, danger) => {
    const b = el("button", "ckd-act" + (danger ? " ckd-danger" : ""), label);
    b.title = title;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      handler();
    });
    rowActions.appendChild(b);
  };

  act("Open", "Open the workflow on the canvas to edit it", () => openWorkflow(item));

  act("Duplicate", "Create a copy of this workflow", async () => {
    try {
      const res = await apiJson("/drilo/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: item.key }),
      });
      toast(`Duplicated as "${res.name}"`);
      await fetchItems();
      refresh();
    } catch (err) {
      toast(err.message, true);
    }
  });

  act(
    "Delete",
    "Move the workflow to Cokedrilo's trash",
    async () => {
      const ok = await confirmDialog({
        title: `Delete "${item.name}"?`,
        body: "It is moved to Cokedrilo's trash (custom_nodes\\Cokedrilo\\trash), so you can restore it by hand. It will disappear from the workflow list and from the Templates sections.",
        confirmLabel: "Delete",
        danger: true,
      });
      if (!ok) return;
      try {
        await apiJson("/drilo/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: item.key }),
        });
        toast(`"${item.name}" moved to the trash`);
        await fetchItems();
        refresh();
      } catch (err) {
        toast(err.message, true);
      }
    },
    true
  );

  // Actions live in the Workflow cell, which can never be hidden.
  nameCell.appendChild(rowActions);

  const cells = {
    favorite: starCell,
    thumb: thumbCell,
    name: nameCell,
    generationType: genCell,
    lastUsed: usedCell,
    runCount: runsCell,
    function: funcCell,
    models: modelsCell,
    comment: commentCell,
  };
  for (const col of visibleColumns()) row.appendChild(cells[col.id]);

  return row;
}

async function uploadThumb(item, file, refresh) {
  const form = new FormData();
  form.append("key", item.key);
  form.append("file", file);
  try {
    const res = await api.fetchApi("/drilo/thumbnail", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    item.thumb = data.thumb;
    refresh();
  } catch (err) {
    toast(err.message, true);
  }
}

// ---------------------------------------------------------------------------
// Filter dropdowns
// ---------------------------------------------------------------------------

function dropdown(label, values, selected, onChange, format = (v) => v) {
  const wrap = el("div", "ckd-drop");
  const btn = el("button", "ckd-btn");
  const paint = () => {
    btn.textContent = selected.size ? `${label} (${selected.size}) ▾` : `${label} ▾`;
    btn.classList.toggle("ckd-on", selected.size > 0);
  };
  paint();

  let menu = null;
  const close = () => {
    menu?.remove();
    menu = null;
    document.removeEventListener("mousedown", onOutside, true);
  };
  const onOutside = (e) => {
    if (!wrap.contains(e.target)) close();
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu) return close();
    menu = el("div", "ckd-menu");
    for (const value of values) {
      const row = el("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = selected.has(value);
      cb.addEventListener("change", () => {
        cb.checked ? selected.add(value) : selected.delete(value);
        paint();
        onChange();
      });
      row.append(cb, el("span", null, format(value)));
      menu.appendChild(row);
    }
    wrap.appendChild(menu);
    document.addEventListener("mousedown", onOutside, true);
  });

  wrap.appendChild(btn);
  return wrap;
}

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------

async function runBulk(action, value) {
  const keys = [...state.selected];
  const data = await apiJson("/drilo/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys, action, value }),
  });
  state.selected.clear();
  await fetchItems();
  render();
  return data;
}

function paintBulkBar(host) {
  host.textContent = "";
  const count = state.selected.size;
  if (!count) return;

  const bar = el("div", "ckd-bulk");
  bar.appendChild(el("b", null, `${count} selected`));

  const action = (label, handler, danger) => {
    const button = el("button", "ckd-btn" + (danger ? " ckd-btn-danger" : ""), label);
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await handler();
      } catch (err) {
        toast(err.message, true);
        button.disabled = false;
      }
    });
    bar.appendChild(button);
  };

  action("★ Favorite", async () => {
    const r = await runBulk("favorite");
    toast(`${r.affected} marked as favorite`);
  });
  action("☆ Unfavorite", async () => {
    const r = await runBulk("unfavorite");
    toast(`${r.affected} removed from favorites`);
  });

  const typeSelect = el("select", "ckd-select");
  typeSelect.appendChild(Object.assign(el("option", null, "Set generation type…"), { value: "" }));
  for (const type of state.genTypes) {
    const option = el("option", null, genLabel(type));
    option.value = type;
    typeSelect.appendChild(option);
  }
  typeSelect.addEventListener("change", async () => {
    if (!typeSelect.value) return;
    try {
      const r = await runBulk("generationType", typeSelect.value);
      toast(`${r.affected} set to ${typeSelect.value}`);
    } catch (err) {
      toast(err.message, true);
    }
  });
  bar.appendChild(typeSelect);

  action(
    "Delete",
    async () => {
      const ok = await confirmDialog({
        title: `Delete ${count} workflow${count > 1 ? "s" : ""}?`,
        body: "They are moved to the library's trash folder, so you can restore them by hand. They will disappear from the workflow list and from the Templates sections.",
        confirmLabel: "Delete",
        danger: true,
      });
      if (!ok) return;
      const r = await runBulk("delete");
      toast(`${r.affected} moved to the trash`);
    },
    true
  );

  action("Clear selection", async () => {
    state.selected.clear();
    render();
  });

  host.appendChild(bar);
}

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

function closeOverlay() {
  closeColumnMenu();
  state.overlay?.remove();
  state.overlay = null;
  document.removeEventListener("keydown", onKeydown, true);
}

function onKeydown(e) {
  if (e.key === "Escape" && !e.target.isContentEditable) {
    e.stopPropagation();
    closeOverlay();
  }
}

function render() {
  if (!state.overlay) return;
  const overlay = state.overlay;
  overlay.textContent = "";

  // --- barra superior ---
  const top = el("div", "ckd-topbar");
  const title = el("div", "ckd-title");
  title.append(el("h2", null, "🐊 DRILO Workflow Library"), el("span", null, "by Cokedrilo"));
  top.appendChild(title);
  top.appendChild(el("div", "ckd-spacer"));

  const importBtn = el("button", "ckd-btn", "＋ Import from Templates");
  importBtn.title = "Copy a workflow from ComfyUI's Templates browser into your library";
  importBtn.addEventListener("click", () => openTemplatePicker(() => render()));
  top.appendChild(importBtn);

  const syncBtn = el("button", "ckd-btn", "Sync Templates");
  syncBtn.title = "Rebuild this pack's two sections of the Templates browser";
  syncBtn.addEventListener("click", async () => {
    syncBtn.textContent = "Syncing…";
    try {
      const r = await apiJson("/drilo/sync", { method: "POST" });
      toast(`Templates synced: ${r.synced} workflows, ${r.favorites} favorites`);
    } catch (err) {
      toast(err.message, true);
    }
    syncBtn.textContent = "Sync Templates";
  });
  top.appendChild(syncBtn);

  const closeBtn = el("button", "ckd-btn ckd-close", "✕");
  closeBtn.title = "Close (Esc)";
  closeBtn.addEventListener("click", closeOverlay);
  top.appendChild(closeBtn);
  overlay.appendChild(top);

  // --- filtros ---
  const filters = el("div", "ckd-filters");
  const search = el("input", "ckd-search");
  search.placeholder = "Search by name, function, comment…";
  search.value = state.search;
  search.addEventListener("input", () => {
    state.search = search.value;
    paintBody();
  });
  search.addEventListener("keydown", (e) => e.stopPropagation());
  filters.appendChild(search);

  const genValues = [...new Set(state.items.map((i) => i.generationType).filter(Boolean))].sort();
  const funcValues = [...new Set(state.items.map((i) => i.function || "—"))].sort();
  filters.appendChild(dropdown("Generation type", genValues, state.genFilter, () => paintBody(), genLabel));
  filters.appendChild(dropdown("Function", funcValues, state.funcFilter, () => paintBody()));

  const modelValues = [...new Set(state.items.flatMap((i) => (i.models || []).map(modelName)))].sort();
  if (modelValues.length) {
    filters.appendChild(dropdown("Models", modelValues, state.modelFilter, () => paintBody()));
  }

  const colsBtn = el("button", "ckd-btn" + (state.prefs.hidden.length ? " ckd-on" : ""));
  colsBtn.textContent = state.prefs.hidden.length ? `Columns (${visibleColumns().length}/${COLUMNS.length}) ▾` : "Columns ▾";
  colsBtn.title = "Show or hide columns (also available by right-clicking the headers)";
  colsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const box = colsBtn.getBoundingClientRect();
    if (document.querySelector(".ckd-ctx")) closeColumnMenu();
    else openColumnMenu(box.left, box.bottom + 6);
  });
  filters.appendChild(colsBtn);

  const favBtn = el("button", "ckd-btn" + (state.onlyFavs ? " ckd-on" : ""), "★ Favorites only");
  favBtn.addEventListener("click", () => {
    state.onlyFavs = !state.onlyFavs;
    render();
  });
  filters.appendChild(favBtn);

  const issuesCount = state.items.filter((i) => i.missingModels?.length || i.missingNodes?.length).length;
  if (issuesCount) {
    const issuesBtn = el(
      "button",
      "ckd-btn" + (state.onlyIssues ? " ckd-on" : ""),
      `⚠ Needs something (${issuesCount})`
    );
    issuesBtn.title = "Only show workflows with missing models or uninstalled node types";
    issuesBtn.addEventListener("click", () => {
      state.onlyIssues = !state.onlyIssues;
      render();
    });
    filters.appendChild(issuesBtn);
  }

  if (state.prefs.order.length) {
    const manualBtn = el(
      "button",
      "ckd-btn" + (state.sortBy === "manual" ? " ckd-on" : ""),
      "⠿ Manual order"
    );
    manualBtn.title = "Back to the order you arranged by dragging";
    manualBtn.addEventListener("click", () => {
      state.sortBy = "manual";
      state.sortDir = 1;
      persistSort();
      render();
    });
    filters.appendChild(manualBtn);
  }

  const resetBtn = el("button", "ckd-btn", "Clear filters");
  resetBtn.addEventListener("click", () => {
    state.search = "";
    state.genFilter.clear();
    state.funcFilter.clear();
    state.modelFilter.clear();
    state.onlyFavs = false;
    state.onlyIssues = false;
    render();
  });
  filters.appendChild(resetBtn);

  const counter = el("span", "ckd-count");
  filters.appendChild(counter);
  overlay.appendChild(filters);

  // --- tabla ---
  const scroll = el("div", "ckd-scroll");
  const head = el("div", "ckd-grid ckd-head");
  head.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openColumnMenu(e.clientX, e.clientY);
  });
  head.title = "Right-click: show or hide columns";
  for (const col of visibleColumns()) {
    const cell = el("div", "ckd-cell" + (col.cls ? " " + col.cls : ""));
    if (col.id === "favorite") {
      const all = document.createElement("input");
      all.type = "checkbox";
      all.className = "ckd-pick";
      all.title = "Select or clear every visible row";
      all.checked = state.selected.size > 0 && visibleItems().every((i) => state.selected.has(i.key));
      all.addEventListener("click", (e) => e.stopPropagation());
      all.addEventListener("change", () => {
        const rows = visibleItems();
        if (all.checked) rows.forEach((i) => state.selected.add(i.key));
        else rows.forEach((i) => state.selected.delete(i.key));
        render();
      });
      cell.appendChild(all);
    }
    cell.appendChild(el("span", null, col.label));
    cell.appendChild(makeColResizer(col));
    if (col.sortable !== false) {
      if (state.sortBy === col.id) cell.appendChild(el("span", "ckd-sort", state.sortDir > 0 ? "▲" : "▼"));
      cell.addEventListener("click", () => {
        if (state.sortBy === col.id) state.sortDir *= -1;
        else {
          state.sortBy = col.id;
          state.sortDir = col.id === "lastUsed" ? -1 : 1;
        }
        persistSort();
        render();
      });
    } else {
      cell.style.cursor = "default";
    }
    head.appendChild(cell);
  }
  scroll.appendChild(head);

  const body = el("div", "ckd-grid");
  enableRowDragging(body);
  scroll.appendChild(body);
  const bulkHost = el("div");
  scroll.appendChild(bulkHost);
  overlay.appendChild(scroll);
  applyGridTemplate();
  applyRowHeight();

  function paintBody() {
    body.textContent = "";
    const rows = visibleItems();
    counter.textContent = `${rows.length} of ${state.items.length}`;
    overlay.classList.toggle("ckd-selecting", state.selected.size > 0);
    for (const item of rows) body.appendChild(buildRow(item, () => render()));
    paintBulkBar(bulkHost);
    if (!rows.length) {
      const empty = el("div", "ckd-empty", state.items.length ? "No workflow matches the current filters." : "There are no workflows in user/default/workflows.");
      empty.style.gridColumn = "1 / -1";
      body.appendChild(empty);
    }
  }

  paintBody();
}

async function openLibrary() {
  if (state.overlay) return closeOverlay();
  const overlay = el("div", "ckd-overlay");
  overlay.appendChild(el("div", "ckd-empty", "Loading library…"));
  document.body.appendChild(overlay);
  state.overlay = overlay;
  document.addEventListener("keydown", onKeydown, true);
  try {
    await fetchItems();
    render();
  } catch (err) {
    overlay.textContent = "";
    const box = el("div", "ckd-empty", `Could not load the library: ${err.message}`);
    overlay.appendChild(box);
    const back = el("button", "ckd-btn", "Close");
    back.addEventListener("click", closeOverlay);
    box.appendChild(document.createElement("br"));
    box.appendChild(back);
  }
}

// ---------------------------------------------------------------------------
// Thumbnail picker: recent outputs, or a file from disk
// ---------------------------------------------------------------------------

async function openThumbnailPicker(item, refresh) {
  const back = el("div", "ckd-picker-back");
  const panel = el("div", "ckd-picker");
  panel.style.maxHeight = "70vh";
  panel.style.height = "auto";

  const head = el("div", "ckd-picker-head");
  head.appendChild(el("h3", null, `Thumbnail for "${item.name}"`));
  const counter = el("span", "ckd-count", "loading…");
  head.appendChild(counter);
  head.appendChild(el("div", "ckd-spacer"));

  const upload = el("button", "ckd-btn", "Upload a file…");
  head.appendChild(upload);
  const close = el("button", "ckd-btn ckd-close", "✕");
  head.appendChild(close);

  const grid = el("div", "ckd-picker-grid");
  panel.append(head, grid);
  back.appendChild(panel);
  document.body.appendChild(back);

  const dismiss = () => {
    document.removeEventListener("keydown", onKey, true);
    back.remove();
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    }
  };
  document.addEventListener("keydown", onKey, true);
  close.addEventListener("click", dismiss);
  back.addEventListener("click", (e) => {
    if (e.target === back) dismiss();
  });

  upload.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", async () => {
      if (!input.files?.[0]) return;
      dismiss();
      await uploadThumb(item, input.files[0], refresh);
    });
    input.click();
  });

  let outputs = [];
  try {
    outputs = (await apiJson("/drilo/outputs?limit=48")).items || [];
  } catch (err) {
    counter.textContent = "";
    grid.appendChild(el("div", "ckd-empty", `Could not list outputs: ${err.message}`));
    return;
  }

  counter.textContent = outputs.length ? `${outputs.length} recent outputs` : "";
  if (!outputs.length) {
    grid.appendChild(el("div", "ckd-empty", "No generated images yet — upload a file instead."));
    return;
  }

  for (const output of outputs) {
    const card = el("div", "ckd-card");
    const imgWrap = el("div", "ckd-card-img");
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = api.apiURL(
      `/view?filename=${encodeURIComponent(output.filename)}&subfolder=${encodeURIComponent(
        output.subfolder
      )}&type=output`
    );
    img.alt = output.filename;
    imgWrap.appendChild(img);

    const body = el("div", "ckd-card-body");
    body.append(el("b", null, output.filename), el("small", null, formatDate(output.modified)));

    card.append(imgWrap, body);
    card.title = "Use this image as the thumbnail";
    card.addEventListener("click", async () => {
      card.classList.add("ckd-busy");
      try {
        const data = await apiJson("/drilo/thumbnail/from-output", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: item.key,
            filename: output.filename,
            subfolder: output.subfolder,
          }),
        });
        item.thumb = data.thumb;
        item.thumbVersion = Math.floor(Date.now() / 1000);
        dismiss();
        refresh();
      } catch (err) {
        card.classList.remove("ckd-busy");
        toast(err.message, true);
      }
    });
    grid.appendChild(card);
  }
}

// ---------------------------------------------------------------------------
// Import from the Templates browser
// ---------------------------------------------------------------------------

const fileURL = (path) => (typeof api.fileURL === "function" ? api.fileURL(path) : path);

let templateCatalog = null;

async function loadTemplateCatalog() {
  if (templateCatalog) return templateCatalog;

  const [core, custom] = await Promise.all([
    fetch(fileURL("/templates/index.json"))
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    apiJson("/workflow_templates").catch(() => ({})),
  ]);

  const catalog = [];
  for (const category of Array.isArray(core) ? core : []) {
    for (const tpl of category.templates || []) {
      catalog.push({
        title: tpl.title || tpl.name,
        category: category.title || category.moduleName || "ComfyUI",
        tags: tpl.tags || [],
        models: tpl.models || [],
        thumb: fileURL(`/templates/${tpl.name}-1.${tpl.mediaSubtype || "webp"}`),
        json: fileURL(`/templates/${tpl.name}.json`),
      });
    }
  }
  for (const [module, names] of Object.entries(custom || {})) {
    if ((state.packModules || []).includes(module)) continue; // our own mirrors
    for (const name of names) {
      catalog.push({
        title: name,
        category: module,
        tags: [],
        models: [],
        thumb: api.apiURL(`/workflow_templates/${module}/${encodeURIComponent(name)}.jpg`),
        json: api.apiURL(`/workflow_templates/${module}/${encodeURIComponent(name)}.json`),
      });
    }
  }

  templateCatalog = catalog;
  return catalog;
}

async function importTemplate(tpl) {
  const res = await fetch(tpl.json);
  if (!res.ok) throw new Error(`Could not fetch the template (${res.status})`);
  const workflow = await res.text();

  const form = new FormData();
  form.append("name", tpl.title.replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 120));
  form.append("workflow", workflow);
  try {
    const image = await fetch(tpl.thumb);
    if (image.ok) form.append("file", await image.blob(), "thumbnail");
  } catch {
    /* the template simply has no usable thumbnail */
  }

  const saved = await api.fetchApi("/drilo/import", { method: "POST", body: form });
  const data = await saved.json();
  if (!saved.ok) throw new Error(data.error || saved.statusText);
  return data;
}

async function openTemplatePicker(refresh) {
  const back = el("div", "ckd-picker-back");
  const panel = el("div", "ckd-picker");
  const head = el("div", "ckd-picker-head");

  head.appendChild(el("h3", null, "Import from Templates"));
  const search = el("input", "ckd-search");
  search.placeholder = "Search templates…";
  head.appendChild(search);
  const counter = el("span", "ckd-count", "loading…");
  head.appendChild(counter);
  head.appendChild(el("div", "ckd-spacer"));
  const close = el("button", "ckd-btn ckd-close", "✕");
  head.appendChild(close);

  const grid = el("div", "ckd-picker-grid");
  panel.append(head, grid);
  back.appendChild(panel);
  document.body.appendChild(back);

  const dismiss = () => {
    document.removeEventListener("keydown", onKey, true);
    back.remove();
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    }
  };
  document.addEventListener("keydown", onKey, true);
  close.addEventListener("click", dismiss);
  back.addEventListener("click", (e) => {
    if (e.target === back) dismiss();
  });

  let catalog = [];
  try {
    catalog = await loadTemplateCatalog();
  } catch (err) {
    counter.textContent = "";
    grid.appendChild(el("div", "ckd-empty", `Could not read the template index: ${err.message}`));
    return;
  }

  const LIMIT = 60;
  const paint = () => {
    const query = search.value.trim().toLowerCase();
    const matches = catalog.filter((tpl) =>
      !query ||
      [tpl.title, tpl.category, ...tpl.tags, ...tpl.models].join(" ").toLowerCase().includes(query)
    );
    const shown = matches.slice(0, LIMIT);
    counter.textContent =
      matches.length > shown.length
        ? `${shown.length} of ${matches.length} — refine the search to see more`
        : `${matches.length} templates`;

    grid.textContent = "";
    for (const tpl of shown) {
      const card = el("div", "ckd-card");
      const imgWrap = el("div", "ckd-card-img");
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = tpl.thumb;
      img.alt = tpl.title;
      img.addEventListener("error", () => {
        imgWrap.textContent = "NO PREVIEW";
      });
      imgWrap.appendChild(img);

      const body = el("div", "ckd-card-body");
      body.append(el("b", null, tpl.title), el("small", null, tpl.category));

      card.append(imgWrap, body);
      card.title = "Click to copy this template into your workflows";
      card.addEventListener("click", async () => {
        card.classList.add("ckd-busy");
        try {
          const data = await importTemplate(tpl);
          toast(`Imported as "${data.name}"`);
          dismiss();
          await fetchItems();
          refresh();
        } catch (err) {
          card.classList.remove("ckd-busy");
          toast(err.message, true);
        }
      });
      grid.appendChild(card);
    }

    if (!shown.length) grid.appendChild(el("div", "ckd-empty", "No template matches that search."));
  };

  search.addEventListener("input", paint);
  search.addEventListener("keydown", (e) => e.stopPropagation());
  paint();
  search.focus();
}

// ---------------------------------------------------------------------------
// Run counter
// ---------------------------------------------------------------------------

function trackRuns() {
  // Attributed to whichever workflow is active when the prompt starts. If you
  // queue a job and immediately switch tabs the count still lands on the one
  // that was queued, because we read the path at execution_start.
  const record = () => {
    const path = app.extensionManager?.workflow?.activeWorkflow?.path;
    if (!path || !path.startsWith("workflows/")) return;
    const key = path.slice("workflows/".length);
    apiJson("/drilo/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    })
      .then((data) => {
        const item = state.items.find((i) => i.key === key);
        if (item && data.ok) item.runCount = data.runCount;
      })
      .catch(() => {
        /* counting is best-effort, never interrupt a run */
      });
  };

  try {
    api.addEventListener("execution_start", record);
  } catch (err) {
    console.warn("[DRILO Library] could not hook execution events:", err);
  }
}

// ---------------------------------------------------------------------------
// Sidebar button: a launcher only, it never opens a panel
// ---------------------------------------------------------------------------

function launchFromSidebar(container) {
  container.textContent = "";
  // Collapse the tab in the same tick so the panel never gets painted.
  const store = app.extensionManager.sidebarTab;
  if (store) store.activeSidebarTabId = null;
  templateCatalog = null; // refetch the template index on each session
  openLibrary();
}

// ---------------------------------------------------------------------------
// Extension registration
// ---------------------------------------------------------------------------

app.registerExtension({
  name: "Drilo.WorkflowLibrary",
  commands: [
    {
      id: "Drilo.OpenLibrary",
      label: "🐊 DRILO Workflow Library",
      icon: "pi pi-star",
      function: openLibrary,
    },
  ],
  menuCommands: [{ path: ["Workflow"], commands: ["Drilo.OpenLibrary"] }],
  // Ctrl+Shift+K is taken by Workspace.ToggleBottomPanel.Shortcuts; B is free.
  keybindings: [{ commandId: "Drilo.OpenLibrary", combo: { key: "b", ctrl: true, shift: true } }],
  setup() {
    const style = document.createElement("style");
    style.id = "drilo-library-styles";
    style.textContent = CSS;
    document.head.appendChild(style);

    trackRuns();

    try {
      app.extensionManager.registerSidebarTab({
        id: "drilo-library",
        icon: "pi pi-star",
        title: "🐊 Library",
        tooltip: "🐊 DRILO Workflow Library",
        label: "Library",
        type: "custom",
        render: launchFromSidebar,
      });
    } catch (err) {
      console.warn("[DRILO Library] could not register the sidebar tab:", err);
    }
  },
});
