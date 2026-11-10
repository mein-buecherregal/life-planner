// Life Planner – iPhone-Widget für Scriptable
// Parameter im Widget (lange drücken → Widget bearbeiten → Parameter):
//   heute · gewohnheiten · kalender · aufgaben · vers · fortschritt
// Dieses Script enthält deinen geheimen Widget-Schlüssel – bitte nicht weitergeben.
const TOKEN = "__TOKEN__", KEY = "__KEY__", PROJECT = "__PROJECT__";
const SRC = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/widgets/${TOKEN}?key=${KEY}`;

const fm = FileManager.local();
const CACHE = fm.joinPath(fm.documentsDirectory(), "lifeplanner-widget-" + TOKEN.slice(0, 8) + ".json");

async function load() {
  try {
    const r = new Request(SRC); r.timeoutInterval = 15;
    const j = await r.loadJSON();
    if (j && j.fields && j.fields.json) { const s = j.fields.json.stringValue; fm.writeString(CACHE, s); return { d: JSON.parse(s), live: true }; }
  } catch (e) {}
  if (fm.fileExists(CACHE)) { try { return { d: JSON.parse(fm.readString(CACHE)), live: false }; } catch (e) {} }
  return null;
}

// ---------- Datum ----------
const pad = n => String(n).padStart(2, "0");
const isoD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const NOW = new Date(), TODAY = isoD(NOW);
const TOM = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return isoD(d); })();
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MON = ["Jan", "Feb", "März", "Apr", "Mai", "Juni", "Juli", "Aug", "Sep", "Okt", "Nov", "Dez"];
function dayLabel(k) {
  if (k === TODAY) return "Heute"; if (k === TOM) return "Morgen";
  const [y, m, d] = k.split("-").map(Number); return `${WD[new Date(y, m - 1, d).getDay()]} ${d}.${m}.`;
}

// ---------- Stil ----------
const param = ((args.widgetParameter || "heute") + "").trim().toLowerCase();
const fam = config.widgetFamily || "medium";
const res = await load();
const D = res && res.d;
const theme = (D && D.theme) || "elegant";
const hex = h => { h = (h || "").trim(); if (/^#[0-9a-f]{3}$/i.test(h)) h = "#" + h.slice(1).split("").map(c => c + c).join(""); return /^#[0-9a-f]{6}$/i.test(h) ? h : null; };
const DEF = { bg: "#f5efe6", card: "#fffcf7", ink: "#2f2822", muted: "#8a7d70", accent: "#a8865a", good: "#7d8f6a", bad: "#b5674d", soft: "#efe4d3", line: "#ebe2d5" };
const C = {}; for (const k in DEF) C[k] = new Color(hex(D && D.col && D.col[k]) || DEF[k]);

function F(size, w) {
  if (theme === "elegant") return new Font(w === "b" ? "Georgia-Bold" : w === "i" ? "Georgia-Italic" : "Georgia", size + 1);
  if (theme === "suess") return w === "b" ? Font.boldRoundedSystemFont(size) : w === "i" ? Font.italicSystemFont(size) : Font.regularRoundedSystemFont(size);
  return w === "b" ? Font.boldSystemFont(size) : w === "i" ? Font.italicSystemFont(size) : Font.systemFont(size);
}
function txt(st, s, size, w, color, lines) {
  const t = st.addText(s); t.font = F(size, w); t.textColor = color || C.ink; if (lines) t.lineLimit = lines; return t;
}
function sym(st, name, color, size) {
  const s = SFSymbol.named(name); if (!s) return; s.applyFont(Font.systemFont(size));
  const i = st.addImage(s.image); i.tintColor = color; i.imageSize = new Size(size, size); return i;
}
function bar(pct, wid, col) {
  const h = 6, dc = new DrawContext(); dc.size = new Size(wid, h); dc.opaque = false; dc.respectScreenScale = true;
  let p = new Path(); p.addRoundedRect(new Rect(0, 0, wid, h), 3, 3); dc.addPath(p); dc.setFillColor(C.soft); dc.fillPath();
  if (pct > 0) { p = new Path(); p.addRoundedRect(new Rect(0, 0, Math.max(h, wid * Math.min(1, pct)), h), 3, 3); dc.addPath(p); dc.setFillColor(col); dc.fillPath(); }
  return dc.getImage();
}
function header(st, title, right) {
  const r = st.addStack(); r.centerAlignContent();
  txt(r, title, 13, "b", C.accent, 1); r.addSpacer();
  if (right) txt(r, right, 11, "r", C.muted, 1);
  st.addSpacer(5);
}
const W = fam === "small" ? 120 : 280;
const ROWS = fam === "large" ? 11 : 4;

// ---------- Daten aufbereiten ----------
const habits = D ? (D.habits || []).map(h => ({ n: h.n, d: D.date === TODAY ? h.d : false })) : [];
const events = D ? (D.events || []).filter(e => e.d >= TODAY) : [];
const tasks = D ? (D.tasks || []) : [];

// ---------- Bausteine ----------
function habitList(st, max, compact) {
  if (!habits.length) { txt(st, "Noch keine Gewohnheiten", 12, "r", C.muted); return; }
  habits.slice(0, max).forEach(h => {
    const r = st.addStack(); r.centerAlignContent(); r.spacing = 6;
    sym(r, h.d ? "checkmark.circle.fill" : "circle", h.d ? C.good : C.muted, compact ? 12 : 14);
    txt(r, h.n, compact ? 12 : 13, "r", h.d ? C.muted : C.ink, 1);
    st.addSpacer(compact ? 3 : 4);
  });
  if (habits.length > max) txt(st, `+ ${habits.length - max} weitere`, 10, "r", C.muted);
}
function eventList(st, max, compact) {
  if (!events.length) { txt(st, "Keine Termine in Sicht", 12, "r", C.muted); return; }
  let last = "";
  events.slice(0, max).forEach(e => {
    if (e.d !== last) { if (last) st.addSpacer(2); txt(st, dayLabel(e.d), 10, "b", C.muted, 1); last = e.d; }
    const r = st.addStack(); r.spacing = 6; r.centerAlignContent();
    const ic = e.k === "geburtstag" ? "🎂 " : "";
    if (e.t) txt(r, e.t, compact ? 11 : 12, "b", C.accent, 1);
    txt(r, ic + e.n, compact ? 12 : 13, "r", C.ink, 1);
    st.addSpacer(3);
  });
}
function taskList(st, max, compact) {
  if (!tasks.length) { txt(st, "Alles erledigt 🎉", 12, "r", C.muted); return; }
  tasks.slice(0, max).forEach(t => {
    const r = st.addStack(); r.centerAlignContent(); r.spacing = 6;
    const over = t.d && t.d < TODAY, now = t.d === TODAY;
    sym(r, "circle", over ? C.bad : now ? C.accent : C.muted, compact ? 12 : 14);
    txt(r, t.n, compact ? 12 : 13, "r", C.ink, 1);
    if (!compact && t.d) { r.addSpacer(); txt(r, over ? "überfällig" : now ? "heute" : dayLabel(t.d), 10, "r", over ? C.bad : C.muted, 1); }
    st.addSpacer(compact ? 3 : 4);
  });
}
function progressRow(st, label, value, pct, col) {
  const r = st.addStack(); r.centerAlignContent();
  txt(r, label, 12, "r", C.ink, 1); r.addSpacer(); txt(r, value, 12, "b", col, 1);
  st.addSpacer(3); st.addImage(bar(pct, W, col)).imageSize = new Size(W, 6); st.addSpacer(8);
}

// ---------- Widget ----------
const w = new ListWidget();
const g = new LinearGradient(); g.colors = [C.card, C.bg]; g.locations = [0, 1]; w.backgroundGradient = g;
w.setPadding(14, 14, 12, 14);
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
const app = (D && D.app) || "https://mein-buecherregal.github.io/life-planner/";
const doneN = habits.filter(h => h.d).length;
const dateTxt = `${WD[NOW.getDay()]}, ${NOW.getDate()}. ${MON[NOW.getMonth()]}`;

if (!D) {
  header(w, "Life Planner");
  txt(w, "Öffne einmal den Life Planner, dann erscheinen hier deine Daten.", 12, "r", C.muted, 4);
  w.url = app;
} else if (param.startsWith("gew")) {
  header(w, "Gewohnheiten", habits.length ? `${doneN}/${habits.length}` : "");
  habitList(w, fam === "large" ? 12 : fam === "small" ? 4 : 5, fam === "small");
  w.url = app + "#gewohnheiten";
} else if (param.startsWith("kal") || param.startsWith("ter")) {
  header(w, fam === "small" ? "Termine" : "Kalender", fam === "small" ? "" : dateTxt);
  eventList(w, fam === "large" ? 10 : 3, fam === "small");
  w.url = app + "#planer";
} else if (param.startsWith("auf")) {
  header(w, "Aufgaben", D.openTasks ? `${D.openTasks} offen` : "");
  taskList(w, fam === "large" ? 12 : 4, fam === "small");
  w.url = app + "#planer";
} else if (param.startsWith("ver")) {
  const [ref, vt] = D.verse || ["", ""];
  txt(w, "Vers des Tages", 11, "b", C.accent, 1); w.addSpacer(6);
  txt(w, "„" + vt + "“", fam === "small" ? 12 : fam === "large" ? 18 : 14, "i", C.ink, fam === "small" ? 7 : 6).minimumScaleFactor = 0.6;
  w.addSpacer(6); txt(w, ref + " · Luther 1912", 10, "r", C.muted, 1);
  w.url = app + "#heute";
} else if (param.startsWith("fort") || param.startsWith("sch")) {
  header(w, "Fortschritt", fam === "small" ? "" : dateTxt);
  const s = D.steps || { n: 0, g: 2000 };
  progressRow(w, "👟 Schritte", s.n.toLocaleString("de-DE"), s.g ? s.n / s.g : 0, C.accent);
  if (habits.length) progressRow(w, "🌱 Gewohnheiten", `${doneN}/${habits.length}`, doneN / habits.length, C.good);
  if (fam !== "small" && D.save) progressRow(w, "💰 Sparziel", D.save.pct + " %", D.save.pct / 100, C.good);
  w.url = app + "#fitness";
} else { // heute
  if (fam === "small") {
    header(w, "Heute", "");
    txt(w, habits.length ? `${doneN}/${habits.length}` : "–", 28, "b", C.accent, 1);
    txt(w, "Gewohnheiten", 11, "r", C.muted, 1); w.addSpacer(6);
    const ne = events[0];
    if (ne) { txt(w, (ne.d === TODAY ? "" : dayLabel(ne.d) + " ") + (ne.t ? ne.t + " " : ""), 10, "b", C.muted, 1); txt(w, ne.n, 12, "r", C.ink, 2); }
    else txt(w, "Keine Termine", 11, "r", C.muted, 1);
  } else if (fam === "medium") {
    header(w, dateTxt, habits.length ? `🌱 ${doneN}/${habits.length}` : "");
    const row = w.addStack(); row.topAlignContent(); row.spacing = 12;
    const L = row.addStack(); L.layoutVertically(); L.size = new Size(130, 0);
    const R = row.addStack(); R.layoutVertically();
    habitList(L, 4, true);
    eventList(R, 2, true); R.addSpacer(3); taskList(R, 2, true);
  } else {
    header(w, dateTxt, "");
    txt(w, `🌱 Gewohnheiten · ${doneN}/${habits.length}`, 11, "b", C.muted, 1); w.addSpacer(4);
    habitList(w, 5, true); w.addSpacer(6);
    txt(w, "📅 Termine", 11, "b", C.muted, 1); w.addSpacer(4);
    eventList(w, 4, true); w.addSpacer(6);
    txt(w, "✅ Aufgaben", 11, "b", C.muted, 1); w.addSpacer(4);
    taskList(w, 4, true);
  }
  w.url = app + "#heute";
}
w.addSpacer();
if (res && !res.live) { const f = w.addText("offline · zuletzt gespeichert"); f.font = Font.systemFont(8); f.textColor = C.muted; }

if (config.runsInWidget) Script.setWidget(w);
else if (fam === "small") await w.presentSmall();
else if (fam === "large") await w.presentLarge();
else await w.presentMedium();
Script.complete();
