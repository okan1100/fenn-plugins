// XOX · Tic-Tac-Toe — play against the computer (player X, computer O) for
// Fenn, the floating notch for Windows. Live plugin: one draw() builds the
// whole tree from state. Event driven only — the computer answers after a
// short 250 ms pause so the player sees their own move land first.
//
// Layout, top-packed, no spacers, no justify (page 520x380 -> content 488x312):
// main row = board 306 | side column 172. Height budget: 306 <= 312.
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
    score: "Skor",
    you: "X (sen)",
    cpu: "O (bilgisayar)",
    drawLabel: "Berabere",
    series: "Seri",
    games: "oyun",
    turnYou: "Sıra sende (X)",
    thinking: "Bilgisayar düşünüyor…",
    youWin: "Kazandın!",
    cpuWin: "Bilgisayar kazandı",
    draw: "Berabere",
    hint: "Karo tıkla, X ile oyna",
    newGame: "Yeni oyun",
    resetScore: "Skoru sıfırla",
    langTip: "Türkçe / English",
  },
  en: {
    score: "Score",
    you: "X (you)",
    cpu: "O (computer)",
    drawLabel: "Draw",
    series: "Series",
    games: "games",
    turnYou: "Your turn (X)",
    thinking: "Computer is thinking…",
    youWin: "You win!",
    cpuWin: "Computer wins",
    draw: "Draw",
    hint: "Click a cell, you play X",
    newGame: "New game",
    resetScore: "Reset score",
    langTip: "Türkçe / English",
  },
};

const locale = String(Intl.DateTimeFormat().resolvedOptions().locale || "en").toLowerCase();
let lang = app.load("lang", locale.startsWith("tr") ? "tr" : "en");
if (lang !== "tr" && lang !== "en") lang = "en";
const t = (k) => (k === undefined ? T[lang] : T[lang] && T[lang][k] !== undefined ? T[lang][k] : T.en[k] !== undefined ? T.en[k] : k);

// ---- State -------------------------------------------------------------

const CELL = 100, GAP = 3, BOARD = 3 * CELL + 2 * GAP; // 306 x 306
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

let board = ["", "", "", "", "", "", "", "", ""];
let over = false;
let winner = null;   // "X" | "O" | "draw" | null
let winLine = null;  // [a, b, c] of the winning line
let aiPending = false;
let aiTimer = null;
// Score and series are per session on purpose — nothing is stored.
let sx = 0, so = 0, sd = 0;
let series = []; // "X" | "O" | "draw", one per finished game

function clearAi() {
  if (aiTimer !== null) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
  aiPending = false;
}

function newGame() {
  clearAi();
  board = ["", "", "", "", "", "", "", "", ""];
  over = false;
  winner = null;
  winLine = null;
}

function checkWinner() {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { who: board[a], line };
  }
  return null;
}

// Returns true when the game is over after the last move.
function resolve() {
  const w = checkWinner();
  if (w) {
    over = true;
    winner = w.who;
    winLine = w.line;
    if (w.who === "X") sx += 1;
    else so += 1;
    series.push(w.who);
    return true;
  }
  if (board.every((v) => v !== "")) {
    over = true;
    winner = "draw";
    winLine = null;
    sd += 1;
    series.push("draw");
    return true;
  }
  return false;
}

// ---- Computer: win -> block -> corner -> centre -> anything ------------

function findWinningMove(sym) {
  for (const [a, b, c] of LINES) {
    const vals = [board[a], board[b], board[c]];
    const empties = [a, b, c].filter((i) => board[i] === "");
    if (empties.length === 1 && vals.filter((v) => v === sym).length === 2) return empties[0];
  }
  return -1;
}

function aiPick() {
  let m = findWinningMove("O");
  if (m >= 0) return m;
  m = findWinningMove("X");
  if (m >= 0) return m;
  const corners = [0, 2, 6, 8].filter((i) => board[i] === "");
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  if (board[4] === "") return 4;
  const free = board.map((v, i) => (v === "" ? i : -1)).filter((i) => i >= 0);
  return free.length ? free[Math.floor(Math.random() * free.length)] : -1;
}

function playAi() {
  if (over) return;
  const i = aiPick();
  if (i < 0) return;
  board[i] = "O";
  resolve();
}

function placePlayer(i) {
  if (over || aiPending || board[i] !== "") return;
  board[i] = "X";
  if (resolve()) {
    draw();
    return;
  }
  clearAi();
  aiPending = true;
  aiTimer = setTimeout(() => {
    aiTimer = null;
    aiPending = false;
    try {
      playAi();
      draw();
    } catch (e) {
      console.error("xox: " + String((e && e.stack) || e));
    }
  }, 250);
  draw();
}

// ---- Drawing -----------------------------------------------------------

function cellCenter(i) {
  return [(i % 3) * (CELL + GAP) + CELL / 2, Math.floor(i / 3) * (CELL + GAP) + CELL / 2];
}

