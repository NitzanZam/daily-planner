/* ============================================================
   שכבת ההגדרות — מה שהיה קונסטנטות בקוד הוא עכשיו מצב נערך.
   כל מה שמסך ההורה משנה עובר דרך כאן, וגם נבדק כאן לפני
   שהוא מגיע למסך הילד, כדי שהגדרה שבורה לא תפיל אותו.
   ============================================================ */

export const SLOT = 10;         // רזולוציה בדקות
export const SLOT_H = 18;       // גובה משבצת בפיקסלים
export const PER_HOUR = 60 / SLOT; // כמה משבצות נכנסות בשעה

/* תיאור משך בעברית — משבצות הן יחידה פנימית, ההורה חושב בדקות */
export const durLabel = (slots) => {
  const m = slots * SLOT;
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60), r = m % 60;
  if (r) return `${h} ש׳ ${r} דק׳`;
  return h === 1 ? "שעה" : `${h} שעות`;
};

export const STORE_KEY = "planner:settings:v1";

export const DAY_NAMES = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export const DEFAULTS = {
  version: 1,
  pin: null,              // נקבע בכניסה הראשונה למסך ההורה
  dayStart: 14 * 60,
  dayEnd: 20 * 60,
  screenBudget: 6,        // במשבצות (6 = שעה)
  maxLen: 12,             // אורך מקסימלי לפעילות (12 = שעתיים)
  fixed: [
    { id: "lunch",  icon: "🍝", label: "צהריים", start: "14:00", end: "14:40" },
    { id: "ball",   icon: "⚽", label: "כדורגל", start: "16:00", end: "17:00", days: [1, 3] },
    { id: "dinner", icon: "🍽️", label: "ערב",    start: "18:30", end: "19:00" },
    { id: "bath",   icon: "🛁", label: "מקלחת",  start: "19:20", end: "20:00" },
  ],
  activities: [
    { id: "hw",     icon: "📚", label: "שיעורים", color: "#c9791a", min: 3, must: true, single: true },
    { id: "screen", icon: "📺", label: "מסך",     color: "#6c4bb6", min: 3, screen: true, after: "hw" },
    { id: "out",    icon: "🚲", label: "בחוץ",    color: "#4a7c2f", min: 3 },
    { id: "lego",   icon: "🧱", label: "לגו",     color: "#2b6cb0", min: 3 },
    { id: "draw",   icon: "🎨", label: "ציור",    color: "#b3325c", min: 3 },
    { id: "read",   icon: "📖", label: "קריאה",   color: "#0f8a7e", min: 3 },
    { id: "guitar", icon: "🎸", label: "גיטרה",   color: "#8a6a2f", min: 3 },
    { id: "friend", icon: "🧒", label: "חבר",     color: "#c2410c", min: 6 },
  ],
};

/* ---------- זמנים ---------- */

export const hhmmToMin = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
};

