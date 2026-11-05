"use strict";
// Password Generator · Parola Üretici — random passwords with a strength meter.
// Live plugin: redraws only on events. Randomness is uniform via crypto.randomInt.
const crypto = require("crypto");
const fenn = require("./fenn");
// Fenn 0.4.0 uyumluluk: `row` + align:"center" satiri dikey yayiyor; varsayilan hizalama sikipaketler.
const _row = fenn.row;
fenn.row = (c, o = {}) => {
  if (o.align === "center") { const { align, ...rest } = o; return _row(c, rest); }
  return _row(c, o);
};
const app = new fenn.Plugin();

// ---- strings (TR + EN) ----
const T = {
  tr: {
    length: "Uzunluk",
    upper: "Büyük harf (ABC)",
    lower: "Küçük harf (abc)",
    digits: "Rakamlar (123)",
    symbols: "Semboller (#$%)",
    generate: "Üret",
    copy: "Kopyala",
    strength: "Güç",
    noResult: "Parola üretmek için Üret'e basın.",
    copied: "Panoya kopyalandı.",
    errSets: "En az bir karakter türü seçin.",
    errNoResult: "Önce bir parola üretin.",
    langName: "English",
  },
  en: {
    length: "Length",
    upper: "Uppercase (ABC)",
    lower: "Lowercase (abc)",
    digits: "Digits (123)",
    symbols: "Symbols (#$%)",
    generate: "Generate",
    copy: "Copy",
    strength: "Strength",
    noResult: "Press Generate to create a password.",
    copied: "Copied to the clipboard.",
    errSets: "Select at least one character set.",
    errNoResult: "Generate a password first.",
    langName: "Türkçe",
  },
};

const LEVELS = {
  tr: ["Zayıf", "Orta", "İyi", "Güçlü"],
  en: ["Weak", "Fair", "Good", "Strong"],
};

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?/";

// ---- language (persisted; default follows the system locale) ----
const locale = String((Intl.DateTimeFormat().resolvedOptions().locale) || "en").toLowerCase();
let lang = app.load("lang", locale.startsWith("tr") ? "tr" : "en");
if (lang !== "tr" && lang !== "en") lang = "en";

// ---- state ----
function clampLen(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 4 && n <= 64 ? n : 12;
}
let len = clampLen(app.load("len", 12));
const opts = app.load("opts", null);
let upper = !opts || typeof opts.upper !== "boolean" ? true : opts.upper;
let lower = !opts || typeof opts.lower !== "boolean" ? true : opts.lower;
let digits = !opts || typeof opts.digits !== "boolean" ? true : opts.digits;
let symbols = !opts || typeof opts.symbols !== "boolean" ? false : opts.symbols;
let result = "";
let status = null; // { text, color }

function save() {
  app.save("lang", lang);
  app.save("len", len);
  app.save("opts", { upper, lower, digits, symbols });
}

// ---- sets and strength ----
function activeSets() {
  const sets = [];
  if (upper) sets.push(UPPER);
  if (lower) sets.push(LOWER);
  if (digits) sets.push(DIGITS);
  if (symbols) sets.push(SYMBOLS);
  return sets;
}

function strength() {
  const sets = activeSets();
  const pool = sets.reduce((n, s) => n + s.length, 0);
  if (!pool) return 0;
  const bits = len * Math.log2(pool);
  return Math.min(1, bits / 128);
}

function levelIndex() {
  const sets = activeSets();
  const pool = sets.reduce((n, s) => n + s.length, 0);
  const bits = pool ? len * Math.log2(pool) : 0;
  if (bits < 45) return 0;
  if (bits < 65) return 1;
  if (bits < 85) return 2;
  return 3;
}

function pctLabel() {
  const pct = Math.round(strength() * 100);
  return lang === "tr" ? "%" + pct : pct + "%";
}

// ---- generation (uniform randomness via crypto.randomInt) ----
function pick(str) {
  return str[crypto.randomInt(str.length)];
}

function generate() {
  const t = T[lang];
  const sets = activeSets();
  if (!sets.length) {
    status = { text: t.errSets, color: "orange" };
    draw();
    return;
  }
  const pool = sets.join("");
  const chars = [];
  for (const s of sets) {
    if (chars.length < len) chars.push(pick(s)); // one from each selected set
  }
  while (chars.length < len) chars.push(pick(pool));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1); // Fisher-Yates shuffle
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  result = chars.join("");
  status = null;
  draw();
}

