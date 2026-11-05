// 15 Puzzle · Bulmaca — sliding tile puzzle for Fenn, the floating notch for Windows.
// Live plugin: one draw() builds the whole tree from state. Event driven only:
// no intervals — the clock is computed at every draw (moves and controls).
//
// Layout, top-packed, no spacers, no justify (page 568x380 -> content 536x312):
// main row = board 304 | side column 222. Height budget: 304 <= 312.
"use strict";

const fenn = require("./fenn");
// Fenn 0.4.0 uyumluluk: `row` + align:"center" satiri dikey yayiyor; varsayilan hizalama sikipaketler.
const _row = fenn.row;
fenn.row = (c, o = {}) => {
  if (o.align === "center") { const { align, ...rest } = o; return _row(c, rest); }
  return _row(c, o);
};
const app = new fenn.Plugin();

// ---- Strings (TR + EN) -------------------------------------------------

const T = {
  tr: {
    moves: "Hamle",
    time: "Süre",
    best: "En iyi",
    shuffle: "Karıştır",
    move: "Yön",
    keysHint: "Oklar / WASD · Enter: karıştır",
    clickHint: "Karo tıkla veya oklarla kaydır",
    ready: "Karıştır ve başla",
    playing: "Hamleni yap",
    solved: "Tebrikler!",
    solvedLine: "Tebrikler!",
    solvedHint: "Karıştır ile yeni oyun",
    noBest: "—",
    newRecord: "Yeni rekor",
    langTip: "Türkçe / English",
  },
  en: {
    moves: "Moves",
    time: "Time",
    best: "Best",
    shuffle: "Shuffle",
    move: "Move",
    keysHint: "Arrows / WASD · Enter: shuffle",
    clickHint: "Click a tile or slide with the arrows",
    ready: "Shuffle to start",
    playing: "Make a move",
    solved: "Well done!",
    solvedLine: "Well done!",
    solvedHint: "Shuffle for a new game",
    noBest: "—",
    newRecord: "New record",
    langTip: "Türkçe / English",
  },
};

const locale = String(Intl.DateTimeFormat().resolvedOptions().locale || "en").toLowerCase();
let lang = app.load("lang", locale.startsWith("tr") ? "tr" : "en");
if (lang !== "tr" && lang !== "en") lang = "en";
const t = (k) => (k === undefined ? T[lang] : T[lang] && T[lang][k] !== undefined ? T[lang][k] : T.en[k] !== undefined ? T.en[k] : k);

// ---- State -------------------------------------------------------------

const TILE = 75, GAP = 4, CELL = TILE + GAP, BOARD = 4 * TILE + 3 * GAP; // 304 x 304

let board = solvedBoard(); // 16 numbers, 0 is the empty slot
let moves = 0;
let startedAt = null;
let finishedAt = null;
let finished = false;
let newRecord = false;
let best = Number.isFinite(app.load("best", null)) ? app.load("best", null) : null;

function solvedBoard() {
  const b = [];
  for (let i = 1; i <= 15; i++) b.push(i);
  b.push(0);
  return b;
}

function isSolved() {
  for (let i = 0; i < 15; i++) if (board[i] !== i + 1) return false;
  return board[15] === 0;
}

function neighbors(idx) {
  const r = Math.floor(idx / 4), c = idx % 4;
  const out = [];
  if (r > 0) out.push(idx - 4);
  if (r < 3) out.push(idx + 4);
  if (c > 0) out.push(idx - 1);
  if (c < 3) out.push(idx + 1);
  return out;
}

function shuffle() {
  board = solvedBoard();
  let from = -1; // where the blank came from: never step straight back
  for (let i = 0; i < 80; i++) {
    const bi = board.indexOf(0);
    let opts = neighbors(bi).filter((n) => n !== from);
    if (!opts.length) opts = neighbors(bi);
    const pick = opts[Math.floor(Math.random() * opts.length)];
    board[bi] = board[pick];
    board[pick] = 0;
    from = bi;
  }
  if (isSolved()) {
    const bi = board.indexOf(0);
    const pick = neighbors(bi)[0];
    board[bi] = board[pick];
    board[pick] = 0;
  }
}

function newGame() {
  shuffle();
  moves = 0;
  startedAt = null;
  finishedAt = null;
  finished = false;
  newRecord = false;
}

function fmtTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function elapsedMs() {
  if (startedAt === null) return 0;
  return (finishedAt || Date.now()) - startedAt;
}

// ---- Moves -------------------------------------------------------------

function doMove(idx) {
  if (finished) return;
  const bi = board.indexOf(0);
  if (!neighbors(bi).includes(idx)) return;
  board[bi] = board[idx];
  board[idx] = 0;
  moves += 1;
  if (startedAt === null) startedAt = Date.now();
  if (isSolved()) {
    finished = true;
    finishedAt = Date.now();
    if (best === null || moves < best) {
      best = moves;
      newRecord = true;
      app.save("best", best);
    }
  }
  draw();
}

function moveBlank(dx, dy) {
  if (finished) return;
  const bi = board.indexOf(0);
  const r = Math.floor(bi / 4) + dy, c = (bi % 4) + dx;
  if (r < 0 || r > 3 || c < 0 || c > 3) return;
  doMove(r * 4 + c);
}

// ---- Drawing -----------------------------------------------------------

function boardShapes() {
  const s = [];
  for (let i = 0; i < 16; i++) {
    const r = Math.floor(i / 4), c = i % 4;
    const x = c * CELL, y = r * CELL;
    const v = board[i];
    if (v === 0) {
      s.push(fenn.shape.rect(x, y, TILE, TILE, { radius: 12, fill: "transparent", stroke: "faint", width: 1 }));
      continue;
    }
    const home = v === i + 1;
    s.push(fenn.shape.rect(x, y, TILE, TILE, {
      radius: 12,
      fill: finished ? "accent" : "faint",
      stroke: finished ? "accent" : home ? "accent" : "dim",
      width: home && !finished ? 2 : 1,
    }));
    s.push(fenn.shape.text(x + TILE / 2, y + TILE / 2, String(v), {
      size: 26,
      bold: true,
      anchor: "center",
      color: finished ? "on_accent" : home ? "accent" : "text",
    }));
  }
  if (finished) {
    const tt = t();
    s.push(fenn.shape.rect(0, 0, BOARD, BOARD, { radius: 14, fill: "#0F172AB8" }));
    s.push(fenn.shape.icon(BOARD / 2, 82, "confetti", { size: 42, color: "white" }));
    s.push(fenn.shape.text(BOARD / 2, 146, tt.solvedLine, { size: 26, bold: true, color: "white", anchor: "center" }));
    s.push(fenn.shape.text(BOARD / 2, 178,
      moves + " " + tt.moves + " · " + fmtTime(elapsedMs()), { size: 14, color: "white", anchor: "center" }));
    s.push(fenn.shape.text(BOARD / 2, 206, tt.solvedHint, { size: 12, color: "white", anchor: "center" }));
  }
  return s;
}

function statCell(label, value) {
  return fenn.column([
    fenn.text(label, { size: "small", color: "dim" }),
    fenn.text(value, { size: "title" }),
  ], { gap: 0, align: "center" });
}

function statusText() {
  const tt = t();
  if (finished) {
    return (newRecord ? tt.newRecord : tt.solved) + " · " + moves + " " + tt.moves;
  }
  return startedAt === null ? tt.ready : tt.playing;
}

function pageView() {
  const tt = t();
  return fenn.column([
    fenn.row([
      fenn.canvas(BOARD, boardShapes(), { width: BOARD, id: "board", keys: true }),
      fenn.column([
        fenn.card([
          fenn.row([
            fenn.text(statusText(), { size: "body", wrap: true, color: finished ? "accent" : "text" }),
            fenn.button("lang", { icon: "translate", tooltip: tt.langTip }),
          ], { gap: 8, align: "center" }),
          fenn.grid(3, [
            statCell(tt.moves, String(moves)),
            statCell(tt.time, fmtTime(elapsedMs())),
            statCell(tt.best, best === null ? tt.noBest : String(best)),
          ], { gap: 8 }),
        ], { padding: 8, gap: 8 }),
        fenn.card([
          fenn.button("shuffle", { label: tt.shuffle, icon: "shuffle", primary: true, width: 0 }),
          fenn.text(tt.clickHint, { size: "small", color: "faint", wrap: true }),
        ], { padding: 8, gap: 8 }),
        fenn.card([
          fenn.text(tt.move, { size: "small", color: "dim" }),
          fenn.column([
            fenn.row([fenn.button("up", { icon: "caret-up" })], { align: "center" }),
            fenn.row([
              fenn.button("left", { icon: "caret-left" }),
              fenn.button("down", { icon: "caret-down" }),
              fenn.button("right", { icon: "caret-right" }),
            ], { gap: 8 }),
          ], { gap: 8, align: "center" }),
          fenn.text(tt.keysHint, { size: "small", color: "faint", wrap: true }),
        ], { padding: 8, gap: 8 }),
      ], { gap: 8 }),
    ], { gap: 10, align: "start" }),
  ], { gap: 8 });
}

