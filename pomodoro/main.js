// Pomodoro · Odak — focus & break timer for Fenn, the floating notch for Windows.
// Live plugin: one draw() builds the whole tree from state. A 1 s interval runs
// ONLY while the countdown is actually ticking; everything else is event driven.
//
// Layout, top-packed, no spacers, no justify (page 568x300 -> content 536x232):
// ring row 160 + 8 + buttons 26 + 8 + presets 26 = 228 <= 232.
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
    focus: "Odak",
    short: "Mola",
    long: "Uzun mola",
    focusing: "Odaklanıyor",
    onBreak: "Mola",
    ready: "Hazır",
    paused: "Duraklatıldı",
    breakReady: "Mola!",
    breakOver: "Mola bitti",
    breakReadyHint: "Odak tamamlandı, mola hazır.",
    breakOverHint: "Mola bitti, yeni odak hazır.",
    runningHint: "Süre işliyor",
    pausedHint: "Devam için Başlat'a bas",
    readyHint: "Süreyi seç ve Başlat'a bas",
    start: "Başlat",
    resume: "Devam",
    pause: "Duraklat",
    reset: "Sıfırla",
    cycle: "Döngü",
    today: "Bugünkü odak",
    pFocus: "Odak · 25 dk",
    pShort: "Mola · 5 dk",
    pLong: "Uzun mola · 15 dk",
    langTip: "Türkçe / English",
  },
  en: {
    focus: "Focus",
    short: "Break",
    long: "Long break",
    focusing: "Focusing",
    onBreak: "On a break",
    ready: "Ready",
    paused: "Paused",
    breakReady: "Break!",
    breakOver: "Break over",
    breakReadyHint: "Focus done, the break is ready.",
    breakOverHint: "Break over, ready to focus.",
    runningHint: "Running",
    pausedHint: "Press Start to continue",
    readyHint: "Pick a session, press Start",
    start: "Start",
    resume: "Resume",
    pause: "Pause",
    reset: "Reset",
    cycle: "Cycle",
    today: "Focus today",
    pFocus: "Focus · 25 min",
    pShort: "Break · 5 min",
    pLong: "Long break · 15 min",
    langTip: "Türkçe / English",
  },
};

const locale = String(Intl.DateTimeFormat().resolvedOptions().locale || "en").toLowerCase();
let lang = app.load("lang", locale.startsWith("tr") ? "tr" : "en");
if (lang !== "tr" && lang !== "en") lang = "en";
const t = (k) => (k === undefined ? T[lang] : T[lang] && T[lang][k] !== undefined ? T[lang][k] : T.en[k] !== undefined ? T.en[k] : k);

// ---- State -------------------------------------------------------------

const MIN = 60 * 1000;
const DUR = { focus: 25 * MIN, short: 5 * MIN, long: 15 * MIN };
const RING = 160, R = 72; // ring canvas 160x160 pt, radius 72

let mode = app.load("mode", "focus");
if (!DUR[mode]) mode = "focus";
let remaining = Number(app.load("remaining", DUR[mode]));
if (!Number.isFinite(remaining) || remaining < 0 || remaining > DUR[mode]) remaining = DUR[mode];
let running = false;
let endAt = 0;
let cycle = Math.max(0, Math.floor(Number(app.load("cycle", 0)) || 0));
let today = app.load("today", null);
let doneNote = null; // null | "focus" | "break": the prominent "Mola!" state
let tick = null;

function todayKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function ensureToday() {
  if (!today || today.date !== todayKey() || typeof today.count !== "number") {
    today = { date: todayKey(), count: 0 };
  }
}

function duration() {
  return DUR[mode] || DUR.focus;
}

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

// ---- Timer (1 s interval only while ticking) ---------------------------

function stopTick() {
  if (tick !== null) {
    clearInterval(tick);
    tick = null;
  }
}

