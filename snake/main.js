// Snake (Yılan) — a mini game plugin for Fenn, the floating notch for Windows.
// Live mode: a big 12x12 canvas board on the left (the cell fills the page
// height) and a tight vertical panel on the right (score cards, a 2x2 button
// D-pad, action buttons). Score and language persist in FENN_DATA_DIR via
// app.load / app.save.
//
// Layout, top-packed, no spacers, no justify (page 680x440 -> content 648x372):
// main row = board 372 | panel 170. Height budget: 372 <= 372.
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
    start: "Start",
    resume: "Resume",
    pause: "Pause",
    restart: "Restart",
    readyTitle: "Ready?",
    readyHint: "Press Start or Enter",
    pausedTitle: "Paused",
    pausedHint: "Space or Resume continues",
    overTitle: "Game over",
    overHint: "Restart or Enter plays again",
    langTip: "Switch language (Türkçe)",
    padTip: "Arrow keys",
    dirUp: "Up",
    dirDown: "Down",
    dirLeft: "Left",
    dirRight: "Right",
    keysHint: "Arrows / WASD: move · Space: pause · Enter: restart",
  },
  tr: {
    ready: "Hazır",
    playing: "Oynanıyor",
    paused: "Duraklatıldı",
    over: "Oyun bitti",
    score: "Skor",
    best: "Rekor",
    start: "Başlat",
    resume: "Devam",
    pause: "Duraklat",
    restart: "Yeniden başlat",
    readyTitle: "Hazır mısın?",
    readyHint: "Başlat'a veya Enter'a bas",
    pausedTitle: "Duraklatıldı",
    pausedHint: "Space veya Devam ile sürdür",
    overTitle: "Oyun bitti",
    overHint: "Yeniden başlat veya Enter",
    langTip: "Dil değiştir (English)",
    padTip: "Yön tuşları",
    dirUp: "Yukarı",
    dirDown: "Aşağı",
    dirLeft: "Sol",
    dirRight: "Sağ",
    keysHint: "Oklar / WASD: hareket · Space: duraklat · Enter: yeniden başlat",
  },
};

const sysLang = String(Intl.DateTimeFormat().resolvedOptions().locale || "en")
  .toLowerCase().startsWith("tr") ? "tr" : "en";
let lang = app.load("lang", sysLang);
if (lang !== "tr" && lang !== "en") lang = sysLang;
const t = (k) => (T[lang] && T[lang][k] !== undefined ? T[lang][k] : T.en[k] !== undefined ? T.en[k] : k);

// ---------------------------------------------------------------- geometry
const GRID = 12;
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
// (12 x 31 = 372 at full size) and never overflows the width.
function cellSize() {
  const byH = Math.floor(pageH / GRID);
  const byW = Math.floor((pageW - PANEL_W - MAIN_GAP) / GRID);
  return Math.max(12, Math.min(32, byH, byW));
}
function boardSize() {
  return cellSize() * GRID;
}

// ---------------------------------------------------------------- state
const state = {
  screen: "menu", // menu | playing | paused | over
  score: 0,
  best: Math.max(0, Math.floor(Number(app.load("best", 0)) || 0)),
};

let snake = [];
let dir = { x: 1, y: 0 };
let turns = []; // queued direction changes, applied one per tick
let food = { x: 7, y: 6 };

function resetBoard() {
  snake = [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }];
  dir = { x: 1, y: 0 };
  turns = [];
  state.score = 0;
  placeFood();
}

function placeFood() {
  const free = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
    }
  }
  if (!free.length) return false; // board full: the player won
  food = free[Math.floor(Math.random() * free.length)];
  return true;
}

function saveBest() {
  if (state.score > state.best) {
    state.best = state.score;
    app.save("best", state.best);
  }
}

// ---------------------------------------------------------------- game loop
let timer = null;
let loopMs = 0;

// Faster as the snake grows: 8 fps down to about 15 fps.
function tickMs() {
  return Math.max(65, 125 - Math.max(0, snake.length - 3) * 4);
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
  step();
  draw();
}

function step() {
  if (turns.length) dir = turns.shift();
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) return gameOver();
  const eats = head.x === food.x && head.y === food.y;
  const body = eats ? snake : snake.slice(0, -1); // the tail moves away
  if (body.some((s) => s.x === head.x && s.y === head.y)) return gameOver();
  snake.unshift(head);
  if (eats) {
    state.score += 10;
    if (!placeFood()) {
      state.score += 50; // filled the whole board
      gameOver();
    }
  } else {
    snake.pop();
  }
}

function gameOver() {
  state.screen = "over";
  stopLoop();
  saveBest();
}