function tileView() {
  const tt = t();
  const size = app.tile.size || "wide";
  const line1 = tt.moves + " " + moves;
  const line2 = fmtTime(elapsedMs());
  if (size === "small") {
    return fenn.column([fenn.text(String(moves), { size: "big" })],
      { align: "center", justify: "center", gap: 0 });
  }
  if (size === "wide") {
    return fenn.row([
      fenn.icon("puzzle-piece", { size: 24, color: "accent" }),
      fenn.column([
        fenn.text(line1, { size: "small", color: "dim" }),
        fenn.text(line2, { size: "title" }),
      ], { gap: 0 }),
    ], { align: "center", gap: 8 });
  }
  return fenn.column([
    fenn.icon("puzzle-piece", { size: 30, color: "accent" }),
    fenn.text(line2, { size: "title" }),
    fenn.text(line1, { size: "small", color: "dim" }),
  ], { align: "center", justify: "center", gap: 4 });
}

function draw() {
  try {
    app.setTile(tileView());
    app.setPage(pageView());
  } catch (e) {
    console.error("puzzle15: draw failed: " + String((e && e.stack) || e));
  }
}

// ---- Events ------------------------------------------------------------

app.on("board", (e) => {
  try {
    if (!e || typeof e !== "object") return;
    if (e.kind === "key") {
      const k = String((e.value && e.value.key) || "");
      const dirs = { Up: [0, -1], W: [0, -1], Down: [0, 1], S: [0, 1], Left: [-1, 0], A: [-1, 0], Right: [1, 0], D: [1, 0] };
      if (dirs[k]) moveBlank(dirs[k][0], dirs[k][1]);
      else if (k === "Enter" || k === "Space") { newGame(); draw(); }
      // Unknown keys are ignored.
      return;
    }
    if (e.kind === "click") {
      const v = e.value || {};
      const x = typeof v.x === "number" ? v.x : -1;
      const y = typeof v.y === "number" ? v.y : -1;
      if (x < 0 || y < 0) return;
      const c = Math.max(0, Math.min(3, Math.floor(x / CELL)));
      const r = Math.max(0, Math.min(3, Math.floor(y / CELL)));
      doMove(r * 4 + c);
    }
  } catch (err) {
    console.error("puzzle15: " + String((err && err.stack) || err));
  }
});

app.on("shuffle", () => {
  try { newGame(); draw(); }
  catch (err) { console.error("puzzle15: " + String((err && err.stack) || err)); }
});
app.on("up", () => { try { moveBlank(0, -1); } catch (err) { console.error("puzzle15: " + String(err)); } });
app.on("down", () => { try { moveBlank(0, 1); } catch (err) { console.error("puzzle15: " + String(err)); } });
app.on("left", () => { try { moveBlank(-1, 0); } catch (err) { console.error("puzzle15: " + String(err)); } });
app.on("right", () => { try { moveBlank(1, 0); } catch (err) { console.error("puzzle15: " + String(err)); } });
app.on("lang", () => {
  try {
    lang = lang === "tr" ? "en" : "tr";
    app.save("lang", lang);
    draw();
  } catch (err) { console.error("puzzle15: " + String((err && err.stack) || err)); }
});

// ---- Lifecycle ---------------------------------------------------------

app.onMessage("theme", () => {
  try { draw(); } catch (e) { console.error("puzzle15: " + String(e)); }
});
app.onMessage("page_open", () => {
  try { draw(); } catch (e) { console.error("puzzle15: " + String(e)); }
});
app.onMessage("shutdown", () => {
  try {
    app.save("lang", lang);
    if (best !== null) app.save("best", best);
  } catch (e) { console.error("puzzle15: " + String(e)); }
});

newGame();
draw();