function startTick() {
  stopTick();
  tick = setInterval(() => {
    try {
      const left = endAt - Date.now();
      if (left <= 0) {
        complete();
        return;
      }
      remaining = left;
      draw();
    } catch (e) {
      stopTick();
      console.error("pomodoro: tick failed: " + String((e && e.stack) || e));
    }
  }, 1000);
}

function complete() {
  stopTick();
  running = false;
  remaining = 0;
  ensureToday();
  if (mode === "focus") {
    today.count += 1;
    cycle += 1;
    app.save("today", today);
    app.save("cycle", cycle);
    mode = cycle % 4 === 0 ? "long" : "short";
    doneNote = "focus"; // "Mola!"
  } else {
    mode = "focus";
    doneNote = "break"; // "Mola bitti"
  }
  remaining = DUR[mode];
  app.save("mode", mode);
  app.save("remaining", remaining);
  app.badgePulse(); // quiet signal on the pill — never a "show"
  draw();
}

function start() {
  if (running) return;
  if (remaining <= 0) remaining = duration();
  running = true;
  endAt = Date.now() + remaining;
  doneNote = null;
  startTick();
  draw();
}

function pause() {
  if (!running) return;
  remaining = Math.max(0, endAt - Date.now());
  running = false;
  stopTick();
  draw();
}

function reset() {
  running = false;
  stopTick();
  remaining = duration();
  doneNote = null;
  app.clearBadge();
  app.save("remaining", remaining);
  draw();
}

function setPreset(m) {
  if (!DUR[m]) return;
  running = false;
  stopTick();
  mode = m;
  remaining = DUR[m];
  doneNote = null;
  app.clearBadge();
  app.save("mode", mode);
  app.save("remaining", remaining);
  draw();
}

// ---- Drawing -----------------------------------------------------------

function modeLabel() {
  return mode === "focus" ? t("focus") : mode === "short" ? t("short") : t("long");
}

function headline() {
  if (doneNote === "focus") return t("breakReady");
  if (doneNote === "break") return t("breakOver");
  if (running) return mode === "focus" ? t("focusing") : t("onBreak");
  if (remaining < duration()) return t("paused");
  return t("ready");
}

function subline() {
  if (doneNote === "focus") return t("breakReadyHint");
  if (doneNote === "break") return t("breakOverHint");
  if (running) return t("runningHint");
  if (remaining < duration()) return t("pausedHint");
  return t("readyHint");
}

function ringShapes() {
  const total = duration();
  const f = Math.max(0, Math.min(1, remaining / total));
  const color = mode === "focus" ? "accent" : "orange";
  return [
    fenn.shape.circle(RING / 2, RING / 2, R, { stroke: "faint", width: 12 }),
    fenn.shape.arc(RING / 2, RING / 2, R, 0, 360 * f, { color, width: 12 }),
    fenn.shape.text(RING / 2, RING / 2 - 12, fmt(remaining), { size: 32, bold: true, anchor: "center" }),
    fenn.shape.text(RING / 2, RING / 2 + 22, modeLabel(), { size: 12, color: "dim", anchor: "center" }),
  ];
}

function statCell(label, value) {
  return fenn.column([
    fenn.text(label, { size: "small", color: "dim" }),
    fenn.text(value, { size: "title" }),
  ], { gap: 0, align: "center" });
}

