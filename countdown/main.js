"use strict";
// Countdown · Gün Sayacı — days left until important dates.
// Live plugin: redraws on events and, once a minute, only when the day changed.
const fenn = require("./fenn");
const app = new fenn.Plugin();

// ---- strings (TR + EN) ----
const T = {
  tr: {
    nameHint: "Etkinlik adı",
    dateHint: "Tarih: GG.AA veya YYYY-AA-GG",
    add: "Ekle",
    del: "Sil",
    today: "Bugün!",
    daysLeft: (n) => "kalan " + n + " gün",
    daysAgo: (n) => n + " gün önce",
    everyYear: "her yıl",
    empty: "Henüz etkinlik eklenmedi.",
    tileEmpty: "Etkinlik yok",
    errName: "Önce bir etkinlik adı girin.",
    errDate: "Geçersiz tarih. GG.AA, GG.AA.YYYY veya YYYY-AA-GG kullanın.",
    langName: "English",
  },
  en: {
    nameHint: "Event name",
    dateHint: "Date: DD.MM or YYYY-MM-DD",
    add: "Add",
    del: "Delete",
    today: "Today!",
    daysLeft: (n) => n + " days left",
    daysAgo: (n) => n + " days ago",
    everyYear: "every year",
    empty: "No events added yet.",
    tileEmpty: "No events",
    errName: "Enter an event name first.",
    errDate: "Invalid date. Use DD.MM, DD.MM.YYYY or YYYY-MM-DD.",
    langName: "Türkçe",
  },
};

// ---- language (persisted; default follows the system locale) ----
const locale = String((Intl.DateTimeFormat().resolvedOptions().locale) || "en").toLowerCase();
let lang = app.load("lang", locale.startsWith("tr") ? "tr" : "en");
if (lang !== "tr" && lang !== "en") lang = "en";

// ---- state (the event list is persisted) ----
let events = app.load("events", []);
if (!Array.isArray(events)) events = [];
events = events.filter((e) => e && typeof e.name === "string" && typeof e.date === "string");
let nameVal = "";
let dateVal = "";
let formSeq = 1;
let err = "";

function save() {
  app.save("events", events);
  app.save("lang", lang);
}

// ---- dates ----
function parseDate(raw) {
  const s = String(raw == null ? "" : raw).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return makeDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (m) return makeDate(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})\.(\d{1,2})$/.exec(s);
  if (m) return makeDate(null, +m[2], +m[1]); // no year: repeats every year
  return null;
}

