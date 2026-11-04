// Dice · Zar — dice & coin roller for Fenn.
// Live plugin: state lives in variables, one draw() sends the whole tree.
// Intervals run only while the roll animation plays (~0.5 s), never idle.
"use strict";

const fenn = require("./fenn");
const app = new fenn.Plugin();

// ---- Strings (TR + EN) -------------------------------------------------

const T = {
  tr: {
    dice: "Zar",
    coin: "Madeni para",
    roll: "At",
    flip: "Çevir",
    heads: "Yazı",
    tails: "Tura",
    history: "Geçmiş",
    total: "Toplam",
    result: "Sonuç",
    count: "Adet",
    noHistory: "Henüz atış yok",
    tileLabel: "Zar & Para",
    langTip: "Türkçe / English",
  },
  en: {
    dice: "Dice",
    coin: "Coin",
    roll: "Roll",
    flip: "Flip",
    heads: "Heads",
    tails: "Tails",
    history: "History",
    total: "Total",
    result: "Result",
    count: "Count",
    noHistory: "No rolls yet",
    tileLabel: "Dice & Coin",
    langTip: "Türkçe / English",
  },
};

const locale = String(Intl.DateTimeFormat().resolvedOptions().locale || "en").toLowerCase();
let lang = app.load("lang", locale.startsWith("tr") ? "tr" : "en");
if (lang !== "tr" && lang !== "en") lang = "en";
const t = () => T[lang];

// ---- State -------------------------------------------------------------

const SIDES = [4, 6, 8, 10, 12, 20];
let mode = "dice";       // "dice" | "coin"
let dieIndex = 1;        // SIDES[dieIndex]
let count = 3;           // 1..5 dice
let rolling = false;
let animTimer = null;
let animDice = [];       // faces shown while the roll animation plays
let animCoin = "heads";  // face shown while the coin animation plays
let result = null;       // {kind:"dice", values, sides, total} | {kind:"coin", face}
let history = [];        // last 8 results (raw, localized at draw time)

const randInt = (n) => 1 + Math.floor(Math.random() * n);

// ---- Drawing -----------------------------------------------------------

function resultSummary() {
  if (rolling) return "?";
  if (!result) return "—";
  if (result.kind === "dice") return String(result.total);
  return t()[result.face];
}

function tileView() {
  const size = app.tile.size || "large";
  const label = t().tileLabel;
  const summary = resultSummary();
  const icon = mode === "coin" ? "coin" : "dice-five";
  if (size === "small") {
    return fenn.column([fenn.text(summary, { size: "big" })],
      { align: "center", justify: "center", gap: 0 });
  }
  if (size === "wide") {
    return fenn.row([
      fenn.icon(icon, { size: 26, color: "accent" }),
      fenn.column([
        fenn.text(label, { size: "small", color: "dim" }),
        fenn.text(summary, { size: "title" }),
      ], { gap: 0 }),
    ], { align: "center", gap: 10 });
  }
  return fenn.column([
    fenn.text(label, { size: "small", color: "dim" }),
    fenn.text(summary, { size: "big" }),
    fenn.button("roll", { icon, primary: true, label: mode === "coin" ? t().flip : t().roll }),
  ], { align: "center", justify: "center", gap: 4 });
}

function diceCanvas() {
  const W = 536, H = 100;
  const n = count;
  const faces = rolling
    ? animDice
    : (result && result.kind === "dice" && result.values.length === n && result.sides === SIDES[dieIndex]
      ? result.values : null);
  const cellW = W / n;
  const size = Math.min(88, cellW - 14);
  const shapes = [];
  for (let i = 0; i < n; i++) {
    const x = i * cellW + (cellW - size) / 2;
    const y = (H - size) / 2;
    shapes.push(fenn.shape.rect(x, y, size, size, { radius: 14, fill: "faint", stroke: "dim", width: 1.5 }));
    const v = faces ? String(faces[i]) : "?";
    shapes.push(fenn.shape.text(x + size / 2, y + size / 2, v,
      { size: 30, anchor: "center", bold: true, color: faces ? "text" : "faint" }));
  }
  return fenn.canvas(H, shapes, { width: W });
}

function coinCanvas() {
  const W = 536, H = 100;
  const cx = W / 2, cy = H / 2, r = 42;
  const face = rolling ? animCoin : (result && result.kind === "coin" ? result.face : null);
  const shapes = [
    fenn.shape.circle(cx, cy, r, { fill: face ? "yellow" : "faint", stroke: face ? "orange" : "dim", width: 3 }),
    fenn.shape.circle(cx, cy, r - 8, { stroke: face ? "orange" : "dim", width: 1 }),
    fenn.shape.text(cx, cy, face ? t()[face] : "?",
      { size: 18, anchor: "center", bold: true, color: face ? "black" : "dim" }),
  ];
  return fenn.canvas(H, shapes, { width: W });
}

function totalLabel() {
  if (rolling) return t().total + ": ?";
  if (!result) return "";
  if (result.kind === "dice") return t().total + ": " + result.total;
  return t().result + ": " + t()[result.face];
}

function historyItems() {
  return history.map((h, i) => {
    if (h.kind === "dice") {
      return fenn.item("h:" + i, h.values.length + "×d" + h.sides, {
        subtitle: h.values.join(" + "),
        trailing: String(h.total),
      });
    }
    return fenn.item("h:" + i, t().coin, { trailing: t()[h.face] });
  });
}

