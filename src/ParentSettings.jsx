import React, { useState } from "react";
import {
  DEFAULTS, DAY_NAMES, SLOT, minToHHMM, hhmmToMin, snap, slotsOf, sanitize,
} from "./settings.js";

/* ============================================================
   מסך ההורה. עורך עותק מקומי של ההגדרות, ומחזיר אותו רק
   בשמירה — כך שיציאה בלי לשמור לא נוגעת במסך הילד.
   ============================================================ */

const C = { ink: "#17233f", inkSoft: "#22315a", paper: "#fff6e6", line: "rgba(255,246,230,.14)" };

const ICONS = ["📚", "📺", "🚲", "🧱", "🎨", "📖", "🎸", "🧒", "⚽", "🏀", "🎹", "🧩", "🐕", "🍎", "🛏️", "🚿", "🍝", "🍽️", "🛁", "🎯", "✏️", "🧘", "🏊", "⏰"];
const COLORS = ["#c9791a", "#6c4bb6", "#4a7c2f", "#2b6cb0", "#b3325c", "#0f8a7e", "#8a6a2f", "#c2410c", "#5b6478", "#8c2f3a"];

export default function ParentSettings({ settings, onSave, onClose, onChangePin }) {
  const [d, setD] = useState(settings);
  const [note, setNote] = useState("");

  const patch = (k, v) => { setD((s) => ({ ...s, [k]: v })); setNote(""); };
  const dirty = JSON.stringify(d) !== JSON.stringify(settings);
  const slots = slotsOf(d);

  /* בלוק קבוע שלא נכנס לגבולות היום, או שמתנגש בבלוק אחר באותו יום,
     נמחק בשמירה. מסמנים אותו מראש כדי שזה לא יקרה בשקט. */
  const fixedIssue = (f, i) => {
    const s0 = hhmmToMin(f.start), e0 = hhmmToMin(f.end);
    if (s0 == null || e0 == null || e0 - s0 < SLOT) return "טווח לא תקין";
    if (s0 < d.dayStart || e0 > d.dayEnd) return "מחוץ לגבולות היום";
    for (let j = 0; j < i; j++) {
      const g = d.fixed[j];
      if (fixedIssue(g, j)) continue; // הבלוק הקודם ייפול בעצמו
      const sameDay = !g.days || !f.days || g.days.some((x) => f.days.includes(x));
      if (sameDay && s0 < hhmmToMin(g.end) && hhmmToMin(g.start) < e0) {
        return `מתנגש עם "${g.label}"`;
      }
    }
    return null;
  };
  const doomed = d.fixed.map(fixedIssue).filter(Boolean).length;

  /* ---------- בלוקים קבועים ---------- */
  const patchFixed = (i, k, v) =>
    patch("fixed", d.fixed.map((f, j) => (j === i ? { ...f, [k]: v } : f)));

  const addFixed = () => {
    const start = minToHHMM(d.dayStart);
    const end = minToHHMM(Math.min(d.dayStart + 60, d.dayEnd));
    patch("fixed", [...d.fixed, { id: "fx" + Date.now(), icon: "📌", label: "בלוק חדש", start, end }]);
  };

  const toggleDay = (i, dow) => {
    const f = d.fixed[i];
    const cur = f.days || [0, 1, 2, 3, 4, 5, 6];
    const next = cur.includes(dow) ? cur.filter((x) => x !== dow) : [...cur, dow].sort();
    patchFixed(i, "days", next.length === 7 ? undefined : next);
  };

  /* ---------- פעילויות ---------- */
  const patchAct = (i, k, v) =>
    patch("activities", d.activities.map((a, j) => (j === i ? { ...a, [k]: v } : a)));

  const addAct = () =>
    patch("activities", [...d.activities, {
      id: "act" + Date.now(), icon: "⭐", label: "פעילות חדשה",
      color: COLORS[d.activities.length % COLORS.length], min: 2,
    }]);

  const removeAct = (i) => {
    const gone = d.activities[i].id;
    // מנקים תלויות שהצביעו על מה שנמחק, אחרת נוצר אריח חסום לנצח
    patch("activities", d.activities
      .filter((_, j) => j !== i)
      .map((a) => (a.after === gone ? { ...a, after: undefined } : a)));
  };

  /* ---------- שמירה ---------- */
  const save = () => {
    const clean = sanitize(d);
    const adjusted = JSON.stringify(clean) !== JSON.stringify(sanitize({ ...d, pin: clean.pin }));
    onSave(clean);
    setD(clean);
    setNote(adjusted ? "נשמר. חלק מהערכים תוקנו כדי להתאים לציר." : "נשמר.");
  };

  const resetAll = () => {
    setD({ ...sanitize(DEFAULTS), pin: d.pin }); // ה-PIN לא מתאפס יחד עם השאר
    setNote("הוחזר לברירת המחדל. עדיין צריך לשמור.");
  };

  return (
    <div dir="rtl" style={{
      position: "fixed", inset: 0, background: C.ink, color: C.paper, zIndex: 90,
      overflowY: "auto", fontFamily: "'Varela Round', system-ui, sans-serif",
      WebkitOverflowScrolling: "touch",
    }}>
      <style>{`
        .pIn { font-family: inherit; background: #17233f; color: #fff6e6;
               border: 2px solid rgba(255,246,230,.25); border-radius: 10px; padding: 7px 9px; font-size: 15px; }
        .pIn:focus { outline: none; border-color: rgba(255,246,230,.6); }
        .pRow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .pCard { border: 1px solid ${C.line}; border-radius: 14px; padding: 12px; margin-bottom: 10px; background: rgba(255,255,255,.03); }
        .pBtn { font-family: inherit; border-radius: 999px; border: 2px solid rgba(255,246,230,.3);
                background: ${C.inkSoft}; color: #fff6e6; padding: 8px 16px; font-size: 15px; }
        .pSwatch { width: 26px; height: 26px; border-radius: 999px; border: 2px solid rgba(255,246,230,.4); padding: 0; }
        label { font-size: 14px; }
      `}</style>

      {/* סרגל עליון דביק — שמירה תמיד בהישג יד */}
      <div style={{
        position: "sticky", top: 0, background: C.ink, zIndex: 2, padding: "14px 16px",
        borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ fontSize: 22 }}>⚙️</span>
        <div style={{ fontSize: 20, marginInlineEnd: "auto" }}>הגדרות הורה</div>
        {dirty && <span style={{ fontSize: 13, opacity: 0.65 }}>יש שינויים</span>}
        <button className="pBtn" onClick={save} disabled={!dirty}
          style={{ background: dirty ? "#4a7c2f" : C.inkSoft, opacity: dirty ? 1 : 0.45 }}>
          שמור
        </button>
        <button className="pBtn" onClick={onClose}>סגור</button>
      </div>

      <div style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
        {note && <div style={{ fontSize: 14, color: "#a8e6b0", marginBottom: 12 }}>{note}</div>}

        {/* ---------- גבולות היום ---------- */}
        <Section title="גבולות היום" hint="הציר מסומן בשעות שלמות, לכן הגבולות הם שעות עגולות">
          <div className="pRow">
            <label>מתחיל</label>
            <select className="pIn" value={d.dayStart / 60}
              onChange={(e) => patch("dayStart", Number(e.target.value) * 60)}>
              {Array.from({ length: 23 }, (_, h) => h).map((h) => (
                <option key={h} value={h} disabled={h * 60 >= d.dayEnd}>{minToHHMM(h * 60)}</option>
              ))}
            </select>
            <label>נגמר</label>
            <select className="pIn" value={d.dayEnd / 60}
              onChange={(e) => patch("dayEnd", Number(e.target.value) * 60)}>
              {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                <option key={h} value={h} disabled={h * 60 <= d.dayStart}>{minToHHMM(h * 60)}</option>
              ))}
            </select>
            <span style={{ fontSize: 13, opacity: 0.6 }}>{slots} רבעי שעה</span>
          </div>
        </Section>

        {/* ---------- כללים ---------- */}
        <Section title="כללים" hint="ברבעי שעה — 4 הם שעה">
          <div className="pRow" style={{ gap: 18 }}>
            <Stepper label="תקציב מסך" value={d.screenBudget} min={0} max={slots}
              onChange={(v) => patch("screenBudget", v)} />
            <Stepper label="אורך מקסימלי לפעילות" value={d.maxLen} min={1} max={slots}
              onChange={(v) => patch("maxLen", v)} />
          </div>
        </Section>

        {/* ---------- בלוקים קבועים ---------- */}
        <Section title="בלוקים קבועים" hint="הילד רואה אותם נעולים ולא יכול להזיז או למחוק">
          {doomed > 0 && (
            <div style={{
              fontSize: 14, lineHeight: 1.6, marginBottom: 12, padding: "9px 12px",
              borderRadius: 12, background: "rgba(140,47,58,.25)", border: "1px solid #b35",
            }}>
              ⚠️ {doomed === 1 ? "בלוק אחד יימחק בשמירה" : `${doomed} בלוקים יימחקו בשמירה`} —
              תקן את הזמנים או מחק אותם ידנית
            </div>
          )}
          {d.fixed.map((f, i) => {
            const issue = fixedIssue(f, i);
            return (
            <div key={f.id} className="pCard" style={issue ? { borderColor: "#b35", background: "rgba(140,47,58,.12)" } : undefined}>
              <div className="pRow">
                <IconPick value={f.icon} onChange={(v) => patchFixed(i, "icon", v)} />
                <input className="pIn" style={{ flex: "1 1 110px", minWidth: 90, maxWidth: 200 }} value={f.label}
                  maxLength={24} onChange={(e) => patchFixed(i, "label", e.target.value)} />
                <TimePick value={f.start} min={d.dayStart} max={d.dayEnd - SLOT}
                  onChange={(v) => patchFixed(i, "start", v)} />
                <span style={{ opacity: 0.5 }}>–</span>
                <TimePick value={f.end} min={d.dayStart + SLOT} max={d.dayEnd}
                  onChange={(v) => patchFixed(i, "end", v)} />
                <button className="pBtn" style={{ background: "#8c2f3a", marginInlineStart: "auto" }}
                  onClick={() => patch("fixed", d.fixed.filter((_, j) => j !== i))}>🗑</button>
              </div>
              <div className="pRow" style={{ marginTop: 10, gap: 6 }}>
                <span style={{ fontSize: 13, opacity: 0.6, marginInlineEnd: 4 }}>ימים</span>
                {DAY_NAMES.map((n, dow) => {
                  const on = !f.days || f.days.includes(dow);
                  return (
                    <button key={dow} onClick={() => toggleDay(i, dow)} style={{
                      width: 32, height: 32, borderRadius: 999, fontFamily: "inherit", fontSize: 14,
                      border: `2px solid ${on ? "#8ef0a0" : "rgba(255,246,230,.25)"}`,
                      background: on ? "rgba(142,240,160,.2)" : "transparent",
                      color: on ? "#fff6e6" : "rgba(255,246,230,.45)",
                    }}>{n}</button>
                  );
                })}
                {!f.days && <span style={{ fontSize: 13, opacity: 0.5 }}>כל יום</span>}
              </div>
              {issue && <div style={{ fontSize: 13, color: "#ff9d9d", marginTop: 8 }}>⚠️ {issue}</div>}
            </div>
          );})}
          <button className="pBtn" onClick={addFixed}>＋ בלוק קבוע</button>
        </Section>

        {/* ---------- פעילויות ---------- */}
        <Section title="פעילויות" hint="מה שהילד יכול לגרור אל הציר">
          {d.activities.map((a, i) => (
            <div key={a.id} className="pCard">
              <div className="pRow">
                <IconPick value={a.icon} onChange={(v) => patchAct(i, "icon", v)} />
                <input className="pIn" style={{ flex: "1 1 110px", minWidth: 90, maxWidth: 200 }} value={a.label}
                  maxLength={24} onChange={(e) => patchAct(i, "label", e.target.value)} />
                <ColorPick value={a.color} onChange={(v) => patchAct(i, "color", v)} />
                <button className="pBtn" style={{ background: "#8c2f3a", marginInlineStart: "auto" }}
                  onClick={() => removeAct(i)} disabled={d.activities.length === 1}
                  title={d.activities.length === 1 ? "צריכה להישאר פעילות אחת" : "מחיקה"}>🗑</button>
              </div>
              <div className="pRow" style={{ marginTop: 10, gap: 16 }}>
                <Stepper label="אורך התחלתי" value={a.min} min={1} max={d.maxLen}
                  onChange={(v) => patchAct(i, "min", v)} />
                <Check label="חובה" checked={!!a.must} onChange={(v) => patchAct(i, "must", v)} />
                <Check label="פעם ביום" checked={!!a.single} onChange={(v) => patchAct(i, "single", v)} />
                <Check label="נחשב מסך" checked={!!a.screen} onChange={(v) => patchAct(i, "screen", v)} />
              </div>
              <div className="pRow" style={{ marginTop: 10 }}>
                <label>רק אחרי</label>
                <select className="pIn" value={a.after || ""}
                  onChange={(e) => patchAct(i, "after", e.target.value || undefined)}>
                  <option value="">— בלי תנאי —</option>
                  {d.activities.filter((o) => o.id !== a.id).map((o) => (
                    <option key={o.id} value={o.id}>{o.icon} {o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          <button className="pBtn" onClick={addAct}>＋ פעילות</button>
        </Section>

        {/* ---------- תחזוקה ---------- */}
        <Section title="שונות">
          <div className="pRow" style={{ gap: 10 }}>
            <button className="pBtn" onClick={onChangePin}>שינוי קוד הורה</button>
            <button className="pBtn" onClick={resetAll}>החזרה לברירת המחדל</button>
          </div>
          <p style={{ fontSize: 13, opacity: 0.5, lineHeight: 1.7, marginTop: 12 }}>
            ההגדרות נשמרות על המכשיר הזה בלבד. שינוי בטלפון שלך לא יגיע לטאבלט של הילד —
            שם צריך להגדיר בנפרד.
          </p>
        </Section>
      </div>
    </div>
  );
}

/* ---------- חלקי ממשק קטנים ---------- */

function Section({ title, hint, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontSize: 17, marginBottom: 4 }}>{title}</div>
      {hint && <div style={{ fontSize: 13, opacity: 0.5, marginBottom: 10 }}>{hint}</div>}
      {children}
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }) {
  const step = (delta) => onChange(Math.max(min, Math.min(max, value + delta)));
  return (
    <div className="pRow" style={{ gap: 6 }}>
      <label style={{ opacity: 0.8 }}>{label}</label>
      <button className="pBtn" style={{ padding: "4px 12px" }} onClick={() => step(-1)} disabled={value <= min}>－</button>
      <span style={{ minWidth: 22, textAlign: "center", fontSize: 16 }}>{value}</span>
      <button className="pBtn" style={{ padding: "4px 12px" }} onClick={() => step(1)} disabled={value >= max}>＋</button>
    </div>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label className="pRow" style={{ gap: 6, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, accentColor: "#4a7c2f" }} />
      {label}
    </label>
  );
}

function IconPick({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button className="pBtn" onClick={() => setOpen((o) => !o)}
        style={{ fontSize: 24, padding: "2px 10px", minWidth: 48 }}>{value}</button>
      {open && (
        <div style={{
          position: "absolute", top: 46, right: 0, zIndex: 5, width: 226, padding: 10,
          background: C.inkSoft, borderRadius: 14, border: `2px solid rgba(255,246,230,.25)`,
          boxShadow: "0 10px 24px rgba(0,0,0,.5)",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
            {ICONS.map((ic) => (
              <button key={ic} onClick={() => { onChange(ic); setOpen(false); }} style={{
                fontSize: 21, padding: 3, border: "none", borderRadius: 8,
                background: ic === value ? "rgba(255,246,230,.2)" : "transparent", cursor: "pointer",
              }}>{ic}</button>
            ))}
          </div>
          <input className="pIn" style={{ width: "100%", marginTop: 8, boxSizing: "border-box", textAlign: "center" }}
            value={value} maxLength={8} placeholder="או אימוג'י אחר"
            onChange={(e) => onChange(e.target.value)} />
        </div>
      )}
    </div>
  );
}

function ColorPick({ value, onChange }) {
  return (
    <div className="pRow" style={{ gap: 4 }}>
      {COLORS.map((c) => (
        <button key={c} className="pSwatch" onClick={() => onChange(c)} style={{
          background: c, borderColor: c === value ? "#fff6e6" : "rgba(255,246,230,.25)",
          borderWidth: c === value ? 3 : 2,
        }} />
      ))}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: 30, height: 28, padding: 0, border: "none", background: "none" }} />
    </div>
  );
}

/* בורר זמן ברבעי שעה בתוך גבולות היום */
function TimePick({ value, min, max, onChange }) {
  const opts = [];
  for (let t = snap(min); t <= max; t += SLOT) opts.push(t);
  const cur = hhmmToMin(value);
  return (
    <select className="pIn" value={cur} onChange={(e) => onChange(minToHHMM(Number(e.target.value)))}>
      {!opts.includes(cur) && <option value={cur}>{minToHHMM(cur)}</option>}
      {opts.map((t) => <option key={t} value={t}>{minToHHMM(t)}</option>)}
    </select>
  );
}
