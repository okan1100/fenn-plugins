"use strict";
// Unit Converter · Birim Çevirici — length, mass, temperature, area, volume, speed.
// Live plugin: redraws only on events. Results go to a separate text; the
// inputs never receive echoed values, so the user's typing is kept.
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
    fromLabel: "Kaynak",
    toLabel: "Hedef",
    valueHint: "Değer",
    enter: "Bir sayı girin",
    swapTip: "Birimleri takas et",
    langName: "English",
    formula: "Formül:",
  },
  en: {
    fromLabel: "From",
    toLabel: "To",
    valueHint: "Value",
    enter: "Enter a number",
    swapTip: "Swap units",
    langName: "Türkçe",
    formula: "Formula:",
  },
};

// ---- categories and units (factors convert to the category's base unit) ----
const CATS = [
  {
    key: "length", tr: "Uzunluk", en: "Length",
    units: [
      { s: "mm", tr: "milimetre", en: "millimeter", f: 0.001 },
      { s: "cm", tr: "santimetre", en: "centimeter", f: 0.01 },
      { s: "m", tr: "metre", en: "meter", f: 1 },
      { s: "km", tr: "kilometre", en: "kilometer", f: 1000 },
      { s: "in", tr: "inç", en: "inch", f: 0.0254 },
      { s: "ft", tr: "fit", en: "foot", f: 0.3048 },
      { s: "mi", tr: "mil", en: "mile", f: 1609.344 },
    ],
  },
  {
    key: "mass", tr: "Kütle", en: "Mass",
    units: [
      { s: "mg", tr: "miligram", en: "milligram", f: 1e-6 },
      { s: "g", tr: "gram", en: "gram", f: 0.001 },
      { s: "kg", tr: "kilogram", en: "kilogram", f: 1 },
      { s: "t", tr: "ton", en: "tonne", f: 1000 },
      { s: "oz", tr: "ons", en: "ounce", f: 0.028349523125 },
      { s: "lb", tr: "libre", en: "pound", f: 0.45359237 },
    ],
  },
  {
    key: "temp", tr: "Sıcaklık", en: "Temperature",
    units: [
      { s: "°C", tr: "Santigrat", en: "Celsius" },
      { s: "°F", tr: "Fahrenheit", en: "Fahrenheit" },
      { s: "K", tr: "Kelvin", en: "Kelvin" },
    ],
  },
  {
    key: "area", tr: "Alan", en: "Area",
    units: [
      { s: "mm²", tr: "milimetrekare", en: "square millimeter", f: 1e-6 },
      { s: "cm²", tr: "santimetrekare", en: "square centimeter", f: 1e-4 },
      { s: "m²", tr: "metrekare", en: "square meter", f: 1 },
      { s: "ha", tr: "hektar", en: "hectare", f: 1e4 },
      { s: "km²", tr: "kilometrekare", en: "square kilometer", f: 1e6 },
      { s: "ft²", tr: "fit kare", en: "square foot", f: 0.09290304 },
    ],
  },
  {
    key: "volume", tr: "Hacim", en: "Volume",
    units: [
      { s: "ml", tr: "mililitre", en: "milliliter", f: 0.001 },
      { s: "L", tr: "litre", en: "liter", f: 1 },
      { s: "m³", tr: "metreküp", en: "cubic meter", f: 1000 },
      { s: "gal", tr: "galon", en: "gallon", f: 3.785411784 },
      { s: "fl oz", tr: "sıvı ons", en: "fluid ounce", f: 0.0295735295625 },
      { s: "cup", tr: "bardak", en: "cup", f: 0.2365882365 },
    ],
  },
  {
    key: "speed", tr: "Hız", en: "Speed",
    units: [
      { s: "m/s", tr: "metre/saniye", en: "meters per second", f: 1 },
      { s: "km/h", tr: "kilometre/saat", en: "kilometers per hour", f: 1 / 3.6 },
      { s: "mph", tr: "mil/saat", en: "miles per hour", f: 0.44704 },
      { s: "kn", tr: "düğüm", en: "knot", f: 0.514444444444 },
      { s: "ft/s", tr: "fit/saniye", en: "feet per second", f: 0.3048 },
    ],
  },
];

// default [from, to] unit pair per category
const DEF = {
  length: [2, 5], mass: [2, 5], temp: [0, 1],
  area: [2, 5], volume: [1, 4], speed: [1, 2],
};

