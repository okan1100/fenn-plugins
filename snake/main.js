// Snake (Yılan) — a mini game plugin for Fenn, the floating notch for Windows.
// Live mode: canvas board (12x12), on-screen buttons and keyboard (arrows / WASD).
// Score and language persist in FENN_DATA_DIR via app.load / app.save.
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
    start: "Start",
    resume: "Resume",
    pause: "Pause",
    restart: "Restart",
    move: "Move",
    readyTitle: "Ready?",
    readyHint: "Press Start or Enter",
    pausedTitle: "Paused",
    pausedHint: "Space or Resume continues",
    overTitle: "Game over",
    overHint: "Restart or Enter plays again",
    langTip: "Switch language (Türkçe)",
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
    move: "Hareket",
    readyTitle: "Hazır mısın?",
    readyHint: "Başlat'a veya Enter'a bas",
    pausedTitle: "Duraklatıldı",
    pausedHint: "Space veya Devam ile sürdür",
    overTitle: "Oyun bitti",
    overHint: "Yeniden başlat veya Enter",
    langTip: "Dil değiştir (English)",
    keysHint: "Oklar / WASD: hareket · Space: duraklat · Enter: yeniden başlat",
  },
};

const sysLang = String(Intl.DateTimeFormat().resolvedOptions().locale || "en")
  .toLowerCase().startsWith("tr") ? "tr" : "en";
let lang = app.load("lang", sysLang);
if (lang !== "tr" && lang !== "en") lang = sysLang;
const t = (k) => (T[lang] && T[lang][k] !== undefined ? T[lang][k] : T.en[k] !== undefined ? T.en[k] : k);

// ---------------------------------------------------------------- state
const GRID = 12;
const CELL = 18;
const BOARD = GRID * CELL; // 216 x 216 points

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
  const s = [];
  s.push(fenn.shape.rect(0, 0, BOARD, BOARD, { radius: 10, fill: "transparent", stroke: "faint", width: 1 }));
  s.push(fenn.shape.circle(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 3, { fill: "#EF4444" }));
  for (let i = snake.length - 1; i >= 0; i--) {
    const seg = snake[i];
    s.push(fenn.shape.rect(seg.x * CELL + 1.5, seg.y * CELL + 1.5, CELL - 3, CELL - 3, {
      radius: 5,
      fill: i === 0 ? "#4ADE80" : "#22C55E",
    }));
  }
  if (state.screen !== "playing") {
    s.push(fenn.shape.rect(0, 0, BOARD, BOARD, { radius: 10, fill: "#0F172AB8" }));
    let title = t("readyTitle");
    let hint = t("readyHint");
    if (state.screen === "paused") {
      title = t("pausedTitle");
      hint = t("pausedHint");
    } else if (state.screen === "over") {
      title = t("overTitle");
      hint = t("overHint");
    }
    s.push(fenn.shape.text(BOARD / 2, BOARD / 2 - 22, title, { size: 22, color: "white", anchor: "center", bold: true }));
    if (state.screen === "over") {
      s.push(fenn.shape.text(BOARD / 2, BOARD / 2 + 6, `${t("score")}: ${state.score}   ·   ${t("best")}: ${state.best}`, { size: 13, color: "white", anchor: "center" }));
    }
    s.push(fenn.shape.text(BOARD / 2, BOARD / 2 + (state.screen === "over" ? 32 : 12), hint, { size: 12, color: "white", anchor: "center" }));
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
      fenn.canvas(BOARD, boardShapes(), { width: BOARD, id: "board", keys: true }),
      fenn.column([
        fenn.text(t("move"), { size: "small", color: "dim" }),
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
        ], { gap: 6 }),
        fenn.row([
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
  // Board clicks are ignored: the buttons and keyboard drive the game.
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
resetBoard();
draw();