// ---------------------------------------------------------------- actions
function newGame() {
  resetBoard();
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

function turn(x, y) {
  if (state.screen !== "playing") return;
  const last = turns.length ? turns[turns.length - 1] : dir;
  if (x === last.x && y === last.y) return;
  if (x === -last.x && y === -last.y) return; // no 180° turns
  if (turns.length >= 2) return;
  turns.push({ x, y });
  draw();
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
    fenn.icon("game-controller", { size: 18, color: "accent" }),
    fenn.text(String(state.score), { size: "huge", bold: true }),
    fenn.text(`${t("best")} ${state.best}`, { size: "small", color: "faint" }),
    fenn.text(statusLabel(), { size: "small", color: "dim" }),
  ], { gap: 2, align: "center", justify: "center" });
}

function boardShapes() {
  const cell = cellSize();
  const board = GRID * cell;
  const s = [];
  s.push(fenn.shape.rect(0, 0, board, board, { radius: 12, fill: "transparent", stroke: "faint", width: 1 }));
  s.push(fenn.shape.circle(food.x * cell + cell / 2, food.y * cell + cell / 2, cell / 2 - 3.5, { fill: "#EF4444" }));
  for (let i = snake.length - 1; i >= 0; i--) {
    const seg = snake[i];
    s.push(fenn.shape.rect(seg.x * cell + 2, seg.y * cell + 2, cell - 4, cell - 4, {
      radius: 7,
      fill: i === 0 ? "#4ADE80" : "#22C55E",
    }));
  }
  if (state.screen !== "playing") {
    s.push(fenn.shape.rect(0, 0, board, board, { radius: 12, fill: "#0F172AB8" }));
    const cx = board / 2;
    let title = t("readyTitle");
    let hint = t("readyHint");
    if (state.screen === "paused") {
      title = t("pausedTitle");
      hint = t("pausedHint");
    } else if (state.screen === "over") {
      title = t("overTitle");
      hint = t("overHint");
    }
    s.push(fenn.shape.text(cx, board / 2 - cell * 0.85, title, { size: Math.round(cell * 0.95), color: "white", anchor: "center", bold: true }));
    if (state.screen === "over") {
      s.push(fenn.shape.text(cx, board / 2 + cell * 0.15, `${t("score")}: ${state.score}   ·   ${t("best")}: ${state.best}`, { size: Math.round(cell * 0.55), color: "white", anchor: "center" }));
    }
    s.push(fenn.shape.text(cx, board / 2 + cell * (state.screen === "over" ? 1.2 : 0.5), hint, { size: Math.round(cell * 0.5), color: "white", anchor: "center" }));
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
    fenn.row([btn("up", "caret-up", t("dirUp")), btn("down", "caret-down", t("dirDown"))], { gap: 8 }),
    fenn.row([btn("left", "caret-left", t("dirLeft")), btn("right", "caret-right", t("dirRight"))], { gap: 8 }),
  ], { gap: 8, tooltip: t("padTip") });
}

function panelView() {
  const startLabel = state.screen === "paused" ? t("resume") : t("start");
  // Height budget (page_size [680, 440]; content = 440 - 68 = 372 pt):
  //   stats card 56 + gap 9 + d-pad 72 + gap 9 + actions 112 + gap 9
  //   + keys hint 54 = 321 <= 372  (top-packed; the board fills the rest)
  return fenn.column([
    fenn.card([
      fenn.grid(2, [statCell(t("score"), state.score), statCell(t("best"), state.best)], { gap: 8 }),
    ], { padding: 8 }),
    padView(),
    fenn.column([
      fenn.button("start", { icon: "play", label: startLabel, primary: true, width: BTN_W }),
      fenn.button("pause", { icon: "pause", label: t("pause"), width: BTN_W }),
      fenn.button("restart", { icon: "arrow-clockwise", label: t("restart"), width: BTN_W }),
    ], { gap: 8 }),
    fenn.text(t("keysHint"), { size: "small", color: "faint", wrap: true }),
  ], { gap: GAP });
}

function pageView() {
  return fenn.row([
    fenn.canvas(boardSize(), boardShapes(), { width: boardSize(), id: "board", keys: true }),
    panelView(),
  ], { gap: MAIN_GAP, align: "start" });
}

let lastTileKey = null;
function draw(force) {
  const key = `${lang}|${state.screen}|${state.score}|${state.best}`;
  if (force || key !== lastTileKey) {
    lastTileKey = key;
    app.setTile(tileView());
  }
  app.setPage(pageView(), [{ id: "lang", icon: "translate", tooltip: t("langTip") }]);
  ensureLoop(); // the snake speeds up as it grows
}

// ---------------------------------------------------------------- events
function onKey(value) {
  const k = String((value && value.key) || "");
  const dirs = {
    Up: [0, -1], W: [0, -1],
    Down: [0, 1], S: [0, 1],
    Left: [-1, 0], A: [-1, 0],
    Right: [1, 0], D: [1, 0],
  };
  if (dirs[k]) {
    turn(dirs[k][0], dirs[k][1]);
    return;
  }
  if (k === "Enter") {
    newGame();
    return;
  }
  if (k === "Space" || k === "Escape") {
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

app.on("up", () => turn(0, -1));
app.on("down", () => turn(0, 1));
app.on("left", () => turn(-1, 0));
app.on("right", () => turn(1, 0));
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
resetBoard();
draw();
