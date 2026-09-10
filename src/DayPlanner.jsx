import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { SLOT, SLOT_H, PER_HOUR, slotsOf, fixedForDay, minToHHMM } from "./settings.js";

/* ============================================================
   מסך הילד. כל החוקים מגיעים מ-settings שההורה קובע —
   כאן לא נשאר שום דבר מקובע לשינוי.
   ============================================================ */

const overlaps = (aS, aL, bS, bL) => aS < bS + bL && bS < aS + aL;
const C = { ink: "#17233f", inkSoft: "#22315a", paper: "#fff6e6", stamp: "#7c6a52" };

const MAX_STARS = 12; // מעבר לזה מציגים מספר במקום שורת כוכבים (12 = שעתיים)

export default function DayPlanner({ settings, onOpenParent }) {
  const today = useMemo(() => new Date(), []);
  const SLOTS = slotsOf(settings);
  const { screenBudget, maxLen, activities } = settings;

  const act = useCallback((id) => activities.find((a) => a.id === id), [activities]);
  const slotLabel = (s) => minToHHMM(settings.dayStart + s * SLOT);

  const fixed = useMemo(() => fixedForDay(settings, today.getDay()), [settings, today]);

  const validate = useCallback((list) => {
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const a = act(p.actId);
      if (!a) return false;
      if (p.start < 0 || p.start + p.len > SLOTS) return false;
      for (const f of fixed) if (overlaps(p.start, p.len, f.s, f.len)) return false;
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        if (overlaps(p.start, p.len, list[j].start, list[j].len)) return false;
      }
      if (a.single && list.filter((q) => q.actId === p.actId).length > 1) return false;
      if (a.after && !list.some((q) => q.actId === a.after && q.start + q.len <= p.start)) return false;
    }
    const screenUsed = list.filter((p) => act(p.actId)?.screen).reduce((n, p) => n + p.len, 0);
    return screenUsed <= screenBudget;
  }, [fixed, act, SLOTS, screenBudget]);

  /* תוכנית ששמורה מלפני שההורה שינה הגדרות יכולה להיות לא חוקית.
     במקום להציג משהו שבור, שומרים בסדר כרונולוגי כל מה שעוד מסתדר. */
  const reconcile = useCallback((list) => {
    const keep = [];
    for (const p of [...list].sort((x, y) => x.start - y.start)) {
      const a = act(p.actId);
      if (!a) continue;
      const len = Math.max(a.min, Math.min(maxLen, p.len));
      const fit = { ...p, len };
      if (validate([...keep, fit])) keep.push(fit);
    }
    return keep;
  }, [act, maxLen, validate]);

  const [placements, setPlacements] = useState([]);
  const [dragView, setDragView] = useState(null);
  const [selected, setSelected] = useState(null);
  const [shake, setShake] = useState(0);
  const [done, setDone] = useState(false);
  const [trimmed, setTrimmed] = useState(false);

  const dragRef = useRef(null);
  const stripRef = useRef(null);
  const placeRef = useRef(placements);
  placeRef.current = placements;

  /* ---------- שמירה מקומית על המכשיר ---------- */
  const key = "plan10:" + today.toISOString().slice(0, 10);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const v = JSON.parse(raw);
        if (Array.isArray(v.placements)) setPlacements(v.placements);
        if (v.done) setDone(true);
      }
    } catch (e) { /* אין תוכנית שמורה להיום */ }
  }, [key]);

  const commit = (list, isDone = done) => {
    setPlacements(list);
    if (isDone !== done) setDone(isDone);
    try { localStorage.setItem(key, JSON.stringify({ placements: list, done: isDone })); } catch (e) {}
  };

  /* התאמה מחדש אחרי שינוי הגדרות — או אחרי טעינה של תוכנית ישנה */
  useEffect(() => {
    const next = reconcile(placeRef.current);
    if (JSON.stringify(next) === JSON.stringify(placeRef.current)) return;
    setTrimmed(true);
    setPlacements(next);
    const stillDone = done && next.length > 0;
    if (stillDone !== done) setDone(stillDone);
    try { localStorage.setItem(key, JSON.stringify({ placements: next, done: stillDone })); } catch (e) {}
  }, [reconcile, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch (e) {} };

  /* ---------- גרירה ---------- */
  const startDrag = (e, actId, len, uid) => {
    if (done) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      actId, len, uid,
      dx: e.clientX - r.left,
      dy: e.clientY - r.top,
      w: uid ? r.width : Math.max(r.width, 110),
      x0: e.clientX, y0: e.clientY, moved: false,
    };
    setSelected(null);
    setDragView({
      actId, len, uid, x: e.clientX, y: e.clientY,
      dx: dragRef.current.dx, dy: dragRef.current.dy, w: dragRef.current.w,
      hover: null, valid: false,
    });
  };

  useEffect(() => {
    const move = (e) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      if (Math.abs(e.clientX - d.x0) > 6 || Math.abs(e.clientY - d.y0) > 6) d.moved = true;
      const strip = stripRef.current?.getBoundingClientRect();
      let hover = null, valid = false;
      if (strip &&
          e.clientX > strip.left - 60 && e.clientX < strip.right + 60 &&
          e.clientY > strip.top - 90 && e.clientY < strip.bottom + 90) {
        let start = Math.round((e.clientY - d.dy - strip.top) / SLOT_H);
        start = Math.max(0, Math.min(SLOTS - d.len, start));
        const others = placeRef.current.filter((p) => p.uid !== d.uid);
        valid = validate([...others, { uid: d.uid || "tmp", actId: d.actId, start, len: d.len }]);
        hover = start;
      }
      setDragView((v) => v && { ...v, x: e.clientX, y: e.clientY, hover, valid });
    };
    const up = () => {
      const d = dragRef.current;
      const v = dragView;
      dragRef.current = null;
      setDragView(null);
      if (!d) return;
      if (!d.moved && d.uid) { setSelected(d.uid); return; }
      const cur = placeRef.current;
      if (v?.hover != null && v.valid) {
        const others = cur.filter((p) => p.uid !== d.uid);
        commit([...others, { uid: d.uid || String(Date.now()), actId: d.actId, start: v.hover, len: d.len }]);
        buzz(12);
      } else if (v?.hover != null) {
        setShake((n) => n + 1);
        buzz(70);
      }
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragView, done, validate, SLOTS]);

  /* ---------- עריכה ---------- */
  const resize = (uid, delta) => {
    const p = placements.find((x) => x.uid === uid);
    const a = act(p.actId);
    const len = Math.max(a.min, Math.min(maxLen, p.len + delta));
    if (len === p.len) return;
    const next = placements.map((x) => (x.uid === uid ? { ...x, len } : x));
    if (validate(next)) { commit(next); buzz(10); } else { setShake((n) => n + 1); buzz(70); }
  };
  const remove = (uid) => { setSelected(null); commit(placements.filter((x) => x.uid !== uid)); buzz(10); };

  /* ---------- נגזרות ---------- */
  const screenUsed = placements.filter((p) => act(p.actId)?.screen).reduce((n, p) => n + p.len, 0);
  const mustLeft = activities.filter((a) => a.must && !placements.some((p) => p.actId === a.id));
  const canFinish = mustLeft.length === 0 && placements.length > 0;
  const hasScreenAct = activities.some((a) => a.screen);
  const hasRoom = (a) => {
    for (let s = 0; s <= SLOTS - a.min; s++) {
      if (validate([...placements, { uid: "tmp", actId: a.id, start: s, len: a.min }])) return true;
    }
    return false;
  };

  return (
    <div dir="rtl" style={{
      fontFamily: "'Varela Round', system-ui, sans-serif", background: C.ink,
      color: C.paper, minHeight: "100%", padding: 14, boxSizing: "border-box",
    }}>
      <style>{`
        .tile { touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
        .row { display: flex; align-items: center; }
        .board { display: flex; flex-direction: column; gap: 16px; align-items: flex-start; }
        @media (min-width: 700px) { .board { flex-direction: row-reverse; } }
        @keyframes nope { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-7px)} 75%{transform:translateX(7px)} }
        .nope { animation: nope .28s ease-in-out; }
        @keyframes pop { from{transform:scale(.7);opacity:0} to{transform:scale(1);opacity:1} }
        .pop { animation: pop .22s ease-out; }
        button { font-family: inherit; }
      `}</style>

      {/* כותרת: תקציב מסך, חובות, סיום, וכפתור ההורה */}
      <div className="row" style={{ justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          {hasScreenAct && screenBudget > 0 && (
            <>
              <span style={{ fontSize: 24 }}>📺</span>
              {screenBudget <= MAX_STARS ? (
                <div className="row" style={{ gap: 4 }}>
                  {Array.from({ length: screenBudget }).map((_, i) => (
                    <span key={i} style={{
                      fontSize: 22, opacity: i < screenUsed ? 1 : 0.28,
                      filter: i < screenUsed ? "none" : "grayscale(1)",
                    }}>⭐</span>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 18 }}>⭐ {screenUsed}/{screenBudget}</span>
              )}
            </>
          )}
        </div>
        <div className="row" style={{ gap: 10 }}>
          {mustLeft.map((a) => (
            <span key={a.id} title={a.label} style={{ fontSize: 22 }}>
              {a.icon}<span style={{ fontSize: 14 }}>❗</span>
            </span>
          ))}
          {canFinish && !done && (
            <button onClick={() => { commit(placements, true); buzz(30); }} style={{
              background: "#4a7c2f", color: "#fff", border: "none",
              borderRadius: 999, padding: "10px 22px", fontSize: 20,
            }}>✓ סיימתי</button>
          )}
          {done && (
            <button onClick={() => commit(placements, false)} style={{
              background: "transparent", color: C.paper, border: `2px solid ${C.inkSoft}`,
              borderRadius: 999, padding: "8px 18px", fontSize: 16,
            }}>✏️ לשנות</button>
          )}
          <button onClick={onOpenParent} title="הגדרות הורה" aria-label="הגדרות הורה" style={{
            background: "transparent", border: "none", color: C.paper,
            fontSize: 20, opacity: 0.45, padding: 4, cursor: "pointer",
          }}>⚙️</button>
        </div>
      </div>

      {trimmed && (
        <div className="row" style={{
          gap: 8, marginBottom: 12, fontSize: 14, background: "rgba(201,121,26,.18)",
          border: "1px solid rgba(201,121,26,.5)", borderRadius: 12, padding: "8px 12px",
        }}>
          <span>ℹ️</span>
          <span style={{ flex: 1 }}>ההגדרות התעדכנו, אז כמה בלוקים ירדו מהתוכנית</span>
          <button onClick={() => setTrimmed(false)} style={{
            background: "transparent", border: "none", color: C.paper, fontSize: 16, cursor: "pointer",
          }}>✕</button>
        </div>
      )}

      <div className="board">
        {/* ---------- הציר ---------- */}
        <div className="row" style={{ gap: 8, alignItems: "flex-start", flex: "0 0 auto" }}>
          <div style={{ width: 42, position: "relative", height: SLOTS * SLOT_H, fontSize: 12, opacity: 0.55 }}>
            {Array.from({ length: SLOTS / PER_HOUR + 1 }).map((_, i) => (
              <div key={i} style={{ position: "absolute", top: i * PER_HOUR * SLOT_H - 7, right: 0 }}>
                {slotLabel(i * PER_HOUR)}
              </div>
            ))}
          </div>

          <div
            ref={stripRef}
            key={"strip" + shake}
            className={shake ? "nope" : ""}
            style={{
              position: "relative", width: 210, height: SLOTS * SLOT_H, borderRadius: 18,
              background: "linear-gradient(#ffd98a 0%, #ffb56b 32%, #c97a6d 58%, #5b5b8f 80%, #29305c 100%)",
              boxShadow: "inset 0 0 0 2px rgba(255,255,255,.25)", overflow: "hidden", flex: "0 0 auto",
            }}
          >
            {Array.from({ length: SLOTS / PER_HOUR }).map((_, i) => (
              <div key={i} style={{
                position: "absolute", top: (i + 1) * PER_HOUR * SLOT_H, left: 0, right: 0,
                height: 1, background: "rgba(255,255,255,.35)",
              }} />
            ))}
            <div style={{ position: "absolute", top: 4, left: 8, fontSize: 18 }}>☀️</div>
            <div style={{ position: "absolute", bottom: 4, left: 8, fontSize: 18 }}>🌙</div>

            {fixed.map((f) => (
              <div key={f.id} style={{
                position: "absolute", top: f.s * SLOT_H, height: f.len * SLOT_H - 3, right: 6, left: 6,
                borderRadius: 12, background: "rgba(255,255,255,.55)", border: `2px dashed ${C.stamp}`,
                display: "flex", alignItems: "center", gap: 8, padding: "0 10px",
                color: C.stamp, boxSizing: "border-box",
              }}>
                <span style={{ fontSize: Math.min(26, f.len * SLOT_H - 12) }}>{f.icon}</span>
                <span style={{ fontSize: 14 }}>{f.label}</span>
                <span style={{ marginInlineStart: "auto", fontSize: 13 }}>🔒</span>
              </div>
            ))}

            {dragView?.hover != null && (
              <div style={{
                position: "absolute", top: dragView.hover * SLOT_H, height: dragView.len * SLOT_H - 3,
                right: 6, left: 6, borderRadius: 12, boxSizing: "border-box",
                border: `3px solid ${dragView.valid ? "#8ef0a0" : "#ff8a8a"}`,
                background: dragView.valid ? "rgba(142,240,160,.25)" : "rgba(255,138,138,.25)",
              }} />
            )}

            {placements.map((p) => {
              const a = act(p.actId);
              if (!a) return null;
              return (
                <div key={p.uid} className="tile pop"
                  onPointerDown={(e) => startDrag(e, p.actId, p.len, p.uid)}
                  style={{
                    position: "absolute", top: p.start * SLOT_H, height: p.len * SLOT_H - 3,
                    right: 6, left: 6, borderRadius: 12, background: a.color, boxSizing: "border-box",
                    opacity: dragView?.uid === p.uid ? 0.25 : 1,
                    boxShadow: selected === p.uid ? "0 0 0 3px #fff6e6" : "0 3px 0 rgba(0,0,0,.25)",
                    display: "flex", alignItems: "center", gap: 8, padding: "0 10px", cursor: "grab",
                  }}>
                  <span style={{ fontSize: Math.min(30, p.len * SLOT_H - 14) }}>{a.icon}</span>
                  <span style={{ fontSize: 15, color: "#fff" }}>{a.label}</span>
                </div>
              );
            })}
          </div>

          {/* כפתורי עריכה לבלוק שנבחר */}
          <div style={{ width: 46, position: "relative", height: SLOTS * SLOT_H, flex: "0 0 auto" }}>
            {!done && placements.filter((p) => p.uid === selected).map((p) => (
              <div key={p.uid} className="pop" style={{
                position: "absolute", top: p.start * SLOT_H,
                display: "flex", flexDirection: "column", gap: 5,
              }}>
                <Round onClick={() => resize(p.uid, 1)}>＋</Round>
                <Round onClick={() => resize(p.uid, -1)}>－</Round>
                <Round onClick={() => remove(p.uid)} bg="#8c2f3a">🗑</Round>
              </div>
            ))}
          </div>
        </div>

        {/* ---------- השלף ---------- */}
        <div style={{ flex: "1 1 auto", minWidth: 240, alignSelf: "stretch" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(102px, 1fr))", gap: 10 }}>
            {activities.map((a) => {
              const room = !done && hasRoom(a);
              const blockedBy = a.after && !placements.some((p) => p.actId === a.after);
              return (
                <div key={a.id} className="tile"
                  onPointerDown={(e) => room && startDrag(e, a.id, a.min, null)}
                  style={{
                    background: a.color, borderRadius: 16, padding: "12px 8px", textAlign: "center",
                    opacity: room ? 1 : 0.32, position: "relative",
                    boxShadow: room ? "0 4px 0 rgba(0,0,0,.3)" : "none",
                    cursor: room ? "grab" : "default",
                  }}>
                  <div style={{ fontSize: 38, lineHeight: 1 }}>{a.icon}</div>
                  <div style={{ fontSize: 15, color: "#fff", marginTop: 6 }}>{a.label}</div>
                  {a.screen && screenBudget > 0 && (
                    <div style={{ position: "absolute", top: 4, left: 6, fontSize: 13 }}>
                      ⭐{Math.max(0, screenBudget - screenUsed)}
                    </div>
                  )}
                  {blockedBy && !done && act(a.after) && (
                    <div style={{ position: "absolute", top: 4, right: 6, fontSize: 15 }}>{act(a.after).icon}</div>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 13, opacity: 0.5, marginTop: 12, lineHeight: 1.6 }}>
            גוררים אריח אל הפס. נגיעה על בלוק פותחת ＋ － 🗑
          </p>
        </div>
      </div>

      {/* רוח רפאים של הגרירה */}
      {dragView && act(dragView.actId) && (
        <div style={{
          position: "fixed", top: dragView.y - dragView.dy, left: dragView.x - dragView.dx,
          width: dragView.w, height: dragView.len * SLOT_H - 3, pointerEvents: "none", zIndex: 50,
          borderRadius: 12, background: act(dragView.actId).color, opacity: 0.92,
          boxShadow: "0 10px 20px rgba(0,0,0,.45)", transform: "scale(1.06)",
          display: "flex", alignItems: "center", gap: 8, padding: "0 10px", boxSizing: "border-box",
        }}>
          <span style={{ fontSize: Math.min(30, dragView.len * SLOT_H - 14) }}>{act(dragView.actId).icon}</span>
          <span style={{ fontSize: 15, color: "#fff" }}>{act(dragView.actId).label}</span>
        </div>
      )}

      {done && (
        <div className="pop" style={{
          position: "fixed", inset: 0, background: "rgba(23,35,63,.82)", zIndex: 60,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
        }}>
          <div style={{ fontSize: 84 }}>🎉</div>
          <div style={{ fontSize: 30 }}>התוכנית שלי מוכנה</div>
          <button onClick={() => commit(placements, false)} style={{
            background: C.paper, color: C.ink, border: "none",
            borderRadius: 999, padding: "12px 26px", fontSize: 18,
          }}>✏️ לשנות משהו</button>
          {/* גם כשהתוכנית נעולה ההורה צריך דרך להיכנס להגדרות */}
          <button onClick={onOpenParent} aria-label="הגדרות הורה" style={{
            background: "transparent", border: "none", color: C.paper,
            fontSize: 20, opacity: 0.3, marginTop: 8, cursor: "pointer",
          }}>⚙️</button>
        </div>
      )}
    </div>
  );
}

function Round({ children, onClick, bg = "#22315a" }) {
  return (
    <button onClick={onClick} style={{
      width: 40, height: 40, borderRadius: 999, border: "2px solid rgba(255,246,230,.35)",
      background: bg, color: "#fff6e6", fontSize: 20, lineHeight: 1,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{children}</button>
  );
}