const TEMP_FORMULAS = {
  "°C>°F": "(°C × 9/5) + 32",
  "°F>°C": "(°F − 32) × 5/9",
  "°C>K": "°C + 273.15",
  "K>°C": "K − 273.15",
  "°F>K": "(°F − 32) × 5/9 + 273.15",
  "K>°F": "(K − 273.15) × 9/5 + 32",
};

// ---- language (persisted; default follows the system locale) ----
const locale = String((Intl.DateTimeFormat().resolvedOptions().locale) || "en").toLowerCase();
let lang = app.load("lang", locale.startsWith("tr") ? "tr" : "en");
if (lang !== "tr" && lang !== "en") lang = "en";

// ---- state ----
function clampIndex(v, max) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n < max ? n : 0;
}

let catIdx = clampIndex(app.load("cat", 0), CATS.length);
let sel = app.load("sel", null);
if (!sel || typeof sel !== "object") sel = {};
for (const c of CATS) {
  const p = Array.isArray(sel[c.key]) ? sel[c.key] : DEF[c.key];
  sel[c.key] = [clampIndex(p[0], c.units.length), clampIndex(p[1], c.units.length)];
}
let fromVal = "";
let toVal = "";
let side = "from"; // which input the user edited last

function save() {
  app.save("lang", lang);
  app.save("cat", catIdx);
  app.save("sel", sel);
}

// ---- conversion ----
function toCelsius(u, v) {
  if (u.s === "°F") return (v - 32) * 5 / 9;
  if (u.s === "K") return v - 273.15;
  return v;
}
function fromCelsius(u, c) {
  if (u.s === "°F") return c * 9 / 5 + 32;
  if (u.s === "K") return c + 273.15;
  return c;
}
function convert(cat, from, to, v) {
  if (cat.key === "temp") return fromCelsius(to, toCelsius(from, v));
  return (v * from.f) / to.f;
}

function parseNum(s) {
  const raw = String(s == null ? "" : s).trim().replace(/\s/g, "").replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function fmt(n) {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e12 || abs < 1e-6) return n.toExponential(4);
  return String(Number(n.toPrecision(6)));
}

function currentUnits() {
  const cat = CATS[catIdx];
  const pair = sel[cat.key];
  return { cat, from: cat.units[pair[0]], to: cat.units[pair[1]] };
}

function resultLine() {
  const t = T[lang];
  const { cat, from, to } = currentUnits();
  const srcRaw = side === "to" ? toVal : fromVal;
  const n = parseNum(srcRaw);
  if (n === null) return { text: t.enter, mono: false, dim: true };
  const a = side === "to" ? to : from;
  const b = side === "to" ? from : to;
  const out = convert(cat, a, b, n);
  return { text: fmt(n) + " " + a.s + " = " + fmt(out) + " " + b.s, mono: true, dim: false };
}

function factorLine() {
  const t = T[lang];
  const { cat, from, to } = currentUnits();
  if (cat.key === "temp") {
    const key = from.s + ">" + to.s;
    return t.formula + " " + (TEMP_FORMULAS[key] || from.s + " = " + to.s);
  }
  return "1 " + from[lang] + " = " + fmt(convert(cat, from, to, 1)) + " " + to[lang];
}

// ---- views ----
function tileView() {
  const { cat, from, to } = currentUnits();
  const srcRaw = side === "to" ? toVal : fromVal;
  const n = parseNum(srcRaw);
  let line1, line2;
  if (n === null) {
    line1 = "1 " + from.s;
    line2 = fmt(convert(cat, from, to, 1)) + " " + to.s;
  } else {
    const a = side === "to" ? to : from;
    const b = side === "to" ? from : to;
    line1 = fmt(n) + " " + a.s;
    line2 = fmt(convert(cat, a, b, n)) + " " + b.s;
  }
  return fenn.column([
    fenn.text(line1, { size: "small", color: "dim" }),
    fenn.text(line2, { size: "title" }),
  ], { gap: 0, justify: "center" });
}

// Unit selection: plain rows of fixed-width buttons (max 5 per row, balanced
// chunks) instead of a multi-row grid, so rows never stretch or spread.
// A 96 pt button + 4 pt gaps keeps even 5-button rows inside ~530 pt.
const UNIT_BTN_W = 96;

