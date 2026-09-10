import React, { useState, useRef } from "react";

/* ============================================================
   שער ה-PIN. בכניסה הראשונה ההורה קובע קוד (הקלדה כפולה),
   ומכאן והלאה הקוד נדרש כדי להיכנס להגדרות.
   הקוד נשמר על המכשיר בלבד — הוא נועד לעצור ילד, לא תוקף.
   ============================================================ */

const C = { ink: "#17233f", inkSoft: "#22315a", paper: "#fff6e6" };

export default function PinGate({ pin, onUnlock, onSetPin, onCancel }) {
  const setup = !pin;
  const [entry, setEntry] = useState("");
  const [first, setFirst] = useState(null); // בהקמה: הקוד מהמסך הראשון
  const entryRef = useRef(""); // הקשה מהירה יכולה להקדים את עדכון ה-state
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(0);

  const write = (v) => { entryRef.current = v; setEntry(v); };

  const fail = (msg) => {
    setErr(msg);
    write("");
    setShake((n) => n + 1);
    try { navigator.vibrate?.(70); } catch (e) {}
  };

  const submit = (code) => {
    if (setup) {
      if (first == null) { setFirst(code); write(""); setErr(""); return; }
      if (code !== first) { setFirst(null); fail("הקודים לא זהים, ננסה שוב"); return; }
      onSetPin(code);
      return;
    }
    if (code === pin) onUnlock();
    else fail("קוד שגוי");
  };

  const push = (d) => {
    if (entryRef.current.length >= 4) return;
    const next = entryRef.current + d;
    setErr("");
    write(next);
    if (next.length === 4) setTimeout(() => submit(next), 120);
  };

  const title = setup
    ? (first == null ? "בחר קוד הורה" : "שוב, לאימות")
    : "קוד הורה";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(23,35,63,.94)", zIndex: 100,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 18, fontFamily: "'Varela Round', system-ui, sans-serif", color: C.paper, padding: 20,
    }}>
      <style>{`
        @keyframes pinNope { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-9px)} 75%{transform:translateX(9px)} }
        .pinNope { animation: pinNope .3s ease-in-out; }
        .pinKey { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
      `}</style>

      <div style={{ fontSize: 30 }}>🔒</div>
      <div style={{ fontSize: 22 }}>{title}</div>
      {setup && first == null && (
        <div style={{ fontSize: 13, opacity: 0.6, maxWidth: 280, textAlign: "center", lineHeight: 1.6 }}>
          הקוד נשמר על המכשיר הזה בלבד ומגן על ההגדרות מפני שינוי בטעות
        </div>
      )}

      <div key={"dots" + shake} className={shake ? "pinNope" : ""} style={{ display: "flex", gap: 14, margin: "6px 0" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: 999,
            border: `2px solid ${C.paper}`,
            background: i < entry.length ? C.paper : "transparent",
          }} />
        ))}
      </div>

      <div style={{ minHeight: 20, fontSize: 14, color: "#ff9d9d" }}>{err}</div>

      {/* ספרות לא מתהפכות ב-RTL — לוח מקשים נומרי נקרא תמיד משמאל לימין */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 74px)", gap: 12, direction: "ltr" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <Key key={d} onClick={() => push(String(d))}>{d}</Key>
        ))}
        <Key onClick={onCancel} bg="transparent" size={17}>ביטול</Key>
        <Key onClick={() => push("0")}>0</Key>
        <Key onClick={() => { write(entryRef.current.slice(0, -1)); setErr(""); }} bg="transparent" size={20}>⌫</Key>
      </div>
    </div>
  );
}

function Key({ children, onClick, bg = "#22315a", size = 26 }) {
  return (
    <button className="pinKey" onClick={onClick} style={{
      width: 74, height: 62, borderRadius: 16, border: `2px solid rgba(255,246,230,.3)`,
      background: bg, color: "#fff6e6", fontSize: size, fontFamily: "inherit",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{children}</button>
  );
}
