// Memory · Hafıza — 4x4 icon matching game for Fenn.
// Live plugin: one draw() builds the whole tree from state.
// Intervals run only while two mismatched cards wait to close (~0.7 s),
// never while idle; draw() is called on state changes only.
"use strict";

const fenn = require("./fenn");
const app = new fenn.Plugin();

// ---- Strings (TR + EN) -------------------------------------------------

const T = {
  tr: {
    moves: "Hamle",
    time: "Süre",
    best: "Rekor",
    newRecord: "Yeni rekor",
    newGame: "Yeni oyun",
    done: "Tebrikler!",
    noBest: "Rekor yok",
    tileLabel: "Hafıza",
    langTip: "Türkçe / English",
  },
  en: {
    moves: "Moves",
    time: "Time",
    best: "Best",
    newRecord: "New record",
    newGame: "New game",
    done: "Well done!",
    noBest: "No best yet",
    tileLabel: "Memory",
    langTip: "Türkçe / English",
  },
};

const locale = String(Intl.DateTimeFormat().resolvedOptions().locale || "en").toLowerCase();
let lang = app.load("lang", locale.startsWith("tr") ? "tr" : "en");
if (lang !== "tr" && lang !== "en") lang = "en";
const t = () => T[lang];

// ---- State -------------------------------------------------------------

const ICONS = ["star", "heart", "moon", "lightning", "flame", "leaf", "ghost", "rocket"];
const CARD = 86, GAP = 8, CELL = CARD + GAP, BOARD = 4 * CARD + 3 * GAP; // 368

