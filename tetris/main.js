// Tetris (Bloklar) — a mini game plugin for Fenn, the floating notch for Windows.
// Live mode: a big 10x18 canvas board on the left (20 pt cells, the cell fills
// the page height) and a tight vertical panel on the right (score cards, a
// next-piece preview, a 2x2 button D-pad with hard drop, action buttons).
// Score, best and language persist in FENN_DATA_DIR via app.load / app.save.
//
// Layout, top-packed, no spacers, no justify (page 680x440 -> content 648x372):
// main row = board 200x360 | panel 170. Height budget: 360 <= 372.
"use strict";

const fenn = require("./fenn");
// Fenn 0.4.0 uyumluluk: `row` + align:"center" satiri dikey yayiyor; varsayilan hizalama sikipaketler.
const _row = fenn.row;
fenn.row = (c, o = {}) => {
  if (o.align === "center") { const { align, ...rest } = o; return _row(c, rest); }
  return _row(c, o);
};
const app = new fenn.Plugin();

// ---------------------------------------------------------------- i18n
const T = {
  en: {
    ready: "Ready",
    playing: "Playing",
    paused: "Paused",
    over: "Game over",
    score: "Score",
    best: "Best",
    level: "Level",
    lines: "Lines",
    next: "Next",
    start: "Start",
    resume: "Resume",
    pause: "Pause",
    restart: "Restart",
    rotate: "Rotate",
    drop: "Drop",
    softDrop: "Soft drop",
    readyTitle: "Ready?",
    readyHint: "Press Start or Enter",
    pausedTitle: "Paused",
    pausedHint: "Space or Resume continues",
    overTitle: "Game over",
    overHint: "Restart or Enter plays again",
    langTip: "Switch language (Türkçe)",
    padTip: "Move · rotate",
    dirLeft: "Left",
    dirRight: "Right",
    keysHint: "←→: move · ↑/W: rotate · ↓: soft drop · Space: hard drop · Esc: pause",
  },
  tr: {
    ready: "Hazır",
    playing: "Oynanıyor",
    paused: "Duraklatıldı",
    over: "Oyun bitti",
    score: "Skor",
    best: "Rekor",
    level: "Seviye",
    lines: "Satır",
    next: "Sonraki",
    start: "Başlat",
    resume: "Devam",
    pause: "Duraklat",
    restart: "Yeniden başlat",
    rotate: "Döndür",
    drop: "Bırak",
    softDrop: "Yavaş düşür",
    readyTitle: "Hazır mısın?",
    readyHint: "Başlat'a veya Enter'a bas",
    pausedTitle: "Duraklatıldı",
    pausedHint: "Space veya Devam ile sürdür",
    overTitle: "Oyun bitti",
    overHint: "Yeniden başlat veya Enter",
    langTip: "Dil değiştir (English)",
    padTip: "Hareket · döndür",
    dirLeft: "Sol",
    dirRight: "Sağ",
    keysHint: "←→: hareket · ↑/W: döndür · ↓: yavaş düşür · Space: hızlı düşür · Esc: duraklat",
  },
};

const sysLang = String(Intl.DateTimeFormat().resolvedOptions().locale || "en")
  .toLowerCase().startsWith("tr") ? "tr" : "en";
let lang = app.load("lang", sysLang);
if (lang !== "tr" && lang !== "en") lang = sysLang;
const t = (k) => (T[lang] && T[lang][k] !== undefined ? T[lang][k] : T.en[k] !== undefined ? T.en[k] : k);

// ---------------------------------------------------------------- geometry
const COLS = 10;
const ROWS = 18;
const GAP = 9;       // side panel stack gap
const MAIN_GAP = 10; // board | panel
const PANEL_W = 170;
const BTN_W = 140;   // action buttons: one column, never wrapping
const PAD_BTN = 40;  // d-pad buttons (~40x32 pt)

// The room the view has, in points. Fenn reports it in `layout`; until then
// assume page_size [680, 440] minus Fenn's chrome (32 wide, 68 tall).
let pageW = 648;
let pageH = 372;

// Board cell: the board is the flexible element, so it fills the page height
// (18 x 20 = 360 at full size; 21 would be 378 > 372) and never overflows the
// width. The next-piece preview uses the same cell.
function cellSize() {
  const byH = Math.floor(pageH / ROWS);
  const byW = Math.floor((pageW - PANEL_W - MAIN_GAP) / COLS);
  return Math.max(8, Math.min(22, byH, byW));
}