function pageView() {
  const tt = t();
  const children = [];
  children.push(fenn.row([
    fenn.chips("mode", [tt.dice, tt.coin], mode === "dice" ? 0 : 1),
    fenn.spacer(),
    fenn.button("lang", { icon: "translate", tooltip: tt.langTip }),
  ], { align: "center", gap: 8 }));
  if (mode === "dice") {
    children.push(fenn.row([
      fenn.chips("die", ["d4", "d6", "d8", "d10", "d12", "d20"], dieIndex),
      fenn.spacer(),
      fenn.button("dec", { icon: "minus", tooltip: tt.count }),
      fenn.text(String(count), { size: "title" }),
      fenn.button("inc", { icon: "plus", tooltip: tt.count }),
    ], { align: "center", gap: 6 }));
    children.push(diceCanvas());
  } else {
    children.push(coinCanvas());
  }
  children.push(fenn.row([
    fenn.button("roll", {
      label: mode === "coin" ? tt.flip : tt.roll,
      icon: mode === "coin" ? "coin" : "dice-five",
      primary: true,
    }),
    fenn.text(totalLabel(), { size: "title" }),
  ], { align: "center", gap: 10 }));
  children.push(fenn.text(tt.history, { size: "small", color: "dim" }));
  if (history.length) {
    children.push(fenn.listView(historyItems()));
  } else {
    children.push(fenn.text(tt.noHistory, { size: "small", color: "faint" }));
  }
  return fenn.column(children, { gap: 8, scroll: true });
}

function draw() {
  try {
    app.setTile(tileView());
    app.setPage(pageView());
  } catch (e) {
    console.error("dice: draw failed: " + String((e && e.stack) || e));
  }
}

// ---- Rolling (interval only while the animation plays) -----------------

function startRoll() {
  if (rolling) return;
  rolling = true;
  let final;
  if (mode === "dice") {
    const values = Array.from({ length: count }, () => randInt(SIDES[dieIndex]));
    final = { kind: "dice", values, sides: SIDES[dieIndex], total: values.reduce((a, b) => a + b, 0) };
    animDice = values.map(() => randInt(SIDES[dieIndex]));
  } else {
    final = { kind: "coin", face: Math.random() < 0.5 ? "heads" : "tails" };
    animCoin = Math.random() < 0.5 ? "heads" : "tails";
  }
  const started = Date.now();
  animTimer = setInterval(() => {
    try {
      if (mode === "dice") animDice = animDice.map(() => randInt(SIDES[dieIndex]));
      else animCoin = animCoin === "heads" ? "tails" : "heads";
      draw();
      if (Date.now() - started >= 500) finishRoll(final);
    } catch (e) {
      stopAnimation();
      console.error("dice: roll animation failed: " + String((e && e.stack) || e));
    }
  }, 90);
}

function finishRoll(final) {
  stopAnimation();
  result = final;
  history = [final].concat(history).slice(0, 8);
  draw();
}

function stopAnimation() {
  if (animTimer) { clearInterval(animTimer); animTimer = null; }
  rolling = false;
}

// ---- Events ------------------------------------------------------------

app.on("roll", () => {
  try { startRoll(); } catch (e) { console.error("dice: " + String((e && e.stack) || e)); }
});

app.on("mode", (ev) => {
  try {
    if (rolling) return;
    const v = ev && ev.value;
    const idx = v && typeof v === "object" ? v.index : parseInt(v, 10);
    if (typeof idx !== "number" || isNaN(idx)) return;
    mode = idx === 0 ? "dice" : "coin";
    draw();
  } catch (e) { console.error("dice: " + String((e && e.stack) || e)); }
});

app.on("die", (ev) => {
  try {
    if (rolling) return;
    const v = ev && ev.value;
    const idx = v && typeof v === "object" ? v.index : parseInt(v, 10);
    if (typeof idx !== "number" || isNaN(idx)) return;
    dieIndex = Math.max(0, Math.min(SIDES.length - 1, Math.round(idx)));
    draw();
  } catch (e) { console.error("dice: " + String((e && e.stack) || e)); }
});

app.on("dec", () => {
  try {
    if (rolling || count <= 1) return;
    count -= 1;
    draw();
  } catch (e) { console.error("dice: " + String((e && e.stack) || e)); }
});

app.on("inc", () => {
  try {
    if (rolling || count >= 5) return;
    count += 1;
    draw();
  } catch (e) { console.error("dice: " + String((e && e.stack) || e)); }
});

app.on("lang", () => {
  try {
    lang = lang === "tr" ? "en" : "tr";
    app.save("lang", lang);
    draw();
  } catch (e) { console.error("dice: " + String((e && e.stack) || e)); }
});

// ---- Lifecycle ---------------------------------------------------------

let lastTileSize = null;

app.onMessage("layout", (m) => {
  try {
    if (m && m.target === "tile" && m.size !== lastTileSize) {
      lastTileSize = m.size;
      draw();
    }
  } catch (e) { console.error("dice: " + String((e && e.stack) || e)); }
});

app.onMessage("page_open", () => {
  try { draw(); } catch (e) { console.error("dice: " + String((e && e.stack) || e)); }
});

app.onMessage("shutdown", () => {
  try {
    stopAnimation();
    app.save("lang", lang);
  } catch (e) { console.error("dice: " + String((e && e.stack) || e)); }
});

draw();
