// Tetris (Bloklar) — a mini game plugin for Fenn, the floating notch for Windows.
// Live mode: 10x18 canvas board, next-piece preview, on-screen buttons and
// keyboard (arrows / WASD / Space / Enter / Escape). Score, best and language
// persist in FENN_DATA_DIR via app.load / app.save.
"use strict";

const fenn = require("./fenn");
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
    readyTitle: "Ready?",
    readyHint: "Press Start or Enter",
    pausedTitle: "Paused",
    pausedHint: "Space or Resume continues",
    overTitle: "Game over",
    overHint: "Restart or Enter plays again",
    langTip: "Switch language (Türkçe)",
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
    readyTitle: "Hazır mısın?",
    readyHint: "Başlat'a veya Enter'a bas",
    pausedTitle: "Duraklatıldı",
    pausedHint: "Space veya Devam ile sürdür",
    overTitle: "Oyun bitti",
    overHint: "Yeniden başlat veya Enter",
    langTip: "Dil değiştir (English)",
    keysHint: "←→: hareket · ↑/W: döndür · ↓: yavaş düşür · Space: hızlı düşür · Esc: duraklat",
  },
};

const sysLang = String(Intl.DateTimeFormat().resolvedOptions().locale || "en")
  .toLowerCase().startsWith("tr") ? "tr" : "en";
let lang = app.load("lang", sysLang);
if (lang !== "tr" && lang !== "en") lang = sysLang;
const t = (k) => (T[lang] && T[lang][k] !== undefined ? T[lang][k] : T.en[k] !== undefined ? T.en[k] : k);

// ---------------------------------------------------------------- pieces
const COLS = 10;
const ROWS = 18;
const CELL = 12;
const BOARD_W = COLS * CELL; // 120
const BOARD_H = ROWS * CELL; // 216

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
let cur = null; // { cells, x, y, color }
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

function cellRect(x, y, color) {
  return fenn.shape.rect(x * CELL + 1.5, y * CELL + 1.5, CELL - 3, CELL - 3, { radius: 3, fill: color });
}

function boardShapes() {
  const s = [];
  s.push(fenn.shape.rect(0, 0, BOARD_W, BOARD_H, { radius: 8, fill: "transparent", stroke: "faint", width: 1 }));
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] !== null) s.push(cellRect(x, y, board[y][x]));
    }
  }
  if (cur && state.screen !== "over") {
    let gy = cur.y; // ghost: where the piece would land
    while (fits(cur.cells, cur.x, gy + 1)) gy++;
    if (gy !== cur.y) {
      for (const [cx, cy] of cur.cells) {
        if (gy + cy >= 0) {
          s.push(fenn.shape.rect((cur.x + cx) * CELL + 1.5, (gy + cy) * CELL + 1.5, CELL - 3, CELL - 3, {
            radius: 3, stroke: cur.color, width: 1,
          }));
        }
      }
    }
    for (const [cx, cy] of cur.cells) {
      if (cur.y + cy >= 0) s.push(cellRect(cur.x + cx, cur.y + cy, cur.color));
    }
  }
  if (state.screen !== "playing") {
    s.push(fenn.shape.rect(0, 0, BOARD_W, BOARD_H, { radius: 8, fill: "#0F172AB8" }));
    let title = t("readyTitle");
    let hint = t("readyHint");
    if (state.screen === "paused") {
      title = t("pausedTitle");
      hint = t("pausedHint");
    } else if (state.screen === "over") {
      title = t("overTitle");
      hint = t("overHint");
    }
    s.push(fenn.shape.text(BOARD_W / 2, BOARD_H / 2 - 30, title, { size: 17, color: "white", anchor: "center", bold: true }));
    if (state.screen === "over") {
      s.push(fenn.shape.text(BOARD_W / 2, BOARD_H / 2 - 2, `${t("score")}: ${state.score}`, { size: 12, color: "white", anchor: "center" }));
      s.push(fenn.shape.text(BOARD_W / 2, BOARD_H / 2 + 14, `${t("best")}: ${state.best}`, { size: 12, color: "white", anchor: "center" }));
    }
    s.push(fenn.shape.text(BOARD_W / 2, BOARD_H / 2 + (state.screen === "over" ? 38 : -2), hint, { size: 11, color: "white", anchor: "center" }));
  }
  return s;
}