function makeDate(year, month, day) {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const y = year == null ? 2000 : year; // 2000 is a leap year, so 29.02 validates
  const d = new Date(y, month - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return { fixed: year != null, year, month, day };
}

function yearlyDate(year, month, day) {
  const last = new Date(year, month, 0).getDate(); // day 0 of next month
  return new Date(year, month - 1, Math.min(day, last)); // 29.02 -> 28.02 in ordinary years
}

function daysLeft(parsed, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (parsed.fixed) {
    return Math.round((new Date(parsed.year, parsed.month - 1, parsed.day) - today) / 86400000);
  }
  let target = yearlyDate(now.getFullYear(), parsed.month, parsed.day);
  if (target < today) target = yearlyDate(now.getFullYear() + 1, parsed.month, parsed.day);
  return Math.round((target - today) / 86400000);
}

// sort: soonest future first, then the closest past, invalid dates last
function score(d) {
  if (d === null || d === undefined) return 2e9;
  return d >= 0 ? d : 1e6 - d;
}

function computeRows() {
  const now = new Date();
  return events
    .map((ev) => {
      const p = parseDate(ev.date);
      return { ev, p, d: p ? daysLeft(p, now) : null };
    })
    .sort((a, b) => score(a.d) - score(b.d));
}

function nextId() {
  return events.reduce((m, ev) => Math.max(m, Number(ev.id) || 0), -1) + 1;
}

// ---- views ----
function tileView(rows) {
  const t = T[lang];
  const best = rows.find((r) => r.d !== null);
  if (!best) {
    return fenn.column([
      fenn.icon("calendar", { size: 26, color: "accent" }),
      fenn.text(t.tileEmpty, { size: "small", color: "dim" }),
    ], { gap: 2, align: "center", justify: "center" });
  }
  const d = best.d;
  const big = d === 0 ? t.today : String(Math.abs(d));
  const val = d === 0 ? 1 : d > 0 ? Math.max(0, 1 - d / 365) : 0; // ring: one year at a time
  return fenn.column([
    fenn.row([
      fenn.ring(val, { size: 30 }),
      fenn.text(big, { size: "big" }),
    ], { gap: 6, align: "center" }),
    fenn.text(best.ev.name, { size: "small", color: "dim" }),
  ], { gap: 2, align: "center", justify: "center" });
}

function dayLabel(d) {
  const t = T[lang];
  if (d === null) return { text: "—", color: "dim" };
  if (d === 0) return { text: t.today, color: "accent" };
  if (d > 0) return { text: t.daysLeft(d), color: "text" };
  return { text: t.daysAgo(-d), color: "dim" };
}

function rowView(r) {
  const t = T[lang];
  const day = dayLabel(r.d);
  const sub = r.p && !r.p.fixed ? r.ev.date + " · " + t.everyYear : r.ev.date;
  return fenn.row([
    fenn.column([
      fenn.text(r.ev.name, { size: "body", bold: true }),
      fenn.text(sub, { size: "small", color: "dim" }),
    ], { gap: 0 }),
    fenn.spacer(),
    fenn.text(day.text, { size: "small", color: day.color }),
    fenn.button("del:" + r.ev.id, { icon: "trash", tooltip: t.del }),
  ], { align: "center", gap: 8 });
}

function pageView(rows) {
  const t = T[lang];
  const children = [
    fenn.row([fenn.spacer(), fenn.button("lang", { icon: "translate", tooltip: t.langName })], { align: "center" }),
    fenn.row([
      fenn.textInput("name:" + formSeq, "", { hint: t.nameHint, live: true, width: 220 }),
      fenn.textInput("date:" + formSeq, "", { hint: t.dateHint, live: true, width: 170 }),
      fenn.button("add", { label: t.add, icon: "plus", primary: true }),
    ], { gap: 6, align: "center" }),
  ];
  if (err) children.push(fenn.text(err, { size: "small", color: "orange" }));
  if (!rows.length) {
    children.push(fenn.text(t.empty, { size: "small", color: "dim" }));
  } else {
    for (const r of rows) children.push(rowView(r));
  }
  return fenn.column(children, { gap: 8, scroll: true });
}

function draw() {
  const rows = computeRows();
  app.setTile(tileView(rows));
  app.setPage(pageView(rows));
}

// ---- actions ----
function addEvent() {
  const t = T[lang];
  const name = nameVal.trim();
  const raw = dateVal.trim();
  if (!name) {
    err = t.errName;
    draw();
    return;
  }
  if (!parseDate(raw)) {
    err = t.errDate;
    draw();
    return;
  }
  events.push({ id: nextId(), name, date: raw });
  nameVal = "";
  dateVal = "";
  err = "";
  formSeq += 1; // fresh ids so the inputs clear
  save();
  draw();
}

function route(e) {
  const id = String(e && e.id != null ? e.id : "");
  const value = e && e.value;
  if (id === "lang") {
    lang = lang === "tr" ? "en" : "tr";
    err = "";
    save();
    draw();
    return;
  }
  if (id === "add") {
    addEvent();
    return;
  }
  if (id.indexOf("del:") === 0) {
    const n = Number(id.slice(4));
    if (Number.isInteger(n)) {
      const before = events.length;
      events = events.filter((ev) => Number(ev.id) !== n);
      if (events.length !== before) {
        err = "";
        save();
      }
      draw();
    }
    return;
  }
  if (id.indexOf("name:") === 0) {
    nameVal = value == null ? "" : String(value);
    if (e.kind === "submit") addEvent();
    return;
  }
  if (id.indexOf("date:") === 0) {
    dateVal = value == null ? "" : String(value);
    if (e.kind === "submit") addEvent();
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

// The day changes at most once a minute; redraw only when it did.
let lastDay = new Date().toDateString();
setInterval(() => {
  try {
    const k = new Date().toDateString();
    if (k !== lastDay) {
      lastDay = k;
      draw();
    }
  } catch (ex) {
    app.log(String((ex && ex.stack) || ex), "error");
  }
}, 60000);

try {
  draw();
} catch (ex) {
  app.log(String((ex && ex.stack) || ex), "error");
}