export const minToHHMM = (t) =>
  `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;

// עיגול לרבע השעה הקרוב — הציר לא יודע לצייר כלום בין לבין
export const snap = (t) => Math.round(t / SLOT) * SLOT;

export const slotsOf = (s) => (s.dayEnd - s.dayStart) / SLOT;

/* ---------- בדיקה וניקוי ---------- */

const clampInt = (v, lo, hi, fallback) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
};

const isHex = (c) => /^#[0-9a-fA-F]{6}$/.test(String(c || ""));

const cleanId = (v, fallback) => {
  const s = String(v || "").replace(/[^a-zA-Z0-9_-]/g, "");
  return s || fallback;
};

const cleanText = (v, fallback, max = 24) => {
  const s = String(v == null ? "" : v).trim().slice(0, max);
  return s || fallback;
};

/* מחזיר תמיד אובייקט הגדרות שמסך הילד יכול לעבוד איתו.
   כל שדה פגום נופל לברירת המחדל במקום להפיל את האפליקציה. */
export function sanitize(raw) {
  const src = raw && typeof raw === "object" ? raw : {};

  // גבולות היום — שעות שלמות, כדי שסימוני הציר יישארו נקיים
  let dayStart = clampInt(src.dayStart, 0, 23 * 60, DEFAULTS.dayStart);
  let dayEnd = clampInt(src.dayEnd, 60, 24 * 60, DEFAULTS.dayEnd);
  dayStart = Math.floor(dayStart / 60) * 60;
  dayEnd = Math.ceil(dayEnd / 60) * 60;
  if (dayEnd - dayStart < 60) {            // לפחות שעה, אחרת אין ציר
    dayStart = DEFAULTS.dayStart;
    dayEnd = DEFAULTS.dayEnd;
  }
  const slots = (dayEnd - dayStart) / SLOT;

  const maxLen = clampInt(src.maxLen, 1, slots, Math.min(DEFAULTS.maxLen, slots));
  const screenBudget = clampInt(src.screenBudget, 0, slots, Math.min(DEFAULTS.screenBudget, slots));

  const pin = /^\d{4}$/.test(String(src.pin || "")) ? String(src.pin) : null;

  /* בלוקים קבועים: חייבים ליפול בתוך היום, על רשת המשבצות,
     ובלי לדרוך אחד על השני באותו יום בשבוע. */
  const fixedIds = new Set();
  const fixed = [];
  for (const f of Array.isArray(src.fixed) ? src.fixed : []) {
    if (!f || typeof f !== "object") continue;
    let s = hhmmToMin(f.start), e = hhmmToMin(f.end);
    if (s == null || e == null) continue;
    s = snap(s); e = snap(e);
    if (s < dayStart || e > dayEnd || e - s < SLOT) continue;

    let days = null;
    if (Array.isArray(f.days)) {
      days = [...new Set(f.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
      if (days.length === 0 || days.length === 7) days = null; // כל השבוע = בלי הגבלה
    }

    // התנגשות עם בלוק קבוע אחר שחי באותו יום
    const clash = fixed.some((g) => {
      const sameDay = !g.days || !days || g.days.some((d) => days.includes(d));
      return sameDay && s < hhmmToMin(g.end) && hhmmToMin(g.start) < e;
    });
    if (clash) continue;

    let id = cleanId(f.id, `fx${fixed.length}`);
    while (fixedIds.has(id)) id += "_";
    fixedIds.add(id);

    const item = { id, icon: cleanText(f.icon, "📌", 8), label: cleanText(f.label, "בלוק"), start: minToHHMM(s), end: minToHHMM(e) };
    if (days) item.days = days.sort();
    fixed.push(item);
  }

  /* פעילויות */
  const actIds = new Set();
  const activities = [];
  for (const a of Array.isArray(src.activities) ? src.activities : []) {
    if (!a || typeof a !== "object") continue;
    let id = cleanId(a.id, `act${activities.length}`);
    while (actIds.has(id)) id += "_";
    actIds.add(id);
    activities.push({
      id,
      icon: cleanText(a.icon, "⭐", 8),
      label: cleanText(a.label, "פעילות"),
      color: isHex(a.color) ? a.color : "#4a7c2f",
      min: clampInt(a.min, 1, maxLen, 3),
      must: !!a.must,
      single: !!a.single,
      screen: !!a.screen,
      after: a.after ? cleanId(a.after, "") : undefined,
    });
  }
  if (activities.length === 0) {
    return sanitize({ ...src, activities: DEFAULTS.activities, fixed: src.fixed });
  }

  /* תלויות: after חייב להצביע על פעילות קיימת, ובלי מעגלים —
     אחרת הילד מקבל אריח שאי אפשר לשבץ לעולם. */
  for (const a of activities) {
    if (!a.after) { delete a.after; continue; }
    if (a.after === a.id || !actIds.has(a.after)) { delete a.after; continue; }
    const seen = new Set([a.id]);
    let cur = a.after;
    while (cur) {
      if (seen.has(cur)) { delete a.after; break; }
      seen.add(cur);
      cur = activities.find((x) => x.id === cur)?.after;
    }
  }

  return { version: 1, pin, dayStart, dayEnd, screenBudget, maxLen, fixed, activities };
}

/* ---------- אחסון ---------- */

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch (e) { /* אין הגדרות שמורות — ברירת המחדל תיטען */ }
  return sanitize(DEFAULTS);
}

export function saveSettings(s) {
  const clean = sanitize(s);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(clean)); } catch (e) {}
  return clean;
}

/* בלוקים קבועים שרלוונטיים ליום מסוים, מתורגמים למשבצות */
export function fixedForDay(s, dow) {
  return s.fixed
    .filter((f) => !f.days || f.days.includes(dow))
    .map((f) => ({
      ...f,
      s: (hhmmToMin(f.start) - s.dayStart) / SLOT,
      len: (hhmmToMin(f.end) - hhmmToMin(f.start)) / SLOT,
    }));
}