function previewShapes() {
  const P = 48; // 4x4 cells at 12 pt
  const s = [fenn.shape.rect(0, 0, P, P, { radius: 8, fill: "transparent", stroke: "faint", width: 1 })];
  const def = SHAPES[nextType];
  if (def) {
    const xs = def.cells.map(([x]) => x);
    const ys = def.cells.map(([, y]) => y);
    const w = Math.max(...xs) - Math.min(...xs) + 1;
    const h = Math.max(...ys) - Math.min(...ys) + 1;
    const ox = (P / CELL - w) / 2 - Math.min(...xs);
    const oy = (P / CELL - h) / 2 - Math.min(...ys);
    for (const [cx, cy] of def.cells) {
      s.push(fenn.shape.rect((cx + ox) * CELL + 1.5, (cy + oy) * CELL + 1.5, CELL - 3, CELL - 3, {
        radius: 3, fill: def.color,
      }));
    }
  }
  return s;
}

function pageView() {
  const startLabel = state.screen === "paused" ? t("resume") : t("start");
  return fenn.column([
    fenn.row([
      fenn.text(statusLabel(), { size: "title" }),
      fenn.spacer(),
      fenn.text(`${t("score")}: ${state.score}`, { size: "body", color: "dim" }),
      fenn.text(`${t("best")}: ${state.best}`, { size: "body", color: "faint" }),
      fenn.button("lang", { icon: "translate", tooltip: t("langTip") }),
    ], { gap: 10, align: "center" }),
    fenn.row([
      fenn.canvas(BOARD_H, boardShapes(), { width: BOARD_W, id: "board", keys: true }),
      fenn.column([
        fenn.row([
          fenn.column([
            fenn.text(t("next"), { size: "small", color: "dim" }),
            fenn.canvas(48, previewShapes(), { width: 48 }),
          ], { gap: 4 }),
          fenn.column([
            fenn.text(`${t("level")}: ${state.level}`, { size: "body" }),
            fenn.text(`${t("lines")}: ${state.lines}`, { size: "body", color: "dim" }),
          ], { gap: 6 }),
          fenn.spacer(),
          fenn.column([
            fenn.button("rotate", { icon: "arrows-clockwise", label: t("rotate") }),
            fenn.button("drop", { icon: "lightning", label: t("drop") }),
          ], { gap: 4 }),
        ], { gap: 14, align: "start" }),
        fenn.column([
          fenn.row([fenn.button("up", { icon: "caret-up" })], { align: "center" }),
          fenn.row([
            fenn.button("left", { icon: "caret-left" }),
            fenn.button("down", { icon: "caret-down" }),
            fenn.button("right", { icon: "caret-right" }),
          ], { gap: 4 }),
        ], { gap: 4, align: "center" }),
        fenn.row([
          fenn.button("start", { icon: "play", label: startLabel, primary: true }),
          fenn.button("pause", { icon: "pause", label: t("pause") }),
          fenn.button("restart", { icon: "arrow-clockwise", label: t("restart") }),
        ], { gap: 6 }),
        fenn.text(t("keysHint"), { size: "small", color: "faint", wrap: true }),
      ], { gap: 8 }),
    ], { gap: 14, align: "start" }),
  ], { gap: 8, scroll: true });
}

let lastTileKey = null;
function draw(force) {
  const key = `${lang}|${state.screen}|${state.score}|${state.best}`;
  if (force || key !== lastTileKey) {
    lastTileKey = key;
    app.setTile(tileView());
  }
  app.setPage(pageView());
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
  // Board clicks are ignored: the buttons and keyboard drive the game.
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
app.on("rotate", () => {
  if (rotate()) draw();
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
  draw();
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