function unitButtons(prefix, cat, selectedIdx, start, count) {
  const out = [];
  for (let j = 0; j < count && start + j < cat.units.length; j++) {
    const i = start + j;
    const u = cat.units[i];
    out.push(fenn.button(prefix + ":" + i, {
      label: u.s,
      tooltip: u[lang],
      primary: i === selectedIdx,
      width: UNIT_BTN_W,
    }));
  }
  return out;
}

function unitRows(prefix, cat, selectedIdx) {
  const n = cat.units.length;
  const rows = Math.ceil(n / 5);
  const per = Math.ceil(n / rows);
  const out = [];
  for (let start = 0; start < n; start += per) {
    out.push(fenn.row(unitButtons(prefix, cat, selectedIdx, start, per), { gap: 4, align: "center" }));
  }
  return out;
}

// Layout rules: no spacers, justify start, gap 8, nothing spreads. Vertical
// flow: category chips -> From (label + input + swap + lang) -> unit rows ->
// To (label + input) -> unit rows -> result -> example line.
// Height budget (page_size [568, 420]; content = 420 - 45 = 375 pt):
//   chips 32 + gap 8 + from row 40 + gap 8 + unit row 30 + gap 8 + unit row 30
//   + gap 8 + to row 40 + gap 8 + unit row 30 + gap 8 + unit row 30
//   + gap 8 + result 22 + gap 8 + example 18 = 336 <= 375 (7-unit categories;
//   3-5-unit categories have one unit row per side: 268 <= 375)
function pageView() {
  const t = T[lang];
  const cat = CATS[catIdx];
  const pair = sel[cat.key];
  const res = resultLine();
  const kids = [
    fenn.chips("cat", CATS.map((c) => c[lang]), catIdx),
    fenn.row([
      fenn.text(t.fromLabel, { size: "small", color: "dim" }),
      fenn.textInput("val:from", "", { hint: t.valueHint, live: true, width: 300 }),
      fenn.button("swap", { icon: "swap", tooltip: t.swapTip }),
      fenn.button("lang", { icon: "translate", tooltip: t.langName }),
    ], { gap: 8, align: "center" }),
  ];
  for (const r of unitRows("ufrom", cat, pair[0])) kids.push(r);
  kids.push(fenn.row([
    fenn.text(t.toLabel, { size: "small", color: "dim" }),
    fenn.textInput("val:to", "", { hint: t.valueHint, live: true, width: 300 }),
  ], { gap: 8, align: "center" }));
  for (const r of unitRows("uto", cat, pair[1])) kids.push(r);
  kids.push(fenn.text(res.text, { size: "body", mono: res.mono, color: res.dim ? "dim" : "text", wrap: true }));
  kids.push(fenn.text(factorLine(), { size: "small", color: "dim", wrap: true }));
  return fenn.column(kids, { gap: 8, justify: "start", scroll: true });
}

function draw() {
  app.setTile(tileView());
  app.setPage(pageView());
}

// ---- actions ----
function chipIndex(value) {
  const n = Number(value && typeof value === "object" ? value.index : value);
  return Number.isInteger(n) && n >= 0 ? n : -1;
}

function route(e) {
  const id = String(e && e.id != null ? e.id : "");
  const value = e && e.value;
  if (id === "lang") {
    lang = lang === "tr" ? "en" : "tr";
    save();
    draw();
    return;
  }
  if (id === "swap") {
    const pair = sel[CATS[catIdx].key];
    const tmp = pair[0];
    pair[0] = pair[1];
    pair[1] = tmp;
    save();
    draw();
    return;
  }
  if (id === "cat") {
    const i = chipIndex(value);
    if (i >= 0 && i < CATS.length) {
      catIdx = i;
      save();
      draw();
    }
    return;
  }
  // Unit buttons: ufrom:<index> / uto:<index> (chips-style events accepted too)
  const um = /^(ufrom|uto):(\d+)$/.exec(id);
  const ui = um ? Number(um[2]) : (id === "ufrom" || id === "uto" ? chipIndex(value) : -1);
  if (ui >= 0 && (um || id === "ufrom" || id === "uto")) {
    const cat = CATS[catIdx];
    if (ui < cat.units.length) {
      const which = um ? um[1] : id;
      sel[cat.key][which === "ufrom" ? 0 : 1] = ui;
      save();
      draw();
    }
    return;
  }
  if (id === "val:from") {
    fromVal = value == null ? "" : String(value);
    side = "from";
    draw();
    return;
  }
  if (id === "val:to") {
    toVal = value == null ? "" : String(value);
    side = "to";
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