let deck = [];        // 16 icon names (8 pairs, shuffled)
let state = [];       // "down" | "up" | "matched"
let pick = -1;        // first flipped card index
let lock = false;     // true while two mismatched cards wait to close
let closeTimer = null;
let moves = 0;
let startedAt = null;
let finishedAt = null;
let finished = false;
let newRecord = false;
let best = app.load("best", null);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function newGame() {
  if (closeTimer) { clearInterval(closeTimer); closeTimer = null; }
  deck = shuffle(ICONS.flatMap((ic) => [ic, ic]));
  state = deck.map(() => "down");
  pick = -1;
  lock = false;
  moves = 0;
  startedAt = null;
  finishedAt = null;
  finished = false;
  newRecord = false;
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function elapsedMs() {
  if (startedAt === null) return 0;
  return (finishedAt || Date.now()) - startedAt;
}

// ---- Drawing -----------------------------------------------------------

function boardShapes() {
  const shapes = [];
  for (let i = 0; i < 16; i++) {
    const r = Math.floor(i / 4), c = i % 4;
    const x = c * CELL, y = r * CELL;
    const cx = x + CARD / 2, cy = y + CARD / 2;
    const st = state[i];
    if (st === "matched") {
      shapes.push(fenn.shape.rect(x, y, CARD, CARD, { radius: 12, fill: "transparent", stroke: "accent", width: 2 }));
      shapes.push(fenn.shape.icon(cx, cy, deck[i], { size: 34, color: "accent" }));
    } else if (st === "up") {
      shapes.push(fenn.shape.rect(x, y, CARD, CARD, { radius: 12, fill: "accent", stroke: "accent", width: 2 }));
      shapes.push(fenn.shape.icon(cx, cy, deck[i], { size: 34, color: "on_accent" }));
    } else {
      shapes.push(fenn.shape.rect(x, y, CARD, CARD, { radius: 12, fill: "faint", stroke: "dim", width: 1 }));
      shapes.push(fenn.shape.icon(cx, cy, "question", { size: 28, color: "dim" }));
    }
  }
  return shapes;
}

function statColumn(label, value) {
  return fenn.column([
    fenn.text(label, { size: "small", color: "dim" }),
    fenn.text(value, { size: "title" }),
  ], { gap: 0 });
}

function statusText() {
  const tt = t();
  if (finished) {
    return (newRecord ? tt.newRecord + " · " : tt.done + " · ") + moves + " " + tt.moves;
  }
  return tt.best + ": " + (best === null ? tt.noBest : best);
}

function pageView() {
  const tt = t();
  return fenn.column([
    fenn.row([
      statColumn(tt.moves, String(moves)),
      statColumn(tt.time, fmtTime(elapsedMs())),
      statColumn(tt.best, best === null ? "—" : String(best)),
      fenn.spacer(),
      fenn.button("lang", { icon: "translate", tooltip: tt.langTip }),
    ], { align: "center", gap: 12 }),
    fenn.canvas(BOARD, boardShapes(), { width: BOARD, id: "board" }),
    fenn.row([
      fenn.text(statusText(), { size: "body", color: newRecord ? "accent" : "dim", wrap: true }),
      fenn.spacer(),
      fenn.button("new", {
        label: tt.newGame,
        icon: "arrow-clockwise",
        primary: finished,
      }),
    ], { align: "center", gap: 8 }),
  ], { gap: 8, scroll: true });
}

function tileView() {
  const tt = t();
  const size = app.tile.size || "wide";
  const line1 = tt.moves + " " + moves;
  const line2 = tt.time + " " + fmtTime(elapsedMs());
  if (size === "small") {
    return fenn.column([fenn.text(String(moves), { size: "big" })],
      { align: "center", justify: "center", gap: 0 });
  }
  if (size === "wide") {
    return fenn.row([
      fenn.icon("brain", { size: 26, color: "accent" }),
      fenn.column([
        fenn.text(line1, { size: "small", color: "dim" }),
        fenn.text(line2, { size: "title" }),
      ], { gap: 0 }),
    ], { align: "center", gap: 10 });
  }
  return fenn.column([
    fenn.icon("brain", { size: 30, color: "accent" }),
    fenn.text(line1, { size: "title" }),
    fenn.text(line2, { size: "small", color: "dim" }),
  ], { align: "center", justify: "center", gap: 4 });
}

function draw() {
  try {
    app.setTile(tileView());
    app.setPage(pageView());
  } catch (e) {
    console.error("memory: draw failed: " + String((e && e.stack) || e));
  }
}

// ---- Game flow (interval only while cards wait to close) ---------------

function startCloseTimer(a, b) {
  const deadline = Date.now() + 700;
  closeTimer = setInterval(() => {
    try {
      if (Date.now() < deadline) return;
      clearInterval(closeTimer);
      closeTimer = null;
      state[a] = "down";
      state[b] = "down";
      lock = false;
      draw();
    } catch (e) {
      if (closeTimer) { clearInterval(closeTimer); closeTimer = null; }
      lock = false;
      console.error("memory: close failed: " + String((e && e.stack) || e));
    }
  }, 100);
}

function finishGame() {
  finished = true;
  finishedAt = Date.now();
  newRecord = best === null || moves < best;
  if (newRecord) {
    best = moves;
    app.save("best", best);
  }
}

app.on("board", (ev) => {
  try {
    if (finished || lock) return;
    const v = (ev && ev.value) || {};
    const x = typeof v.x === "number" ? v.x : 0;
    const y = typeof v.y === "number" ? v.y : 0;
    const col = Math.max(0, Math.min(3, Math.floor(x / CELL)));
    const row = Math.max(0, Math.min(3, Math.floor(y / CELL)));
    const idx = row * 4 + col;
    if (state[idx] !== "down") return;
    if (startedAt === null) startedAt = Date.now();
    state[idx] = "up";
    if (pick === -1) {
      pick = idx;
      draw();
      return;
    }
    const a = pick;
    const b = idx;
    pick = -1;
    moves += 1;
    if (deck[a] === deck[b]) {
      state[a] = "matched";
      state[b] = "matched";
      if (state.every((s) => s === "matched")) finishGame();
    } else {
      lock = true;
      startCloseTimer(a, b);
    }
    draw();
  } catch (e) {
    console.error("memory: " + String((e && e.stack) || e));
  }
});

app.on("new", () => {
  try {
    newGame();
    draw();
  } catch (e) { console.error("memory: " + String((e && e.stack) || e)); }
});

app.on("lang", () => {
  try {
    lang = lang === "tr" ? "en" : "tr";
    app.save("lang", lang);
    draw();
  } catch (e) { console.error("memory: " + String((e && e.stack) || e)); }
});

// ---- Lifecycle ---------------------------------------------------------

let lastTileSize = null;

app.onMessage("layout", (m) => {
  try {
    if (m && m.target === "tile" && m.size !== lastTileSize) {
      lastTileSize = m.size;
      draw();
    }
  } catch (e) { console.error("memory: " + String((e && e.stack) || e)); }
});

app.onMessage("page_open", () => {
  try { draw(); } catch (e) { console.error("memory: " + String((e && e.stack) || e)); }
});

app.onMessage("shutdown", () => {
  try {
    if (closeTimer) { clearInterval(closeTimer); closeTimer = null; }
    app.save("lang", lang);
    if (best !== null) app.save("best", best);
  } catch (e) { console.error("memory: " + String((e && e.stack) || e)); }
});

newGame();
draw();