// ---- views ----
function tileView() {
  return fenn.ring(strength(), {
    label: pctLabel(),
    size: 40,
    tooltip: T[lang].strength + ": " + LEVELS[lang][levelIndex()],
  });
}

// Layout rules: no spacers, justify start, gap 8 / padding 8, nothing spreads.
// Height budget (page_size [568, 360]; content = 360 - 45 = 315 pt):
//   result card 100 (padding 16 + info row 36 + gap 8 + password 2 lines 40)
//   + gap 8 + slider 40 + gap 8 + toggle row 36 + gap 8 + toggle row 36
//   + gap 8 + generate row 32 = 276 <= 315  (39 pt spare)
function pageView() {
  const t = T[lang];
  const level = LEVELS[lang][levelIndex()];
  const info = [fenn.text(t.strength + ": " + level, { size: "small", color: "dim" })];
  if (status) info.push(fenn.text(status.text, { size: "small", color: status.color, wrap: true }));
  return fenn.column([
    fenn.card([
      fenn.row([
        fenn.ring(strength(), { size: 32, label: pctLabel(), tooltip: t.strength + ": " + level }),
        fenn.column(info, { gap: 2 }),
        fenn.button("copy", { label: t.copy, icon: "copy" }),
      ], { gap: 8, align: "center" }),
      result
        ? fenn.text(result, { mono: true, wrap: true })
        : fenn.text(t.noResult, { size: "small", color: "dim", wrap: true }),
    ], { padding: 8, gap: 8 }),
    fenn.row([
      fenn.text(t.length + ":", { size: "small", color: "dim" }),
      fenn.slider("len", len, { min: 4, max: 64, step: 1, width: 340 }),
      fenn.text(String(len), { size: "body", bold: true }),
    ], { gap: 8, align: "center" }),
    fenn.row([
      fenn.toggle("opt:upper", upper, { label: t.upper }),
      fenn.toggle("opt:lower", lower, { label: t.lower }),
    ], { gap: 8, align: "center" }),
    fenn.row([
      fenn.toggle("opt:digits", digits, { label: t.digits }),
      fenn.toggle("opt:symbols", symbols, { label: t.symbols }),
    ], { gap: 8, align: "center" }),
    fenn.row([
      fenn.button("gen", { label: t.generate, icon: "arrows-clockwise", primary: true }),
      fenn.button("lang", { icon: "translate", tooltip: t.langName }),
    ], { gap: 8, align: "center" }),
  ], { gap: 8, justify: "start", scroll: true });
}

function draw() {
  app.setTile(tileView());
  app.setPage(pageView());
}

// ---- actions ----
function route(e) {
  const t = T[lang];
  const id = String(e && e.id != null ? e.id : "");
  const value = e && e.value;
  if (id === "lang") {
    lang = lang === "tr" ? "en" : "tr";
    status = null;
    save();
    draw();
    return;
  }
  if (id === "gen") {
    generate();
    return;
  }
  if (id === "copy") {
    if (result) {
      app.copy(result);
      status = { text: t.copied, color: "green" };
    } else {
      status = { text: t.errNoResult, color: "orange" };
    }
    draw();
    return;
  }
  if (id === "len") {
    len = clampLen(value);
    save();
    draw();
    return;
  }
  if (id.indexOf("opt:") === 0) {
    const on = value === true;
    const key = id.slice(4);
    if (key === "upper") upper = on;
    else if (key === "lower") lower = on;
    else if (key === "digits") digits = on;
    else if (key === "symbols") symbols = on;
    else return;
    status = null;
    save();
    draw();
    return;
  }
  // unknown ids are ignored
}

app.onMessage("event", (e) => {
  try {
    route(e);
  } catch (ex) {
    app.log(String((ex && ex.stack) || ex), "error");
  }
});
app.onMessage("page_open", () => {
  try {
    draw();
  } catch (ex) {
    app.log(String((ex && ex.stack) || ex), "error");
  }
});
app.onMessage("shutdown", () => {
  try {
    save();
  } catch (ex) {
    /* the process is about to be killed */
  }
});

try {
  draw();
} catch (ex) {
  app.log(String((ex && ex.stack) || ex), "error");
}