function pageView() {
  const tt = t();
  return fenn.column([
    fenn.row([
      fenn.canvas(RING, ringShapes(), { width: RING }),
      fenn.column([
        fenn.card([
          fenn.row([
            fenn.column([
              fenn.text(headline(), { size: "big", bold: true, color: doneNote ? "accent" : "text" }),
              fenn.text(subline(), { size: "small", color: "dim", wrap: true }),
            ], { gap: 8 }),
            fenn.button("lang", { icon: "translate", tooltip: tt.langTip }),
          ], { gap: 8, align: "center" }),
        ], { padding: 8, gap: 8 }),
        fenn.card([
          fenn.grid(2, [
            statCell(tt.cycle, cycle % 4 + " / 4"),
            statCell(tt.today, String(today.count)),
          ], { gap: 8 }),
        ], { padding: 8, gap: 8 }),
      ], { gap: 8 }),
    ], { gap: 10, align: "center" }),
    fenn.row([
      fenn.button("start", {
        label: !running && remaining < duration() && !doneNote ? tt.resume : tt.start,
        icon: "play", primary: true, width: 172,
      }),
      fenn.button("pause", { label: tt.pause, icon: "pause", width: 172 }),
      fenn.button("reset", { label: tt.reset, icon: "arrow-clockwise", width: 172 }),
    ], { gap: 8, align: "center" }),
    fenn.grid(3, [
      fenn.button("preset:focus", { label: tt.pFocus, icon: "target", width: 0 }),
      fenn.button("preset:short", { label: tt.pShort, icon: "coffee", width: 0 }),
      fenn.button("preset:long", { label: tt.pLong, icon: "moon-stars", width: 0 }),
    ], { gap: 8 }),
  ], { gap: 8 });
}

function tileView() {
  const tt = t();
  const size = app.tile.size || "wide";
  const time = fmt(remaining);
  const note = doneNote === "focus" ? tt.breakReady : doneNote === "break" ? tt.breakOver : "";
  if (size === "small") {
    return fenn.column([
      fenn.text(note || time, { size: "title", color: doneNote ? "accent" : "text" }),
    ], { align: "center", justify: "center", gap: 0 });
  }
  const line2 = note || time;
  const line1 = note ? modeLabel() : headline();
  if (size === "wide") {
    return fenn.row([
      fenn.icon(mode === "focus" ? "timer" : "coffee", { size: 24, color: "accent" }),
      fenn.column([
        fenn.text(line1, { size: "small", color: doneNote ? "accent" : "dim" }),
        fenn.text(line2, { size: "title", color: doneNote ? "accent" : "text" }),
      ], { gap: 0 }),
    ], { align: "center", gap: 8 });
  }
  return fenn.column([
    fenn.icon(mode === "focus" ? "timer" : "coffee", { size: 30, color: "accent" }),
    fenn.text(line2, { size: "title", color: doneNote ? "accent" : "text" }),
    fenn.text(line1, { size: "small", color: "dim" }),
  ], { align: "center", justify: "center", gap: 4 });
}

function sendBadge() {
  if (doneNote) return; // the pulse from complete() stays until acknowledged
  if (running || remaining < duration()) {
    app.badgeRing(Math.max(0, Math.min(1, remaining / duration())), fmt(remaining));
  } else {
    app.clearBadge();
  }
}

function draw() {
  try {
    ensureToday();
    app.setTile(tileView());
    app.setPage(pageView());
    sendBadge();
  } catch (e) {
    console.error("pomodoro: draw failed: " + String((e && e.stack) || e));
  }
}

// ---- Events ------------------------------------------------------------

function guard(fn) {
  return (...args) => {
    try { fn(...args); }
    catch (e) { console.error("pomodoro: " + String((e && e.stack) || e)); }
  };
}

app.on("start", guard(() => start()));
app.on("pause", guard(() => pause()));
app.on("reset", guard(() => reset()));
app.on("preset:focus", guard(() => setPreset("focus")));
app.on("preset:short", guard(() => setPreset("short")));
app.on("preset:long", guard(() => setPreset("long")));
app.on("lang", guard(() => {
  lang = lang === "tr" ? "en" : "tr";
  app.save("lang", lang);
  draw();
}));

// ---- Lifecycle ---------------------------------------------------------

app.onMessage("theme", guard(() => draw()));
app.onMessage("page_open", guard(() => draw()));
app.onMessage("shutdown", guard(() => {
  stopTick();
  if (running) remaining = Math.max(0, endAt - Date.now());
  running = false;
  ensureToday();
  app.save("lang", lang);
  app.save("mode", mode);
  app.save("remaining", remaining);
  app.save("cycle", cycle);
  app.save("today", today);
}));

draw();