function boardShapes() {
  const s = [];
  const wc = winner === "X" ? "accent" : winner === "O" ? "orange" : "dim";
  const m = 27;
  for (let i = 0; i < 9; i++) {
    const x = (i % 3) * (CELL + GAP), y = Math.floor(i / 3) * (CELL + GAP);
    const hi = winLine && winLine.includes(i);
    s.push(fenn.shape.rect(x, y, CELL, CELL, {
      radius: 14, fill: "faint", stroke: hi ? wc : "dim", width: hi ? 3 : 1,
    }));
    if (board[i] === "X") {
      s.push(fenn.shape.line([[x + m, y + m], [x + CELL - m, y + CELL - m]], { color: "accent", width: 5 }));
      s.push(fenn.shape.line([[x + CELL - m, y + m], [x + m, y + CELL - m]], { color: "accent", width: 5 }));
    } else if (board[i] === "O") {
      s.push(fenn.shape.circle(x + CELL / 2, y + CELL / 2, CELL / 2 - m, { stroke: "orange", width: 5 }));
    }
  }
  if (winLine) {
    const p1 = cellCenter(winLine[0]), p2 = cellCenter(winLine[2]);
    s.push(fenn.shape.line([p1, p2], { color: wc, width: 6 }));
  }
  return s;
}

function scoreCell(label, value) {
  return fenn.column([
    fenn.text(label, { size: "small", color: "dim" }),
    fenn.text(value, { size: "title" }),
  ], { gap: 0, align: "center" });
}

function statusText() {
  if (winner === "X") return t("youWin");
  if (winner === "O") return t("cpuWin");
  if (winner === "draw") return t("draw");
  return aiPending ? t("thinking") : t("turnYou");
}

function seriesIcons() {
  return series.slice(-10).map((r) => {
    const icon = r === "X" ? "x" : r === "O" ? "circle" : "equals";
    const color = r === "X" ? "accent" : r === "O" ? "orange" : "dim";
    return fenn.column([fenn.icon(icon, { size: 16, color })], { align: "center" });
  });
}

function pageView() {
  const tt = t();
  const icons = seriesIcons();
  return fenn.column([
    fenn.row([
      fenn.canvas(BOARD, boardShapes(), { width: BOARD, id: "board" }),
      fenn.column([
        fenn.card([
          fenn.row([
            fenn.text(statusText(), {
              size: "body", wrap: true,
              color: winner === "O" ? "orange" : winner ? "accent" : "text",
            }),
            fenn.button("lang", { icon: "translate", tooltip: tt.langTip }),
          ], { gap: 8, align: "center" }),
          fenn.grid(3, [
            scoreCell(tt.you, String(sx)),
            scoreCell(tt.cpu, String(so)),
            scoreCell(tt.drawLabel, String(sd)),
          ], { gap: 8 }),
          fenn.text(tt.series + " · " + (sx + so + sd) + " " + tt.games,
            { size: "small", color: "dim" }),
          icons.length ? fenn.grid(5, icons, { gap: 8 }) : fenn.text("", { size: "small" }),
        ], { padding: 8, gap: 8 }),
        fenn.card([
          fenn.button("new", { label: tt.newGame, icon: "arrow-clockwise", primary: over, width: 0 }),
          fenn.button("reset", { label: tt.resetScore, icon: "trash", width: 0 }),
          fenn.text(tt.hint, { size: "small", color: "faint", wrap: true }),
        ], { padding: 8, gap: 8 }),
      ], { gap: 8 }),
    ], { gap: 10, align: "start" }),
  ], { gap: 8 });
}

function tileView() {
  const tt = t();
  const size = app.tile.size || "wide";
  const line1 = statusText();
  const line2 = "X " + sx + " · " + so + " O";
  if (size === "small") {
    return fenn.column([fenn.text("X " + sx + ":" + so + " O", { size: "title" })],
      { align: "center", justify: "center", gap: 0 });
  }
  if (size === "wide") {
    return fenn.row([
      fenn.icon("grid-four", { size: 24, color: "accent" }),
      fenn.column([
        fenn.text(line1, { size: "small", color: "dim" }),
        fenn.text(line2, { size: "title" }),
      ], { gap: 0 }),
    ], { align: "center", gap: 8 });
  }
  return fenn.column([
    fenn.icon("grid-four", { size: 30, color: "accent" }),
    fenn.text(line2, { size: "title" }),
    fenn.text(line1, { size: "small", color: "dim" }),
  ], { align: "center", justify: "center", gap: 4 });
}

function draw() {
  try {
    app.setTile(tileView());
    app.setPage(pageView());
  } catch (e) {
    console.error("xox: draw failed: " + String((e && e.stack) || e));
  }
}

// ---- Events ------------------------------------------------------------

function guard(fn) {
  return (...args) => {
    try { fn(...args); }
    catch (e) { console.error("xox: " + String((e && e.stack) || e)); }
  };
}

app.on("board", guard((e) => {
  if (!e || typeof e !== "object") return;
  if (e.kind !== "click") return; // clicks only; unknown kinds are ignored
  const v = e.value || {};
  const x = typeof v.x === "number" ? v.x : -1;
  const y = typeof v.y === "number" ? v.y : -1;
  if (x < 0 || y < 0) return;
  const stride = CELL + GAP;
  const c = Math.max(0, Math.min(2, Math.floor(x / stride)));
  const r = Math.max(0, Math.min(2, Math.floor(y / stride)));
  placePlayer(r * 3 + c);
}));

app.on("new", guard(() => { newGame(); draw(); }));
app.on("reset", guard(() => { sx = 0; so = 0; sd = 0; series = []; newGame(); draw(); }));
app.on("lang", guard(() => {
  lang = lang === "tr" ? "en" : "tr";
  app.save("lang", lang);
  draw();
}));

// ---- Lifecycle ---------------------------------------------------------

app.onMessage("theme", guard(() => draw()));
app.onMessage("page_open", guard(() => draw()));
app.onMessage("shutdown", guard(() => {
  clearAi();
  app.save("lang", lang);
}));

newGame();
draw();