// ---------------------------------------------------------------- pieces
const SHAPES = {
  I: { color: "#22D3EE", size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { color: "#FACC15", size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { color: "#A855F7", size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { color: "#22C55E", size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { color: "#EF4444", size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { color: "#3B82F6", size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { color: "#F97316", size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

const state = {
  screen: "menu", // menu | playing | paused | over
  score: 0,
  best: Math.max(0, Math.floor(Number(app.load("best", 0)) || 0)),
  level: 1,
  lines: 0,
};

let board = [];
let cur = null; // { cells, x, y, color, size }
let nextType = "T";
let bag = [];

function emptyBoard() {
  board = [];
  for (let y = 0; y < ROWS; y++) board.push(new Array(COLS).fill(null));
}

function takeFromBag() {
  if (!bag.length) {
    bag = Object.keys(SHAPES);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = bag[i];
      bag[i] = bag[j];
      bag[j] = tmp;
    }
  }
  return bag.pop();
}

function rotateCells(cells, size) {
  return cells.map(([x, y]) => [size - 1 - y, x]); // clockwise
}

function fits(cells, px, py) {
  for (const [cx, cy] of cells) {
    const x = px + cx;
    const y = py + cy;
    if (x < 0 || x >= COLS || y >= ROWS) return false;
    if (y >= 0 && board[y][x] !== null) return false;
  }
  return true;
}

function spawn() {
  const type = nextType;
  nextType = takeFromBag();
  const def = SHAPES[type];
  cur = {
    cells: def.cells.map(([x, y]) => [x, y]),
    x: Math.floor((COLS - def.size) / 2),
    y: 0,
    color: def.color,
    size: def.size,
  };
  if (!fits(cur.cells, cur.x, cur.y)) gameOver();
}

function clearLines() {
  let n = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every((c) => c !== null)) {
      board.splice(y, 1);
      board.unshift(new Array(COLS).fill(null));
      n++;
      y++;
    }
  }
  if (n > 0) {
    state.score += [0, 100, 300, 500, 800][n] * state.level;
    state.lines += n;
    state.level = Math.floor(state.lines / 10) + 1;
  }
}

function lockAndSpawn() {
  for (const [cx, cy] of cur.cells) {
    const x = cur.x + cx;
    const y = cur.y + cy;
    if (y < 0) return gameOver(); // locked above the board
    board[y][x] = cur.color;
  }
  clearLines();
  spawn();
}

function saveBest() {
  if (state.score > state.best) {
    state.best = state.score;
    app.save("best", state.best);
  }
}

function gameOver() {
  state.screen = "over";
  stopLoop();
  saveBest();
}

// ---------------------------------------------------------------- game loop
let timer = null;
let loopMs = 0;

// One level every 10 lines: 750 ms per row down to about 90 ms.
function tickMs() {
  return Math.max(90, 750 - (state.level - 1) * 70);
}

function stopLoop() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

function startLoop() {
  stopLoop();
  if (state.screen !== "playing") return;
  loopMs = tickMs();
  timer = setInterval(loopStep, loopMs);
}

function ensureLoop() {
  if (state.screen !== "playing") {
    stopLoop();
  } else if (timer === null || tickMs() !== loopMs) {
    startLoop();
  }
}

function loopStep() {
  if (fits(cur.cells, cur.x, cur.y + 1)) {
    cur.y += 1;
  } else {
    lockAndSpawn();
  }
  draw();
}

// ---------------------------------------------------------------- actions
function newGame() {
  emptyBoard();
  state.score = 0;
  state.level = 1;
  state.lines = 0;
  bag = [];
  spawn();
  state.screen = "playing";
  startLoop();
  draw();
}

function pauseGame() {
  state.screen = "paused";
  stopLoop();
  draw();
}

function resumeGame() {
  state.screen = "playing";
  startLoop();
  draw();
}

function startOrResume() {
  if (state.screen === "playing") return;
  if (state.screen === "paused") resumeGame();
  else newGame();
}

function togglePause() {
  if (state.screen === "playing") pauseGame();
  else if (state.screen === "paused") resumeGame();
  else newGame();
}

function move(dx) {
  if (state.screen !== "playing" || !cur) return false;
  if (!fits(cur.cells, cur.x + dx, cur.y)) return false;
  cur.x += dx;
  return true;
}

function softDrop() {
  if (state.screen !== "playing" || !cur) return false;
  if (!fits(cur.cells, cur.x, cur.y + 1)) return false;
  cur.y += 1;
  state.score += 1;
  return true;
}

function hardDrop() {
  if (state.screen !== "playing" || !cur) return;
  let moved = 0;
  while (fits(cur.cells, cur.x, cur.y + 1)) {
    cur.y += 1;
    moved++;
  }
  state.score += 2 * moved;
  lockAndSpawn();
  draw();
}

function rotate() {
  if (state.screen !== "playing" || !cur) return false;
  const rotated = rotateCells(cur.cells, cur.size);
  for (const dx of [0, -1, 1, -2, 2]) {
    if (fits(rotated, cur.x + dx, cur.y)) {
      cur.cells = rotated;
      cur.x += dx;
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- views
function statusLabel() {
  if (state.screen === "playing") return t("playing");
  if (state.screen === "paused") return t("paused");
  if (state.screen === "over") return t("over");
  return t("ready");
}

function tileView() {
  return fenn.column([
    fenn.icon("squares-four", { size: 18, color: "accent" }),
    fenn.text(String(state.score), { size: "huge", bold: true }),
    fenn.text(`${t("best")} ${state.best}`, { size: "small", color: "faint" }),
    fenn.text(statusLabel(), { size: "small", color: "dim" }),
  ], { gap: 2, align: "center", justify: "center" });
}

function cellRect(x, y, cell, color) {
  return fenn.shape.rect(x * cell + 2, y * cell + 2, cell - 4, cell - 4, { radius: 5, fill: color });
}

function boardShapes() {
  const cell = cellSize();
  const w = COLS * cell;
  const h = ROWS * cell;
  const s = [];
  s.push(fenn.shape.rect(0, 0, w, h, { radius: 10, fill: "transparent", stroke: "faint", width: 1 }));
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] !== null) s.push(cellRect(x, y, cell, board[y][x]));
    }
  }
  if (cur && state.screen !== "over") {
    let gy = cur.y; // ghost: where the piece would land
    while (fits(cur.cells, cur.x, gy + 1)) gy++;
    if (gy !== cur.y) {
      for (const [cx, cy] of cur.cells) {
        if (gy + cy >= 0) {
          s.push(fenn.shape.rect((cur.x + cx) * cell + 2, (gy + cy) * cell + 2, cell - 4, cell - 4, {
            radius: 5, stroke: cur.color, width: 1,
          }));
        }
      }
    }
    for (const [cx, cy] of cur.cells) {
      if (cur.y + cy >= 0) s.push(cellRect(cur.x + cx, cur.y + cy, cell, cur.color));
    }
  }
  if (state.screen !== "playing") {
    s.push(fenn.shape.rect(0, 0, w, h, { radius: 10, fill: "#0F172AB8" }));
    const cx = w / 2;
    let title = t("readyTitle");
    let hint = t("readyHint");
    if (state.screen === "paused") {
      title = t("pausedTitle");
      hint = t("pausedHint");
    } else if (state.screen === "over") {
      title = t("overTitle");
      hint = t("overHint");
    }
    s.push(fenn.shape.text(cx, h / 2 - cell * 1.5, title, { size: Math.round(cell * 0.9), color: "white", anchor: "center", bold: true }));
    if (state.screen === "over") {
      s.push(fenn.shape.text(cx, h / 2 - cell * 0.1, `${t("score")}: ${state.score}   ·   ${t("best")}: ${state.best}`, { size: Math.round(cell * 0.6), color: "white", anchor: "center" }));
    }
    s.push(fenn.shape.text(cx, h / 2 + cell * (state.screen === "over" ? 1.9 : -0.1), hint, { size: Math.round(cell * 0.55), color: "white", anchor: "center" }));
  }
  return s;
}

function previewShapes() {
  const cell = cellSize();
  const P = cell * 4;
  const s = [fenn.shape.rect(0, 0, P, P, { radius: 10, fill: "transparent", stroke: "faint", width: 1 })];
  const def = SHAPES[nextType];
  if (def) {
    const xs = def.cells.map(([x]) => x);
    const ys = def.cells.map(([, y]) => y);
    const bw = Math.max(...xs) - Math.min(...xs) + 1;
    const bh = Math.max(...ys) - Math.min(...ys) + 1;
    const ox = (4 - bw) / 2 - Math.min(...xs);
    const oy = (4 - bh) / 2 - Math.min(...ys);
    for (const [cx, cy] of def.cells) {
      s.push(fenn.shape.rect((cx + ox) * cell + 2, (cy + oy) * cell + 2, cell - 4, cell - 4, {
        radius: 5, fill: def.color,
      }));
    }
  }
  return s;
}

function statCell(label, value) {
  return fenn.column([
    fenn.text(label, { size: "small", color: "dim" }),
    fenn.text(String(value), { size: "title", bold: true }),
  ], { gap: 0, align: "center" });
}

function padView() {
  const btn = (id, icon, tip) => fenn.button(id, { icon, width: PAD_BTN, tooltip: tip });
  return fenn.column([
    fenn.row([btn("up", "caret-up", t("rotate")), btn("down", "caret-down", t("softDrop"))], { gap: 8 }),
    fenn.row([btn("left", "caret-left", t("dirLeft")), btn("right", "caret-right", t("dirRight"))], { gap: 8 }),
  ], { gap: 8, tooltip: t("padTip") });
}

function panelView() {
  const startLabel = state.screen === "paused" ? t("resume") : t("start");
  // Height budget (page_size [680, 440]; content = 440 - 68 = 372 pt):
  //   stats card 56 + gap 9 + next row 80 + gap 9 + pad row 72 + gap 9
  //   + actions 112 = 347 <= 372  (top-packed; the board fills the page)
  return fenn.column([
    fenn.card([
      fenn.grid(3, [
        statCell(t("score"), state.score),
        statCell(t("best"), state.best),
        statCell(t("level"), state.level),
      ], { gap: 6 }),
    ], { padding: 8 }),
    fenn.row([
      fenn.canvas(cellSize() * 4, previewShapes(), { width: cellSize() * 4, tooltip: t("next") }),
      fenn.column([
        fenn.text(t("next"), { size: "small", color: "dim" }),
        fenn.text(`${t("lines")}: ${state.lines}`, { size: "small", color: "faint" }),
      ], { gap: 2 }),
    ], { gap: 8, align: "center" }),
    fenn.row([
      padView(),
      fenn.button("drop", { icon: "lightning", width: PAD_BTN, tooltip: t("drop") }),
    ], { gap: 8, align: "center" }),
    fenn.column([
      fenn.button("start", { icon: "play", label: startLabel, primary: true, width: BTN_W }),
      fenn.button("pause", { icon: "pause", label: t("pause"), width: BTN_W }),
      fenn.button("restart", { icon: "arrow-clockwise", label: t("restart"), width: BTN_W }),
    ], { gap: 8 }),
  ], { gap: GAP });
}

function pageView() {
  const cell = cellSize();
  return fenn.row([
    fenn.canvas(ROWS * cell, boardShapes(), {
      width: COLS * cell, id: "board", keys: true, tooltip: t("keysHint"),
    }),
    panelView(),
  ], { gap: MAIN_GAP, align: "start" });
}

let lastTileKey = null;
function draw(force) {
  const key = `${lang}|${state.screen}|${state.score}|${state.best}|${state.level}|${state.lines}`;
  if (force || key !== lastTileKey) {
    lastTileKey = key;
    app.setTile(tileView());
  }
  app.setPage(pageView(), [{ id: "lang", icon: "translate", tooltip: t("langTip") }]);
  ensureLoop(); // level-ups change the fall speed
}

// ---------------------------------------------------------------- events
function onKey(value) {
  const k = String((value && value.key) || "");
  if (k === "Left" || k === "A") {
    if (move(-1)) draw();
    return;
  }
  if (k === "Right" || k === "D") {
    if (move(1)) draw();
    return;
  }
  if (k === "Down" || k === "S") {
    if (softDrop()) draw();
    return;
  }
  if (k === "Up" || k === "W") {
    if (rotate()) draw();
    return;
  }
  if (k === "Space") {
    hardDrop();
    return;
  }
  if (k === "Enter") {
    newGame();
    return;
  }
  if (k === "Escape") {
    togglePause();
    return;
  }
  // Unknown keys are ignored.
}

app.on("board", (e) => {
  if (!e || typeof e !== "object") return;
  if (e.kind === "key") onKey(e.value);
  // Board clicks are ignored: the pad and keyboard drive the game.
});

app.on("up", () => {
  if (rotate()) draw();
});
app.on("down", () => {
  if (softDrop()) draw();
});
app.on("left", () => {
  if (move(-1)) draw();
});
app.on("right", () => {
  if (move(1)) draw();
});
app.on("drop", () => hardDrop());
app.on("start", () => startOrResume());
app.on("pause", () => {
  if (state.screen === "playing" || state.screen === "paused") togglePause();
});
app.on("restart", () => newGame());
app.on("lang", () => {
  lang = lang === "tr" ? "en" : "tr";
  app.save("lang", lang);
  draw(true);
});

app.onMessage("layout", (m) => {
  // The room the page gives us: the board fills it.
  if (!m || m.target !== "page") return;
  const w = Number(m.width);
  const h = Number(m.height);
  if (!(w > 0) || !(h > 0)) return;
  if (w !== pageW || h !== pageH) {
    pageW = w;
    pageH = h;
    draw(true);
  }
});

app.onMessage("theme", () => {
  // Theme colors resolve at draw time: send a fresh tree.
  draw(true);
});

app.onMessage("page_close", () => {
  // Nobody is watching the page: pause instead of ticking for nothing.
  if (state.screen === "playing") pauseGame();
});

app.onMessage("shutdown", () => {
  stopLoop();
  saveBest();
  app.save("lang", lang);
});

// ---------------------------------------------------------------- start
emptyBoard();
spawn();
draw();
